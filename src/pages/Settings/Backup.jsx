import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function BackupSettings() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const collections = ['events', 'participants', 'attendance', 'attendanceLogs', 'auditLogs'];
      const exportData = {};

      for (const colName of collections) {
        const querySnapshot = await getDocs(collection(db, colName));
        exportData[colName] = {};
        querySnapshot.forEach((doc) => {
          exportData[colName][doc.id] = doc.data();
        });
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem</h1>
        <p className="text-slate-500">Backup dan Restore Database</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5 text-emerald-600" /> Export (Backup)</CardTitle>
          <CardDescription>
            Unduh seluruh data dari database (Acara, Peserta, Absensi, Log) sebagai file JSON.
            Sangat disarankan untuk melakukan backup setiap selesai acara.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting} className="bg-emerald-600 hover:bg-emerald-700">
            {isExporting ? 'Memproses...' : 'Unduh Backup (.json)'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600"><Upload className="w-5 h-5" /> Import (Restore)</CardTitle>
          <CardDescription className="text-red-500/80">
            <span className="font-bold underline">PERINGATAN BERBAHAYA:</span> Fitur restore akan segera tersedia di pembaruan berikutnya. 
            Melakukan restore akan menimpa/menambah data yang sudah ada. Hubungi Administrator sistem jika Anda perlu memulihkan data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="destructive" className="bg-red-100 text-red-400 hover:bg-red-100">
            Pilih File JSON
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
