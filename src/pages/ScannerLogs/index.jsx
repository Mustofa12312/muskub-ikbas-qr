import { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../../context/EventContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, QrCode, MonitorSmartphone, ArrowRightLeft, Download } from 'lucide-react';
import { attendanceService } from '../../services/attendanceService';
import { exportToExcel } from '../../utils/excel';
import { toast } from 'sonner';

export default function ScannerLogs() {
  const { activeEvent } = useEvent();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await attendanceService.getAttendanceLogs(
        activeEvent.id, 
        activeSession || (activeEvent.hasSessions ? activeEvent.sessions[0] : 'main')
      );
      setLogs(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeEvent, activeSession]);

  useEffect(() => {
    if (activeEvent) {
      if (activeEvent.hasSessions && activeEvent.sessions?.length > 0 && !activeSession) {
        setActiveSession(activeEvent.sessions[0]);
      } else if (!activeEvent.hasSessions && activeSession) {
        setActiveSession(null);
      }
      fetchLogs();
    } else {
      setLoading(false);
    }
  }, [activeEvent, activeSession, fetchLogs]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    // Handle Firestore timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    if (action === 'in') return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Check-in</Badge>;
    if (action === 'out') return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Check-out</Badge>;
    if (action === 'MANUAL_OVERRIDE') return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Koreksi Manual</Badge>;
    return <Badge variant="outline">{action}</Badge>;
  };

  const handleExport = () => {
    if (logs.length === 0) return toast.error('Tidak ada data untuk diekspor');

    const exportData = logs.map(log => ({
      'ID Log': log.id,
      'Waktu Scan': formatDate(log.timestamp),
      'Nama Peserta': log.participantName,
      'Delegasi': log.delegation,
      'Aktivitas': log.action === 'in' ? 'Check-in' : log.action === 'out' ? 'Check-out' : log.action,
      'Sesi': log.sessionId || '-',
      'ID Scanner': log.scannerId || '-'
    }));

    exportToExcel(exportData, `Riwayat_Scan_${activeEvent.name}`);
    toast.success('Log riwayat scan berhasil diekspor ke Excel');
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-slate-500">Pilih acara terlebih dahulu di menu Acara.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Riwayat Scan Gerbang</h1>
          <p className="text-slate-500">Log detik demi detik proses pemindaian QR Code</p>
        </div>
        
        {activeEvent.hasSessions && activeEvent.sessions?.length > 0 && (
          <select 
            className="h-10 px-3 rounded-md border border-slate-200 bg-white text-sm min-w-[200px]"
            value={activeSession || ''}
            onChange={(e) => setActiveSession(e.target.value)}
          >
            {activeEvent.sessions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        
        <Button variant="outline" onClick={handleExport} disabled={loading || logs.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export Log
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <QrCode className="h-5 w-5 text-slate-500" />
            200 Log Scan Terakhir
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu Scan</TableHead>
                <TableHead>Peserta</TableHead>
                <TableHead>Delegasi</TableHead>
                <TableHead>Aktivitas</TableHead>
                <TableHead>ID Scanner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Memuat data log...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Belum ada riwayat pemindaian
                  </TableCell>
                </TableRow>
              ) : (
                logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDate(log.timestamp)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="h-4 w-4 text-slate-400" />
                        {log.participantName}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {log.delegation}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400" />
                        {getActionBadge(log.action)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                        <MonitorSmartphone className="h-3.5 w-3.5" />
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded">{log.scannerId || 'Unknown'}</code>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
