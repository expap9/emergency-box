import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { Package, Plus, QrCode, Trash2, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBoxes, getBatches, createBox, deleteBox } from '../lib/api';
import { useAuth } from '../lib/auth';

const statusLabel: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'พร้อมใช้', cls: 'badge-green' },
  DISTRIBUTED: { label: 'จ่ายออก', cls: 'badge-blue' },
  EXPIRED: { label: 'หมดอายุ', cls: 'badge-red' },
  MAINTENANCE: { label: 'ซ่อมบำรุง', cls: 'badge-yellow' },
  RETIRED: { label: 'ปลดประจำการ', cls: 'badge-gray' },
};

const batchStatusLabel: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'พร้อมจ่าย', cls: 'badge-green' },
  DISTRIBUTED: { label: 'จ่ายออก', cls: 'badge-blue' },
  RETURNED: { label: 'รับคืนแล้ว', cls: 'badge-gray' },
  EXPIRED: { label: 'หมดอายุ', cls: 'badge-red' },
  RECALLED: { label: 'เรียกคืน', cls: 'badge-red' },
};

export default function BoxesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: boxes = [], isLoading: boxLoading } = useQuery({ queryKey: ['boxes'], queryFn: getBoxes });
  // QR-only active batches (no physical box) — ACTIVE or DISTRIBUTED
  const { data: allBatches = [], isLoading: batchLoading } = useQuery({
    queryKey: ['batches-for-boxes'],
    queryFn: () => getBatches(),
  });

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ boxNumber: '', notes: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; boxNumber: string } | null>(null);

  // QR-only batches = no boxId, status ACTIVE or DISTRIBUTED
  const qrBatches = (allBatches as {
    id: string; batchNumber: string; qrCode?: string; boxId?: string | null; status: string;
    expiryDate: string; preparedDate: string;
    preparedBy: { name: string };
    distributions: { ward: { name: string } | null }[];
  }[]).filter(b => !b.boxId && (b.status === 'ACTIVE' || b.status === 'DISTRIBUTED'));

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

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBox(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['boxes'] });
      toast.success(data.message);
      setConfirmDelete(null);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error ?? 'ไม่สามารถลบได้');
      setConfirmDelete(null);
    },
  });

  const isLoading = boxLoading || batchLoading;
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

      {/* ─── Physical Boxes ─── */}
      {boxes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            กล่องฟิสิคัล ({boxes.length} กล่อง)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(boxes as {
              id: string; boxNumber: string; status: string;
              batches: { id: string; expiryDate: string; status: string; distributions: { ward: { name: string } | null }[] }[];
            }[]).map((box) => {
              const lastBatch = box.batches?.[0];
              const ward = lastBatch?.distributions?.[0]?.ward;
              const st = statusLabel[box.status] || statusLabel.AVAILABLE;
              return (
                <div key={box.id} className="card hover:shadow-md transition-shadow group">
                  <div className="flex items-start justify-between">
                    <div className="bg-red-100 rounded-lg p-3 group-hover:bg-red-200 transition-colors">
                      <Package size={20} className="text-red-700" />
                    </div>
                    <span className={st.cls}>{st.label}</span>
                  </div>
                  <h3 className="font-bold text-lg mt-3">{box.boxNumber}</h3>
                  {ward && <p className="text-xs text-gray-500 mt-0.5">📍 {ward.name}</p>}
                  {lastBatch && (
                    <p className="text-xs text-gray-400 mt-1">
                      หมดอายุ: {format(new Date(lastBatch.expiryDate), 'd MMM yy', { locale: th })}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Link to={`/batches?boxId=${box.id}&boxNumber=${encodeURIComponent(box.boxNumber)}`} className="btn-secondary text-xs py-1 px-2 flex-1 justify-center">
                      ประวัติ
                    </Link>
                    <Link to={`/boxes/${box.id}/qrcode`} className="btn-secondary text-xs py-1 px-2">
                      <QrCode size={14} />
                    </Link>
                    {user?.role === 'ADMIN' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: box.id, boxNumber: box.boxNumber }); }}
                        className="btn-secondary text-xs py-1 px-2 text-red-600 hover:bg-red-50 hover:border-red-300"
                        title="ลบกล่อง"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── QR-issue Batches ─── */}
      {qrBatches.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            QR Code Batches — พร้อมจ่าย / จ่ายออกแล้ว ({qrBatches.length} ชุด)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {qrBatches.map((b) => {
              const days = differenceInDays(new Date(b.expiryDate), new Date());
              const ward = b.distributions?.[0]?.ward;
              const st = batchStatusLabel[b.status] || batchStatusLabel.ACTIVE;
              return (
                <div key={b.id} className="card hover:shadow-md transition-shadow group border-l-4 border-l-blue-400">
                  <div className="flex items-start justify-between">
                    <div className="bg-blue-100 rounded-lg p-3 group-hover:bg-blue-200 transition-colors">
                      <ClipboardList size={20} className="text-blue-700" />
                    </div>
                    <span className={st.cls}>{st.label}</span>
                  </div>
                  <h3 className="font-bold text-sm mt-3 text-blue-800 truncate" title={b.batchNumber}>
                    {b.batchNumber}
                  </h3>
                  {ward
                    ? <p className="text-xs text-gray-500 mt-0.5">📍 {ward.name}</p>
                    : <p className="text-xs text-gray-400 mt-0.5">🏥 ห้องยา</p>
                  }
                  <p className={`text-xs mt-1 font-medium ${days < 7 ? 'text-red-600' : days < 30 ? 'text-yellow-600' : 'text-gray-400'}`}>
                    หมดอายุ: {format(new Date(b.expiryDate), 'd MMM yy', { locale: th })}
                    {days >= 0 ? ` (อีก ${days} วัน)` : ' (หมดแล้ว)'}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Link to={`/batches/${b.id}/sticker`} className="btn-secondary text-xs py-1 px-2 flex-1 justify-center">
                      สติกเกอร์
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {boxes.length === 0 && qrBatches.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>ยังไม่มีกล่องในระบบ</p>
          <p className="text-sm mt-1">กด "เพิ่มกล่องใหม่" หรือไปที่ "ออก QR Code" เพื่อเริ่มต้น</p>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="p-6 text-center space-y-3">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h2 className="text-lg font-semibold">ยืนยันการลบกล่อง?</h2>
              <p className="text-gray-500 text-sm">
                กล่อง <span className="font-bold text-gray-800">{confirmDelete.boxNumber}</span>
              </p>
              <p className="text-xs text-gray-400">
                หากกล่องมีประวัติการจัดยา ระบบจะ "ปลดประจำการ" แทนการลบถาวร
              </p>
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button className="btn-secondary flex-1 justify-center" onClick={() => setConfirmDelete(null)}>ยกเลิก</button>
              <button
                className="btn-primary flex-1 justify-center bg-red-600 hover:bg-red-700"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(confirmDelete.id)}
              >
                {deleteMut.isPending ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <input className="input" placeholder="เช่น EB-006" value={form.boxNumber}
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
