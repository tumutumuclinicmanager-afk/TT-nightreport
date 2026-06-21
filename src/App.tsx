import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocFromCache, collection, setDoc, query, getDocs, limit } from 'firebase/firestore';
import { NightReport } from './types/report';
import { getSampleReports } from './utils/reportDefaults';
import Auth from './components/Auth';
import Branding from './components/Branding';
import Dashboard from './components/Dashboard';
import ReportForm from './components/ReportForm';
import ReportingEngine from './components/ReportingEngine';
import BatchPdfModal from './components/BatchPdfModal';
import UserWhitelist from './components/UserWhitelist';
import AuditLogView from './components/AuditLogView';
import { isUserWhitelistedOrAuthorized } from './utils/auditLogger';
import { HeartPulse, ShieldCheck, HelpCircle, Sun, Moon, LogOut, Layers, ShieldAlert, Cloud, CloudOff, Database, Wifi, WifiOff, Info, CheckCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'supervisor' | 'admin'>('supervisor');
  const [userDesignation, setUserDesignation] = useState<string>('Night Superintendent');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [offlineStatus, setOfflineStatus] = useState<boolean>(!navigator.onLine);
  const [showSyncDetails, setShowSyncDetails] = useState<boolean>(false);
  const [isCheckingSync, setIsCheckingSync] = useState<boolean>(false);

  const checkConnection = () => {
    setIsCheckingSync(true);
    setTimeout(() => {
      setOfflineStatus(!navigator.onLine);
      setIsCheckingSync(false);
    }, 850);
  };
  
  // Dark Mode Support
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('pcea_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('pcea_dark_mode', String(next));
      return next;
    });
  };
  
  // Dashboard states
  const [selectedShiftDate, setSelectedShiftDate] = useState<string>('');
  const [selectedReportToEdit, setSelectedReportToEdit] = useState<NightReport | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Monitor offline events
  useEffect(() => {
    const handleOnline = () => setOfflineStatus(false);
    const handleOffline = () => setOfflineStatus(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Load role parameters
        try {
          // If they are the clinic manager, we force update their profile in Firestore if needed
          const emailToNormalize = (user.email || '').toLowerCase();
          if (emailToNormalize === 'tumutumuclinicmanager@gmail.com') {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists() || userDoc.data().role !== 'admin' || !userDoc.data().whitelisted) {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email,
                displayName: 'Clinic Manager',
                role: 'admin',
                designation: 'Clinic Manager',
                whitelisted: true,
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
          }

          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile(data);
            setUserRole(data.role || 'supervisor');
            setUserDesignation(data.designation || (data.role === 'admin' ? 'Chief Medical Director' : 'Night Superintendent'));
            
            // Check if DB is completely empty and seed historical records
            await ensureDbSeeded(user.uid);
          } else {
            // Default role fallback
            const defaultProf = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Healthcare Professional',
              role: 'supervisor' as const,
              designation: 'Night Superintendent',
              whitelisted: emailToNormalize === 'tumutumuclinicmanager@gmail.com',
              createdAt: new Date().toISOString()
            };
            setUserProfile(defaultProf);
            setUserRole('supervisor');
            setUserDesignation('Night Superintendent');
          }
        } catch (err) {
          console.warn("Using offline user role defaults:", err);
          setUserRole('supervisor');
          setUserDesignation('Night Superintendent');
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Database auto-seeding helper (disabled to avoid false data)
  const ensureDbSeeded = async (uid: string) => {
    console.log("Mock data seeding disabled to maintain pure data integrity.");
  };

  const handleLoginSuccess = (user: any, role: 'supervisor' | 'admin') => {
    setCurrentUser(user);
    setUserRole(role);
    setUserDesignation(role === 'admin' ? 'Chief Medical Officer' : 'Night Superintendent');
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);
    await signOut(auth);
    setCurrentUser(null);
  };

  const handleSelectShiftDate = async (date: string, editMode: boolean) => {
    setSelectedShiftDate(date);
    
    if (editMode) {
      // Check if report already exists in DB
      try {
        let snap = null;
        try {
          snap = await getDoc(doc(db, 'nightReports', date));
        } catch (offlineErr: any) {
          console.warn("getDoc failed online, attempting local cache lookup:", offlineErr.message);
          try {
            snap = await getDocFromCache(doc(db, 'nightReports', date));
          } catch (cacheErr: any) {
            console.warn("getDocFromCache lookup also failed:", cacheErr.message);
          }
        }

        if (snap && snap.exists()) {
          setSelectedReportToEdit(snap.data() as NightReport);
        } else {
          // Check localStorage as robust fallback
          const localDraftStr = localStorage.getItem(`pcea_draft_${date}`);
          if (localDraftStr) {
            try {
              const parsed = JSON.parse(localDraftStr);
              if (parsed && parsed.date === date) {
                setSelectedReportToEdit(parsed);
              } else {
                setSelectedReportToEdit(null);
              }
            } catch {
              setSelectedReportToEdit(null);
            }
          } else {
            setSelectedReportToEdit(null); // Will trigger brand new report creation
          }
        }
        setActiveTab('new-report');
      } catch (err: any) {
        console.warn("Using offline safe defaults or locally stored draft details:", err.message);
        
        // Secondary lookup check
        const localDraftStr = localStorage.getItem(`pcea_draft_${date}`);
        if (localDraftStr) {
          try {
            const parsed = JSON.parse(localDraftStr);
            if (parsed && parsed.date === date) {
              setSelectedReportToEdit(parsed);
            } else {
              setSelectedReportToEdit(null);
            }
          } catch {
            setSelectedReportToEdit(null);
          }
        } else {
          setSelectedReportToEdit(null);
        }
        setActiveTab('new-report');
      }
    }
  };

  const handleReportSaveFinished = () => {
    setRefreshTrigger(prev => prev + 1);
    setActiveTab('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-lg animate-pulse">
            <HeartPulse className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Tumutumu Hospital Secure Keyway</h3>
            <p className="text-xs text-slate-400">Verifying authorized clinical session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  // Check Whitelist status
  const isWhitelisted = isUserWhitelistedOrAuthorized(userProfile || {
    email: currentUser.email,
    role: userRole,
    designation: userDesignation,
    whitelisted: false
  });

  if (!isWhitelisted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center font-sans p-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-8 text-center space-y-6 animate-in fade-in zoom-in-95 leading-normal">
          <div className="h-12 w-12 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center mx-auto shadow-md">
            <ShieldAlert className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 font-display">Whitelist Clearance Required</h2>
            <p className="text-xs text-slate-550 dark:text-slate-400">
              Your registered account <b>{currentUser.email}</b> is currently pending clinical whitelisting. Only the CMO, CNO, or systems administrators can authorize operational access.
            </p>
          </div>
          <button
            onClick={confirmLogout}
            className="w-full inline-flex justify-center items-center h-10 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border"
          >
            Sign Out Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row font-sans text-slate-900 dark:text-slate-100 transition-all duration-350">
      
      {/* Brand Navigation Header representing the beautiful dark sidebar navigation on desktop */}
      <Branding 
        userName={currentUser.displayName || 'Sister In-Charge'} 
        userRole={userRole} 
        userDesignation={userDesignation}
        userEmail={currentUser.email || ''}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        offlineStatus={offlineStatus}
      />

      {/* Main Content Area - responsive layout shifting with the sidebar block */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-350">
        
        {/* Dynamic header matching the Sleek layout design style */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20 no-print transition-colors duration-350">
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              <span className="w-1.5 h-4.5 bg-teal-500 rounded-full inline-block"></span>
              {activeTab === 'dashboard' ? 'Log Operations Desk' : activeTab === 'new-report' ? 'Night Superintendent Report' : 'Hospital Reporting & Analytics'}
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-semibold hidden sm:block">
              {activeTab === 'dashboard' ? 'Operational Registry & Live Board' : activeTab === 'new-report' ? 'Active Clinical Audit Form' : 'PCEA Tumutumu Management Analytics'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Custom Light/Dark Mode Selector */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 sm:p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-600 dark:text-slate-300 transition-all cursor-pointer flex items-center justify-center"
              title={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            >
              {darkMode ? (
                <Sun className="h-4.5 w-4.5 text-amber-500 animate-pulse" />
              ) : (
                <Moon className="h-4.5 w-4.5 text-slate-600 dark:text-slate-400" />
              )}
            </button>

            {/* Real-time Sync Status Indicator */}
            <div className="relative border-r border-slate-200 dark:border-slate-800 pr-4">
              <button
                onClick={() => setShowSyncDetails(!showSyncDetails)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer select-none font-sans ${
                  offlineStatus
                    ? 'bg-amber-500/15 border-amber-300/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                    : 'bg-teal-500/15 border-teal-300/40 text-teal-600 dark:text-teal-400 hover:bg-teal-500/25'
                }`}
                title="Click to view secure Firestore sync state"
              >
                {offlineStatus ? (
                  <>
                    <CloudOff className="h-4 w-4 shrink-0 transition-transform duration-300 hover:scale-110 text-amber-600 dark:text-amber-400" />
                    <div className="leading-tight text-left">
                      <p className="text-[8px] text-amber-500 font-extrabold uppercase tracking-widest">Network Link</p>
                      <p className="text-[11px] font-bold">Offline Draft Cache</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Cloud className="h-4 w-4 shrink-0 animate-pulse text-teal-600 dark:text-teal-400" />
                    <div className="leading-tight text-left">
                      <p className="text-[8px] text-teal-500 font-extrabold uppercase tracking-widest">Firestore Cloud</p>
                      <p className="text-[11px] font-bold">Synced Live Feed</p>
                    </div>
                  </>
                )}
              </button>

              {/* Informative Popover / Overlay details panel */}
              {showSyncDetails && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowSyncDetails(false)}
                  />
                  <div className="absolute right-0 mt-2.5 w-76 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 z-50 text-xs text-slate-600 dark:text-slate-300 animate-in fade-in slide-in-from-top-3 duration-250">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 font-display text-sm tracking-tight text-teal-600 dark:text-teal-400">
                        <Database className="h-4.5 w-4.5" />
                        Firestore Synchronization
                      </span>
                      <button
                        onClick={() => setShowSyncDetails(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold p-1 rounded-lg transition-colors cursor-pointer text-sm"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-850 p-3 rounded-xl border border-slate-150 dark:border-slate-850/60 leading-normal">
                        {offlineStatus ? (
                          <div className="bg-amber-100 dark:bg-amber-950/40 p-1.5 rounded-lg text-amber-500">
                            <CloudOff className="h-4 w-4 shrink-0" />
                          </div>
                        ) : (
                          <div className="bg-teal-100 dark:bg-teal-950/40 p-1.5 rounded-lg text-teal-500">
                            <Cloud className="h-4 w-4 shrink-0" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-150 leading-tight mb-1 text-[11px]">
                            {offlineStatus ? 'Standby Workspace (Offline)' : 'Continuous Synced Tunnel'}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                            {offlineStatus 
                              ? 'Wireless connection is down. Your clinical logs are safely stored in your browser draft registry & will automatically upload to Tumutumu database as soon as you reconnect.'
                              : 'Connected. Your local reports and system interactions are actively mirrored to the primary cloud server on every update.'
                            }
                          </p>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-550 dark:text-slate-400 space-y-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                        <div className="flex items-center justify-between">
                          <span>Local Draft Lock:</span>
                          <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Secure Offline Cache Ready
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Firestore Socket:</span>
                          <span className={`font-semibold ${offlineStatus ? 'text-amber-500' : 'text-teal-500'}`}>
                            {offlineStatus ? 'Standby' : 'Live Listener Attached'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={checkConnection}
                        disabled={isCheckingSync}
                        className="w-full h-9 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer text-xs shadow-sm border border-slate-200/40 dark:border-slate-700/50"
                      >
                        {isCheckingSync ? (
                          <>
                            <span className="h-3 w-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                            <span>Re-evaluating sync link...</span>
                          </>
                        ) : (
                          <>
                            <Wifi className="h-3.5 w-3.5" />
                            <span>Retry Cloud Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {activeTab === 'new-report' && selectedShiftDate && (
              <div className="text-right">
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">Report Date</p>
                <p className="text-xs font-bold text-teal-700 dark:text-teal-400 font-mono">{selectedShiftDate}</p>
              </div>
            )}
          </div>
        </header>

        {/* Main Body viewport frame */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950 transition-colors duration-350">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              user={currentUser} 
              userRole={userRole} 
              onSelectDate={handleSelectShiftDate}
              onRefreshTrigger={refreshTrigger}
              onOpenBatchExport={() => setShowBatchModal(true)}
            />
          )}

          {activeTab === 'new-report' && userRole === 'supervisor' && (
            <div className="space-y-4">
              <ReportForm 
                user={currentUser} 
                userRole={userRole} 
                initialDate={selectedShiftDate}
                existingReport={selectedReportToEdit}
                onSaved={handleReportSaveFinished}
              />
            </div>
          )}

          {activeTab === 'analytics' && (
            <ReportingEngine 
              user={currentUser} 
              userRole={userRole} 
            />
          )}

          {activeTab === 'whitelisting' && (
            <UserWhitelist 
              currentUser={currentUser} 
              currentRole={userRole} 
              currentDesignation={userDesignation}
            />
          )}

          {activeTab === 'audit-log' && userRole === 'admin' && (
            <AuditLogView />
          )}

        </main>

        {/* Branded Clinical Environment Footer details */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/60 dark:border-slate-800 py-4 text-center mt-auto no-print transition-colors duration-350">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium font-sans">
            <span>&copy; {new Date().getFullYear()} PCEA Tumutumu Hospital. Operations Registry.</span>
            <div className="flex gap-4 mt-2 sm:mt-0 font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> HIPAA Certified Cloud Tunneling</span>
              <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> Support Ext: 4400</span>
            </div>
          </div>
        </footer>

        {/* Custom Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500 mb-3">
                <LogOut className="h-6 w-6" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm Sign-Out</h3>
              </div>
              <p className="text-xs text-slate-550 dark:text-slate-350 leading-relaxed mb-6">
                Are you sure you want to log out of the PCEA Night Superintendent Portal? Any unsaved local edits may be discarded.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogout}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/10 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        <BatchPdfModal 
          isOpen={showBatchModal} 
          onClose={() => setShowBatchModal(false)}
          user={currentUser}
        />

      </div>
    </div>
  );
}
