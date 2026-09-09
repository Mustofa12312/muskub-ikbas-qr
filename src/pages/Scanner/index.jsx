import { useState, useEffect, useRef, useCallback } from 'react';
import { useEvent } from '../../context/EventContext';
import { attendanceService } from '../../services/attendanceService';
import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle, AlertTriangle, XCircle, Search, Camera, Keyboard } from 'lucide-react';
import { QrReader } from 'react-qr-reader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function Scanner() {
  const { activeEvent } = useEvent();
  const [scanMode, setScanMode] = useState('usb'); // 'usb' or 'camera'
  const [scanAction, setScanAction] = useState('in'); // 'in' or 'out'
  const [activeSession, setActiveSession] = useState(null);
  const [scanStatus, setScanStatus] = useState('idle'); // idle, success, already_attended, not_found, error
  const [scanResult, setScanResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [scannerId, setScannerId] = useState(localStorage.getItem('scannerId') || '');
  const [showScannerConfig, setShowScannerConfig] = useState(!localStorage.getItem('scannerId'));
  const [tempScannerId, setTempScannerId] = useState(scannerId);
  
  // Ref for the hidden input used by USB Scanner
  const inputRef = useRef(null);
  
  const loadRecentScans = useCallback(async () => {
    try {
      const data = await attendanceService.getRecentScans(activeEvent.id, 4);
      setRecentScans(data);
    } catch (error) {
      console.error("Failed to load recent scans", error);
    }
  }, [activeEvent]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (activeEvent) {
      if (activeEvent.hasSessions && activeEvent.sessions?.length > 0) {
        // eslint-disable-next-line react/set-state-in-effect
        setActiveSession(activeEvent.sessions[0]);
      } else {
        // eslint-disable-next-line react/set-state-in-effect
        setActiveSession(null);
      }
      loadRecentScans();
    }
  }, [activeEvent, loadRecentScans]);

  // Keep focus on the hidden input for the USB scanner if in USB mode
  useEffect(() => {
    const focusInput = () => {
      if (scanMode === 'usb' && inputRef.current) {
        inputRef.current.focus();
      }
    };
    
    focusInput();
    window.addEventListener('click', focusInput);
    
    return () => {
      window.removeEventListener('click', focusInput);
    };
  }, [scanMode]);

  // Handle auto-reset after scan
  useEffect(() => {
    if (scanStatus !== 'idle') {
      const timer = setTimeout(() => {
        setScanStatus('idle');
        setScanResult(null);
        if (scanMode === 'usb' && inputRef.current) inputRef.current.focus();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [scanStatus, scanMode]);



  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (type === 'success') {
        // High pitch short beep
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
      } else if (type === 'warning') {
        // Two medium pitch short beeps
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        
        osc2.start(ctx.currentTime + 0.2);
        osc2.stop(ctx.currentTime + 0.3);
        oscillator.stop(ctx.currentTime + 0.4);
      } else if (type === 'error') {
        // Low pitch long beep
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, ctx.currentTime); // A3
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.warn("Audio not supported or blocked", e);
    }
  };

  const handleScan = async (qrCode) => {
    if (!activeEvent || !qrCode || !qrCode.trim()) return;
    
    // Prevent processing if already processing
    if (scanStatus !== 'idle') return;
    
    // Validate time
    if (activeEvent.checkInStart || activeEvent.checkInEnd) {
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      
      if (activeEvent.checkInStart && currentTime < activeEvent.checkInStart) {
        setScanStatus('error');
        setScanResult({ message: `Absensi belum dibuka. Dibuka jam ${activeEvent.checkInStart} WIB` });
        playSound('error');
        return;
      }
      
      if (activeEvent.checkInEnd && currentTime > activeEvent.checkInEnd) {
        setScanStatus('error');
        setScanResult({ message: `Absensi sudah ditutup sejak jam ${activeEvent.checkInEnd} WIB` });
        playSound('error');
        return;
      }
    }
    
    try {
      const result = await attendanceService.processAttendance(qrCode, activeEvent.id, scanAction, activeSession, scannerId);
      
      if (result.success) {
        setScanStatus('success');
        setScanResult(result.participant);
        playSound('success');
        loadRecentScans();
      } else {
        if (result.status === 'ALREADY_ATTENDED') {
          setScanStatus('already_attended');
          setScanResult(result.participant);
          playSound('warning');
        } else {
          setScanStatus('not_found');
          setScanResult({ message: result.message, qrCode });
          playSound('error');
        }
      }
    } catch (_error) {
      setScanStatus('error');
      setScanResult({ message: 'Terjadi kesalahan sistem' });
      playSound('error');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue) {
      handleScan(inputValue);
      setInputValue('');
    }
  };

  const handleCameraScan = (result, _error) => {
    if (result) {
      handleScan(result?.text);
    }
  };

  const handleSaveScannerId = () => {
    if (tempScannerId.trim()) {
      localStorage.setItem('scannerId', tempScannerId.trim());
      setScannerId(tempScannerId.trim());
      setShowScannerConfig(false);
    }
  };

  if (!activeEvent) {
    return <div className="p-8 text-center text-slate-500">Pilih acara terlebih dahulu</div>;
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto">
      {/* Hidden input for USB barcode scanner */}
      {scanMode === 'usb' && (
        <form onSubmit={handleSubmit} className="absolute opacity-0 -z-10">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoFocus
            autoComplete="off"
          />
        </form>
      )}

      {/* Main Scanner Area */}
      <div className="flex-1 flex flex-col">
        <div className="text-center mb-6">
          <div className="flex justify-center items-center gap-3 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-tight">{activeEvent.name}</h1>
            <div className={`px-3 py-1 rounded-full text-xs font-bold border ${isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200 animate-pulse'}`}>
              {isOnline ? '● ONLINE' : '○ OFFLINE'}
            </div>
          </div>
          <p className="text-slate-500">ABSENSI PESERTA</p>
        </div>

        <Card className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 relative ${
          scanStatus === 'success' ? 'bg-emerald-50 border-emerald-200' :
          scanStatus === 'already_attended' ? 'bg-amber-50 border-amber-200' :
          scanStatus === 'not_found' || scanStatus === 'error' ? 'bg-red-50 border-red-200' :
          'bg-white'
        }`}>
          {/* Scan Action & Session Select */}
          <div className="absolute top-4 left-4 z-20 flex gap-2 items-center">
            {activeEvent.hasSessions && activeEvent.sessions?.length > 0 && (
              <select 
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={activeSession}
                onChange={(e) => setActiveSession(e.target.value)}
              >
                {activeEvent.sessions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}

            <Button 
              size="sm" 
              variant={scanAction === 'in' ? 'default' : 'outline'}
              onClick={() => setScanAction('in')}
              className={scanAction === 'in' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              Check-in
            </Button>
            <Button 
              size="sm" 
              variant={scanAction === 'out' ? 'default' : 'outline'}
              onClick={() => setScanAction('out')}
              className={scanAction === 'out' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            >
              Check-out
            </Button>
          </div>

          <div className="absolute top-4 right-4 z-20 flex gap-2">
            <Button 
              size="sm" 
              variant={scanMode === 'usb' ? 'default' : 'outline'}
              onClick={() => setScanMode('usb')}
              className={scanMode === 'usb' ? 'bg-emerald-600' : ''}
            >
              <Keyboard className="w-4 h-4 mr-2" /> USB Mode
            </Button>
            <Button 
              size="sm" 
              variant={scanMode === 'camera' ? 'default' : 'outline'}
              onClick={() => setScanMode('camera')}
              className={scanMode === 'camera' ? 'bg-emerald-600' : ''}
            >
              <Camera className="w-4 h-4 mr-2" /> Kamera HP
            </Button>
          </div>

          <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center mt-12">
            
            {/* IDLE STATE */}
            {scanStatus === 'idle' && (
              <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center w-full max-w-sm">
                
                {scanMode === 'usb' ? (
                  <>
                    <div className="w-64 h-64 border-4 border-dashed border-slate-300 rounded-3xl flex items-center justify-center bg-slate-50 mb-8 relative">
                      <ScanOverlay />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-700">Silakan Arahkan Scanner USB</h2>
                    <p className="text-slate-500 mt-2">Scanner sedang aktif dan siap menerima data</p>
                  </>
                ) : (
                  <>
                    <div className="w-full aspect-square rounded-3xl overflow-hidden bg-black mb-8 relative shadow-lg">
                      <QrReader
                        onResult={handleCameraScan}
                        constraints={{ facingMode: 'environment' }}
                        containerStyle={{ width: '100%', height: '100%' }}
                        videoStyle={{ objectFit: 'cover' }}
                      />
                      <div className="absolute inset-0 border-[16px] border-black/40 z-10 pointer-events-none">
                        <ScanOverlay />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-700">Arahkan Kamera ke QR</h2>
                    <p className="text-slate-500 mt-2">Posisikan QR code di tengah kotak</p>
                  </>
                )}

              </div>
            )}

            {/* SUCCESS STATE */}
            {scanStatus === 'success' && scanResult && (
              <div className="animate-in slide-in-from-bottom-8 fade-in duration-300 w-full max-w-md">
                <div className="mx-auto w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-emerald-700 mb-6">✓ {scanAction === 'in' ? 'BERHASIL CHECK-IN' : 'BERHASIL CHECK-OUT'}</h2>
                
                <ParticipantCard participant={scanResult} />
                
                <div className="mt-6 text-emerald-700 font-bold text-xl">
                  {scanAction === 'in' ? scanResult.attendanceTime : scanResult.checkoutTime} WIB
                </div>
              </div>
            )}

            {/* ALREADY ATTENDED STATE */}
            {scanStatus === 'already_attended' && scanResult && (
              <div className="animate-in zoom-in-95 fade-in duration-300 w-full max-w-md">
                <div className="mx-auto w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-amber-700 mb-6">⚠ {scanAction === 'in' ? 'SUDAH CHECK-IN' : 'SUDAH CHECK-OUT'}</h2>
                
                <ParticipantCard participant={scanResult} />
                
                <div className="mt-6 text-amber-700">
                  Waktu {scanAction === 'in' ? 'Check-in' : 'Check-out'} sebelumnya: <span className="font-bold">
                    {scanAction === 'in' ? scanResult.attendanceTime : scanResult.checkoutTime} WIB
                  </span>
                </div>
              </div>
            )}

            {/* NOT FOUND / ERROR STATE */}
            {(scanStatus === 'not_found' || scanStatus === 'error') && (
              <div className="animate-in shake fade-in duration-300">
                <div className="mx-auto w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                  <XCircle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-red-700 mb-2">
                  {scanStatus === 'not_found' ? '❌ QR CODE TIDAK DIKENALI' : '❌ TERJADI KESALAHAN'}
                </h2>
                <p className="text-slate-600 mb-4">{scanResult?.message}</p>
                {scanResult?.qrCode && (
                  <div className="inline-block bg-white px-4 py-2 rounded-lg border border-red-100 font-mono text-sm">
                    {scanResult.qrCode}
                  </div>
                )}
              </div>
            )}
            
          </CardContent>
        </Card>
      </div>

      {/* Sidebar Recent Scans */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <Card className="flex-1 bg-slate-900 text-slate-100 border-slate-800">
          <CardContent className="p-4">
            <h3 className="font-semibold text-slate-300 uppercase tracking-wider text-sm mb-4 border-b border-slate-800 pb-2">
              Scan Terakhir
            </h3>
            
            <div className="space-y-3">
              {recentScans.length > 0 ? (
                recentScans.map((scan) => (
                  <div key={scan.id} className="flex items-center gap-3.5 bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 shadow-sm animate-in slide-in-from-right-4 fade-in hover:bg-slate-800 transition-colors">
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 shadow-inner">
                        {scan.photoUrl ? (
                          <img src={scan.photoUrl} alt={scan.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Users size={20} />
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-[#0f172a] rounded-full p-[2px]">
                        <CheckCircle size={14} className="text-emerald-500 fill-emerald-500/20" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-100">{scan.name}</p>
                      <p className="text-[11px] font-medium text-slate-400 truncate flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {scan.attendanceTime} WIB
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Belum ada data
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 text-sm text-slate-600 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${scanMode === 'usb' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
            <span>{scanMode === 'usb' ? 'Scanner USB aktif' : 'Kamera HP aktif'}</span>
          </div>
          <div className="flex justify-between items-center border-t pt-3">
            <span className="font-medium">ID Perangkat: <span className="text-slate-900">{scannerId || 'Belum diatur'}</span></span>
            <Button variant="ghost" size="sm" onClick={() => setShowScannerConfig(true)} className="h-6 px-2 text-xs">Ubah</Button>
          </div>
        </div>
      </div>

      <Dialog open={showScannerConfig} onOpenChange={setShowScannerConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfigurasi Scanner</DialogTitle>
            <DialogDescription>
              Tentukan identitas perangkat ini agar panitia dapat melacak gerbang masuk mana yang melakukan scan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="scannerId">Scanner ID (Misal: Gate A, Pintu VIP)</Label>
            <Input 
              id="scannerId" 
              value={tempScannerId} 
              onChange={(e) => setTempScannerId(e.target.value)} 
              placeholder="Masukkan identitas scanner..."
              className="mt-2"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button disabled={!tempScannerId.trim()} onClick={handleSaveScannerId}>Simpan Konfigurasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components for Scanner
function ScanOverlay() {
  return (
    <>
      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl -translate-x-1 -translate-y-1"></div>
      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl translate-x-1 -translate-y-1"></div>
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl -translate-x-1 translate-y-1"></div>
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl translate-x-1 translate-y-1"></div>
      
      <div className="w-full h-0.5 bg-emerald-500/50 absolute top-1/2 -translate-y-1/2 animate-scan shadow-[0_0_8px_2px_rgba(16,185,129,0.5)]"></div>
      <Search className="text-slate-300 w-16 h-16 opacity-50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </>
  );
}

function ParticipantCard({ participant }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden w-full relative">
      <div className="h-28 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05]"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </div>
      <div className="px-6 pb-8 pt-0 flex flex-col items-center -mt-14 relative z-10">
        <div className="relative mb-5">
          <div className="w-28 h-28 rounded-full border-4 border-white bg-slate-50 overflow-hidden shadow-xl">
            {participant.photoUrl ? (
              <img src={participant.photoUrl} alt={participant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Users size={48} />
              </div>
            )}
          </div>
          <div className="absolute bottom-1 right-1 bg-white rounded-full p-0.5 shadow-md border border-slate-50">
            <CheckCircle size={22} className="text-emerald-500 fill-emerald-50" />
          </div>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 uppercase text-center mb-1.5 tracking-tight">{participant.name}</h3>
        <p className="text-slate-500 font-medium text-center text-sm">{participant.delegation}</p>
        <div className="mt-5 px-5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider border border-emerald-100 shadow-sm">
          {participant.position}
        </div>
      </div>
    </div>
  );
}
