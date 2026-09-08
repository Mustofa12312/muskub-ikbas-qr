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
import { exportToExcel } from '../../utils/excel';
import { exportToPDF } from '../../utils/pdf';
import { attendanceService } from '../../services/attendanceService';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function Attendance() {
  const { activeEvent } = useEvent();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'hadir', 'belum'

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await participantService.getParticipantsByEvent(activeEvent.id);
      setParticipants(data);
    } catch (error) {
      toast.error('Gagal memuat daftar kehadiran');
    } finally {
      setLoading(false);
    }
  }, [activeEvent]);

  useEffect(() => {
    if (activeEvent) {
      loadParticipants();
    } else {
      setLoading(false);
    }
  }, [activeEvent, loadParticipants]);

  const handleExportExcel = () => {
    const exportData = filteredParticipants.map(p => ({
      'ID Peserta': p.id,
      'Nama': p.name,
      'Delegasi': p.delegation,
      'Jabatan': p.position,
      'Status': p.status,
      'Waktu Hadir': p.status === 'HADIR' ? p.attendanceTime : '-'
    }));
    exportToExcel(exportData, `Daftar_Hadir_${activeEvent.name}`);
    toast.success('Data diekspor ke Excel');
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
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.delegation.toLowerCase().includes(search.toLowerCase());
    
    if (statusFilter === 'hadir') return matchesSearch && p.status === 'HADIR';
    if (statusFilter === 'belum') return matchesSearch && p.status !== 'HADIR';
    return matchesSearch;
  });

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
                placeholder="Cari nama atau delegasi..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
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
                  <TableHead>Delegasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu Hadir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                  </TableRow>
                ) : filteredParticipants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-slate-500">Tidak ada peserta ditemukan</TableCell>
                  </TableRow>
                ) : (
                  filteredParticipants.map(participant => (
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
                      <TableCell className="text-slate-600">{participant.delegation}</TableCell>
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
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
