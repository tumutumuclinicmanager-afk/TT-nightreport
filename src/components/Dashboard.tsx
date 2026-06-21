import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { NightReport, CMOComment } from '../types/report';
import { generateSingleShiftPDF } from '../utils/pdfGenerator';
import { getCurrentShiftDate } from '../utils/reportDefaults';
import { 
  Calendar as CalendarIcon, 
  Search, 
  Filter, 
  FileText, 
  CheckCircle2, 
  FileEdit, 
  Activity, 
  MessageCircle, 
  Plus, 
  User, 
  Eye, 
  Send,
  AlertCircle,
  ChevronRight,
  Download,
  Layers,
  FileSpreadsheet
} from 'lucide-react';

interface DashboardProps {
  user: any;
  userRole: 'supervisor' | 'admin';
  onSelectDate: (date: string, editMode: boolean) => void;
  onRefreshTrigger: number;
  onOpenBatchExport?: () => void;
}

export default function Dashboard({ user, userRole, onSelectDate, onRefreshTrigger, onOpenBatchExport }: DashboardProps) {
  const [reports, setReports] = useState<NightReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<NightReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'submitted'>('all');
  const [selectedReportForView, setSelectedReportForView] = useState<NightReport | null>(null);
  
  // Comments state
  const [newCommentText, setNewCommentText] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  // Calendar dates generation
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June (0-indexed represents June as 5, actually local time in metadata says 2026-06-18)

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  useEffect(() => {
    fetchReports();
  }, [onRefreshTrigger]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'nightReports'), orderBy('date', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetched: NightReport[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push(doc.data() as NightReport);
      });
      setReports(fetched);
    } catch (err) {
      console.error("Error retrieving reports (likely offline persistent mode active):", err);
    } finally {
      setLoading(false);
    }
  };

  // Run filter logic on query changes
  useEffect(() => {
    let result = [...reports];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.date.includes(q) || 
        r.nightSuperName.toLowerCase().includes(q) ||
        (r.generalRemarks && r.generalRemarks.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter);
    }

    setFilteredReports(result);
  }, [reports, searchQuery, statusFilter]);

  // Handle addition of CMO administrative comments
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedReportForView) return;

    setIsSavingComment(true);
    const newComment: CMOComment = {
      id: `comment-${Date.now()}`,
      commenterName: user.displayName || 'Chief Medical Officer / Admin',
      commenterRole: userRole === 'admin' ? 'Chief Medical Director' : 'Supervisor',
      commentText: newCommentText.trim(),
      timestamp: new Date().toISOString()
    };

    const updatedComments = [...(selectedReportForView.cmoComments || []), newComment];

    try {
      const docRef = doc(db, 'nightReports', selectedReportForView.date);
      await updateDoc(docRef, {
        cmoComments: updatedComments
      });

      // Log audit
      try {
        const logId = `${selectedReportForView.date}_comment_${Date.now()}_${user.uid}`;
        const logRef = doc(db, 'auditLogs', logId);
        await setDoc(logRef, {
          id: logId,
          reportDate: selectedReportForView.date,
          timestamp: new Date().toISOString(),
          userId: user.uid,
          userEmail: user.email || '',
          userDisplayName: user.displayName || 'Authorized Reviewer',
          userRole: userRole,
          modifiedFields: ['cmoComments'],
          action: 'comment',
          details: `Added new review comment under report ${selectedReportForView.date}.`
        });
      } catch (logErr) {
        console.warn("Failed to write audit log for comment:", logErr);
      }

      // Update local state arrays
      setSelectedReportForView(prev => prev ? { ...prev, cmoComments: updatedComments } : null);
      setReports(prev => prev.map(r => r.date === selectedReportForView.date ? { ...r, cmoComments: updatedComments } : r));
      setNewCommentText('');
    } catch (err) {
      console.error("Failed to post comment to Firestore:", err);
      alert("Error: Unable to submit commentary. Please check connection.");
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleExportCSV = async () => {
    if (filteredReports.length === 0) {
      alert("No reports available to export with the current filters.");
      return;
    }

    const headers = [
      "Shift Date",
      "Night Superintendent",
      "Status",
      "Submitted At",
      "OPD Attendance",
      "Total Ward Patients (Sum)",
      "ICU Patients",
      "HDU Patients",
      "Ward 1 Patients",
      "Ward 2 Patients",
      "Ward 3 Medical Patients",
      "Ward 3 Gyn-Surg Patients",
      "Ward 3 Paeds Patients",
      "Ward 4 Antenatal Patients",
      "Ward 4 Postnatal Patients",
      "Ward 4 Post CS Patients",
      "Ward 5 Patients",
      "Ward 6 Patients",
      "Ward 7 Surgical Patients",
      "Ward 7 Gynae Patients",
      "Ward 7 Medical Patients",
      "Shalom Patients",
      "NBU Patients",
      "Total Admissions (Sum)",
      "Admission Ward 1",
      "Admission Ward 2",
      "Admission Ward 3",
      "Admission Ward 4",
      "Admission Ward 5",
      "Admission Ward 6",
      "Admission Ward 7",
      "Admission Shalom",
      "Admission NBU",
      "Transfer In",
      "Transfer Out",
      "Emergency CS",
      "Trauma RTA",
      "Trauma Assaults",
      "Morgue Start",
      "Morgue Admissions",
      "Radiology X-Ray",
      "Radiology Ultrasound",
      "Radiology CT Scan",
      "Total Deaths",
      "Deceased Records Summary",
      "Total Incidents",
      "Incident Logs Summary",
      "Total Deliveries",
      "Deliveries Summary",
      "Total Blood Transfusion Units",
      "Blood Transfusions Summary",
      "Total Major Procedures",
      "Major Procedures Summary",
      "Stockout & Equipment Notes",
      "Staffing Notes",
      "General Shift Remarks",
      "CMO Review Comments Count",
      "Review Commentaries Summary"
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '';
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    const rows = filteredReports.map(report => {
      const stats = report.patientStats || {} as any;
      const sumPatients = 
        (stats.hdu || 0) + (stats.icu || 0) + (stats.ward1 || 0) + (stats.ward2 || 0) + 
        (stats.ward5 || 0) + (stats.ward6 || 0) + (stats.shalom || 0) + (stats.nbu || 0) + 
        (stats.ward3SurgGyn || 0) + (stats.ward3Medical || 0) + (stats.ward3Paeds || 0) + 
        (stats.ward4Antenatal || 0) + (stats.ward4Postnatal || 0) + (stats.ward4PostCS || 0) + 
        (stats.ward7Surgical || 0) + (stats.ward7Gynae || 0) + (stats.ward7Medical || 0);

      const adms = report.admissions || {} as any;
      const sumAdms = 
        (adms.ward1 || 0) + (adms.ward2 || 0) + (adms.ward3 || 0) + (adms.ward4 || 0) + 
        (adms.ward5 || 0) + (adms.ward6 || 0) + (adms.ward7 || 0) + (adms.shalom || 0) + (adms.nbu || 0);

      const emg = report.emergencies || {} as any;
      const mrg = report.morgue || {} as any;
      const rad = report.radiology || {} as any;

      const deathSummary = (report.deaths || []).map(d => `${d.patientName} (${d.patientId || 'No ID'}) in ${d.ward} at ${d.time || 'N/A'}: ${d.cause || 'N/A'}`).join('; ');
      const incidentSummary = (report.incidents || []).map(i => `[${i.category.toUpperCase()}] ${i.details}`).join('; ');
      const deliverySummary = (report.deliveries || []).map(del => `${del.motherName}: ${del.deliveryType} -> ${del.outcome} (${del.babyGender || 'Gender unknown'} at ${del.time || 'N/A'})`).join('; ');
      const totalBloodUnits = (report.bloodTransfusions || []).reduce((sum, b) => sum + (b.units || 0), 0);
      const transfusionSummary = (report.bloodTransfusions || []).map(b => `${b.patientName} (${b.ward || 'N/A'}): ${b.units} units due to ${b.indication || 'N/A'}`).join('; ');
      const procedureSummary = (report.majorProcedures || []).map(p => `${p.patientName}: ${p.procedureName} by ${p.surgeon || 'N/A'} (Outcome: ${p.outcome || 'N/A'})`).join('; ');
      const reviewsSummary = (report.cmoComments || []).map(c => `${c.commenterName} (${c.commenterRole}): ${c.commentText}`).join('; ');

      return [
        report.date,
        report.nightSuperName,
        report.status,
        report.submittedAt || '',
        report.opdAttendance || 0,
        sumPatients,
        stats.icu || 0,
        stats.hdu || 0,
        stats.ward1 || 0,
        stats.ward2 || 0,
        stats.ward3Medical || 0,
        stats.ward3SurgGyn || 0,
        stats.ward3Paeds || 0,
        stats.ward4Antenatal || 0,
        stats.ward4Postnatal || 0,
        stats.ward4PostCS || 0,
        stats.ward5 || 0,
        stats.ward6 || 0,
        stats.ward7Surgical || 0,
        stats.ward7Gynae || 0,
        stats.ward7Medical || 0,
        stats.shalom || 0,
        stats.nbu || 0,
        sumAdms,
        adms.ward1 || 0,
        adms.ward2 || 0,
        adms.ward3 || 0,
        adms.ward4 || 0,
        adms.ward5 || 0,
        adms.ward6 || 0,
        adms.ward7 || 0,
        adms.shalom || 0,
        adms.nbu || 0,
        adms.transferIn || 0,
        adms.transferOut || 0,
        emg.emCS || 0,
        emg.traumaRta || 0,
        emg.traumaAssaults || 0,
        mrg.startOfShift || 0,
        mrg.shiftAdmissions || 0,
        rad.xray || 0,
        rad.ultrasound || 0,
        rad.ctScan || 0,
        (report.deaths || []).length,
        deathSummary,
        (report.incidents || []).length,
        incidentSummary,
        (report.deliveries || []).length,
        deliverySummary,
        totalBloodUnits,
        transfusionSummary,
        (report.majorProcedures || []).length,
        procedureSummary,
        report.stockOuts || '',
        report.staffingNotes || '',
        report.generalRemarks || '',
        (report.cmoComments || []).length,
        reviewsSummary
      ].map(escapeCSV);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tumutumu_hospital_reports_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    try {
      const logId = `csv_export_${Date.now()}_${user?.uid || 'guest'}`;
      await setDoc(doc(db, 'auditLogs', logId), {
        id: logId,
        reportDate: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        userId: user?.uid || 'guest',
        userEmail: user?.email || '',
        userDisplayName: user?.displayName || 'Clinical Management Reviewer',
        userRole: userRole,
        modifiedFields: ['csvExport'],
        action: 'comment',
        details: `Exported ${filteredReports.length} filtered night reports to CSV for external data analysis.`
      });
    } catch (auditErr) {
      console.warn("Failed to save audit log for CSV export", auditErr);
    }
  };

  // Pre-calculate mapped dates of reports for fast calendar dots lookups
  const getMapReportOnDate = (dateStr: string) => {
    return reports.find(r => r.date === dateStr);
  };

  // Generate calendar days
  const getDaysInMonth = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    const days = [];
    
    // Fill empty offset blocks at start of month
    const startOffset = date.getDay();
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    while (date.getMonth() === month) {
      days.push(new Date(date));
      date.setDate(date.getDate() + 1);
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentYear, currentMonth);

  return (
    <div className="space-y-8 font-sans">
      
      {/* Search and Filters Hub */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        
        <div className="w-full md:w-auto flex-1">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-400 h-4.5 w-4.5" />
            <input
              type="text"
              placeholder="Search reports by date, superintendent name, or remark keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-4 py-2.5 w-full bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 w-full md:w-auto shrink-0">
          <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-3 bg-slate-50">
            <Filter className="text-slate-400 h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-xs font-semibold bg-transparent border-0 focus:ring-0 text-slate-700 py-2 cursor-pointer outline-none"
            >
              <option value="all">Display All Reports</option>
              <option value="draft">Draft (Unsubmitted)</option>
              <option value="submitted">Submitted (Locked)</option>
            </select>
          </div>

          {onOpenBatchExport && (
            <button
              onClick={onOpenBatchExport}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-220 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              title="Batch export multiple night reports as high-quality PDFs"
            >
              <Layers className="h-4 w-4 text-teal-600" />
              <span>Batch PDF Export</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-220 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Export currently filtered list of shift reports in CSV format for spreadsheet analysis"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {userRole === 'supervisor' && (
            <button
              onClick={() => {
                const shiftDate = getCurrentShiftDate();
                onSelectDate(shiftDate, true);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-teal-500/10 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              File Today's Shift
            </button>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Calendar & Aggregations */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Calendar selector view */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <CalendarIcon className="h-4.5 w-4.5 text-teal-600" />
                Shift Calendar
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (currentMonth === 0) {
                      setCurrentMonth(11);
                      setCurrentYear(prev => prev - 1);
                    } else {
                      setCurrentMonth(prev => prev - 1);
                    }
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                >
                  &larr;
                </button>
                <span className="text-xs font-bold text-slate-700 font-mono">
                  {monthNames[currentMonth]} {currentYear}
                </span>
                <button
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentMonth(0);
                      setCurrentYear(prev => prev + 1);
                    } else {
                      setCurrentMonth(prev => prev + 1);
                    }
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                >
                  &rarr;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
              <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((dateObj, idx) => {
                if (!dateObj) return <div key={`empty-${idx}`} />;
                
                const dateStr = dateObj.toISOString().split('T')[0];
                const matchedReport = getMapReportOnDate(dateStr);
                const hasDraft = matchedReport && matchedReport.status === 'draft';
                const hasSubmitted = matchedReport && matchedReport.status === 'submitted';

                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      if (matchedReport) {
                        setSelectedReportForView(matchedReport);
                      } else if (userRole === 'supervisor') {
                        onSelectDate(dateStr, true);
                      } else {
                        alert("No night report filed yet for: " + dateStr);
                      }
                    }}
                    className={`h-10 text-xs font-semibold rounded-lg flex flex-col items-center justify-between py-1 transition-all relative cursor-pointer ${
                      hasSubmitted ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      hasDraft ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-slate-50 hover:bg-slate-100 text-slate-400 border border-transparent'
                    }`}
                  >
                    <span>{dateObj.getDate()}</span>
                    {matchedReport && (
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        hasSubmitted ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 border-t pt-4 flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 block" />
                Submitted Shift
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded bg-amber-50 text-amber-700 border border-amber-200 block" />
                Draft Saved
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Reports list / Active detail inspection */}
        <div className="lg:col-span-2 space-y-6">
          
          {selectedReportForView ? (
            <div className="bg-white border rounded-2xl shadow-sm border-slate-200 overflow-hidden">
              
              {/* Report mini inspect Header */}
              <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                <div>
                  <div className="text-[10px] bg-teal-500/10 text-teal-300 font-bold tracking-widest uppercase border border-teal-500/25 px-2 py-0.5 rounded-full inline-block">
                    Shift Report View Mode
                  </div>
                  <h3 className="text-base font-bold font-display mt-1 tracking-tight">
                    Night Report for {selectedReportForView.date}
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5 font-medium">
                    Lodged by: <span className="font-bold text-teal-200">{selectedReportForView.nightSuperName}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateSingleShiftPDF(selectedReportForView, user.displayName || 'PCEA Clinical Auditor')}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-sky-500/10 active:scale-95 cursor-pointer"
                    id="btn-download-pdf-report"
                    title="Download fully audited shift report PDF"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                  {selectedReportForView.status === 'draft' && userRole === 'supervisor' && (
                    <button
                      onClick={() => onSelectDate(selectedReportForView.date, true)}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <FileEdit className="h-3.5 w-3.5" />
                      Edit Draft
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedReportForView(null)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded transition-all cursor-pointer font-semibold uppercase"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Main parameters review grids */}
              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto no-scrollbar">
                
                {/* 1. Statistics Grid summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">OPD Patients</span>
                    <span className="text-lg font-bold font-mono text-slate-800">{selectedReportForView.opdAttendance || 0}</span>
                  </div>
                  <div className="bg-slate-50 border p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">ICU / HDU</span>
                    <span className="text-lg font-bold font-mono text-slate-800">
                      {(selectedReportForView.patientStats?.icu || 0) + (selectedReportForView.patientStats?.hdu || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-50 border p-3 rounded-xl">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Deliveries</span>
                    <span className="text-lg font-bold font-mono text-emerald-700">{selectedReportForView.deliveries?.length || 0}</span>
                  </div>
                  <div className="bg-rose-50/40 border border-rose-100 p-3 rounded-xl">
                    <span className="text-[10px] text-rose-500 font-bold uppercase block">Deceased Clients</span>
                    <span className="text-lg font-bold font-mono text-rose-700">{selectedReportForView.deaths?.length || 0}</span>
                  </div>
                </div>

                {/* 2. Mortalities */}
                {selectedReportForView.deaths && selectedReportForView.deaths.length > 0 && (
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                      <AlertCircle className="h-4.5 w-4.5" />
                      Mortality Audit Records
                    </h4>
                    <div className="border border-rose-100 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-rose-50 font-bold text-rose-900 border-b">
                          <tr>
                            <th className="p-2">Patient</th>
                            <th className="p-2">Ward</th>
                            <th className="p-2">Cause Of Death</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y bg-rose-50/10 font-medium">
                          {selectedReportForView.deaths.map(d => (
                            <tr key={d.id}>
                              <td className="p-2 font-bold">{d.patientName} ({d.patientId})</td>
                              <td className="p-2">{d.ward}</td>
                              <td className="p-2 text-rose-700">{d.cause} at {d.time}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Incidents */}
                {selectedReportForView.incidents && selectedReportForView.incidents.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide">Significant Shift Incidents</h4>
                    <ul className="space-y-1.5">
                      {selectedReportForView.incidents.map(inc => (
                        <li key={inc.id} className="bg-amber-50/30 border border-amber-100 p-2.5 rounded-lg text-xs leading-relaxed text-slate-700 font-medium">
                          <span className="font-bold text-amber-800 uppercase mr-1 inline-block bg-amber-100 px-1.5 py-0.5 rounded text-[9px]">{inc.category}</span>
                          {inc.details}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Transfusions & procedures lists */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  {/* Blood transfusions */}
                  <div className="bg-slate-50 border p-4.5 rounded-xl space-y-2">
                    <h5 className="font-bold text-slate-900">Blood Transfusions Logs</h5>
                    {selectedReportForView.bloodTransfusions && selectedReportForView.bloodTransfusions.length > 0 ? (
                      <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                        {selectedReportForView.bloodTransfusions.map(b => (
                          <li key={b.id}>{b.patientName} ({b.ward}): <b>{b.units} Units</b> - {b.indication}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-slate-400 italic">No transfusions reported.</p>
                    )}
                  </div>

                  {/* Major procedures */}
                  <div className="bg-slate-50 border p-4.5 rounded-xl space-y-2">
                    <h5 className="font-bold text-slate-900">Emergency Surgical Procedures</h5>
                    {selectedReportForView.majorProcedures && selectedReportForView.majorProcedures.length > 0 ? (
                      <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                        {selectedReportForView.majorProcedures.map(m => (
                          <li key={m.id}>{m.patientName}: {m.procedureName} (Surgeon: {m.surgeon})</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-slate-400 italic">No procedures logged.</p>
                    )}
                  </div>
                </div>

                {/* 5. General qualitative remarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-500 block uppercase">Stockout & Equipments Status</span>
                    <p className="bg-slate-50 p-3 rounded-lg text-slate-700 italic border">{selectedReportForView.stockOuts || "None logged."}</p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-500 block uppercase">Superintendent Shift Summary</span>
                    <p className="bg-teal-50/20 p-3 rounded-lg text-slate-700 border border-teal-100">{selectedReportForView.generalRemarks || "None supplied."}</p>
                  </div>
                </div>

                {/* 6. digital sign preview */}
                {selectedReportForView.digitalSignature && (
                  <div className="border-t pt-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Approved & Digitally Validated By</span>
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-28 bg-slate-50 border rounded-lg flex items-center justify-center p-1">
                        <img src={selectedReportForView.digitalSignature} className="max-h-full max-w-full" alt="Validation Signature" />
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-slate-950">{selectedReportForView.nightSuperName}</div>
                        <div className="text-slate-400 text-[10px]">Supervisor • Filed digitally</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. CLINICAL MANAGEMENT REMARKS / COMMENTS ENGINE */}
                <div className="border-t pt-5 space-y-4">
                  <h4 className="text-xs font-bold text-teal-800 uppercase tracking-widest flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Clinical commentaries & Matron reviews
                  </h4>

                  {selectedReportForView.cmoComments && selectedReportForView.cmoComments.length > 0 ? (
                    <ul className="space-y-3">
                      {selectedReportForView.cmoComments.map(comment => (
                        <li key={comment.id} className="bg-teal-50/20 border border-teal-100/45 p-3 rounded-xl text-xs space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-semibold text-teal-800">
                            <span>{comment.commenterName} ({comment.commenterRole})</span>
                            <span className="text-slate-400 font-mono">{new Date(comment.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-700 font-medium">{comment.commentText}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 font-medium">No reviews or management guidelines added to this report yet.</p>
                  )}

                  {/* Add Administrative comment if Admin (or anyone in test sandbox) */}
                  <form onSubmit={handleAddComment} className="flex gap-2 items-start mt-3">
                    <textarea
                      rows={1.5}
                      required
                      placeholder="CMO/Admin: Type audit outcome remarks, instructions, or notes here..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="flex-grow p-2 w-full text-xs border rounded-xl bg-slate-50"
                    />
                    <button
                      type="submit"
                      disabled={isSavingComment || !newCommentText.trim()}
                      className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl py-2 px-3 shrink-0 self-center cursor-pointer transition-all hover:scale-105"
                      title="Post Comment"
                    >
                      {isSavingComment ? (
                        <div className="border-2 border-white border-t-transparent animate-spin h-4 w-4 rounded-full" />
                      ) : (
                        <Send className="h-4.5 w-4.5" />
                      )}
                    </button>
                  </form>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white border rounded-2xl border-slate-100 shadow-sm p-6 space-y-4 text-center">
              <Eye className="h-10 w-10 text-slate-300 mx-auto animate-bounce" />
              <div>
                <h4 className="text-sm font-bold text-slate-700">Audit Desk & Inspection Glass</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Select any active date from the shift calendar to check full statistical logs, mortality forms, or review CMO Comments.
                </p>
              </div>

              {/* Simple grid list of recent reports */}
              <div className="border-t pt-4 space-y-2.5 text-left text-xs max-h-72 overflow-y-auto no-scrollbar">
                <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block">Recent Logs</span>
                {reports.length > 0 ? (
                  reports.slice(0, 5).map(rep => (
                    <div 
                      key={rep.date} 
                      onClick={() => setSelectedReportForView(rep)}
                      className="flex justify-between items-center p-3 border rounded-xl hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-950 font-mono block">{rep.date}</div>
                        <div className="text-slate-400 text-[10px]">Supervisor: {rep.nightSuperName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rep.status === 'submitted' ? (
                          <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide">
                            Submitted
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-800 border border-amber-100 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide">
                            Draft
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 italic font-medium text-center py-2">No shift logs on file.</p>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
