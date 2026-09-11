import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../../context/EventContext';
import { attendanceService } from '../../services/attendanceService';
import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle, AlertTriangle, XCircle, Search, Camera, Keyboard, ArrowLeft, Maximize, Minimize, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Scanner as QrReader } from '@yudiel/react-qr-scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function Scanner() {
  const navigate = useNavigate();
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
  
  // New States for UI/UX improvements
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  
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
        setActiveSession(activeEvent.sessions[0]);
      } else {
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

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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


  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const playSound = (type) => {
    if (isMuted) return;
    
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.1);
      } else if (type === 'warning') {
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(440, ctx.currentTime);
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
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, ctx.currentTime);
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
      // Dapatkan waktu saat ini dalam zona waktu WIB (Asia/Jakarta)
      const options = { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' };
      const currentTime = new Intl.DateTimeFormat('en-GB', options).format(new Date()); // Format: HH:mm
      
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

  const handleCameraScan = (detectedCodes) => {
    if (detectedCodes && detectedCodes.length > 0) {
      handleScan(detectedCodes[0].rawValue);
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
    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
        <Button variant="outline" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Dashboard
        </Button>
        <p>Pilih acara terlebih dahulu untuk memulai scanner.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Top Navigation Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Kembali ke Dashboard">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">{activeEvent.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">ABSENSI PESERTA</span>
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isOnline ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 animate-pulse'}`}>
                {isOnline ? '● ONLINE' : '○ OFFLINE'}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)} title={isMuted ? "Nyalakan Suara" : "Matikan Suara"}>
            {isMuted ? <VolumeX className="w-5 h-5 text-slate-400" /> : <Volume2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}>
            {isFullscreen ? <Minimize className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <Maximize className="w-5 h-5 text-slate-600 dark:text-slate-300" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-6 max-w-[1600px] w-full mx-auto">
        {/* Hidden input for USB barcode scanner */}
        {scanMode === 'usb' && (
          <form onSubmit={handleSubmit} className="absolute opacity-0 -z-10">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              autoFocus
              autoComplete="off"
            />
          </form>
        )}

        {/* Main Scanner Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 shadow-lg border-0 ring-1 ring-slate-200 dark:ring-slate-700 ${
            scanStatus === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20 ring-emerald-200 dark:ring-emerald-800/50' :
            scanStatus === 'already_attended' ? 'bg-amber-50 dark:bg-amber-950/20 ring-amber-200 dark:ring-amber-800/50' :
            scanStatus === 'not_found' || scanStatus === 'error' ? 'bg-red-50 dark:bg-red-950/20 ring-red-200 dark:ring-red-800/50' :
            'bg-white dark:bg-slate-800'
          }`}>
            
            {/* Control Bar (Inside Card) */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                {activeEvent.hasSessions && activeEvent.sessions?.length > 0 && (
                  <select 
                    className="h-9 px-3 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={activeSession}
                    onChange={(e) => setActiveSession(e.target.value)}
                  >
                    {activeEvent.sessions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                )}
                
                <div className="flex rounded-md shadow-sm" role="group">
                  <Button 
                    size="sm" 
                    variant={scanAction === 'in' ? 'default' : 'outline'}
                    onClick={() => setScanAction('in')}
                    className={`rounded-r-none ${scanAction === 'in' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'dark:text-slate-300 dark:border-slate-600'}`}
                  >
                    Check-in
                  </Button>
                  <Button 
                    size="sm" 
                    variant={scanAction === 'out' ? 'default' : 'outline'}
                    onClick={() => setScanAction('out')}
                    className={`rounded-l-none border-l-0 ${scanAction === 'out' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'dark:text-slate-300 dark:border-slate-600'}`}
                  >
                    Check-out
                  </Button>
                </div>
              </div>

              <div className="flex rounded-md shadow-sm" role="group">
                <Button 
                  size="sm" 
                  variant={scanMode === 'usb' ? 'default' : 'outline'}
                  onClick={() => setScanMode('usb')}
                  className={`rounded-r-none ${scanMode === 'usb' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'dark:text-slate-300 dark:border-slate-600'}`}
                >
                  <Keyboard className="w-4 h-4 mr-2" /> USB Mode
                </Button>
                <Button 
                  size="sm" 
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  onClick={() => { setScanMode('camera'); setIsCameraReady(false); }}
                  className={`rounded-l-none border-l-0 ${scanMode === 'camera' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'dark:text-slate-300 dark:border-slate-600'}`}
                >
                  <Camera className="w-4 h-4 mr-2" /> Kamera HP
                </Button>
              </div>
            </div>

            <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center relative min-h-[400px]">
              
              {/* IDLE STATE */}
              {scanStatus === 'idle' && (
                <div className="animate-in fade-in zoom-in duration-300 flex flex-col items-center w-full max-w-sm">
                  
                  {scanMode === 'usb' ? (
                    <>
                      <div className={`w-64 h-64 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center mb-8 relative transition-colors ${
                        isInputFocused ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-300 bg-slate-50 dark:bg-slate-800 dark:border-slate-600'
                      }`}>
                        {isInputFocused ? (
                          <>
                            <ScanOverlay />
                            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-sm animate-pulse">
                              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Scanner Siap
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-400 dark:text-slate-500 flex flex-col items-center">
                            <AlertTriangle className="w-12 h-12 mb-2 text-red-400" />
                            <span className="font-bold">FOKUS HILANG</span>
                          </div>
                        )}
                      </div>
                      
                      {isInputFocused ? (
                        <>
                          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Silakan Arahkan Scanner USB</h2>
                          <p className="text-slate-500 dark:text-slate-400 mt-2">Aplikasi sedang aktif dan siap menerima data QR dari perangkat Anda.</p>
                        </>
                      ) : (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 max-w-md w-full animate-bounce">
                          <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-1">Scanner Tidak Aktif!</h2>
                          <p className="text-red-600 dark:text-red-300 text-sm">Klik di mana saja pada area layar ini untuk mengaktifkan kembali tangkapan scanner USB.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="w-full aspect-square rounded-3xl overflow-hidden bg-slate-900 mb-8 relative shadow-lg flex items-center justify-center" ref={(el) => {
                        // Detect when the camera video is actually playing
                        if (el && !isCameraReady) {
                          const checkVideo = () => {
                            const video = el.querySelector('video');
                            if (video && video.readyState >= 2) {
                              setIsCameraReady(true);
                            } else {
                              setTimeout(checkVideo, 300);
                            }
                          };
                          // Start checking after a short delay to let the component mount
                          setTimeout(checkVideo, 500);
                        }
                      }}>
                        {!isCameraReady && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white z-20">
                            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
                            <p className="font-medium">Menyiapkan Kamera...</p>
                            <p className="text-xs text-slate-400 mt-2 text-center px-4">Pastikan Anda telah memberikan izin akses kamera pada browser.</p>
                          </div>
                        )}
                        <QrReader
                          onScan={(codes) => {
                            handleCameraScan(codes);
                          }}
                          onError={(error) => {
                            console.error('QR Scanner Error:', error);
                          }}
                          components={{
                            audio: false,
                            onOff: false,
                            torch: false,
                            zoom: false,
                            finder: false,
                          }}
                          constraints={{
                            facingMode: 'environment',
                          }}
                        />
                        <div className="absolute inset-0 border-[16px] border-black/40 z-10 pointer-events-none">
                          <ScanOverlay />
                        </div>
                      </div>
                      <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200">Arahkan Kamera ke QR</h2>
                      <p className="text-slate-500 dark:text-slate-400 mt-2">Posisikan QR code peserta di tengah area pemindaian.</p>
                    </>
                  )}

                </div>
              )}

              {/* SUCCESS STATE */}
              {scanStatus === 'success' && scanResult && (
                <div className="animate-in slide-in-from-bottom-8 fade-in duration-300 w-full max-w-md">
                  <div className="mx-auto w-20 h-20 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-6">✓ {scanAction === 'in' ? 'BERHASIL CHECK-IN' : 'BERHASIL CHECK-OUT'}</h2>
                  
                  <ParticipantCard participant={scanResult} />
                  
                  <div className="mt-6 text-emerald-700 dark:text-emerald-400 font-bold text-xl">
                    {scanAction === 'in' ? scanResult.attendanceTime : scanResult.checkoutTime} WIB
                  </div>
                </div>
              )}

              {/* ALREADY ATTENDED STATE */}
              {scanStatus === 'already_attended' && scanResult && (
                <div className="animate-in zoom-in-95 fade-in duration-300 w-full max-w-md">
                  <div className="mx-auto w-20 h-20 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-amber-700 dark:text-amber-400 mb-6">⚠ {scanAction === 'in' ? 'SUDAH CHECK-IN' : 'SUDAH CHECK-OUT'}</h2>
                  
                  <ParticipantCard participant={scanResult} />
                  
                  <div className="mt-6 text-amber-700 dark:text-amber-400">
                    Waktu {scanAction === 'in' ? 'Check-in' : 'Check-out'} sebelumnya: <span className="font-bold">
                      {scanAction === 'in' ? scanResult.attendanceTime : scanResult.checkoutTime} WIB
                    </span>
                  </div>
                </div>
              )}

              {/* NOT FOUND / ERROR STATE */}
              {(scanStatus === 'not_found' || scanStatus === 'error') && (
                <div className="animate-in shake fade-in duration-300 max-w-md w-full">
                  <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
                    <XCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">
                    {scanStatus === 'not_found' ? '❌ QR CODE TIDAK DIKENALI' : '❌ TERJADI KESALAHAN'}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-300 mb-4 bg-white/50 dark:bg-slate-900/50 p-3 rounded-lg">{scanResult?.message}</p>
                  {scanResult?.qrCode && (
                    <div className="inline-block bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-red-100 dark:border-red-900/50 font-mono text-sm dark:text-slate-200">
                      ID: {scanResult.qrCode}
                    </div>
                  )}
                </div>
              )}
              
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Recent Scans */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          <Card className="flex-1 bg-slate-900 text-slate-100 border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[300px] lg:max-h-full">
            <div className="p-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Histori Kehadiran
              </h3>
            </div>
            
            <CardContent className="p-4 flex-1 overflow-y-auto">
              <div className="space-y-3">
                {recentScans.length > 0 ? (
                  recentScans.map((scan) => (
                    <div key={scan.id} className="flex items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 shadow-sm animate-in slide-in-from-right-4 fade-in hover:bg-slate-700/80 transition-colors">
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
                  <div className="text-center py-10 flex flex-col items-center text-slate-500">
                    <Users className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm">Belum ada data kehadiran.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300 shadow-sm">
            <div className="flex items-center gap-3 font-medium">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${scanMode === 'usb' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'}`}></div>
              <span>{scanMode === 'usb' ? 'Mode USB Aktif' : 'Mode Kamera Aktif'}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3">
              <span className="font-medium text-slate-500 dark:text-slate-400">ID Gerbang: <span className="text-slate-900 dark:text-white font-bold ml-1">{scannerId || 'Belum diatur'}</span></span>
              <Button variant="secondary" size="sm" onClick={() => setShowScannerConfig(true)} className="h-7 px-3 text-xs rounded-full dark:bg-slate-700 dark:text-slate-200">Konfigurasi</Button>
            </div>
          </div>
        </div>

        <Dialog open={showScannerConfig} onOpenChange={setShowScannerConfig}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Konfigurasi Scanner</DialogTitle>
              <DialogDescription>
                Tentukan identitas perangkat ini agar sistem dapat melacak gerbang mana yang melakukan pencatatan.
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
    </div>
  );
}

// Sub-components for Scanner
function ScanOverlay() {
  return (
    <>
      <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-emerald-500 rounded-tl-2xl -translate-x-1 -translate-y-1 transition-all duration-300"></div>
      <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-emerald-500 rounded-tr-2xl translate-x-1 -translate-y-1 transition-all duration-300"></div>
      <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-emerald-500 rounded-bl-2xl -translate-x-1 translate-y-1 transition-all duration-300"></div>
      <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-emerald-500 rounded-br-2xl translate-x-1 translate-y-1 transition-all duration-300"></div>
      
      <div className="w-full h-0.5 bg-emerald-500/80 absolute top-1/2 -translate-y-1/2 animate-scan shadow-[0_0_12px_3px_rgba(16,185,129,0.6)]"></div>
      <Search className="text-emerald-500/20 w-20 h-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
    </>
  );
}

function ParticipantCard({ participant }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700 overflow-hidden w-full relative">
      <div className="h-28 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.05]"></div>
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
      </div>
      <div className="px-6 pb-8 pt-0 flex flex-col items-center -mt-14 relative z-10">
        <div className="relative mb-5 mt-4">
          <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl border-4 border-white dark:border-slate-800 bg-slate-50 dark:bg-slate-700 overflow-hidden shadow-2xl">
            {participant.photoUrl ? (
              <img src={participant.photoUrl} alt={participant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-500">
                <Users size={64} />
              </div>
            )}
          </div>
          <div className="absolute bottom-1 right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow-md border border-slate-50 dark:border-slate-700">
            <CheckCircle size={22} className="text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
          </div>
        </div>
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white uppercase text-center mb-1.5 tracking-tight line-clamp-2">{participant.name}</h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-center text-sm line-clamp-1">{participant.mpw} - {participant.mpc}</p>
        <div className="mt-5 px-5 py-1.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full uppercase tracking-wider border border-emerald-100 dark:border-emerald-800 shadow-sm">
          {participant.position}
        </div>
      </div>
    </div>
  );
}
