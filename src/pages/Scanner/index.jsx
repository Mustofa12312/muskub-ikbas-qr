import { useState, useEffect, useRef } from 'react';
import { useEvent } from '../../context/EventContext';
import { attendanceService } from '../../services/attendanceService';
import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle, AlertTriangle, XCircle, Search, Camera, Keyboard } from 'lucide-react';
import { QrReader } from 'react-qr-reader';
import { Button } from '@/components/ui/button';

export default function Scanner() {
  const { activeEvent } = useEvent();
  const [scanMode, setScanMode] = useState('usb'); // 'usb' or 'camera'
  const [scanStatus, setScanStatus] = useState('idle'); // idle, success, already_attended, not_found, error
  const [scanResult, setScanResult] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  // Ref for the hidden input used by USB Scanner
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (activeEvent) {
      loadRecentScans();
    }
  }, [activeEvent]);

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

  const loadRecentScans = async () => {
    try {
      const data = await attendanceService.getRecentScans(activeEvent.id, 4);
      setRecentScans(data);
    } catch (error) {
      console.error("Failed to load recent scans", error);
    }
  };

  const playSound = (type) => {
    // Audio play omitted for brevity
  };

  const handleScan = async (qrCode) => {
    if (!activeEvent || !qrCode || !qrCode.trim()) return;
    
    // Prevent processing if already processing
    if (scanStatus !== 'idle') return;
    
    try {
      const result = await attendanceService.processAttendance(qrCode, activeEvent.id);
      
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
    } catch (error) {
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

  const handleCameraScan = (result, error) => {
    if (result) {
      handleScan(result?.text);
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
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 uppercase tracking-tight">{activeEvent.name}</h1>
          <p className="text-slate-500 mt-1">ABSENSI PESERTA</p>
        </div>

        <Card className={`flex-1 flex flex-col overflow-hidden transition-colors duration-300 relative ${
          scanStatus === 'success' ? 'bg-emerald-50 border-emerald-200' :
          scanStatus === 'already_attended' ? 'bg-amber-50 border-amber-200' :
          scanStatus === 'not_found' || scanStatus === 'error' ? 'bg-red-50 border-red-200' :
          'bg-white'
        }`}>
          {/* Scan Mode Toggle */}
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
                <h2 className="text-2xl font-bold text-emerald-700 mb-6">✓ BERHASIL</h2>
                
                <ParticipantCard participant={scanResult} />
                
                <div className="mt-6 text-emerald-700 font-bold text-xl">
                  {scanResult.attendanceTime} WIB
                </div>
              </div>
            )}

            {/* ALREADY ATTENDED STATE */}
            {scanStatus === 'already_attended' && scanResult && (
              <div className="animate-in zoom-in-95 fade-in duration-300 w-full max-w-md">
                <div className="mx-auto w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-6">
                  <AlertTriangle size={40} />
                </div>
                <h2 className="text-2xl font-bold text-amber-700 mb-6">⚠ SUDAH ABSEN</h2>
                
                <ParticipantCard participant={scanResult} />
                
                <div className="mt-6 text-amber-700">
                  Waktu hadir sebelumnya: <span className="font-bold">{scanResult.attendanceTime} WIB</span>
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
                  <div key={scan.id} className="flex items-center gap-3 bg-slate-800 p-2.5 rounded-lg animate-in slide-in-from-right-4 fade-in">
                    <div className="w-10 h-10 rounded bg-slate-700 overflow-hidden shrink-0 border border-slate-600">
                      {scan.photoUrl ? (
                        <img src={scan.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500">
                          <Users size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-slate-100">{scan.name}</p>
                      <p className="text-xs text-slate-400 truncate">{scan.attendanceTime}</p>
                    </div>
                    <CheckCircle size={16} className="text-emerald-500 shrink-0" />
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
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 text-sm text-slate-600 shadow-sm">
          <div className={`w-2 h-2 rounded-full animate-pulse ${scanMode === 'usb' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
          {scanMode === 'usb' ? 'Scanner USB aktif' : 'Kamera HP aktif'}
        </div>
      </div>
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden w-full">
      <div className="h-24 bg-gradient-to-r from-emerald-600 to-emerald-800"></div>
      <div className="px-6 pb-6 pt-0 flex flex-col items-center -mt-12">
        <div className="w-24 h-24 rounded-full border-4 border-white bg-slate-100 overflow-hidden shadow-md z-10 mb-4">
          {participant.photoUrl ? (
            <img src={participant.photoUrl} alt={participant.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              <Users size={40} />
            </div>
          )}
        </div>
        <h3 className="text-xl font-bold text-slate-900 uppercase text-center mb-1">{participant.name}</h3>
        <p className="text-slate-600 font-medium text-center">{participant.delegation}</p>
        <div className="mt-3 px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full uppercase tracking-wider">
          {participant.position}
        </div>
      </div>
    </div>
  );
}
