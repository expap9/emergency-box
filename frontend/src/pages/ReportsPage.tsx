import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AlertTriangle, Download, BarChart3 } from 'lucide-react';
import { getExpiryReport, getMonthlyStats, getWardReport } from '../lib/api';

const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'expiry' | 'monthly' | 'wards'>('expiry');
  const [expiryDays, setExpiryDays] = useState(30);

  const { data: expiryData = [] } = useQuery({
    queryKey: ['expiry-report', expiryDays],
    queryFn: () => getExpiryReport(expiryDays),
    enabled: activeTab === 'expiry',
  });
  const { data: monthly = [] } = useQuery({
    queryKey: ['monthly-stats', 12],
    queryFn: () => getMonthlyStats(12),
    enabled: activeTab === 'monthly',
  });
  const { data: wardData = [] } = useQuery({
    queryKey: ['ward-report'],
    queryFn: getWardReport,
    enabled: activeTab === 'wards',
  });

  const tabs = [
    { id: 'expiry', label: 'ใกล้หมดอายุ' },
    { id: 'monthly', label: 'สถิติรายเดือน' },
    { id: 'wards', label: 'สรุปตามหอผู้ป่วย' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">รายงาน</h1>
          <p className="text-gray-500 text-sm">สรุปข้อมูลการติดตาม Emergency Box</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.id ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Expiry Report */}
      {activeTab === 'expiry' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">แสดงกล่องที่หมดอายุภายใน</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setExpiryDays(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  expiryDays === d ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                {d} วัน
              </button>
            ))}
          </div>

          {expiryData.length === 0 ? (
            <div className="card text-center py-12">
              <AlertTriangle size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">ไม่มีกล่องที่ใกล้หมดอายุใน {expiryDays} วัน</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  พบ {expiryData.length} กล่อง ที่จะหมดอายุใน {expiryDays} วัน
                </span>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">กล่อง / Batch</th>
                    <th className="table-header">วันหมดอายุ</th>
                    <th className="table-header">เหลือ (วัน)</th>
                    <th className="table-header">ตำแหน่ง</th>
                    <th className="table-header">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expiryData.map((b: {
                    id: string; batchNumber: string; expiryDate: string; status: string;
                    box: { boxNumber: string };
                    distributions: { ward: { name: string } }[];
                  }) => {
                    const days = differenceInDays(new Date(b.expiryDate), new Date());
                    const ward = b.distributions?.[0]?.ward;
                    return (
                      <tr key={b.id} className={`hover:bg-gray-50 ${days <= 7 ? 'bg-red-50' : ''}`}>
                        <td className="table-cell">
                          <p className="font-medium">{b.box.boxNumber}</p>
                          <p className="text-xs text-gray-400">{b.batchNumber}</p>
                        </td>
                        <td className="table-cell text-sm">{format(new Date(b.expiryDate), 'd MMM yyyy', { locale: th })}</td>
                        <td className="table-cell">
                          <span className={`font-bold text-lg ${days <= 7 ? 'text-red-600' : days <= 14 ? 'text-orange-600' : 'text-yellow-600'}`}>
                            {days}
                          </span>
                        </td>
                        <td className="table-cell text-sm">{ward ? ward.name : 'ห้องยา'}</td>
                        <td className="table-cell">
                          <span className={`badge ${b.status === 'DISTRIBUTED' ? 'badge-blue' : 'badge-green'}`}>
                            {b.status === 'DISTRIBUTED' ? 'จ่ายออกแล้ว' : 'อยู่ที่ห้องยา'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Monthly Stats */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-4">การจ่ายและรับคืนรายเดือน (12 เดือนล่าสุด)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthly}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="distributed" name="จ่ายออก" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Bar dataKey="returned" name="รับคืน" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">เดือน</th>
                  <th className="table-header text-center">จ่ายออก</th>
                  <th className="table-header text-center">รับคืน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthly.map((m: { month: string; distributed: number; returned: number }) => (
                  <tr key={m.month} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{m.month}</td>
                    <td className="table-cell text-center font-semibold text-red-600">{m.distributed}</td>
                    <td className="table-cell text-center font-semibold text-green-600">{m.returned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ward Report */}
      {activeTab === 'wards' && (
        <div className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card">
              <h2 className="font-semibold mb-4">การใช้งานตามหอผู้ป่วย</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={wardData.filter((w: { totalDistributions: number }) => w.totalDistributions > 0)}
                    dataKey="totalDistributions" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {wardData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card overflow-hidden p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">หอผู้ป่วย</th>
                    <th className="table-header text-center">ทั้งหมด</th>
                    <th className="table-header text-center">ปัจจุบัน</th>
                    <th className="table-header text-center">คืนแล้ว</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {wardData.map((w: { id: string; name: string; totalDistributions: number; activeBoxes: number; returnedBoxes: number }) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-sm">{w.name}</td>
                      <td className="table-cell text-center font-bold">{w.totalDistributions}</td>
                      <td className="table-cell text-center">
                        {w.activeBoxes > 0 && <span className="badge-blue">{w.activeBoxes}</span>}
                      </td>
                      <td className="table-cell text-center">
                        {w.returnedBoxes > 0 && <span className="badge-green">{w.returnedBoxes}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
