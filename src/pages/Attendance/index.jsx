import { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../../context/EventContext';
import { participantService } from '../../services/participantService';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, Users, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { exportToExcel, exportToCSV } from '../../utils/excel';
import { exportToPDF } from '../../utils/pdf';
import { attendanceService } from '../../services/attendanceService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function Attendance() {
  const { activeEvent } = useEvent();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'hadir', 'belum'
  const [activeSession, setActiveSession] = useState(null);
  const [attendanceMap, setAttendanceMap] = useState({});
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionTargetStatus, setCorrectionTargetStatus] = useState('HADIR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await participantService.getParticipantsByEvent(activeEvent.id);
      setParticipants(pData);
      
      // We also need to get the attendance for the current session
      // For simplicity, we just use the getRecentScans but without limit, or we query the attendance collection directly
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../services/firebase');
      const conditions = [where('eventId', '==', activeEvent.id)];
      if (activeSession) {
        conditions.push(where('sessionId', '==', activeSession));
      } else {
        conditions.push(where('sessionId', '==', 'main'));
      }
      
      const q = query(collection(db, 'attendance'), ...conditions);
      const snap = await getDocs(q);
      const aMap = {};
      snap.forEach(doc => {
        const d = doc.data();
        aMap[d.participantId] = d;
      });
      setAttendanceMap(aMap);
      
    } catch (error) {
      console.error("Gagal memuat daftar kehadiran:", error);
      toast.error('Gagal memuat daftar kehadiran: ' + error.message);
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
      loadParticipants();
    } else {
      setLoading(false);
    }
  }, [activeEvent, activeSession, loadParticipants]);

  const handleExportExcel = () => {
    const exportData = filteredParticipants.map(p => ({
      'ID Peserta': p.id,
      'Nama': p.name,
      'MPW': p.mpw,
      'MPC/MPCI': p.mpc,
      'Jabatan': p.position,
      'Status': p.status,
      'Waktu Hadir': p.status === 'HADIR' ? p.attendanceTime : '-'
    }));
    exportToExcel(exportData, `Daftar_Hadir_${activeEvent.name}`);
    toast.success('Data diekspor ke Excel');
  };

  const handleExportCSV = () => {
    const exportData = filteredParticipants.map(p => ({
      'ID Peserta': p.id,
      'Nama': p.name,
      'MPW': p.mpw,
      'MPC/MPCI': p.mpc,
      'Jabatan': p.position,
      'Status': p.status,
      'Waktu Hadir': p.status === 'HADIR' ? p.attendanceTime : '-'
    }));
    exportToCSV(exportData, `Daftar_Hadir_${activeEvent.name}`);
    toast.success('Data diekspor ke CSV');
  };

  const handleExportPDF = async () => {
    try {
      const stats = await attendanceService.getAttendanceStats(activeEvent.id);
      exportToPDF(filteredParticipants, activeEvent.name, stats);
      toast.success('Laporan diekspor ke PDF');
    } catch (error) {
      toast.error('Gagal mengekspor PDF');
    }
  };

  // Filter participants
  const processedParticipants = participants.map(p => {
    const aData = attendanceMap[p.id];
    return {
      ...p,
      status: aData?.status || 'BELUM HADIR',
      attendanceTime: aData?.attendanceTime || null
    };
  });

  const filteredParticipants = processedParticipants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          (p.mpw && p.mpw.toLowerCase().includes(search.toLowerCase())) ||
                          (p.mpc && p.mpc.toLowerCase().includes(search.toLowerCase()));
    
    if (statusFilter === 'hadir') return matchesSearch && p.status === 'HADIR';
    if (statusFilter === 'belum') return matchesSearch && p.status !== 'HADIR';
    return matchesSearch;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleOpenCorrection = (participant) => {
    setSelectedParticipant(participant);
    setCorrectionTargetStatus(participant.status === 'HADIR' ? 'BELUM HADIR' : 'HADIR');
    setCorrectionReason('');
    setCorrectionModalOpen(true);
  };

  const submitCorrection = async () => {
    if (!correctionReason.trim()) {
      return toast.error('Alasan koreksi harus diisi');
    }
    
    setIsSubmitting(true);
    try {
      await attendanceService.overrideAttendanceStatus(
        activeEvent.id, 
        selectedParticipant.id, 
        correctionTargetStatus, 
        correctionReason, 
        activeSession || 'main'
      );
      toast.success('Status absensi berhasil dikoreksi');
      setCorrectionModalOpen(false);
      loadParticipants();
    } catch (error) {
      toast.error('Gagal mengoreksi absensi: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, activeSession]);

  if (!activeEvent) {
    return <div className="p-8 text-center text-slate-500">Pilih acara terlebih dahulu di menu Acara.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daftar Kehadiran</h1>
          <p className="text-slate-500">Pantau kehadiran peserta untuk {activeEvent.name}</p>
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={loading || participants.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                Export ke Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileText className="mr-2 h-4 w-4 text-blue-500" />
                Export ke CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileText className="mr-2 h-4 w-4 text-red-500" />
                Export ke PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama, mpw, atau mpc..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {activeEvent.hasSessions && activeEvent.sessions?.length > 0 && (
                <select 
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm w-full sm:w-auto"
                  value={activeSession || ''}
                  onChange={(e) => setActiveSession(e.target.value)}
                >
                  {activeEvent.sessions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
              <select 
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm w-full sm:w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="hadir">Sudah Hadir</option>
                <option value="belum">Belum Hadir</option>
              </select>
            </div>
          </div>
          
          <div className="text-sm text-slate-500 mb-4">
            Menampilkan {filteredParticipants.length} peserta
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>MPW - MPC/MPCI</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu Hadir</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                  </TableRow>
                ) : paginatedParticipants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Tidak ada peserta ditemukan</TableCell>
                  </TableRow>
                ) : (
                  paginatedParticipants.map(participant => (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border">
                            {participant.photoUrl ? (
                              <img src={participant.photoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <Users size={16} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{participant.name}</div>
                            <div className="text-xs text-slate-500">{participant.position}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{participant.mpw} - {participant.mpc}</TableCell>
                      <TableCell>
                        {participant.status === 'HADIR' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Hadir</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Belum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 font-medium">
                        {participant.status === 'HADIR' && participant.attendanceTime ? participant.attendanceTime + ' WIB' : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleOpenCorrection(participant)}
                        >
                          Ubah Status
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-slate-500">
                Halaman {currentPage} dari {totalPages}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Sebelumnya
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Correction Dialog */}
      <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Koreksi Manual Kehadiran</DialogTitle>
            <DialogDescription>
              Tindakan ini akan secara paksa mengubah status absensi peserta dan akan tercatat di Audit Log.
            </DialogDescription>
          </DialogHeader>
          
          {selectedParticipant && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border">
                <div className="font-medium text-slate-900">{selectedParticipant.name}</div>
                <div className="text-sm text-slate-500">{selectedParticipant.mpw} - {selectedParticipant.mpc}</div>
                <div className="text-xs mt-1 text-slate-400">Status saat ini: {selectedParticipant.status}</div>
              </div>

              <div className="space-y-2">
                <Label>Ubah Menjadi Status</Label>
                <select 
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white"
                  value={correctionTargetStatus}
                  onChange={(e) => setCorrectionTargetStatus(e.target.value)}
                >
                  <option value="HADIR">Hadir</option>
                  <option value="BELUM HADIR">Belum Hadir</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Alasan Koreksi (Wajib)</Label>
                <Input 
                  placeholder="Misal: QR salah pindai, lupa bawa kartu..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionModalOpen(false)}>Batal</Button>
            <Button 
              className={correctionTargetStatus === 'HADIR' ? 'bg-emerald-600' : 'bg-amber-600'} 
              onClick={submitCorrection}
              disabled={!correctionReason.trim() || isSubmitting}
            >
              {isSubmitting ? 'Memproses...' : 'Simpan Koreksi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
