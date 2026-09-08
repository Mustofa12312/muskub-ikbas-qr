import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Plus, Trash2, Users, Search, Download, Upload, FileText, FileSpreadsheet, Edit } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { exportToExcel, importFromExcel, exportToCSV } from '../../utils/excel';
import { exportToPDF } from '../../utils/pdf';
import { generateIDCards, generateBulkQRCodes } from '../../utils/idCard';
import { generateCertificate } from '../../utils/certificate';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Printer, Award, MessageCircle, Mail } from 'lucide-react';

export default function Participants() {
  const { activeEvent } = useEvent();
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDelegation, setFilterDelegation] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', delegation: '', position: '', qrCode: '' });
  const [photoFile, setPhotoFile] = useState(null);

  // Import Validation State
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef(null);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await participantService.getParticipantsByEvent(activeEvent.id);
      setParticipants(data);
    } catch (error) {
      toast.error('Gagal memuat daftar peserta');
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

  const closeDialog = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({ name: '', delegation: '', position: '', qrCode: '' });
    setPhotoFile(null);
  };

  const openEditDialog = (participant) => {
    setEditingId(participant.id);
    setFormData({
      name: participant.name,
      delegation: participant.delegation,
      position: participant.position,
      qrCode: participant.qrCode || ''
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeEvent) return toast.error('Pilih acara terlebih dahulu');
    
    setIsSubmitting(true);
    try {
      if (editingId) {
        const participantToEdit = participants.find(p => p.id === editingId);
        await participantService.updateParticipant(
          editingId,
          { ...formData, eventId: activeEvent.id },
          photoFile,
          participantToEdit?.photoUrl
        );
        toast.success('Data peserta berhasil diperbarui');
      } else {
        await participantService.createParticipant({
          ...formData,
          eventId: activeEvent.id
        }, photoFile);
        toast.success('Peserta berhasil ditambahkan');
      }
      
      closeDialog();
      loadParticipants();
    } catch (error) {
      toast.error(`Gagal ${editingId ? 'memperbarui' : 'menambah'} peserta: ` + error.message);
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
      
      const validRows = [];
      const errorRows = [];

      importedData.forEach((row, index) => {
        if (!row.Nama || !row.Delegasi || !row.Jabatan) {
          errorRows.push({ rowNumber: index + 2, ...row });
        } else {
          validRows.push(row);
        }
      });

      setImportPreviewData({ validRows, errorRows });
      setIsImportModalOpen(true);
    } catch (error) {
      toast.error('Gagal mengimpor file: ' + error.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!importPreviewData || importPreviewData.validRows.length === 0) return;
    
    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const row of importPreviewData.validRows) {
      const customId = row.ID || row['ID (Opsional)'] || row.id || row.Id;

      try {
        await participantService.createParticipant({
          name: row.Nama,
          delegation: row.Delegasi,
          position: row.Jabatan,
          qrCode: customId ? String(customId) : undefined,
          eventId: activeEvent.id
        }, null);
        successCount++;
      } catch (_err) {
        errorCount++;
      }
    }

    toast.success(`Import selesai: ${successCount} berhasil, ${errorCount} gagal.`);
    setIsImporting(false);
    setIsImportModalOpen(false);
    setImportPreviewData(null);
    loadParticipants();
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'ID (Opsional)': 'ID-001',
        'Nama': 'Ahmad Dahlan',
        'Delegasi': 'PC Pamekasan',
        'Jabatan': 'Ketua'
      },
      {
        'ID (Opsional)': 'ID-002',
        'Nama': 'Siti Aminah',
        'Delegasi': 'PC Sampang',
        'Jabatan': 'Anggota'
      }
    ];
    exportToExcel(templateData, 'Template_Import_Peserta');
    toast.success('Template Excel berhasil diunduh');
  };

  const handleShareWA = (participant) => {
    const message = `Halo ${participant.name},\n\nTerima kasih telah terdaftar sebagai peserta ${activeEvent.name}.\nBerikut adalah Kode Akses QR Anda: *${participant.qrCode}*\n\nHarap tunjukkan kode ini saat tiba di lokasi acara untuk Check-in.\n\nSalam,\nPanitia`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const handleShareEmail = (participant) => {
    const subject = `Kode Akses QR - ${activeEvent.name}`;
    const body = `Halo ${participant.name},\n\nTerima kasih telah terdaftar sebagai peserta ${activeEvent.name}.\nBerikut adalah Kode Akses QR/ID Anda: ${participant.qrCode}\n\nHarap tunjukkan kode ini saat tiba di lokasi acara untuk proses Check-in.\n\nSalam,\nPanitia`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleDownloadAllQRsOnly = async () => {
    try {
      toast.info('Sedang menyiapkan file ZIP QR Code...', { id: 'zip-toast' });
      
      const zip = new JSZip();
      let hasData = false;
      
      for (const p of filteredParticipants) {
        if (!p.qrCode) continue;
        
        // Generate QR code as Data URL
        const dataUrl = await QRCode.toDataURL(p.qrCode, {
          width: 500,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
        
        // Strip the data:image/png;base64, part
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        
        // Add to ZIP
        const safeName = p.name.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/ +/g, '_');
        zip.file(`qr_${safeName}.png`, base64Data, { base64: true });
        hasData = true;
      }
      
      if (!hasData) {
        toast.error('Tidak ada QR Code yang dapat diunduh', { id: 'zip-toast' });
        return;
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `QR_Code_Only_${activeEvent.name.replace(/[^a-zA-Z0-9]/g, '_')}.zip`);
      
      toast.success('Berhasil mengunduh kumpulan QR Code', { id: 'zip-toast' });
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengunduh QR Code', { id: 'zip-toast' });
    }
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

  const handleExportCSV = () => {
    const exportData = filteredParticipants.map(p => ({
      'ID Peserta': p.id,
      'Nama': p.name,
      'Delegasi': p.delegation,
      'Jabatan': p.position,
      'Status': p.status,
      'Waktu Hadir': p.status === 'HADIR' ? p.attendanceTime : '-'
    }));
    exportToCSV(exportData, `Data_Peserta_${activeEvent.name}`);
    toast.success('Data diekspor ke CSV');
  };

  const handleExportPDF = async () => {
    try {
      const stats = await attendanceService.getAttendanceStats(activeEvent.id);
      exportToPDF(filteredParticipants, activeEvent.name, stats);
      toast.success('Laporan diekspor ke PDF');
    } catch (_error) {
      toast.error('Gagal mengekspor PDF');
    }
  };

  const handlePrintIDCards = async () => {
    try {
      toast.info('Sedang membuat ID Card...', { id: 'print-toast' });
      await generateIDCards(filteredParticipants, activeEvent.name);
      toast.success('ID Card berhasil dibuat', { id: 'print-toast' });
    } catch (_error) {
      toast.error('Gagal membuat ID Card', { id: 'print-toast' });
    }
  };

  const handlePrintBulkQR = async () => {
    try {
      toast.info('Sedang membuat QR Code Massal...', { id: 'print-toast' });
      await generateBulkQRCodes(filteredParticipants, activeEvent.name);
      toast.success('QR Code Massal berhasil dibuat', { id: 'print-toast' });
    } catch (_error) {
      toast.error('Gagal membuat QR Code Massal', { id: 'print-toast' });
    }
  };

  // Filter participants
  const filteredParticipants = participants.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.delegation.toLowerCase().includes(search.toLowerCase()) ||
                          (p.qrCode && p.qrCode.toLowerCase().includes(search.toLowerCase()));
    const matchesDelegation = filterDelegation === 'all' || p.delegation === filterDelegation;
    const matchesPosition = filterPosition === 'all' || p.position === filterPosition;
    
    return matchesSearch && matchesDelegation && matchesPosition;
  });

  const uniqueDelegations = [...new Set(participants.map(p => p.delegation))].filter(Boolean).sort();
  const uniquePositions = [...new Set(participants.map(p => p.position))].filter(Boolean).sort();

  // Pagination Logic
  const totalPages = Math.ceil(filteredParticipants.length / itemsPerPage);
  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDelegation, filterPosition]);

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
          
          <Button variant="outline" onClick={handleDownloadTemplate} disabled={loading}>
            <Download className="mr-2 h-4 w-4" /> Template Import
          </Button>
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
              <DropdownMenuItem onClick={handleDownloadAllQRsOnly}>
                <Download className="mr-2 h-4 w-4 text-purple-500" />
                Download Semua QR (ZIP)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
          
          <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : closeDialog()}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingId(null); setFormData({ name: '', delegation: '', position: '', qrCode: '' }); }}>
                <Plus className="mr-2 h-4 w-4" /> Tambah
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Peserta' : 'Tambah Peserta Baru'}</DialogTitle>
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
                  <Label htmlFor="qrCode">ID / QR Code (Opsional)</Label>
                  <Input 
                    id="qrCode" 
                    value={formData.qrCode || ''} 
                    onChange={e => setFormData({...formData, qrCode: e.target.value})} 
                    placeholder="Bisa gunakan NIK / ID khusus"
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

          {/* Import Validation Modal */}
          <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Validasi Data Import</DialogTitle>
              </DialogHeader>
              {importPreviewData && (
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 rounded-md bg-slate-50 border">
                    <div className="flex-1 text-center">
                      <div className="text-sm text-slate-500 mb-1">Total Data Ditemukan</div>
                      <div className="text-2xl font-bold">{importPreviewData.validRows.length + importPreviewData.errorRows.length}</div>
                    </div>
                    <div className="flex-1 text-center border-l">
                      <div className="text-sm text-slate-500 mb-1">Data Valid</div>
                      <div className="text-2xl font-bold text-emerald-600">✓ {importPreviewData.validRows.length}</div>
                    </div>
                    <div className="flex-1 text-center border-l">
                      <div className="text-sm text-slate-500 mb-1">Data Gagal</div>
                      <div className="text-2xl font-bold text-red-500">⚠ {importPreviewData.errorRows.length}</div>
                    </div>
                  </div>

                  {importPreviewData.errorRows.length > 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-4">
                      <h4 className="text-sm font-semibold text-red-800 mb-2">Data dengan masalah (akan dilewati):</h4>
                      <div className="max-h-40 overflow-y-auto text-sm text-red-700 space-y-1">
                        {importPreviewData.errorRows.map((err, i) => (
                          <div key={i}>Baris {err.rowNumber}: Nama/Delegasi/Jabatan kosong ({err.Nama || '?'})</div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
                    <Button variant="outline" onClick={() => setIsImportModalOpen(false)} disabled={isImporting}>
                      Batalkan
                    </Button>
                    <Button 
                      onClick={confirmImport} 
                      className="bg-emerald-600 hover:bg-emerald-700" 
                      disabled={importPreviewData.validRows.length === 0 || isImporting}
                    >
                      {isImporting ? 'Sedang Mengimpor...' : `Import ${importPreviewData.validRows.length} Data Valid`}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
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
            
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select 
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm w-full sm:w-auto"
                value={filterDelegation}
                onChange={(e) => setFilterDelegation(e.target.value)}
              >
                <option value="all">Semua Delegasi</option>
                {uniqueDelegations.map(del => <option key={del} value={del}>{del}</option>)}
              </select>
              
              <select 
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm w-full sm:w-auto"
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
              >
                <option value="all">Semua Jabatan</option>
                {uniquePositions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
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
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8" 
                          onClick={() => openEditDialog(participant)}
                          title="Edit Peserta"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8" 
                          onClick={() => handleShareWA(participant)}
                          title="Kirim Kode Akses via WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 w-8" 
                          onClick={() => handleShareEmail(participant)}
                          title="Kirim Kode Akses via Email"
                        >
                          <Mail className="h-4 w-4" />
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
    </div>
  );
}
