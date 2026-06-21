import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { NightReport, DeathRecord, IncidentRecord, DeliveryRecord, BloodTransfusion, MajorProcedure, CMOComment } from '../types/report';
import { createEmptyReport, getCurrentShiftDate } from '../utils/reportDefaults';
import { getReportDiff } from '../utils/auditLogger';
import { 
  Save, 
  CheckCircle, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  Signature, 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  Flame, 
  Clock, 
  Heart, 
  MessageSquare, 
  RefreshCcw 
} from 'lucide-react';

interface ReportFormProps {
  user: any;
  userRole: 'supervisor' | 'admin';
  initialDate?: string;
  onSaved: () => void;
  existingReport?: NightReport | null;
}

export default function ReportForm({ user, userRole, initialDate, onSaved, existingReport }: ReportFormProps) {
  // Setup the report state
  const todayStr = initialDate || getCurrentShiftDate();
  
  const [draftRestored, setDraftRestored] = useState<boolean>(false);
  const [draftRestoredTime, setDraftRestoredTime] = useState<string>('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);

  const [report, setReport] = useState<NightReport>(() => {
    const localDraftStr = localStorage.getItem(`pcea_draft_${todayStr}`);
    if (localDraftStr) {
      try {
        const parsed = JSON.parse(localDraftStr);
        if (parsed && parsed.date === todayStr) {
          if (existingReport) {
            const lTime = new Date(parsed.updatedAt || 0).getTime();
            const eTime = new Date(existingReport.updatedAt || 0).getTime();
            if (lTime > eTime) {
              return parsed;
            }
          } else {
            return parsed;
          }
        }
      } catch (err) {
        console.error("Failed to parse local draft copy:", err);
      }
    }
    if (existingReport) {
      return existingReport;
    }
    return createEmptyReport(todayStr, user.displayName || 'Sister In-Charge', user.uid);
  });
  const [baseReport, setBaseReport] = useState<NightReport | null>(existingReport || null);

  const [activeFormTab, setActiveFormTab] = useState<'stats' | 'admissions' | 'emergency_morgue' | 'procedures' | 'critical' | 'submit'>('stats');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'dirty' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Local additions states
  const [tempDeath, setTempDeath] = useState<Omit<DeathRecord, 'id'>>({ patientName: '', patientId: '', ward: 'Ward 1', time: '12:00 AM', cause: '' });
  const [tempIncident, setTempIncident] = useState<Omit<IncidentRecord, 'id'>>({ category: 'infrastructure', details: '' });
  const [tempDelivery, setTempDelivery] = useState<Omit<DeliveryRecord, 'id'>>({ motherName: '', deliveryType: 'Normal SVD', outcome: 'Live Birth', babyGender: 'Female', time: '12:00 AM' });
  const [tempBlood, setTempBlood] = useState<Omit<BloodTransfusion, 'id'>>({ patientName: '', ward: 'Ward 1', units: 1, indication: '' });
  const [tempProcedure, setTempProcedure] = useState<Omit<MajorProcedure, 'id'>>({ patientName: '', procedureName: '', surgeon: '', outcome: 'Stable' });

  // Canvas ref for signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Check draft restore state on component mount
  useEffect(() => {
    const localDraftStr = localStorage.getItem(`pcea_draft_${todayStr}`);
    if (localDraftStr) {
      try {
        const parsed = JSON.parse(localDraftStr);
        if (parsed && parsed.date === todayStr) {
          if (existingReport) {
            const lTime = new Date(parsed.updatedAt || 0).getTime();
            const eTime = new Date(existingReport.updatedAt || 0).getTime();
            if (lTime > eTime) {
              setDraftRestored(true);
              setDraftRestoredTime(new Date(parsed.updatedAt || "").toLocaleTimeString());
            }
          } else {
            setDraftRestored(true);
            setDraftRestoredTime(new Date(parsed.updatedAt || "").toLocaleTimeString());
          }
        }
      } catch (err) {
        console.error("Draft checking failed on mount:", err);
      }
    }
  }, [todayStr, existingReport]);

  // Handle discarding restored draft
  const handleDiscardRestoredDraft = () => {
    setShowDiscardConfirm(true);
  };

  const confirmDiscardRestoredDraft = () => {
    localStorage.removeItem(`pcea_draft_${todayStr}`);
    setDraftRestored(false);
    setShowDiscardConfirm(false);
    setReport(existingReport || createEmptyReport(todayStr, user.displayName || 'Sister In-Charge', user.uid));
    setSaveStatus('saved');
  };

  // Keep localStorage sync when report changes
  useEffect(() => {
    if (report && report.status === 'draft') {
      localStorage.setItem(`pcea_draft_${report.date}`, JSON.stringify(report));
    }
  }, [report]);

  // Load existing report or sync if prop changes
  useEffect(() => {
    if (existingReport) {
      setBaseReport(existingReport);
      // Only set report if local draft hasn't overridden it (or is older)
      const localDraftStr = localStorage.getItem(`pcea_draft_${todayStr}`);
      let shouldOverride = true;
      if (localDraftStr) {
        try {
          const parsed = JSON.parse(localDraftStr);
          if (parsed && parsed.date === todayStr) {
            const lTime = new Date(parsed.updatedAt || 0).getTime();
            const eTime = new Date(existingReport.updatedAt || 0).getTime();
            if (lTime > eTime) {
              shouldOverride = false;
            }
          }
        } catch (e) {}
      }
      if (shouldOverride) {
        setReport(existingReport);
      }
      
      setTimeout(() => {
        if (canvasRef.current && (existingReport.digitalSignature || report.digitalSignature)) {
          loadSignatureOnCanvas(shouldOverride ? existingReport.digitalSignature : report.digitalSignature);
        }
      }, 100);
    } else {
      setBaseReport(null);
      const localDraftStr = localStorage.getItem(`pcea_draft_${todayStr}`);
      if (!localDraftStr) {
        setReport(createEmptyReport(todayStr, user.displayName || 'Sister In-Charge', user.uid));
        clearCanvas();
      }
    }
  }, [existingReport, todayStr, user]);

  const loadSignatureOnCanvas = (sigData: string) => {
    if (!sigData || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      if (canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = sigData;
  };

  // Draw signature pad functionality
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const isDark = document.documentElement.classList.contains('dark');
    ctx.strokeStyle = isDark ? '#38bdf8' : '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Auto-reload the signature from state if active
    if (report && report.digitalSignature) {
      loadSignatureOnCanvas(report.digitalSignature);
    }
  }, [activeFormTab]);

  const startSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.strokeStyle = isDark ? '#38bdf8' : '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    setIsDrawing(true);
    const pos = getMousePos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getMousePos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setSaveStatus('dirty');
  };

  const stopSignature = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Save signature to base64
    if (canvasRef.current) {
      const dataUri = canvasRef.current.toDataURL();
      updateField('digitalSignature', dataUri);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateField('digitalSignature', '');
    setSaveStatus('dirty');
  };

  const getMousePos = (canvas: HTMLCanvasElement, evt: any) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Automatic autosave every 30 seconds if form is dirty and not submitted
  useEffect(() => {
    const autosaveTimer = setInterval(() => {
      if (saveStatus === 'dirty' && report.status === 'draft') {
        saveReportToDb();
      }
    }, 30000);

    return () => clearInterval(autosaveTimer);
  }, [report, saveStatus]);

  // Handle standard input updates
  const updateField = (field: keyof NightReport, value: any) => {
    setReport(prev => ({
      ...prev,
      [field]: value,
      updatedAt: new Date().toISOString()
    }));
    setSaveStatus('dirty');
  };

  const updateNestedField = (section: 'patientStats' | 'admissions' | 'emergencies' | 'morgue' | 'radiology', field: string, val: string | number) => {
    const numericVal = typeof val === 'string' && val === '' ? null : Number(val);
    if (numericVal !== null && (isNaN(numericVal) || numericVal < 0)) return; // Prevent negative inputs

    setReport(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: numericVal
      },
      updatedAt: new Date().toISOString()
    }));
    setSaveStatus('dirty');
  };

  // List adding helpers
  const appendDeath = () => {
    if (!tempDeath.patientName || !tempDeath.cause) {
      alert("Please provide the Patient Name and Cause of Death.");
      return;
    }
    const newRecord: DeathRecord = {
      ...tempDeath,
      id: `death-${Date.now()}`
    };
    updateField('deaths', [...report.deaths, newRecord]);
    setTempDeath({ patientName: '', patientId: '', ward: 'Ward 1', time: '12:00 AM', cause: '' });
  };

  const removeDeath = (id: string) => {
    updateField('deaths', report.deaths.filter(d => d.id !== id));
  };

  const appendIncident = () => {
    if (!tempIncident.details) {
      alert("Please capture incident details before adding.");
      return;
    }
    const newRecord: IncidentRecord = {
      ...tempIncident,
      id: `incident-${Date.now()}`
    };
    updateField('incidents', [...report.incidents, newRecord]);
    setTempIncident({ category: 'infrastructure', details: '' });
  };

  const removeIncident = (id: string) => {
    updateField('incidents', report.incidents.filter(i => i.id !== id));
  };

  const appendDelivery = () => {
    if (!tempDelivery.motherName) {
      alert("Please provide the Mother's Name.");
      return;
    }
    const newRecord: DeliveryRecord = {
      ...tempDelivery,
      id: `delivery-${Date.now()}`
    };
    updateField('deliveries', [...report.deliveries, newRecord]);
    setTempDelivery({ motherName: '', deliveryType: 'Normal SVD', outcome: 'Live Birth', babyGender: 'Female', time: '12:00 AM' });
  };

  const removeDelivery = (id: string) => {
    updateField('deliveries', report.deliveries.filter(d => d.id !== id));
  };

  const appendBlood = () => {
    if (!tempBlood.patientName || !tempBlood.units || !tempBlood.indication) {
      alert("Provide patient name, units, and indication.");
      return;
    }
    const newRecord: BloodTransfusion = {
      ...tempBlood,
      id: `transfusion-${Date.now()}`
    };
    updateField('bloodTransfusions', [...report.bloodTransfusions, newRecord]);
    setTempBlood({ patientName: '', ward: 'Ward 1', units: 1, indication: '' });
  };

  const removeBlood = (id: string) => {
    updateField('bloodTransfusions', report.bloodTransfusions.filter(b => b.id !== id));
  };

  const appendProcedure = () => {
    if (!tempProcedure.patientName || !tempProcedure.procedureName) {
      alert("Please insert patient name and procedure name.");
      return;
    }
    const newRecord: MajorProcedure = {
      ...tempProcedure,
      id: `proc-${Date.now()}`
    };
    updateField('majorProcedures', [...report.majorProcedures, newRecord]);
    setTempProcedure({ patientName: '', procedureName: '', surgeon: '', outcome: 'Stable' });
  };

  const removeProcedure = (id: string) => {
    updateField('majorProcedures', report.majorProcedures.filter(m => m.id !== id));
  };

  // Perform Firestore save
  const saveReportToDb = async (overridingStatus?: 'draft' | 'submitted') => {
    setSaveStatus('saving');
    setErrorMessage('');
    
    // Auto-update deaths during shift if deaths record is added, matching morgue stats
    let finalMorgue = { ...report.morgue };
    if (report.deaths.length > 0) {
      finalMorgue.shiftAdmissions = report.deaths.length;
    }

    const payload: NightReport = {
      ...report,
      morgue: finalMorgue,
      status: overridingStatus || report.status,
      updatedAt: new Date().toISOString(),
      submittedAt: overridingStatus === 'submitted' ? new Date().toISOString() : report.submittedAt || ''
    };

    try {
      // Calculate changes using local baseReport state (avoiding slow, redundant database getDoc calls)
      const oldReport = baseReport;
      const changedFields = getReportDiff(oldReport, payload);

      const dbPromises: Promise<any>[] = [
        setDoc(doc(db, 'nightReports', payload.date), payload)
      ];

      if (changedFields.length > 0) {
        const logId = `${payload.date}_edit_${Date.now()}_${user.uid}`;
        const logRef = doc(db, 'auditLogs', logId);
        dbPromises.push(
          setDoc(logRef, {
            id: logId,
            reportDate: payload.date,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            userEmail: user.email || '',
            userDisplayName: user.displayName || 'Sister In-Charge',
            userRole: userRole,
            modifiedFields: changedFields,
            action: oldReport ? 'update' : 'create',
            details: `Report for ${payload.date} ${oldReport ? 'updated' : 'created'} with status '${payload.status}'. Modified: ${changedFields.join(', ')}.`
          })
        );
      }

      // Execute database writes concurrently to minimize network roundtrips
      await Promise.all(dbPromises);

      // Save payload as baseReport for future saves
      setBaseReport(payload);

      if (payload.status === 'submitted') {
        localStorage.removeItem(`pcea_draft_${payload.date}`);
        setDraftRestored(false);
      }
      setReport(payload);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString());
      return true;
    } catch (err: any) {
      console.error(err);
      setSaveStatus('error');
      setErrorMessage("Offline Storage Sync Pending: System cached draft locally.");
      return false;
    }
  };

  // Handle ultimate shift submit
  const handleFinalSubmit = async () => {
    // Basic verification: Make sure name and signature are completed
    if (!report.nightSuperName) {
      alert("Please fill out Night Superintendent Name.");
      return;
    }
    if (!report.digitalSignature) {
      alert("Digital signature is required to officialize this report. Sign in the canvas field under step 5.");
      setActiveFormTab('submit');
      setShowSubmitModal(false);
      return;
    }

    setIsSubmitting(true);
    const ok = await saveReportToDb('submitted');
    setIsSubmitting(false);
    
    if (ok) {
      setShowSubmitModal(false);
      alert("Night report for " + report.date + " submitted successfully to Chief Medical Officer!");
      onSaved();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans transition-all duration-350">
      
      {/* Form header & status indicator */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-cyan-900 px-6 py-6 text-white relative">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <div className="text-teal-300 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
              Clinical Shift Documentation
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-display mt-1">
              Night Superintendent Report
            </h2>
            <p className="text-slate-300 text-xs mt-1">
              For ward operations, clinical censuses, deaths, and incidents.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Save Status Banner */}
            <div className="flex items-center gap-2 bg-black/25 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${
                saveStatus === 'saved' ? 'bg-emerald-400 animate-pulse' :
                saveStatus === 'saving' ? 'bg-amber-400 animate-spin' :
                saveStatus === 'dirty' ? 'bg-sky-400' : 'bg-rose-400'
              }`} />
              <span className="font-semibold text-slate-100">
                {saveStatus === 'saved' && `Synced (Last saved: ${lastSavedTime || 'Just now'})`}
                {saveStatus === 'saving' && 'Saving draft...'}
                {saveStatus === 'dirty' && 'Unsaved modifications'}
                {saveStatus === 'error' && 'Cached (Offline Active)'}
              </span>
              {saveStatus === 'dirty' && (
                <button 
                  onClick={() => saveReportToDb()}
                  className="ml-2 hover:text-white text-teal-300 transition-colors cursor-pointer"
                  title="Manual Save"
                >
                  <Save className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-200 flex gap-2">
              <span>Shift Date:</span>
              <span className="font-semibold text-teal-200">{report.date}</span>
            </div>
          </div>
        </div>
      </div>

      {draftRestored && (
        <div className="bg-teal-50 dark:bg-teal-950/20 border-b border-teal-100 dark:border-teal-900/30 px-6 py-3 transition-colors">
          {showDiscardConfirm ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                <span>Are you sure? This will permanently delete your locally saved modifications for this shift.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 text-slate-750 dark:text-slate-350 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-all text-[11px] font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDiscardRestoredDraft}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all text-[11px] font-bold shadow-sm cursor-pointer"
                >
                  Yes, Discard Draft
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-teal-805 dark:text-teal-300">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse shrink-0" />
                <span>
                  Restored draft copy from local auto-save {draftRestoredTime ? ` (last change at ${draftRestoredTime})` : ''}. Your progress is saved automatically.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDiscardRestoredDraft}
                className="px-2.5 py-1 bg-teal-100/60 hover:bg-rose-100/80 dark:bg-slate-850 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-lg transition-all text-[11px] font-bold border border-rose-200/40 cursor-pointer shrink-0"
              >
                Discard Draft & Reset
              </button>
            </div>
          )}
        </div>
      )}

      {/* Accordion / Tab selectors for clean viewport split on mobile */}
      <div className="flex bg-slate-50 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 overflow-x-auto no-scrollbar py-1 px-3 transition-colors">
        {[
          { key: 'stats', label: '1. Patient Stats' },
          { key: 'admissions', label: '2. Admissions' },
          { key: 'emergency_morgue', label: '3. Emer & Morgue' },
          { key: 'procedures', label: '4. Clinical Procedures' },
          { key: 'critical', label: '5. Critical Logs' },
          { key: 'submit', label: '6. Sign & Submit' }
        ].map(item => (
          <button
            key={item.key}
            onClick={() => setActiveFormTab(item.key as any)}
            className={`whitespace-nowrap px-4 py-2.5 text-xs font-semibold rounded-lg m-0.5 transition-all cursor-pointer ${
              activeFormTab === item.key
                ? 'bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-400 shadow-sm border border-slate-150 dark:border-slate-700/50'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {report.status === 'submitted' && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border-y border-amber-100 dark:border-amber-900/40 px-6 py-3 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-medium transition-colors">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          This report is already submitted and locked. Saving new stats is disabled, but Administrators/CMO may add administrative remarks in comments.
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/20 px-6 py-2.5 border-b border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-medium transition-colors">
          {errorMessage}
        </div>
      )}

      <div className="p-6">
        
        {/* -- SECTION 1: Patient Stats -- */}
        {activeFormTab === 'stats' && (
          <div className="space-y-6">
            <div className="bg-teal-50 border border-teal-100/40 p-4 rounded-xl flex items-center gap-3">
              <Activity className="text-teal-600 h-6 w-6" />
              <div>
                <h4 className="text-sm font-bold text-teal-800">1. Patients Census Statistics</h4>
                <p className="text-[11px] text-teal-700/80 mt-0.5">
                  Input the number of active hospitalized patients in each ward at shift commencement.
                </p>
              </div>
            </div>

            {/* General OPD */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-w-sm">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                OPD Attendance (7:00 PM to 6:00 AM)
              </label>
              <input
                type="number"
                disabled={report.status === 'submitted'}
                value={report.opdAttendance || ''}
                placeholder="0"
                onChange={(e) => updateField('opdAttendance', e.target.value === '' ? null : Number(e.target.value))}
                className="mt-1.5 w-full bg-white px-3 py-2 border border-slate-200 rounded-xl font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* ICU HDU block */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-0.5 font-bold rounded-full border border-rose-100">
                  Critical Care Units
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold uppercase">ICU</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.icu || ''}
                      onChange={(e) => updateNestedField('patientStats', 'icu', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold uppercase">HDU</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.hdu || ''}
                      onChange={(e) => updateNestedField('patientStats', 'hdu', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Standard single Wards block */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-xs bg-teal-50 text-teal-700 px-2.5 py-0.5 font-bold rounded-full border border-teal-100">
                  General In-Patient Wards
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {[
                    { key: 'ward1', label: 'Ward 1' },
                    { key: 'ward2', label: 'Ward 2' },
                    { key: 'ward5', label: 'Ward 5' },
                    { key: 'ward6', label: 'Ward 6' },
                    { key: 'shalom', label: 'Shalom' },
                    { key: 'nbu', label: 'NBU' }
                  ].map(w => (
                    <div key={w.key}>
                      <label className="block text-xs text-slate-500 font-semibold uppercase">{w.label}</label>
                      <input
                        type="number"
                        disabled={report.status === 'submitted'}
                        value={(report.patientStats as any)[w.key] || ''}
                        onChange={(e) => updateNestedField('patientStats', w.key, e.target.value)}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-tier Wards: Ward 3 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-xs bg-cyan-50 text-cyan-700 px-2.5 py-0.5 font-bold rounded-full border border-cyan-100">
                  Ward 3 Segregations
                </span>
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Surgical / Gynae</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward3SurgGyn || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward3SurgGyn', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Medical</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward3Medical || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward3Medical', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Paediatrics</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward3Paeds || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward3Paeds', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Ward 4: Maternal / Obstetric */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 font-bold rounded-full border border-indigo-100">
                  Ward 4 Maternal Care
                </span>
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Antenatal</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward4Antenatal || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward4Antenatal', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Postnatal</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward4Postnatal || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward4Postnatal', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Post C/S (Maternity)</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward4PostCS || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward4PostCS', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Ward 7 */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-0.5 font-bold rounded-full border border-amber-100">
                  Ward 7 Segregations
                </span>
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Surgical</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward7Surgical || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward7Surgical', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Gynae</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward7Gynae || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward7Gynae', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold uppercase">Medical</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.patientStats.ward7Medical || ''}
                      onChange={(e) => updateNestedField('patientStats', 'ward7Medical', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -- SECTION 2: Admissions & Transfers -- */}
        {activeFormTab === 'admissions' && (
          <div className="space-y-6">
            <div className="bg-cyan-50 border border-cyan-100/40 p-4 rounded-xl flex items-center gap-3">
              <Plus className="text-cyan-600 h-6 w-6" />
              <div>
                <h4 className="text-sm font-bold text-cyan-800">2. Admissions & Ward Transfers</h4>
                <p className="text-[11px] text-cyan-700/80 mt-0.5">
                  Record new night admissions directly logging onto specific units, plus hospital transitions. All default to zero if empty.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Admissions to Wards */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 md:col-span-2">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  New Night Admissions per Ward
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
                  {[
                    { key: 'ward1', label: 'Ward 1' },
                    { key: 'ward2', label: 'Ward 2' },
                    { key: 'ward3', label: 'Ward 3' },
                    { key: 'ward4', label: 'Ward 4' },
                    { key: 'ward5', label: 'Ward 5' },
                    { key: 'ward6', label: 'Ward 6' },
                    { key: 'ward7', label: 'Ward 7' },
                    { key: 'shalom', label: 'Shalom Ward' },
                    { key: 'nbu', label: 'New Born Unit' }
                  ].map(w => (
                    <div key={w.key}>
                      <label className="block text-xs text-slate-500 font-semibold">{w.label}</label>
                      <input
                        type="number"
                        disabled={report.status === 'submitted'}
                        value={(report.admissions as any)[w.key] || ''}
                        onChange={(e) => updateNestedField('admissions', w.key, e.target.value)}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white focus:ring-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Transfers & Critical Admissions */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Transfers & Critical Admissions
                </h5>
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold">HDU/ICU Admissions</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.admissions.hduIcu || ''}
                      onChange={(e) => updateNestedField('admissions', 'hduIcu', e.target.value)}
                      className="mt-1.5 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold">Total Transfer In</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.admissions.transferIn || ''}
                      onChange={(e) => updateNestedField('admissions', 'transferIn', e.target.value)}
                      className="mt-1.5 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 font-semibold">Total Transfer Out</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.admissions.transferOut || ''}
                      onChange={(e) => updateNestedField('admissions', 'transferOut', e.target.value)}
                      className="mt-1.5 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -- SECTION 3: Emergencies, Morgue, Radiology -- */}
        {activeFormTab === 'emergency_morgue' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Emergencies */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b pb-2">
                  <h4 className="text-sm font-bold text-slate-900">3A. Emergencies Lodged</h4>
                  <p className="text-[11px] text-slate-400">Total urgent emergencies presented during shift.</p>
                </div>
                <div className="space-y-3 font-medium">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Trauma RTA</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.emergencies.traumaRta || ''}
                      onChange={(e) => updateNestedField('emergencies', 'traumaRta', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Trauma Assaults</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.emergencies.traumaAssaults || ''}
                      onChange={(e) => updateNestedField('emergencies', 'traumaAssaults', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">EM C/S (Emergency Caesarean)</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.emergencies.emCS || ''}
                      onChange={(e) => updateNestedField('emergencies', 'emCS', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Morgue */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b pb-2">
                  <h4 className="text-sm font-bold text-slate-900">3B. Morgue (Leech) Census</h4>
                  <p className="text-[11px] text-slate-400">Morgue census registers and shift deaths admissions.</p>
                </div>
                <div className="space-y-3 font-medium">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Clients at start of shift</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.morgue.startOfShift || ''}
                      onChange={(e) => updateNestedField('morgue', 'startOfShift', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Admissions (Deaths registered)*</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        disabled={true} // Auto synchronized from deaths array logs to enforce zero error
                        value={report.deaths.length}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-100 text-slate-600 font-bold"
                      />
                      <span className="text-[10px] text-teal-600 shrink-0 mt-1 uppercase font-bold">Auto-Logged</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Others / BID (Brought-In-Dead)</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.morgue.others || ''}
                      onChange={(e) => updateNestedField('morgue', 'others', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Radiology */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="border-b pb-2">
                  <h4 className="text-sm font-bold text-slate-900">3C. Radiology Department</h4>
                  <p className="text-[11px] text-slate-400">Total imaging metrics performed during night shift.</p>
                </div>
                <div className="space-y-3 font-medium">
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">X-Rays</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.radiology.xray || ''}
                      onChange={(e) => updateNestedField('radiology', 'xray', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">Ultrasounds</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.radiology.get_ultrasounds || report.radiology.ultrasound || ''}
                      onChange={(e) => updateNestedField('radiology', 'ultrasound', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 uppercase">CT Scans</label>
                    <input
                      type="number"
                      disabled={report.status === 'submitted'}
                      value={report.radiology.ctScan || ''}
                      onChange={(e) => updateNestedField('radiology', 'ctScan', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-slate-50 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* -- SECTION 4: Deliveries and Clinical Procedures -- */}
        {activeFormTab === 'procedures' && (
          <div className="space-y-8">
            
            {/* Blood Transfusions Log */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="border-b pb-2">
                <h4 className="text-sm font-bold text-slate-900">4A. Blood Transfusions Log</h4>
                <p className="text-xs text-slate-400">Track transfused units and active indications.</p>
              </div>

              {report.status !== 'submitted' && (
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block">Patient Name</label>
                    <input
                      type="text"
                      placeholder="Jane Koech"
                      value={tempBlood.patientName}
                      onChange={(e) => setTempBlood(prev => ({ ...prev, patientName: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Ward</label>
                    <select
                      value={tempBlood.ward}
                      onChange={(e) => setTempBlood(prev => ({ ...prev, ward: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    >
                      {['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4 (Maternity)', 'Ward 5', 'Ward 6', 'Ward 7', 'Shalom'].map(wardName => (
                        <option key={wardName} value={wardName}>{wardName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Units</label>
                    <input
                      type="number"
                      placeholder="1"
                      min={1}
                      value={tempBlood.units}
                      onChange={(e) => setTempBlood(prev => ({ ...prev, units: Math.max(1, Number(e.target.value)) }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="font-bold text-slate-600 block">Indication / Notes</label>
                      <input
                        type="text"
                        placeholder="Anaemia secondary to Hb drop"
                        value={tempBlood.indication}
                        onChange={(e) => setTempBlood(prev => ({ ...prev, indication: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={appendBlood}
                      className="h-8 bg-teal-600 hover:bg-teal-700 text-white px-3.5 rounded font-bold transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {report.bloodTransfusions.length > 0 ? (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2.5">Patient Name</th>
                        <th className="p-2.5">Ward</th>
                        <th className="p-2.5 text-center">Units</th>
                        <th className="p-2.5">Indication</th>
                        {report.status !== 'submitted' && <th className="p-2.5 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-medium">
                      {report.bloodTransfusions.map(b => (
                        <tr key={b.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">{b.patientName}</td>
                          <td className="p-2.5">{b.ward}</td>
                          <td className="p-2 text-center">{b.units}</td>
                          <td className="p-2.5">{b.indication}</td>
                          {report.status !== 'submitted' && (
                            <td className="p-1.5 text-center">
                              <button
                                onClick={() => removeBlood(b.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mx-auto" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No blood transfusions recorded.</p>
              )}
            </div>

            {/* Major Procedures Log */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="border-b pb-2">
                <h4 className="text-sm font-bold text-slate-900">4B. Major Procedures / Night Surgeries</h4>
                <p className="text-xs text-slate-400">Record emergency procedures performed in the main and maternity theaters.</p>
              </div>

              {report.status !== 'submitted' && (
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block">Patient Name</label>
                    <input
                      type="text"
                      placeholder="Jane Doe"
                      value={tempProcedure.patientName}
                      onChange={(e) => setTempProcedure(prev => ({ ...prev, patientName: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Procedure Name</label>
                    <input
                      type="text"
                      placeholder="Appendicial Torsion ectomy"
                      value={tempProcedure.procedureName}
                      onChange={(e) => setTempProcedure(prev => ({ ...prev, procedureName: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Surgeon</label>
                    <input
                      type="text"
                      placeholder="Dr. Kamau"
                      value={tempProcedure.surgeon}
                      onChange={(e) => setTempProcedure(prev => ({ ...prev, surgeon: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="font-bold text-slate-600 block">Outcome / Remarks</label>
                      <input
                        type="text"
                        placeholder="Successful, stable."
                        value={tempProcedure.outcome}
                        onChange={(e) => setTempProcedure(prev => ({ ...prev, outcome: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={appendProcedure}
                      className="h-8 bg-teal-600 hover:bg-teal-700 text-white px-3.5 rounded font-bold transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {report.majorProcedures.length > 0 ? (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2.5">Patient Name</th>
                        <th className="p-2.5">Active Procedure</th>
                        <th className="p-2.5">Surgeon Assigned</th>
                        <th className="p-2.5">Outcome</th>
                        {report.status !== 'submitted' && <th className="p-2.5 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-medium">
                      {report.majorProcedures.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">{m.patientName}</td>
                          <td className="p-2.5">{m.procedureName}</td>
                          <td className="p-2.5">{m.surgeon}</td>
                          <td className="p-2.5">{m.outcome}</td>
                          {report.status !== 'submitted' && (
                            <td className="p-1.5 text-center">
                              <button
                                onClick={() => removeProcedure(m.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mx-auto" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No major surgical procedures recorded during this shift.</p>
              )}
            </div>

          </div>
        )}

        {/* -- SECTION 5: Critical Event Logs and Deliveries -- */}
        {activeFormTab === 'critical' && (
          <div className="space-y-8">
            
            {/* Maternal Deliveries Log */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="border-b pb-2">
                <h4 className="text-sm font-bold text-slate-900">5A. Shift Deliveries (Maternity Logs)</h4>
                <p className="text-xs text-slate-400 font-medium">Detailed roster of births registered on shift.</p>
              </div>

              {report.status !== 'submitted' && (
                <div className="bg-slate-50 p-4 rounded-lg grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 block">Mother Name</label>
                    <input
                      type="text"
                      placeholder="Ruth Wambui"
                      value={tempDelivery.motherName}
                      onChange={(e) => setTempDelivery(prev => ({ ...prev, motherName: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Delivery Type</label>
                    <select
                      value={tempDelivery.deliveryType}
                      onChange={(e) => setTempDelivery(prev => ({ ...prev, deliveryType: e.target.value as any }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="Normal SVD">Normal SVD</option>
                      <option value="C/S">Caesarean Section</option>
                      <option value="Breech">Breech Delivery</option>
                      <option value="Assisted">Assisted Delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Gender</label>
                    <select
                      value={tempDelivery.babyGender}
                      onChange={(e) => setTempDelivery(prev => ({ ...prev, babyGender: e.target.value as any }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Outcome</label>
                    <select
                      value={tempDelivery.outcome}
                      onChange={(e) => setTempDelivery(prev => ({ ...prev, outcome: e.target.value as any }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="Live Birth">Live Birth</option>
                      <option value="Stillbirth">Stillbirth</option>
                      <option value="Neonatal Death">Neonatal Death</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2 col-span-2 sm:col-span-1">
                    <div className="flex-1">
                      <label className="font-bold text-slate-600 block">Time</label>
                      <input
                        type="text"
                        placeholder="e.g. 02:40 AM"
                        value={tempDelivery.time}
                        onChange={(e) => setTempDelivery(prev => ({ ...prev, time: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={appendDelivery}
                      className="h-8 bg-teal-600 hover:bg-teal-700 text-white px-3.5 rounded font-bold transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {report.deliveries.length > 0 ? (
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b">
                      <tr>
                        <th className="p-2.5">Mother's Name</th>
                        <th className="p-2.5">Delivery Style</th>
                        <th className="p-2.5 text-center">Newborn Gender</th>
                        <th className="p-2.5">Clinical Outcome</th>
                        <th className="p-2.5">Time</th>
                        {report.status !== 'submitted' && <th className="p-2.5 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-medium">
                      {report.deliveries.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5">{d.motherName}</td>
                          <td className="p-2.5">{d.deliveryType}</td>
                          <td className="p-2.5 text-center">{d.babyGender}</td>
                          <td className="p-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                              d.outcome === 'Live Birth' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                              {d.outcome}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono">{d.time}</td>
                          {report.status !== 'submitted' && (
                            <td className="p-1.5 text-center">
                              <button
                                onClick={() => removeDelivery(d.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mx-auto" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No maternal deliveries recorded during this shift.</p>
              )}
            </div>

            {/* Mortalities / Deaths Log - Critical Metric */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="border-b pb-2 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">5B. Mortalities / Deaths Log</h4>
                  <p className="text-xs text-slate-400">Detailed logs of deaths validated on the shift layout.</p>
                </div>
                <div className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1 font-bold rounded-lg uppercase">
                  Total Deaths: {report.deaths.length}
                </div>
              </div>

              {report.status !== 'submitted' && (
                <div className="bg-rose-50/30 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs border border-rose-100/50">
                  <div>
                    <label className="font-bold text-slate-600 block">Deceased Patient Name</label>
                    <input
                      type="text"
                      placeholder="Sister Wangari"
                      value={tempDeath.patientName}
                      onChange={(e) => setTempDeath(prev => ({ ...prev, patientName: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">IP / File ID</label>
                    <input
                      type="text"
                      placeholder="IP-4289"
                      value={tempDeath.patientId}
                      onChange={(e) => setTempDeath(prev => ({ ...prev, patientId: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 block">Ward Location</label>
                    <select
                      value={tempDeath.ward}
                      onChange={(e) => setTempDeath(prev => ({ ...prev, ward: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white focus:border-rose-500"
                    >
                      {['Ward 1', 'Ward 2', 'Ward 3', 'Ward 4', 'Ward 5', 'Ward 6', 'Ward 7', 'ICU', 'HDU', 'NBU', 'Shalom'].map(wardName => (
                        <option key={wardName} value={wardName}>{wardName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="font-bold text-slate-600 block">Time & Direct Cause</label>
                      <input
                        type="text"
                        placeholder="03:20 AM - Sudden arrest, CPCR failed"
                        value={tempDeath.cause}
                        onChange={(e) => setTempDeath(prev => ({ ...prev, cause: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded px-2 py-1 bg-white focus:border-rose-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={appendDeath}
                      className="h-8 bg-rose-600 hover:bg-rose-700 text-white px-3.5 rounded font-bold transition-colors shrink-0 flex items-center justify-center cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {report.deaths.length > 0 ? (
                <div className="overflow-x-auto border border-rose-100 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-rose-50 text-rose-800 font-bold border-b border-rose-100">
                      <tr>
                        <th className="p-2.5">Deceased Name</th>
                        <th className="p-2.5">IP/File ID</th>
                        <th className="p-2.5">Ward</th>
                        <th className="p-2.5">Cause of Death / Time</th>
                        {report.status !== 'submitted' && <th className="p-2.5 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-medium">
                      {report.deaths.map(d => (
                        <tr key={d.id} className="hover:bg-rose-50/10">
                          <td className="p-2.5 font-bold text-slate-950">{d.patientName}</td>
                          <td className="p-2.5">{d.patientId}</td>
                          <td className="p-2.5">{d.ward}</td>
                          <td className="p-2.5">
                            <span className="text-rose-700 font-medium">{d.cause}</span>
                          </td>
                          {report.status !== 'submitted' && (
                            <td className="p-1.5 text-center">
                              <button
                                onClick={() => removeDeath(d.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4 mx-auto" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No mortalities recorded on this shift.</p>
              )}
            </div>

            {/* General Incidents / Infrastructure Logs */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="border-b pb-2">
                <h4 className="text-sm font-bold text-slate-900">5C. Infrastructure & Incidents Log</h4>
                <p className="text-xs text-slate-400">Capture technical blockages, central shortages, or administrative emergencies.</p>
              </div>

              {report.status !== 'submitted' && (
                <div className="bg-slate-50 p-4 rounded-lg flex flex-col sm:flex-row gap-3 text-xs items-end">
                  <div className="w-full sm:w-1/4">
                    <label className="font-bold text-slate-600 block">Incident Ward / Category</label>
                    <select
                      value={tempIncident.category}
                      onChange={(e) => setTempIncident(prev => ({ ...prev, category: e.target.value as any }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white font-semibold"
                    >
                      <option value="maternal">Maternal Incident</option>
                      <option value="neonatal">Neonatal Incident</option>
                      <option value="surgical">Surgical Incident</option>
                      <option value="infrastructure">Infrastructure Breakdown</option>
                      <option value="other">Other Occurrences</option>
                    </select>
                  </div>
                  <div className="flex-1 w-full">
                    <label className="font-bold text-slate-600 block flex-1">Details & Resolution Actions</label>
                    <input
                      type="text"
                      placeholder="Oxygen cylinders manifold drops or power shortages recorded summary."
                      value={tempIncident.details}
                      onChange={(e) => setTempIncident(prev => ({ ...prev, details: e.target.value }))}
                      className="mt-1 w-full border border-slate-200 rounded px-2.5 py-1.5 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={appendIncident}
                    className="h-8.5 bg-teal-600 hover:bg-teal-700 text-white px-4 rounded font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Log Incident
                  </button>
                </div>
              )}

              {report.incidents.length > 0 ? (
                <ul className="space-y-2.5">
                  {report.incidents.map(i => (
                    <li key={i.id} className="bg-amber-50/20 border border-amber-100 p-3 rounded-xl flex justify-between items-start text-xs text-slate-700">
                      <div className="space-y-1">
                        <span className="uppercase text-[9px] font-bold bg-amber-500/10 text-amber-800 border border-amber-200/30 px-2 py-0.5 rounded-full mr-2">
                          {i.category}
                        </span>
                        <span>{i.details}</span>
                      </div>
                      {report.status !== 'submitted' && (
                        <button
                          onClick={() => removeIncident(i.id)}
                          className="text-rose-500 hover:bg-rose-50 p-1 rounded hover:text-rose-700 ml-3 cursor-pointer"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 font-medium">No incidents or issues logged.</p>
              )}
            </div>

          </div>
        )}

        {/* -- SECTION 6: Remarks, Signature & CMO Commentary submission -- */}
        {activeFormTab === 'submit' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Other Logs & Notes fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Stock Outs / Equipment Issues
                  </label>
                  <textarea
                    rows={3}
                    disabled={report.status === 'submitted'}
                    value={report.stockOuts}
                    onChange={(e) => updateField('stockOuts', e.target.value)}
                    placeholder="List specific drugs, syringes, or machinery breakdowns..."
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Staffing Notes & Shortages
                  </label>
                  <textarea
                    rows={3}
                    disabled={report.status === 'submitted'}
                    value={report.staffingNotes}
                    onChange={(e) => updateField('staffingNotes', e.target.value)}
                    placeholder="Note roster delays, emergency leaves, or shifts overdues..."
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    General Remarks / Other Occurrences
                  </label>
                  <textarea
                    rows={4}
                    disabled={report.status === 'submitted'}
                    value={report.generalRemarks}
                    onChange={(e) => updateField('generalRemarks', e.target.value)}
                    placeholder="Comment on overall ward atmospheres, clinical responses..."
                    className="mt-1.5 block w-full border border-slate-200 rounded-xl p-3 text-sm bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Signature Canvas block */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex flex-col space-y-4">
                <div className="border-b pb-3 border-slate-200/65">
                  <h4 className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
                    <Signature className="h-5 w-5 text-teal-600" />
                    Shift Validation & Signature
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Draw signature on pad below. Authentic validation required for submissions.
                  </p>
                </div>

                <div className="relative border border-slate-300 rounded-xl bg-white overflow-hidden m-auto shadow-inner w-full max-w-sm">
                  {report.status !== 'submitted' ? (
                    <canvas
                      ref={canvasRef}
                      width={380}
                      height={160}
                      className="cursor-crosshair w-full"
                      onMouseDown={startSignature}
                      onMouseMove={drawSignature}
                      onMouseUp={stopSignature}
                      onMouseLeave={stopSignature}
                      onTouchStart={startSignature}
                      onTouchMove={drawSignature}
                      onTouchEnd={stopSignature}
                    />
                  ) : (
                    <div className="h-40 flex items-center justify-center bg-slate-50">
                      {report.digitalSignature ? (
                        <img 
                          src={report.digitalSignature} 
                          alt="digital-signature" 
                          className="max-h-full max-w-full italic" 
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">No signature supplied.</span>
                      )}
                    </div>
                  )}
                  
                  {report.status !== 'submitted' && (
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="absolute top-2 right-2 text-[10px] bg-slate-900 text-white font-bold px-2 py-1 rounded transition-colors hover:bg-rose-600 cursor-pointer"
                    >
                      Reset Pad
                    </button>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase">Superintendent Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Wangechi Sister In-Charge"
                      disabled={report.status === 'submitted'}
                      value={report.nightSuperName}
                      onChange={(e) => updateField('nightSuperName', e.target.value)}
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1 text-sm bg-white"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono flex justify-between pr-1">
                    <span>Authorized UID:</span>
                    <span className="font-bold text-slate-600">{user.uid.slice(0, 10)}...</span>
                  </div>
                </div>

                {report.status !== 'submitted' && (
                  <div className="pt-4 border-t border-slate-200 flex gap-3">
                    <button
                      type="button"
                      onClick={() => saveReportToDb()}
                      className="flex-1 h-10 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Save className="h-4 w-4" />
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSubmitModal(true)}
                      className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/15 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Submit Final Report
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* FOOTER NAV CONTROLS FOR TABS */}
      <div className="bg-slate-50 border-t px-6 py-4 flex justify-between items-center no-print">
        <button
          disabled={activeFormTab === 'stats'}
          onClick={() => {
            const tabs: any[] = ['stats', 'admissions', 'emergency_morgue', 'procedures', 'critical', 'submit'];
            const idx = tabs.indexOf(activeFormTab);
            if (idx > 0) setActiveFormTab(tabs[idx - 1]);
          }}
          className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">
          PCEA Tumutumu Hospital operations
        </span>

        <button
          disabled={activeFormTab === 'submit'}
          onClick={() => {
            const tabs: any[] = ['stats', 'admissions', 'emergency_morgue', 'procedures', 'critical', 'submit'];
            const idx = tabs.indexOf(activeFormTab);
            if (idx < tabs.length - 1) setActiveFormTab(tabs[idx + 1]);
          }}
          className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold hover:bg-teal-700 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
        >
          Next Step
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* FINAL SUBMIT DIALOG MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4 transition-all animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full border p-6 space-y-4 shadow-2xl relative">
            
            <div className="flex gap-3 leading-tight Items-center">
              <div className="h-10 w-10 bg-teal-100 rounded-full flex items-center justify-center text-teal-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Report End-submission</h3>
                <p className="text-xs text-slate-400 mt-0.5">Submit Night superintendent report to CMO & Director?</p>
              </div>
            </div>

            <div className="bg-slate-50 border p-3 rounded-lg text-xs text-slate-600 font-medium">
              <p>Once submitted, the stats layout becomes <b>locked and read-only</b> for further supervisor edits. The Chief Medical Officer and Matron will receive instant analytical reports of deaths, admissions, and emergency cases during your shift.</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2 border rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="border-2 border-white border-t-transparent animate-spin h-4 w-4 rounded-full" />
                ) : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
