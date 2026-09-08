import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EventProvider } from '../context/EventContext';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Calendar, ScanLine, History, ClipboardCheck, Settings, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function MainLayout() {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
        <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white p-4 shrink-0">
          <h1 className="text-xl font-bold mb-8">MUSKUB IV</h1>
          <nav className="flex flex-col space-y-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                    location.pathname === item.path ? "bg-slate-800 text-white font-medium" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon size={20} />
                  {item.name}
                </Link>
              );
            })}
            
            <Link 
              to="/scanner" 
              className="flex items-center gap-3 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md mt-6 transition-colors shadow-sm"
            >
              <ScanLine size={20} />
              <span className="font-medium">Mulai Scanner</span>
            </Link>
          </nav>
          
          <div className="mt-auto pt-6 border-t border-slate-800">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-slate-300 hover:bg-red-900/50 hover:text-red-400 rounded-md transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Keluar</span>
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
