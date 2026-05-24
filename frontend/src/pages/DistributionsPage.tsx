import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { ArrowLeftRight, RotateCcw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDistributions, returnBox } from '../lib/api';

const conditionOptions = [
  { value: 'GOOD', label: '✓ สมบูรณ์ดี', cls: 'bg-green-100 text-green-800' },
  { value: 'FAIR', label: '△ พอใช้', cls: 'bg-yellow-100 text-yellow-800' },
  { value: 'DAMAGED', label: '✕ ชำรุด', cls: 'bg-red-100 text-red-800' },
  { value: 'INCOMPLETE', label: '! ยาไม่ครบ', cls: 'bg-orange-100 text-orange-800' },
];

export default function DistributionsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [returnModal, setReturnModal] = useState<{ id: string; boxNumber: string } | null>(null);
  const [condition, setCondition] = useState('GOOD');
  const [conditionNotes, setConditionNotes] = useState('');

  const { data: distributions = [], isLoading } = useQuery({
    queryKey: ['distributions', statusFilter],
    queryFn: () => getDistributions(statusFilter ? { status: statusFilter } : {}),
  });

  const returnMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { condition: string; conditionNotes?: string } }) =>
      returnBox(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['distributions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('รับกล่องคืนเรียบร้อย');
      setReturnModal(null);
      setCondition('GOOD');
      setConditionNotes('');
    },
    onError: () => toast.error('ไม่สามารถรับกล่องคืนได้'),
  });

  const handleReturn = () => {
    if (!returnModal) return;
    returnMut.mutate({ id: returnModal.id, data: { condition, conditionNotes } });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">จ่าย / รับคืนกล่อง</h1>
          <p className="text-gray-500 text-sm">ประวัติการจ่ายและรับคืนกล่อง Emergency</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[
          { v: 'ACTIVE', l: 'กำลังใช้อยู่' },
          { v: 'RETURNED', l: 'คืนแล้ว' },
          { v: '', l: 'ทั้งหมด' },
        ].map(opt => (
          <button key={opt.v} onClick={() => setStatusFilter(opt.v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === opt.v ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}>
            {opt.l}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="table-header">กล่อง / Batch</th>
                <th className="table-header">หอผู้ป่วย</th>
                <th className="table-header">วันจ่าย</th>
                <th className="table-header">วันหมดอายุ</th>
                <th className="table-header">สถานะ</th>
                <th className="table-header">สภาพ</th>
                <th className="table-header">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {distributions.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">ไม่มีข้อมูล</td></tr>
              )}
              {distributions.map((d: {
                id: string; status: string; type?: string; condition?: string; conditionNotes?: string;
                distributedAt: string; returnedAt?: string;
                borrowerName?: string; borrowerDept?: string;
                batch: { box: { boxNumber: string } | null; batchNumber: string; expiryDate: string };
                ward?: { name: string } | null;
                distributedBy: { name: string };
              }) => {
                const days = differenceInDays(new Date(d.batch.expiryDate), new Date());
                const isOverdue = d.status === 'ACTIVE' && days < 0;
                const condOpt = conditionOptions.find(c => c.value === d.condition);
                const displayName = d.batch.box?.boxNumber ?? d.batch.batchNumber;
                const locationName = d.ward?.name ?? d.borrowerName ?? (d.type === 'LOAN' ? 'ยืม' : 'ไม่ระบุ');
                return (
                  <tr key={d.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {isOverdue && <AlertCircle size={14} className="text-red-600 flex-shrink-0" />}
                        <div>
                          <p className="font-medium">{displayName}</p>
                          <p className="text-xs text-gray-400">{d.batch.batchNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium">{locationName}</p>
                      <p className="text-xs text-gray-400">โดย {d.distributedBy.name}</p>
                    </td>
                    <td className="table-cell text-sm">
                      {format(new Date(d.distributedAt), 'd MMM yy', { locale: th })}
                    </td>
                    <td className="table-cell">
                      <span className={`text-sm font-medium ${days < 7 ? 'text-red-600' : days < 30 ? 'text-yellow-600' : 'text-gray-700'}`}>
                        {format(new Date(d.batch.expiryDate), 'd MMM yy', { locale: th })}
                      </span>
                      {d.status === 'ACTIVE' && (
                        <p className="text-xs text-gray-400">{days >= 0 ? `อีก ${days} วัน` : 'หมดอายุแล้ว'}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      {d.status === 'ACTIVE' ? (
                        <span className={`badge ${isOverdue ? 'badge-red' : 'badge-blue'}`}>
                          {isOverdue ? 'เลยกำหนด' : 'กำลังใช้'}
                        </span>
                      ) : (
                        <div>
                          <span className="badge-green">คืนแล้ว</span>
                          {d.returnedAt && <p className="text-xs text-gray-400 mt-0.5">{format(new Date(d.returnedAt), 'd MMM yy', { locale: th })}</p>}
                        </div>
                      )}
                    </td>
                    <td className="table-cell">
                      {condOpt && <span className={`badge ${condOpt.cls}`}>{condOpt.label}</span>}
                      {d.conditionNotes && <p className="text-xs text-gray-400 mt-0.5">{d.conditionNotes}</p>}
                    </td>
                    <td className="table-cell">
                      {d.status === 'ACTIVE' && (
                        <button
                          onClick={() => setReturnModal({ id: d.id, boxNumber: displayName })}
                          className="btn-secondary text-xs py-1.5"
                        >
                          <RotateCcw size={13} /> รับคืน
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Modal */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">รับกล่องคืน — {returnModal.boxNumber}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">สภาพกล่องที่รับคืน</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {conditionOptions.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setCondition(opt.value)}
                      className={`p-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                        condition === opt.value ? `border-red-500 ${opt.cls}` : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">หมายเหตุ (ถ้ามี)</label>
                <textarea className="input" rows={2} value={conditionNotes}
                  onChange={e => setConditionNotes(e.target.value)}
                  placeholder="รายละเอียดสภาพกล่อง ยาที่ขาด ฯลฯ" />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setReturnModal(null)}>ยกเลิก</button>
              <button className="btn-success" onClick={handleReturn} disabled={returnMut.isPending}>
                {returnMut.isPending ? 'กำลังบันทึก...' : '✓ ยืนยันรับคืน'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
