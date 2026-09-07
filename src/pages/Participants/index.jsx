import { useState, useEffect, useRef } from 'react';
import { useEvent } from '../../context/EventContext';
import { participantService } from '../../services/participantService';
import { attendanceService } from '../../services/attendanceService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Users, Search, Download, Upload, FileText, FileSpreadsheet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { exportToExcel, importFromExcel } from '../../utils/excel';
import { exportToPDF } from '../../utils/pdf';
import { generateIDCards, generateBulkQRCodes } from '../../utils/idCard';
import { generateCertificate } from '../../utils/certificate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Printer, Award, MessageCircle } from 'lucide-react';

export default function Participants() {
  const { activeEvent } = useEvent();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', delegation: '', position: '' });
  const [photoFile, setPhotoFile] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (activeEvent) {
      loadParticipants();
    } else {
      setLoading(false);
    }
  }, [activeEvent]);

  const loadParticipants = async () => {
    setLoading(true);
    try {
      const data = await participantService.getParticipantsByEvent(activeEvent.id);
      setParticipants(data);
    } catch (error) {
      toast.error('Gagal memuat daftar peserta');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeEvent) return toast.error('Pilih acara terlebih dahulu');
    
    setIsSubmitting(true);
    try {
      await participantService.createParticipant({
        ...formData,
        eventId: activeEvent.id
      }, photoFile);
      
      toast.success('Peserta berhasil ditambahkan');
      setIsOpen(false);
      setFormData({ name: '', delegation: '', position: '' });
      setPhotoFile(null);
      loadParticipants();
    } catch (error) {
      toast.error('Gagal menambah peserta: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus peserta ini?')) {
      try {
        await participantService.deleteParticipant(id);
        toast.success('Peserta berhasil dihapus');
        loadParticipants();
      } catch (error) {
        toast.error('Gagal menghapus peserta');
      }
    }
  };

  const handleDownloadQR = (participant) => {
    const svg = document.getElementById(`qr-${participant.id}`);
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = "white"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${participant.qrCode}-${participant.name}.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const importedData = await importFromExcel(file);
      
      let successCount = 0;
      let errorCount = 0;

      // Import sequentially or in batches (sequential for simplicity here)
      for (const row of importedData) {
        if (!row.Nama || !row.Delegasi || !row.Jabatan) {
          errorCount++;
          continue;
        }

        try {
          await participantService.createParticipant({
            name: row.Nama,
            delegation: row.Delegasi,
            position: row.Jabatan,
            eventId: activeEvent.id
          }, null);
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }

      toast.success(`Import selesai: ${successCount} berhasil, ${errorCount} gagal.`);
      loadParticipants();
    } catch (error) {
      toast.error('Gagal mengimpor file: ' + error.message);
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleShareWA = (participant) => {
    const message = `Halo ${participant.name},\n\nTerima kasih telah terdaftar sebagai peserta ${activeEvent.name}.\nBerikut adalah Kode Akses QR Anda: *${participant.qrCode}*\n\nHarap tunjukkan kode ini saat tiba di lokasi acara untuk Check-in.\n\nSalam,\nPanitia`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleExportExcel = () => {
    const exportData = filteredParticipants.map(p => ({
      'ID Peserta': p.id,
      'Nama': p.name,
      'Delegasi': p.delegation,
      'Jabatan': p.position,
      'Status': p.status,
      'Waktu Hadir': p.status === 'HADIR' ? p.attendanceTime : '-'
    }));
    exportToExcel(exportData, `Data_Peserta_${activeEvent.name}`);
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

  const handlePrintIDCards = async () => {
    try {
      toast.info('Sedang membuat ID Card...', { id: 'print-toast' });
      await generateIDCards(filteredParticipants, activeEvent.name);
      toast.success('ID Card berhasil dibuat', { id: 'print-toast' });
    } catch (error) {
      toast.error('Gagal membuat ID Card', { id: 'print-toast' });
    }
  };

  const handlePrintBulkQR = async () => {
    try {
      toast.info('Sedang membuat QR Code Massal...', { id: 'print-toast' });
      await generateBulkQRCodes(filteredParticipants, activeEvent.name);
      toast.success('QR Code Massal berhasil dibuat', { id: 'print-toast' });
    } catch (error) {
      toast.error('Gagal membuat QR Code Massal', { id: 'print-toast' });
    }
  };

  // Filter participants
  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.delegation.toLowerCase().includes(search.toLowerCase()) ||
    (p.qrCode && p.qrCode.toLowerCase().includes(search.toLowerCase()))
  );

  if (!activeEvent) {
    return <div className="p-8 text-center text-slate-500">Pilih atau buat acara terlebih dahulu di menu Acara.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Peserta</h1>
          <p className="text-slate-500">Kelola data peserta untuk {activeEvent.name}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Hidden file input for import */}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleImport} 
          />
          
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={loading || participants.length === 0}>
                <Printer className="mr-2 h-4 w-4" /> Cetak / Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handlePrintIDCards}>
                <Printer className="mr-2 h-4 w-4 text-blue-500" />
                Cetak ID Card (B4)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintBulkQR}>
                <Printer className="mr-2 h-4 w-4 text-slate-500" />
                Cetak QR Massal (A4)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" /> Tambah
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Peserta Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delegation">Delegasi</Label>
                  <Input 
                    id="delegation" 
                    value={formData.delegation} 
                    onChange={e => setFormData({...formData, delegation: e.target.value})} 
                    placeholder="PC IKBAS Panyeppen"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Jabatan</Label>
                  <Input 
                    id="position" 
                    value={formData.position} 
                    onChange={e => setFormData({...formData, position: e.target.value})} 
                    placeholder="Ketua / Anggota"
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="photo">Foto (Opsional)</Label>
                  <Input 
                    id="photo" 
                    type="file" 
                    accept="image/*"
                    onChange={e => setPhotoFile(e.target.files[0])} 
                  />
                </div>
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Peserta'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama, delegasi, atau QR..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="text-sm text-slate-500">
              Total: {filteredParticipants.length} peserta
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peserta</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>QR Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                  </TableRow>
                ) : filteredParticipants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Tidak ada peserta ditemukan</TableCell>
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
                            <div className="text-xs text-slate-500">{participant.delegation}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{participant.position}</TableCell>
                      <TableCell>
                        {participant.qrCode ? (
                          <div className="flex items-center gap-2">
                            <div className="hidden">
                              <QRCodeSVG id={`qr-${participant.id}`} value={participant.qrCode} size={256} />
                            </div>
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">{participant.qrCode}</code>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDownloadQR(participant)}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        {participant.status === 'HADIR' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Hadir</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Belum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right flex items-center justify-end gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8" 
                          onClick={() => handleShareWA(participant)}
                          title="Kirim Kode Akses via WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        
                        {participant.status === 'HADIR' && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-amber-600 border-amber-200 hover:bg-amber-50" 
                            onClick={() => {
                              toast.info('Men-generate Sertifikat...');
                              generateCertificate(participant, activeEvent.name);
                            }}
                            title="Cetak Sertifikat"
                          >
                            <Award className="h-4 w-4 mr-1" /> Sertifikat
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(participant.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
