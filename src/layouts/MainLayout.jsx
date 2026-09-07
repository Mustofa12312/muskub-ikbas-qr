import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EventProvider } from '../context/EventContext';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Calendar, ScanLine } from 'lucide-react';

export default function MainLayout() {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Acara', path: '/events', icon: Calendar },
    { name: 'Peserta', path: '/participants', icon: Users },
  ];

  return (
    <EventProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white p-4 shrink-0">
          <h1 className="text-xl font-bold mb-8">MUSKUB IV</h1>
          <nav className="flex flex-col space-y-2">
            {navItems.map((item) => {
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
            <Link to="/participants" className={cn("flex flex-col items-center gap-1 p-2", location.pathname === '/participants' ? "text-emerald-600" : "text-slate-500")}>
              <Users size={24} />
              <span className="text-[10px] font-medium">Peserta</span>
            </Link>
            <Link to="/scanner" className="flex flex-col items-center gap-1 p-2 -mt-4 bg-emerald-600 text-white rounded-full shadow-lg border-4 border-slate-50">
              <div className="p-2">
                <ScanLine size={28} />
              </div>
            </Link>
        </nav>
      </div>
    </EventProvider>
  );
}
