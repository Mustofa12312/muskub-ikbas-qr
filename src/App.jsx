import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

import Events from './pages/Events';
import Participants from './pages/Participants';
import Attendance from './pages/Attendance';
import Scanner from './pages/Scanner';
import AuditLog from './pages/AuditLog';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/audit-log" element={<AuditLog />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </Router>
  );
}

export default App;
