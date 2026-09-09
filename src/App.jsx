import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { EventProvider } from './context/EventContext';

import Events from './pages/Events';
import Participants from './pages/Participants';
import Attendance from './pages/Attendance';
import Scanner from './pages/Scanner';
import AuditLog from './pages/AuditLog';
import ScannerLogs from './pages/ScannerLogs';
import BackupSettings from './pages/Settings/Backup';

function App() {
  return (
    <Router>
      <EventProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/scanner-logs" element={<ScannerLogs />} />
          <Route path="/settings" element={<BackupSettings />} />
        </Route>
        
        <Route path="/scanner" element={<Scanner />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </EventProvider>
      <Toaster position="top-center" richColors />
    </Router>
  );
}

export default App;
