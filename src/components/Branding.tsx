import { useState } from 'react';
import { 
  HeartPulse, 
  LogOut, 
  FileText, 
  BarChart3, 
  CalendarRange, 
  Menu, 
  X, 
  ShieldCheck,
  Users,
  ClipboardList
} from 'lucide-react';
import { isAllowedToWhitelist } from '../utils/auditLogger';

interface BrandingProps {
  userName: string;
  userRole: 'supervisor' | 'cmo' | 'cno' | 'admin';
  userDesignation?: string;
  userEmail?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  offlineStatus?: boolean;
}

export default function Branding({ 
  userName, 
  userRole, 
  userDesignation = 'Healthcare Team Member', 
  userEmail = '',
  activeTab, 
  setActiveTab, 
  onLogout,
  offlineStatus = false
}: BrandingProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getInitials = (nameString: string) => {
    const parts = nameString.split(' ').filter(Boolean);
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const canWhitelist = isAllowedToWhitelist(userRole, userDesignation, userEmail);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Operations Board',
      icon: CalendarRange,
      show: true
    },
    {
      id: 'new-report',
      label: 'New Night Report',
      icon: FileText,
      show: userRole === 'supervisor'
    },
    {
      id: 'analytics',
      label: 'Trends & Analytics',
      icon: BarChart3,
      show: true
    },
    {
      id: 'whitelisting',
      label: 'Staff Access Control',
      icon: Users,
      show: canWhitelist
    },
    {
      id: 'audit-log',
      label: 'System Audit Logs',
      icon: ClipboardList,
      show: userRole === 'admin'
    }
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const menuContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 font-sans">
      {/* Brand Header */}
      <div className="p-6 bg-slate-950 border-b border-slate-850">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center text-white shrink-0 shadow-md shadow-teal-500/20">
            <HeartPulse className="h-5.5 w-5.5 animate-pulse text-white" />
          </div>
          <div>
            <span className="text-sm font-black text-teal-400 tracking-tight leading-tight block uppercase">
              PCEA Tumutumu
            </span>
            <span className="text-[10px] text-slate-400 tracking-widest font-bold uppercase block leading-none mt-0.5">
              Hospital System
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Space */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="text-[9px] uppercase font-bold text-slate-500 mb-2.5 px-3 tracking-widest">
          Main Registry Menu
        </div>
        
        {navItems.map((item) => {
          if (!item.show) return null;
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-teal-600/20 to-teal-600/5 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <IconComponent className={`h-4.5 w-4.5 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Sync Status Badge inside Sidebar */}
      {offlineStatus && (
        <div className="px-5 py-2.5 mx-4 mb-2 rounded-lg bg-orange-950/20 border border-orange-500/20 flex items-center gap-2 text-[10px] text-orange-400 font-bold tracking-wide font-mono uppercase">
          <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping" />
          Offline Cache Operational
        </div>
      )}

      {/* Profile Signature & logout */}
      <div className="p-4 bg-slate-950/70 border-t border-slate-850/80">
        <div className="flex items-center justify-between p-2.5 bg-slate-850/50 rounded-xl border border-slate-800/40">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">
              {getInitials(userName)}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate leading-snug">{userName}</p>
              <p className="text-[10px] text-teal-400 font-extrabold uppercase tracking-wider leading-tight mt-0.5 mb-1">
                {userRole === 'admin' ? 'Super Admin' :
                 userRole === 'cmo' ? 'Chief Medical Officer' :
                 userRole === 'cno' ? 'Chief Nursing Officer' : 'Night Supervisor'}
              </p>
              <p className="text-[9px] text-slate-405 truncate tracking-wide leading-none">{userDesignation}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Log Out Security Key"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. DESKTOP PERMANENT SIDEBAR */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:border-r lg:border-slate-800 bg-slate-900 no-print">
        {menuContent}
      </aside>

      {/* 2. MOBILE HEADER BAR */}
      <header className="lg:hidden h-16 bg-slate-900 border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between px-4 text-slate-100 no-print">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center text-white">
            <HeartPulse className="h-5 w-5 animate-pulse text-white" />
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight text-teal-400 uppercase leading-none">PCEA Tumutumu</h1>
            <p className="text-[9px] text-slate-400 mt-0.5 tracking-wider font-bold">NIGHT SUPER PORTAL</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {offlineStatus && (
            <span className="text-[9px] bg-orange-950/30 text-orange-400 px-2 py-0.5 rounded border border-orange-500/20 font-bold font-mono uppercase">
              Offline
            </span>
          )}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-colors cursor-pointer"
            aria-label="Open clinical registry panel"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* 3. MOBILE SLIDE-OUT DRAWER OVERLAY */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print">
          {/* Backdrop blur overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Main slide content drawer */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 pt-5 pb-4">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 bg-slate-850/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Display same sidebar menu component tree */}
            <div className="h-full flex flex-col">
              {menuContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

