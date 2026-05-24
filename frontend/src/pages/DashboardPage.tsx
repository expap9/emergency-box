import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { Package, AlertTriangle, CheckCircle, Clock, ArrowRight, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboard, getMonthlyStats } from '../lib/api';

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number; icon: typeof Package; color: string; sub?: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-600', '-100').replace('-800', '-100')}`}>
          <Icon size={24} className={color} />
        </div>
      </div>
    </div>
  );
}

function ExpiryBadge({ date }: { date: string }) {
  const days = differenceInDays(new Date(date), new Date());
  if (days < 0) return <span className="badge-red">หมดอายุแล้ว</span>;
  if (days <= 7) return <span className="badge-red">{days} วัน</span>;
  if (days <= 30) return <span className="badge-yellow">{days} วัน</span>;
  return <span className="badge-green">{days} วัน</span>;
}

export default function DashboardPage() {
  const { data: dashboard, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });
  const { data: monthly } = useQuery({ queryKey: ['monthly-stats'], queryFn: () => getMonthlyStats(6) });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  const s = dashboard?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">ภาพรวมระบบติดตาม Emergency Box</p>
        </div>
        <Link to="/batches/new" className="btn-primary">
          + จัดยากล่องใหม่
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="กล่องทั้งหมด" value={s.totalBoxes || 0} icon={Package} color="text-blue-600" />
        <StatCard label="พร้อมใช้งาน" value={s.availableBoxes || 0} icon={CheckCircle} color="text-green-600" />
        <StatCard label="จ่ายออกไปแล้ว" value={s.distributedBoxes || 0} icon={Building2} color="text-purple-600" />
        <StatCard label="ใกล้หมดอายุ (30 วัน)" value={s.expiringIn30 || 0} icon={AlertTriangle} color="text-red-600"
          sub={`ใน 7 วัน: ${s.expiringIn7 || 0} กล่อง`} />
      </div>

      {/* Alert Banner */}
      {(s.expiringIn7 > 0 || s.expiredBatches > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-red-800">ต้องดำเนินการด่วน!</p>
            <p className="text-red-700 text-sm">
              {s.expiringIn7 > 0 && `มีกล่องใกล้หมดอายุภายใน 7 วัน จำนวน ${s.expiringIn7} กล่อง `}
              {s.expiredBatches > 0 && `มีกล่องหมดอายุแล้ว ${s.expiredBatches} กล่อง`}
            </p>
          </div>
          <Link to="/reports" className="ml-auto text-red-600 hover:text-red-800 flex items-center gap-1 text-sm font-medium">
            ดูรายละเอียด <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Distributions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">กล่องที่จ่ายออกอยู่</h2>
            <Link to="/distributions" className="text-sm text-red-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="space-y-3">
            {dashboard?.recentDistributions?.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-6">ไม่มีกล่องที่จ่ายออก</p>
            )}
            {dashboard?.recentDistributions?.map((d: {
              id: string;
              batch: { box: { boxNumber: string } | null; batchNumber: string; expiryDate: string };
              ward?: { name: string } | null;
              borrowerName?: string;
              distributedAt: string;
            }) => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-red-100 rounded-lg p-2">
                    <Package size={16} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{d.batch.box?.boxNumber ?? d.batch.batchNumber}</p>
                    <p className="text-xs text-gray-500">{d.ward?.name ?? d.borrowerName ?? '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <ExpiryBadge date={d.batch.expiryDate} />
                  <p className="text-xs text-gray-400 mt-1">
                    {format(new Date(d.distributedAt), 'd MMM yy', { locale: th })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">สถิติรายเดือน</h2>
            <Link to="/reports" className="text-sm text-red-600 hover:underline">ดูรายงาน</Link>
          </div>
          {monthly && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="distributed" name="จ่ายออก" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="returned" name="รับคืน" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600 rounded" /> จ่ายออก</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-600 rounded" /> รับคืน</span>
          </div>
        </div>
      </div>

      {/* Ward Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">สถานะกล่องตามหอผู้ป่วย</h2>
          <Link to="/wards" className="text-sm text-red-600 hover:underline">ดูทั้งหมด</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">หอผู้ป่วย</th>
                <th className="table-header text-center">กล่องที่มีอยู่</th>
                <th className="table-header">กล่อง / วันหมดอายุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dashboard?.wardSummary?.filter((w: { activeBoxCount: number }) => w.activeBoxCount > 0).map((w: {
                id: string; name: string; activeBoxCount: number;
                distributions: { batch: { expiryDate: string; batchNumber: string } }[];
              }) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{w.name}</td>
                  <td className="table-cell text-center">
                    <span className="badge-blue">{w.activeBoxCount} กล่อง</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {w.distributions.map((d: { batch: { expiryDate: string; batchNumber: string } }, i: number) => (
                        <span key={i} className="text-xs text-gray-600">
                          {d.batch.batchNumber}: <ExpiryBadge date={d.batch.expiryDate} />
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
