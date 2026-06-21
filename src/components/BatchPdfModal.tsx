import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { NightReport } from '../types/report';
import { generateSingleShiftPDF, generateConsolidatedBatchPDF } from '../utils/pdfGenerator';
import { 
  X, 
  Calendar, 
  Download, 
  FileText, 
  Layers, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

interface BatchPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

export default function BatchPdfModal({ isOpen, onClose, user }: BatchPdfModalProps) {
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default to last 7 days
    return d.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]; // Default to today
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reports, setReports] = useState<NightReport[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [activeDownloadMode, setActiveDownloadMode] = useState<'consolidated' | 'individual' | null>(null);

  // Clear states when opening/closing
  useEffect(() => {
    if (isOpen) {
      setReports([]);
      setHasSearched(false);
      setErrorMessage('');
      setSuccessMessage('');
      setActiveDownloadMode(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Fetch
  const handleFetchReports = async () => {
    if (!startDate || !endDate) {
      setErrorMessage('Please select both start and end dates.');
      return;
    }

    if (startDate > endDate) {
      setErrorMessage('The start date must be earlier than or equal to the end date.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setReports([]);

    try {
      // Query all nightReports sorted by date
      const q = query(collection(db, 'nightReports'), orderBy('date', 'asc'));
      const querySnapshot = await getDocs(q);
      
      const allFetched: NightReport[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as NightReport;
        allFetched.push(data);
      });

      // Filter in range [startDate, endDate]
      const filtered = allFetched.filter(r => r.date >= startDate && r.date <= endDate);
      
      setReports(filtered);
      setHasSearched(true);
      if (filtered.length === 0) {
        setErrorMessage('No submitted night shift reports found in this date range.');
      } else {
        setSuccessMessage(`Successfully fetched ${filtered.length} submitted night shift report(s).`);
      }
    } catch (err: any) {
      console.error('Failed to fetch reports for batch generation:', err);
      // Fallback: check localStorage for matching drafts
      const localFalls: NightReport[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pcea_draft_')) {
          try {
            const dataStr = localStorage.getItem(key);
            if (dataStr) {
              const report = JSON.parse(dataStr) as NightReport;
              if (report.date >= startDate && report.date <= endDate) {
                localFalls.push(report);
              }
            }
          } catch {
            // Ignore corrupted local storage items
          }
        }
      }

      if (localFalls.length > 0) {
        setReports(localFalls.sort((a,b) => a.date.localeCompare(b.date)));
        setHasSearched(true);
        setSuccessMessage(`Offline Cache: Loaded ${localFalls.length} draft shift reports from local storage.`);
      } else {
        setErrorMessage(`Unable to retrieve records: ${err.message || 'Check your internet connection.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger individual PDF downloads sequentially
  const handleBatchDownloadIndividual = async () => {
    if (reports.length === 0) return;
    setActiveDownloadMode('individual');
    
    // Download reports sequentially with a small delay to avoid browser blocking multiple downloads
    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      generateSingleShiftPDF(r, user?.displayName || 'Clinical Auditor');
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    setActiveDownloadMode(null);
  };

  // Consolidated PDF portfolio download
  const handleConsolidatedExport = () => {
    if (reports.length === 0) return;
    setActiveDownloadMode('consolidated');
    
    try {
      generateConsolidatedBatchPDF(
        reports, 
        startDate, 
        endDate, 
        user?.displayName || 'Clinical Operations Auditor'
      );
    } catch (err: any) {
      setErrorMessage(`Export failed: ${err.message || 'An error occurred during generation.'}`);
    } finally {
      setActiveDownloadMode(null);
    }
  };

  // Helper stats inside the selected batch
  const totalOPD = reports.reduce((acc, r) => acc + (r.opdAttendance || 0), 0);
  const totalDeliveries = reports.reduce((acc, r) => acc + (r.deliveries?.length || 0), 0);
  const totalDeaths = reports.reduce((acc, r) => acc + (r.deaths?.length || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 p-4" id="batch-pdf-modal-container">
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-900/40 dark:to-slate-900 border-b border-teal-500/20 px-6 py-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-teal-200" />
            <div>
              <h3 className="text-sm font-bold text-slate-50 dark:text-slate-100">Batch PDF Export Portal</h3>
              <p className="text-[10px] text-teal-100 dark:text-slate-400 font-medium">Generate professionally-styled clinical audit dossiers</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
            title="Close modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Date range inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
              <div className="relative">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-220 dark:border-slate-820 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 outline-none text-slate-800 dark:text-slate-100 transition-colors"
                />
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
              <div className="relative">
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950/60 border border-slate-220 dark:border-slate-820 rounded-xl focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 outline-none text-slate-800 dark:text-slate-100 transition-colors"
                />
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Action trigger to search database with selected dates */}
          <button
            type="button"
            onClick={handleFetchReports}
            disabled={isLoading}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/10 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Querying Cloud Archives...
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                Query Shift Records
              </>
            )}
          </button>

          {/* Status Message center */}
          {errorMessage && (
            <div className="bg-rose-50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-450 p-3.5 rounded-xl flex gap-2.5 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-teal-50 dark:bg-teal-950/15 border border-teal-100 dark:border-teal-900/30 text-teal-800 dark:text-teal-400 p-3.5 rounded-xl flex gap-2.5 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-teal-505" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Search outcomes list if found reports */}
          {hasSearched && reports.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              
              {/* Aggregate quick facts summary */}
              <div className="bg-slate-50 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 p-4 rounded-2xl grid grid-cols-3 gap-2 text-center">
                <div className="p-1">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Reports</p>
                  <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">{reports.length}</p>
                </div>
                <div className="border-l border-r border-slate-200 dark:border-slate-800 p-1">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Deliveries</p>
                  <p className="text-base font-extrabold text-teal-600 dark:text-teal-400">{totalDeliveries}</p>
                </div>
                <div className="p-1">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Mortality</p>
                  <p className="text-base font-extrabold text-rose-600 dark:text-rose-400">{totalDeaths}</p>
                </div>
              </div>

              {/* Action layout selectors */}
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Choose Output Compilation Format</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Option A: Consolidated */}
                  <button
                    type="button"
                    onClick={handleConsolidatedExport}
                    disabled={activeDownloadMode !== null}
                    className="p-4 border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500/50 bg-slate-50/40 hover:bg-teal-50/10 dark:bg-transparent rounded-2xl flex flex-col items-center text-center gap-2 group transition-all text-xs font-semibold cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <Layers className="h-6 w-6 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="text-slate-805 dark:text-slate-100 font-bold">Consolidated Portfolio</p>
                      <p className="text-[10px] text-slate-400 mt-1 dark:text-slate-500 leading-normal">Combines all shifts chronologically into a single multi-page PDF with executive cover dashboard stats.</p>
                    </div>
                    {activeDownloadMode === 'consolidated' && (
                      <Loader2 className="h-3 w-3 animate-spin text-teal-600 mt-1" />
                    )}
                  </button>

                  {/* Option B: Individual sequential download */}
                  <button
                    type="button"
                    onClick={handleBatchDownloadIndividual}
                    disabled={activeDownloadMode !== null}
                    className="p-4 border border-slate-200 dark:border-slate-800 hover:border-sky-500 dark:hover:border-sky-500/50 bg-slate-50/40 hover:bg-sky-50/10 dark:bg-transparent rounded-2xl flex flex-col items-center text-center gap-2 group transition-all text-xs font-semibold cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <Download className="h-6 w-6 text-sky-600 dark:text-sky-455 group-hover:scale-110 transition-transform" />
                    <div>
                      <p className="text-slate-805 dark:text-slate-100 font-bold">Separate Shift Files</p>
                      <p className="text-[10px] text-slate-400 mt-1 dark:text-slate-500 leading-normal">Triggers consecutive individual downloads for each shift date separately with branded headers.</p>
                    </div>
                    {activeDownloadMode === 'individual' && (
                      <Loader2 className="h-3 w-3 animate-spin text-sky-600 mt-1" />
                    )}
                  </button>

                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-slate-50 dark:bg-slate-950/40 border-t border-slate-105 dark:border-slate-850 px-6 py-4 flex justify-between items-center text-[10px] text-slate-400">
          <span>Clinical Informatics Division • PCEA</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl font-bold text-slate-550 dark:text-slate-350 transition-all cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
