import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Mail, Lock, LogIn, Fingerprint, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isMockMode = import.meta.env.VITE_FIREBASE_API_KEY === "YOUR_API_KEY" || !import.meta.env.VITE_FIREBASE_API_KEY;
      
      if (isMockMode) {
        // Simulasi network delay
        await new Promise(r => setTimeout(r, 1000));
        toast.success('Login berhasil (Mock Mode)!');
        navigate('/');
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Login berhasil!');
      navigate('/');
    } catch (error) {
      toast.error('Login gagal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/50 to-slate-100 p-4">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-200/20 blur-[100px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] rounded-full bg-teal-200/20 blur-[100px]" />
      </div>

      <Card className="w-full max-w-[420px] shadow-2xl shadow-emerald-900/10 border border-white/50 bg-white/80 backdrop-blur-xl relative z-10 overflow-hidden rounded-2xl">
        {/* Top accent line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 absolute top-0 left-0"></div>
        
        <CardHeader className="text-center pt-10 pb-6 px-8">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-emerald-100/50">
            <Fingerprint className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <CardTitle className="text-2xl font-extrabold text-slate-800 tracking-tight">
            MUSKUB IV <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">IKBAS</span>
          </CardTitle>
          <CardDescription className="text-slate-500 mt-2.5 text-sm font-medium">
            Sistem Absensi & Manajemen Peserta
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-8 pb-10">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600 font-semibold text-[11px] uppercase tracking-wider ml-1">Email Administrator</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <Mail className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@muskub.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 bg-white/50 border-slate-200 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all rounded-xl shadow-sm hover:border-emerald-300/50 text-base"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-slate-600 font-semibold text-[11px] uppercase tracking-wider">Kata Sandi</Label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                  <Lock className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 pr-12 h-12 bg-white/50 border-slate-200 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all rounded-xl shadow-sm hover:border-emerald-300/50 text-base"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-emerald-600 focus:outline-none transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-5 w-5" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 mt-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition-all hover:shadow-emerald-600/30 hover:-translate-y-0.5 active:translate-y-0 text-base" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Memproses...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <LogIn className="w-5 h-5" strokeWidth={2} />
                  <span>Masuk ke Sistem</span>
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
