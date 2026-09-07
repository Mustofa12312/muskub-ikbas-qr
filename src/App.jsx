import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          {/* Placeholder untuk rute lain yang akan dibuat di fase berikutnya */}
          <Route path="/events" element={<div className="p-4">Halaman Acara (Segera Hadir)</div>} />
          <Route path="/participants" element={<div className="p-4">Halaman Peserta (Segera Hadir)</div>} />
          <Route path="/scanner" element={<div className="p-4">Halaman Scanner (Segera Hadir)</div>} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </Router>
  );
}

export default App;
