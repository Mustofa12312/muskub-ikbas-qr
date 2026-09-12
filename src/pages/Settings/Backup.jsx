import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Upload, Settings as SettingsIcon, Volume2, Vibrate, CheckCircle2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef, useEffect } from 'react';

export default function BackupSettings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef(null);

  // Settings State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [defaultPhoto, setDefaultPhoto] = useState('');
  const defaultPhotoInputRef = useRef(null);

  // Load settings on mount
  useEffect(() => {
    const savedSound = localStorage.getItem('muskub_sound_enabled');
    const savedVibrate = localStorage.getItem('muskub_vibrate_enabled');
    const savedDefaultPhoto = localStorage.getItem('muskub_default_photo');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');
    if (savedVibrate !== null) setVibrateEnabled(savedVibrate === 'true');
    if (savedDefaultPhoto) setDefaultPhoto(savedDefaultPhoto);
  }, []);

  const handleSoundToggle = (checked) => {
    setSoundEnabled(checked);
    localStorage.setItem('muskub_sound_enabled', checked);
    if (checked) toast.success('Suara scanner diaktifkan');
  };

  const handleVibrateToggle = (checked) => {
    setVibrateEnabled(checked);
    localStorage.setItem('muskub_vibrate_enabled', checked);
    if (checked) toast.success('Getar scanner diaktifkan');
  };

  const handleDefaultPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error("File harus berupa gambar");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setDefaultPhoto(dataUrl);
        try {
          localStorage.setItem('muskub_default_photo', dataUrl);
          toast.success("Foto default berhasil disimpan");
        } catch (err) {
          toast.error("Gagal menyimpan foto (kuota penyimpanan penuh)");
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    
    if (defaultPhotoInputRef.current) {
      defaultPhotoInputRef.current.value = "";
    }
  };

  const handleRemoveDefaultPhoto = () => {
    setDefaultPhoto('');
    localStorage.removeItem('muskub_default_photo');
    toast.success("Foto default dihapus");
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const collections = ['events', 'participants', 'attendance', 'attendanceLogs', 'auditLogs'];
      const exportData = {};

      for (const colName of collections) {
        const querySnapshot = await getDocs(collection(db, colName));
        exportData[colName] = {};
        querySnapshot.forEach((document) => {
          exportData[colName][document.id] = document.data();
        });
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `muskub_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode); // required for firefox
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      toast.success('Backup berhasil diunduh!');
    } catch (error) {
      toast.error('Gagal membuat backup: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      toast.error("File harus berformat JSON");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        await performRestore(jsonData);
      } catch (error) {
        toast.error("Format JSON tidak valid atau file rusak");
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const performRestore = async (data) => {
    if (!window.confirm("PERINGATAN: Memulihkan data akan MENIMPA data saat ini dengan ID yang sama. Apakah Anda yakin ingin melanjutkan?")) {
      return;
    }

    setIsRestoring(true);
    toast.info("Memulai proses restore. Mohon tunggu...");
    
    try {
      let batch = writeBatch(db);
      let operationCount = 0;

      // Iterate through collections in the JSON
      for (const [colName, docs] of Object.entries(data)) {
        if (typeof docs === 'object' && docs !== null) {
          for (const [docId, docData] of Object.entries(docs)) {
            const docRef = doc(db, colName, docId);
            batch.set(docRef, docData);
            operationCount++;
            
            // Firestore batches have a limit of 500 operations
            if (operationCount >= 490) {
              await batch.commit();
              batch = writeBatch(db); // Create a new batch
              operationCount = 0;
            }
          }
        }
      }

      // Commit any remaining operations
      if (operationCount > 0) {
        await batch.commit();
      }

      toast.success("Restore data berhasil diselesaikan!");
    } catch (error) {
      toast.error("Gagal melakukan restore: " + error.message);
      console.error("Restore error:", error);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
        <p className="text-slate-500">Konfigurasi preferensi aplikasi dan database</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Kolom Kiri: Preferensi */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-slate-600" /> Preferensi Aplikasi</CardTitle>
              <CardDescription>
                Atur fitur-fitur lokal untuk perangkat ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2 text-base"><Volume2 className="w-4 h-4 text-emerald-600"/> Suara Scanner</Label>
                  <p className="text-sm text-slate-500">Bunyikan nada saat QR code berhasil discan.</p>
                </div>
                <Switch 
                  checked={soundEnabled} 
                  onCheckedChange={handleSoundToggle}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2 text-base"><Vibrate className="w-4 h-4 text-emerald-600"/> Getar Scanner</Label>
                  <p className="text-sm text-slate-500">Getarkan perangkat saat berhasil discan (hanya HP).</p>
                </div>
                <Switch 
                  checked={vibrateEnabled} 
                  onCheckedChange={handleVibrateToggle}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
              <div className="border-t border-slate-100 pt-6">
                <div className="space-y-4">
                  <div>
                    <Label className="flex items-center gap-2 text-base"><ImageIcon className="w-4 h-4 text-emerald-600"/> Foto Default Peserta</Label>
                    <p className="text-sm text-slate-500 mt-1">Foto ini akan ditampilkan jika peserta tidak memiliki foto profil.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                      {defaultPhoto ? (
                        <img src={defaultPhoto} alt="Default" className="w-full h-full object-cover object-top" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={defaultPhotoInputRef}
                        onChange={handleDefaultPhotoChange}
                      />
                      <Button variant="outline" size="sm" onClick={() => defaultPhotoInputRef.current?.click()}>
                        {defaultPhoto ? 'Ubah Foto' : 'Unggah Foto'}
                      </Button>
                      {defaultPhoto && (
                        <Button variant="ghost" size="sm" onClick={handleRemoveDefaultPhoto} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8">
                          <Trash2 className="w-4 h-4 mr-2" /> Hapus Foto
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/50 border-emerald-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="w-5 h-5" /> Status Sistem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Versi Aplikasi</span>
                <span className="font-medium text-slate-900">v1.0.0 (MUSKUB IV)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Database Engine</span>
                <span className="font-medium text-emerald-600">Muskub</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Database */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-emerald-600" /> Export Database</CardTitle>
              <CardDescription>
                Unduh seluruh data (Acara, Peserta, Absensi, Log) sebagai file JSON. Sangat disarankan untuk backup berkala.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExport} disabled={isExporting} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {isExporting ? (
                   <div className="flex items-center gap-2">
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     Memproses...
                   </div>
                ) : 'Unduh Backup (.json)'}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600"><Upload className="w-5 h-5" /> Import (Restore)</CardTitle>
              <CardDescription className="text-red-500/80">
                <span className="font-bold underline">PERINGATAN BERBAHAYA:</span> Fitur ini akan <strong>menimpa</strong> data yang sudah ada dengan ID yang sama.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isRestoring} 
                variant="destructive" 
                className="w-full bg-red-500 hover:bg-red-600"
              >
                {isRestoring ? (
                   <div className="flex items-center gap-2">
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     Memulihkan Data...
                   </div>
                ) : 'Pilih File Backup (.json)'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
