import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { ClipboardList, Printer, Plus, AlertTriangle } from 'lucide-react';
import { getBatches } from '../lib/api';

const statusMap: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'พร้อมจ่าย', cls: 'badge-green' },
  DISTRIBUTED: { label: 'จ่ายออกแล้ว', cls: 'badge-blue' },
  RETURNED: { label: 'รับคืนแล้ว', cls: 'badge-gray' },
  EXPIRED: { label: 'หมดอายุ', cls: 'badge-red' },
  RECALLED: { label: 'เรียกคืน', cls: 'badge-red' },
};

export default function BatchesPage() {
  const [filter, setFilter] = useState('');
  const [expiringSoon, setExpiringSoon] = useState(false);

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches', filter, expiringSoon],
    queryFn: () => getBatches({ ...(filter && { status: filter }), ...(expiringSoon && { expiringSoon: 'true' }) }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">การจัดยากล่อง (Batches)</h1>
          <p className="text-gray-500 text-sm">ประวัติการจัดยาทุก Batch</p>
        </div>
        <Link to="/batches/new" className="btn-primary">
          <Plus size={18} /> จัดยาใหม่
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {['', 'ACTIVE', 'DISTRIBUTED', 'RETURNED', 'EXPIRED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === s ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s === '' ? 'ทั้งหมด' : statusMap[s]?.label || s}
          </button>
        ))}
        <label className="flex items-center gap-2 ml-2 cursor-pointer text-sm text-gray-600">
          <input type="checkbox" checked={expiringSoon} onChange={e => setExpiringSoon(e.target.checked)}
            className="rounded border-gray-300 text-red-600" />
          <AlertTriangle size={14} className="text-yellow-500" /> ใกล้หมดอายุ (30 วัน)
        </label>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">Batch / กล่อง</th>
                <th className="table-header">วันจัด</th>
                <th className="table-header">วันหมดอายุ</th>
                <th className="table-header">สถานะ</th>
                <th className="table-header">ตำแหน่ง</th>
                <th className="table-header">สติกเกอร์</th>
                <th className="table-header">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">ไม่มีข้อมูล</td></tr>
              )}
              {batches.map((b: {
                id: string; batchNumber: string; status: string; stickerPrinted: boolean;
                preparedDate: string; expiryDate: string;
                box: { boxNumber: string } | null;
                preparedBy: { name: string };
                distributions: { ward: { name: string } }[];
              }) => {
                const days = differenceInDays(new Date(b.expiryDate), new Date());
                const st = statusMap[b.status] || { label: b.status, cls: 'badge-gray' };
                const ward = b.distributions?.[0]?.ward;
                return (
                  <tr key={b.id} className={`hover:bg-gray-50 ${days < 7 && b.status !== 'RETURNED' ? 'bg-red-50' : ''}`}>
                    <td className="table-cell">
                      <p className="font-medium">{b.batchNumber}</p>
                      <p className="text-xs text-gray-400">กล่อง {b.box?.boxNumber ?? '-'}</p>
                    </td>
                    <td className="table-cell text-sm">
                      {format(new Date(b.preparedDate), 'd MMM yy', { locale: th })}
                      <p className="text-xs text-gray-400">โดย {b.preparedBy.name}</p>
                    </td>
                    <td className="table-cell">
                      <span className={`text-sm font-semibold ${days < 7 ? 'text-red-600' : days < 30 ? 'text-yellow-600' : 'text-gray-700'}`}>
                        {format(new Date(b.expiryDate), 'd MMM yy', { locale: th })}
                      </span>
                      <p className="text-xs text-gray-400">{days >= 0 ? `อีก ${days} วัน` : 'หมดอายุแล้ว'}</p>
                    </td>
                    <td className="table-cell"><span className={st.cls}>{st.label}</span></td>
                    <td className="table-cell text-sm">{ward ? ward.name : <span className="text-gray-400">ห้องยา</span>}</td>
                    <td className="table-cell">
                      {b.stickerPrinted
                        ? <span className="badge-green text-xs">พิมพ์แล้ว</span>
                        : <span className="badge-yellow text-xs">ยังไม่พิมพ์</span>}
                    </td>
                    <td className="table-cell">
                      <Link to={`/batches/${b.id}/sticker`} className="btn-secondary text-xs py-1.5">
                        <Printer size={13} /> สติกเกอร์
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
