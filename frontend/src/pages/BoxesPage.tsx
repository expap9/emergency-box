import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Package, Plus, QrCode, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBoxes, createBox } from '../lib/api';

const statusLabel: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'พร้อมใช้', cls: 'badge-green' },
  DISTRIBUTED: { label: 'จ่ายออก', cls: 'badge-blue' },
  EXPIRED: { label: 'หมดอายุ', cls: 'badge-red' },
  MAINTENANCE: { label: 'ซ่อมบำรุง', cls: 'badge-yellow' },
  RETIRED: { label: 'ปลดประจำการ', cls: 'badge-gray' },
};

export default function BoxesPage() {
  const qc = useQueryClient();
  const { data: boxes = [], isLoading } = useQuery({ queryKey: ['boxes'], queryFn: getBoxes });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ boxNumber: '', notes: '' });

  const createMut = useMutation({
    mutationFn: createBox,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['boxes'] });
      toast.success(`สร้างกล่อง ${data.boxNumber} สำเร็จ`);
      setShowModal(false);
      setForm({ boxNumber: '', notes: '' });
    },
    onError: () => toast.error('ไม่สามารถสร้างกล่องได้'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">กล่อง Emergency</h1>
          <p className="text-gray-500 text-sm">ทะเบียนกล่องยาทั้งหมด</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> เพิ่มกล่องใหม่
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {boxes.map((box: {
          id: string; boxNumber: string; status: string; updatedAt: string;
          batches: { expiryDate: string; status: string; distributions: { ward: { name: string } }[] }[];
        }) => {
          const lastBatch = box.batches?.[0];
          const ward = lastBatch?.distributions?.[0]?.ward;
          const st = statusLabel[box.status] || statusLabel.AVAILABLE;
          return (
            <div key={box.id} className="card hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="bg-red-100 rounded-lg p-3 group-hover:bg-red-200 transition-colors">
                  <Package size={20} className="text-red-700" />
                </div>
                <span className={st.cls}>{st.label}</span>
              </div>
              <h3 className="font-bold text-lg mt-3">{box.boxNumber}</h3>
              {ward && <p className="text-xs text-gray-500">📍 {ward.name}</p>}
              {lastBatch && (
                <p className="text-xs text-gray-400 mt-1">
                  หมดอายุ: {format(new Date(lastBatch.expiryDate), 'd MMM yy', { locale: th })}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <Link to={`/batches?boxId=${box.id}`} className="btn-secondary text-xs py-1 px-2 flex-1 justify-center">
                  ประวัติ
                </Link>
                <Link to={`/boxes/${box.id}/qrcode`} className="btn-secondary text-xs py-1 px-2">
                  <QrCode size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Box Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">เพิ่มกล่อง Emergency ใหม่</h2>
            </div>
            <form onSubmit={e => { e.preventDefault(); createMut.mutate(form); }} className="p-6 space-y-4">
              <div>
                <label className="label">หมายเลขกล่อง <span className="text-red-500">*</span></label>
                <input className="input" placeholder="เช่น EB-001" value={form.boxNumber}
                  onChange={e => setForm({ ...form, boxNumber: e.target.value })} required />
              </div>
              <div>
                <label className="label">หมายเหตุ</label>
                <textarea className="input" rows={2} placeholder="หมายเหตุ (ถ้ามี)" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary" disabled={createMut.isPending}>
                  {createMut.isPending ? 'กำลังสร้าง...' : 'สร้างกล่อง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
