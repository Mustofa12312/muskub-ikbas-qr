import { useState } from 'react';
import { useEvent } from '../../context/EventContext';
import { eventService } from '../../services/eventService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Calendar, CheckCircle, Clock } from 'lucide-react';

export default function Events() {
  const { events, activeEvent, changeActiveEvent, reloadEvents, loading } = useEvent();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    date: '', 
    location: '', 
    description: '', 
    checkInStart: '', 
    checkInEnd: '', 
    hasSessions: false, 
    sessions: 'Sesi Pagi, Sesi Siang' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({ 
      name: '', 
      date: '', 
      location: '', 
      description: '', 
      checkInStart: '', 
      checkInEnd: '', 
      hasSessions: false, 
      sessions: 'Sesi Pagi, Sesi Siang' 
    });
    setEditingId(null);
  };

  const handleEditClick = (event) => {
    setFormData({
      name: event.name || '',
      date: event.date || '',
      location: event.location || '',
      description: event.description || '',
      checkInStart: event.checkInStart || '',
      checkInEnd: event.checkInEnd || '',
      hasSessions: event.hasSessions || false,
      sessions: Array.isArray(event.sessions) ? event.sessions.join(', ') : (event.sessions || 'Sesi Pagi, Sesi Siang')
    });
    setEditingId(event.id);
    setIsOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const dataToSubmit = { ...formData };
      if (dataToSubmit.hasSessions) {
        dataToSubmit.sessions = dataToSubmit.sessions.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        dataToSubmit.sessions = [];
      }

      if (editingId) {
        await eventService.updateEvent(editingId, dataToSubmit);
        toast.success('Acara berhasil diperbarui');
      } else {
        await eventService.createEvent(dataToSubmit);
        toast.success('Acara berhasil dibuat');
      }
      setIsOpen(false);
      resetForm();
      reloadEvents();
    } catch (error) {
      toast.error(`Gagal ${editingId ? 'memperbarui' : 'membuat'} acara: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetActive = async (event) => {
    try {
      // For simplicity, we just change it in context
      // In a real app, you might want to save this to localStorage or update the DB status
      changeActiveEvent(event);
      toast.success(`Acara "${event.name}" sekarang aktif`);
    } catch (error) {
      toast.error('Gagal mengubah acara aktif');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Yakin ingin menghapus acara ini? Semua data peserta di dalamnya bisa menjadi yatim.')) {
      try {
        await eventService.deleteEvent(id);
        toast.success('Acara berhasil dihapus');
        reloadEvents();
      } catch (error) {
        toast.error('Gagal menghapus acara');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Acara</h1>
          <p className="text-slate-500">Kelola daftar acara dan sesi absensi</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" /> Tambah Acara
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Acara' : 'Buat Acara Baru'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Acara</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="MUSKUB IV IKBAS Panyeppen"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})} 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkInStart">Jam Buka Absen</Label>
                  <Input 
                    id="checkInStart" 
                    type="time" 
                    value={formData.checkInStart} 
                    onChange={e => setFormData({...formData, checkInStart: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkInEnd">Jam Tutup Absen</Label>
                  <Input 
                    id="checkInEnd" 
                    type="time" 
                    value={formData.checkInEnd} 
                    onChange={e => setFormData({...formData, checkInEnd: e.target.value})} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Lokasi</Label>
                <Input 
                  id="location" 
                  value={formData.location} 
                  onChange={e => setFormData({...formData, location: e.target.value})} 
                  placeholder="Gedung Utama"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Input 
                  id="description" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-slate-50">
                <div className="space-y-0.5">
                  <Label className="text-base">Multi-Sesi Absensi</Label>
                  <p className="text-sm text-slate-500">
                    Aktifkan jika acara ini memiliki lebih dari 1 sesi
                  </p>
                </div>
                <Switch 
                  checked={formData.hasSessions} 
                  onCheckedChange={(checked) => setFormData({...formData, hasSessions: checked})} 
                />
              </div>

              {formData.hasSessions && (
                <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                  <Label htmlFor="sessions">Daftar Sesi (Pisahkan dengan koma)</Label>
                  <Input 
                    id="sessions" 
                    value={formData.sessions} 
                    onChange={e => setFormData({...formData, sessions: e.target.value})} 
                    placeholder="Sesi Pagi, Sesi Siang, Sesi Malam"
                  />
                </div>
              )}

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : (editingId ? 'Simpan Perubahan' : 'Simpan Acara')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Acara</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    Belum ada data acara
                  </TableCell>
                </TableRow>
              ) : (
                events.map(event => {
                  const isActive = activeEvent?.id === event.id;
                  return (
                    <TableRow key={event.id} className={isActive ? 'bg-emerald-50/50' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {event.name}
                        </div>
                        {event.hasSessions && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 mt-1 ml-6">
                            <Clock className="h-3 w-3" />
                            {event.sessions?.length || 0} Sesi
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{event.date}</TableCell>
                      <TableCell>{event.location}</TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Aktif</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500">Tidak Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {!isActive && (
                          <Button size="sm" variant="outline" onClick={() => handleSetActive(event)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Set Aktif
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEditClick(event)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(event.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
