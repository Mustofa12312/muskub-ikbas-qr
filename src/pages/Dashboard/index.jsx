import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '../../context/EventContext';
import { attendanceService } from '../../services/attendanceService';
import { Users, UserCheck, UserX, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { activeEvent, loading: eventLoading } = useEvent();
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, percentage: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeEvent) {
      loadDashboardData();
    }
  }, [activeEvent]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, recentData] = await Promise.all([
        attendanceService.getAttendanceStats(activeEvent.id),
        attendanceService.getRecentScans(activeEvent.id, 5)
      ]);
      setStats(statsData);
      setRecentScans(recentData);
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  if (eventLoading) {
    return <div className="p-8"><Skeleton className="h-8 w-64 mb-6" /><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>;
  }

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <h2 className="text-xl font-medium">Belum ada acara aktif</h2>
        <p>Silakan buat acara baru di halaman Acara.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">{activeEvent.name}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Peserta</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Sudah Hadir</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{loading ? <Skeleton className="h-8 w-16" /> : stats.present}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Belum Hadir</CardTitle>
            <UserX className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{loading ? <Skeleton className="h-8 w-16" /> : stats.absent}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Persentase</CardTitle>
            <Percent className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{loading ? <Skeleton className="h-8 w-16" /> : `${stats.percentage}%`}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Kehadiran Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-4 w-[150px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentScans.length > 0 ? (
              <div className="space-y-4">
                {recentScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center space-x-4">
                      <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {scan.photoUrl ? (
                          <img src={scan.photoUrl} alt={scan.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            <Users size={20} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">{scan.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{scan.delegation} • {scan.position}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-emerald-600">Hadir</p>
                      <p className="text-xs text-slate-500">{scan.attendanceTime}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                Belum ada data kehadiran untuk acara ini.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
