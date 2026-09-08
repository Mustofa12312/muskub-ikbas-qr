import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEvent } from '../../context/EventContext';
import { attendanceService } from '../../services/attendanceService';
import { Users, UserCheck, UserX, Percent, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { activeEvent, loading: eventLoading } = useEvent();
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, percentage: 0 });
  const [recentScans, setRecentScans] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = null;

    if (activeEvent) {
      setLoading(true);
      unsubscribe = attendanceService.subscribeToDashboardData(
        activeEvent.id, 
        (statsData, recentData, allPresent) => {
          setStats(statsData);
          setRecentScans(recentData);

          // Process chart data
          const groupedByHour = {};
          allPresent.forEach(p => {
            if(p.attendanceTime) {
              const hour = p.attendanceTime.split(':')[0] + ':00';
              groupedByHour[hour] = (groupedByHour[hour] || 0) + 1;
            }
          });
          
          const chartFormatted = Object.keys(groupedByHour).sort().map(hour => ({
            time: hour,
            peserta: groupedByHour[hour]
          }));
          setChartData(chartFormatted);
          setLoading(false);
        }
      );
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeEvent]);

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
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" /> 
              Tren Kedatangan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : chartData.length > 0 ? (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPeserta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="peserta" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPeserta)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 text-sm h-[300px] flex items-center justify-center border-dashed border-2 border-slate-100 rounded-xl">
                Data belum cukup untuk menampilkan grafik
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
