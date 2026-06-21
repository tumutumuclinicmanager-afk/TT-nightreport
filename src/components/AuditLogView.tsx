import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Clock, User, Calendar, Shield, Search, Filter, RefreshCw, CheckCircle, HelpCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  reportDate: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userRole: string;
  modifiedFields: string[];
  action: 'create' | 'update' | 'comment';
  details: string;
}

export default function AuditLogView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Reset pagination when search, filter, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, actionFilter, itemsPerPage]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const logsRef = collection(db, 'auditLogs');
        const q = query(logsRef, orderBy('timestamp', 'desc'));
        const snap = await getDocs(q);
        
        const fetchedLogs: AuditLogEntry[] = [];
        snap.forEach((docSnap) => {
          fetchedLogs.push(docSnap.data() as AuditLogEntry);
        });
        setLogs(fetchedLogs);
      } catch (err) {
        console.error("Failed to fetch audit log stream:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [refreshTrigger]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.userDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.reportDate.includes(searchQuery) ||
      (log.details || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = 
      actionFilter === 'all' || 
      log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  // Pagination calculation
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  
  // Guard against currentPage going out of bounds
  const activePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show page 1
      pages.push(1);
      
      const start = Math.max(2, activePage - 1);
      const end = Math.min(totalPages - 1, activePage + 1);
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      // Always show last page
      pages.push(totalPages);
    }
    return pages;
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Created
          </span>
        );
      case 'update':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/30">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
            Updated
          </span>
        );
      case 'comment':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900/30">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
            Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-100">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Search & filters controls card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search user, email, report date or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
            />
          </div>

          <div className="relative w-full sm:w-48 shrink-0">
            <Filter className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white appearance-none"
            >
              <option value="all">All Change Types</option>
              <option value="create">Initial Submission</option>
              <option value="update">Edits & Modifications</option>
              <option value="comment">CMO/CNO Review Logs</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className="h-10 px-4 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer button-interactive"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Streams
        </button>
      </div>

      {/* Main Audit logs database list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-xl overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
            <span className="p-1.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 rounded-lg">
              <Shield className="h-5 w-5" />
            </span>
            System-Wide Clinical Audit Logs
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 dark:text-slate-400 leading-relaxed">
            Standard HIPAA-compliant registry log tracking report creations, corrections, and review commentary stamps.
          </p>
        </div>

        {loading ? (
          <div className="p-16 text-center space-y-4">
            <div className="h-10 w-10 border-4 border-teal-600 border-t-transparent animate-spin rounded-full mx-auto" />
            <p className="text-xs text-slate-450 dark:text-slate-550 font-semibold uppercase tracking-wider">Syncing Audit Trails...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 max-w-sm mx-auto space-y-3">
            <HelpCircle className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest">No Logs Found</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">No events found matching current filter parameters, or no logs have been written yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  <th className="py-4 px-6">Timestamp / Agent</th>
                  <th className="py-4 px-4 w-32">Shift date</th>
                  <th className="py-4 px-4 w-32">Event type</th>
                  <th className="py-4 px-4">Specific fields modified</th>
                  <th className="py-4 px-6">Descriptive Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans text-slate-700 dark:text-slate-300">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/30 transition-colors">
                    <td className="py-4.5 px-6">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-mono text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                            {log.userDisplayName ? log.userDisplayName[0].toUpperCase() : 'A'}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-150 leading-none block">
                              {log.userDisplayName}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block mt-0.5 max-w-44">
                              {log.userEmail}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Calendar className="h-3.5 w-3.5 text-teal-600/70" />
                        {log.reportDate}
                      </div>
                    </td>

                    <td className="py-4.5 px-4">{getActionBadge(log.action)}</td>

                    <td className="py-4.5 px-4">
                      {log.modifiedFields && log.modifiedFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1 leading-normal max-w-xs">
                          {log.modifiedFields.map((field, idx) => (
                            <span 
                              key={idx} 
                              className="inline-block px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/40 text-[9px] font-medium"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No fields modified</span>
                      )}
                    </td>

                    <td className="py-4.5 px-6 leading-relaxed text-slate-600 dark:text-slate-350 max-w-sm">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Interactive Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/10 transition-colors">
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-450">
              <span>
                Showing <strong className="font-bold text-slate-800 dark:text-slate-200">{startIndex + 1}</strong> to{" "}
                <strong className="font-bold text-slate-800 dark:text-slate-200">{endIndex}</strong> of{" "}
                <strong className="font-bold text-slate-800 dark:text-slate-200">{totalItems}</strong> logs
              </span>
              <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-4">
                <span>Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-transparent font-semibold text-slate-700 dark:text-slate-300 ring-0 focus:ring-0 border-none cursor-pointer text-xs p-0 focus:outline-none"
                >
                  <option value={10} className="bg-white dark:bg-slate-900">10 entries</option>
                  <option value={15} className="bg-white dark:bg-slate-900">15 entries</option>
                  <option value={25} className="bg-white dark:bg-slate-900">25 entries</option>
                  <option value={50} className="bg-white dark:bg-slate-900">50 entries</option>
                  <option value={100} className="bg-white dark:bg-slate-900">100 entries</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={activePage === 1}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                title="First Page"
              >
                <ChevronsLeft className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={activePage === 1}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                title="Previous Page"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>

              <div className="flex items-center gap-1 mx-1.5">
                {getPageNumbers().map((pageNum, idx) => (
                  <button
                    key={idx}
                    onClick={() => typeof pageNum === 'number' && setCurrentPage(pageNum)}
                    disabled={typeof pageNum !== 'number'}
                    className={`min-w-8 h-8 px-2.5 rounded-xl text-xs font-bold leading-none flex items-center justify-center transition-all select-none ${
                      pageNum === activePage
                        ? 'bg-teal-600 text-white shadow-sm hover:bg-teal-700 cursor-default'
                        : pageNum === '...'
                        ? 'text-slate-400 dark:text-slate-500 cursor-default hover:bg-transparent'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer shadow-sm'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={activePage === totalPages}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                title="Next Page"
              >
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={activePage === totalPages}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                title="Last Page"
              >
                <ChevronsRight className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
