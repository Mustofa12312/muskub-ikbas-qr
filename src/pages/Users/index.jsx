import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Shield, Trash2, Mail, Users as UsersIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function Users() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'OPERATOR'
  });

  useEffect(() => {
    if (currentUser?.role === 'SUPER_ADMIN') {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getAllUsers();
      setUsers(data);
    } catch (error) {
      toast.error('Gagal memuat pengguna');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    if (formData.password.length < 6) {
      toast.error('Password minimal 6 karakter');
      setIsSubmitting(false);
      return;
    }

    try {
      await userService.createUser(formData);
      toast.success('Pengguna berhasil ditambahkan!');
      setIsOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'OPERATOR' });
      loadUsers();
    } catch (error) {
      let errorMsg = 'Gagal menambahkan pengguna';
      if (error.message.includes('email-already-in-use')) {
        errorMsg = 'Email sudah digunakan oleh pengguna lain.';
      }
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (uid, newRole, email) => {
    try {
      await userService.updateUserRole(uid, newRole, email);
      toast.success('Peran berhasil diperbarui');
      loadUsers();
    } catch (error) {
      toast.error('Gagal memperbarui peran');
    }
  };

  const handleDelete = async (uid, email) => {
    if (window.confirm(`Yakin ingin mencabut akses pengguna ${email}? (Ini hanya akan menghapus role, mereka tidak akan bisa login ke dasbor).`)) {
      try {
        await userService.removeUserDocument(uid, email);
        toast.success('Akses pengguna dicabut');
        loadUsers();
      } catch (error) {
        toast.error('Gagal menghapus pengguna');
      }
    }
  };

  // Protect this route client-side too
  if (currentUser?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  const roleColors = {
    'SUPER_ADMIN': 'bg-purple-100 text-purple-800 border-purple-200',
    'ADMIN': 'bg-blue-100 text-blue-800 border-blue-200',
    'OPERATOR': 'bg-slate-100 text-slate-800 border-slate-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Pengguna</h1>
          <p className="text-slate-500">Kelola akses panitia dan operator sistem</p>
        </div>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <UserPlus className="mr-2 h-4 w-4" /> Tambah Pengguna
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buat Akun Baru</DialogTitle>
              <CardDescription>Akun ini akan langsung aktif dan bisa digunakan untuk login.</CardDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap / Posisi</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="Budi - Gerbang A"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email} 
                  onChange={e => setFormData({...formData, email: e.target.value})} 
                  placeholder="operator@muskub.com"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})} 
                  placeholder="Minimal 6 karakter"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Hak Akses (Role)</Label>
                <Select value={formData.role} onValueChange={(val) => setFormData({...formData, role: val})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">SUPER ADMIN (Akses Penuh)</SelectItem>
                    <SelectItem value="ADMIN">ADMIN (Kelola Acara & Peserta)</SelectItem>
                    <SelectItem value="OPERATOR">OPERATOR (Hanya Scanner & Absensi)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                {isSubmitting ? 'Membuat Akun...' : 'Simpan Pengguna'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-emerald-600" />
            Daftar Pengguna Aktif
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Pengguna</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                    Belum ada data pengguna.
                  </TableCell>
                </TableRow>
              ) : (
                users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || 'Tidak Ada Nama'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {user.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.id === currentUser.uid ? (
                         <Badge className={roleColors[user.role] + " border"}>{user.role} (Anda)</Badge>
                      ) : (
                        <Select value={user.role || 'OPERATOR'} onValueChange={(val) => handleRoleChange(user.id, val, user.email)}>
                          <SelectTrigger className={`h-8 w-36 ${roleColors[user.role || 'OPERATOR']} border font-semibold text-xs`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SUPER_ADMIN">SUPER ADMIN</SelectItem>
                            <SelectItem value="ADMIN">ADMIN</SelectItem>
                            <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {user.id !== currentUser.uid && (
                        <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(user.id, user.email)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
