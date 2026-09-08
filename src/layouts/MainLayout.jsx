import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EventProvider } from '../context/EventContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Calendar, ScanLine, History, ClipboardCheck, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function MainLayout() {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] },
    { name: 'Acara', path: '/events', icon: Calendar, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Peserta', path: '/participants', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Kehadiran', path: '/attendance', icon: ClipboardCheck, roles: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR'] },
    { name: 'Audit Log', path: '/audit-log', icon: History, roles: ['SUPER_ADMIN'] },
    { name: 'Riwayat Scan', path: '/scanner-logs', icon: ScanLine, roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Pengaturan', path: '/settings', icon: Settings, roles: ['SUPER_ADMIN'] },
  ];

  const userRole = currentUser?.role || 'OPERATOR';
  const filteredNavItems = navItems.filter(item => item.roles.includes(userRole));

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <EventProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <aside 
          className={cn(
            "hidden md:flex flex-col bg-[#0b1120] text-slate-300 border-r border-slate-800/60 p-4 shrink-0 transition-all duration-300 relative",
            isSidebarCollapsed ? "w-20 items-center" : "w-56"
          )}
        >
          <div className={cn("flex items-center mb-8 w-full", isSidebarCollapsed ? "justify-center" : "justify-between px-2")}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <ScanLine size={18} strokeWidth={2.5} />
              </div>
              {!isSidebarCollapsed && (
                <h1 className="text-lg font-bold tracking-wide text-white whitespace-nowrap">
                  MUSKUB <span className="text-emerald-500">IV</span>
                </h1>
              )}
            </div>
            
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={cn(
                "text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors flex items-center justify-center",
                isSidebarCollapsed ? "absolute -right-3 top-6 bg-[#0b1120] border border-slate-800 w-6 h-6 rounded-full shadow-md z-10" : "p-1"
              )}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={18} />}
            </button>
          </div>
          
          <nav className="flex flex-col space-y-1 w-full">
            {!isSidebarCollapsed && <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3 whitespace-nowrap">Menu Utama</div>}
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={isSidebarCollapsed ? item.name : ""}
                  className={cn(
                    "flex items-center rounded-lg transition-all duration-200 text-sm font-medium",
                    isSidebarCollapsed ? "justify-center p-2.5 mx-auto" : "gap-3 px-3 py-2.5 w-full",
                    isActive 
                      ? "bg-emerald-500/15 text-emerald-400" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className={cn(isActive ? "text-emerald-400" : "text-slate-500", "shrink-0")} />
                  {!isSidebarCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                </Link>
              );
            })}
            
            <div className="pt-4 mt-2 w-full flex justify-center">
              <Link 
                to="/scanner" 
                title={isSidebarCollapsed ? "Mulai Scanner" : ""}
                className={cn(
                  "flex items-center justify-center bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-lg transition-all shadow-lg shadow-emerald-900/20 text-sm font-medium",
                  isSidebarCollapsed ? "p-2.5 w-10 h-10" : "gap-2 w-full py-2.5"
                )}
              >
                <ScanLine size={18} className="shrink-0" />
                {!isSidebarCollapsed && <span className="whitespace-nowrap">Mulai Scanner</span>}
              </Link>
            </div>
          </nav>
          
          <div className="mt-auto pt-4 border-t border-slate-800/60 w-full">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 px-3 py-2 mb-2 w-full">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-500 shrink-0 border border-slate-700">
                  <Users size={14} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-white truncate">{currentUser?.email}</p>
                  <p className="text-[10px] text-slate-500 truncate capitalize">{userRole.replace('_', ' ')}</p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-2 w-full">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-500 shrink-0 border border-slate-700" title={currentUser?.email}>
                  <Users size={14} />
                </div>
              </div>
            )}
            
            <button 
              onClick={handleLogout}
              title={isSidebarCollapsed ? "Keluar" : ""}
              className={cn(
                "flex items-center text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors text-sm font-medium",
                isSidebarCollapsed ? "justify-center p-2.5 mx-auto" : "gap-3 px-3 py-2 w-full"
              )}
            >
              <LogOut size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span className="whitespace-nowrap">Keluar</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8 overflow-auto h-screen pb-24 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-3 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Link to="/" className={cn("flex flex-col items-center gap-1 p-2", location.pathname === '/' ? "text-emerald-600" : "text-slate-500")}>
              <LayoutDashboard size={24} />
              <span className="text-[10px] font-medium">Home</span>
            </Link>
            
            {userRole !== 'OPERATOR' && (
              <Link to="/participants" className={cn("flex flex-col items-center gap-1 p-2", location.pathname === '/participants' ? "text-emerald-600" : "text-slate-500")}>
                <Users size={24} />
                <span className="text-[10px] font-medium">Peserta</span>
              </Link>
            )}
            
            <Link to="/attendance" className={cn("flex flex-col items-center gap-1 p-2", location.pathname === '/attendance' ? "text-emerald-600" : "text-slate-500")}>
              <ClipboardCheck size={24} />
              <span className="text-[10px] font-medium">Kehadiran</span>
            </Link>
            <Link to="/scanner" className="flex flex-col items-center gap-1 p-2 -mt-4 bg-emerald-600 text-white rounded-full shadow-lg border-4 border-slate-50">
              <div className="p-2">
                <ScanLine size={28} />
              </div>
            </Link>
            
            <button onClick={handleLogout} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-red-500">
              <LogOut size={24} />
              <span className="text-[10px] font-medium">Keluar</span>
            </button>
        </nav>
      </div>
    </EventProvider>
  );
}
