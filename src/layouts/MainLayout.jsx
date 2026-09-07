import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/ui/sidebar'; // We'll create a custom sidebar or use standard layout

export default function MainLayout() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white p-4">
        <h1 className="text-xl font-bold mb-8">MUSKUB IV</h1>
        <nav className="flex flex-col space-y-2">
          <a href="/" className="px-4 py-2 hover:bg-slate-800 rounded">Dashboard</a>
          <a href="/events" className="px-4 py-2 hover:bg-slate-800 rounded">Acara</a>
          <a href="/participants" className="px-4 py-2 hover:bg-slate-800 rounded">Peserta</a>
          <a href="/scanner" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded mt-4">Scanner</a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t flex justify-around p-3 pb-safe">
          <a href="/" className="text-sm">Home</a>
          <a href="/participants" className="text-sm">Peserta</a>
          <a href="/scanner" className="text-sm font-bold text-emerald-600">Scan</a>
      </nav>
    </div>
  );
}
