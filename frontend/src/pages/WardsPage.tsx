import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { getWards, createWard, updateWard } from '../lib/api';

interface Ward { id: string; name: string; code: string; floor?: string; building?: string; department?: string; contactName?: string; contactPhone?: string; distributions: { batch: { box: { boxNumber: string } } }[]; }
type WardForm = Omit<Ward, 'id' | 'distributions'>;
const emptyForm: WardForm = { name: '', code: '', floor: '', building: '', department: '', contactName: '', contactPhone: '' };

export default function WardsPage() {
  const qc = useQueryClient();
  const { data: wards = [], isLoading } = useQuery({ queryKey: ['wards'], queryFn: getWards });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Ward | null>(null);
  const [form, setForm] = useState<WardForm>(emptyForm);

  const mut = useMutation({
    mutationFn: (data: WardForm) => editing ? updateWard(editing.id, data) : createWard(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wards'] });
      toast.success(editing ? 'แก้ไขหอผู้ป่วยสำเร็จ' : 'เพิ่มหอผู้ป่วยสำเร็จ');
      setShowModal(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const openEdit = (w: Ward) => { setEditing(w); setForm({ name: w.name, code: w.code, floor: w.floor || '', building: w.building || '', department: w.department || '', contactName: w.contactName || '', contactPhone: w.contactPhone || '' }); setShowModal(true); };
  const openNew = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">หอผู้ป่วย</h1>
          <p className="text-gray-500 text-sm">จัดการหอผู้ป่วยในระบบ</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={18} /> เพิ่มหอผู้ป่วย</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wards.map((w: Ward) => (
          <div key={w.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="bg-blue-100 rounded-lg p-2">
                <Building2 size={20} className="text-blue-600" />
              </div>
              <span className="badge-blue text-xs">{w.code}</span>
            </div>
            <h3 className="font-bold mt-3">{w.name}</h3>
            {w.department && <p className="text-xs text-gray-500">{w.department}</p>}
            {(w.building || w.floor) && (
              <p className="text-xs text-gray-400">{w.building && `อาคาร ${w.building} `}{w.floor && `ชั้น ${w.floor}`}</p>
            )}
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex items-center gap-1.5">
                <Package size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500">
                  {w.distributions?.length || 0} กล่อง
                </span>
              </div>
              <button onClick={() => openEdit(w)} className="text-xs text-red-600 hover:underline">แก้ไข</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'แก้ไขหอผู้ป่วย' : 'เพิ่มหอผู้ป่วยใหม่'}</h2>
            </div>
            <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">ชื่อหอผู้ป่วย <span className="text-red-500">*</span></label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">รหัสหอ <span className="text-red-500">*</span></label>
                  <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="MED-M" />
                </div>
                <div>
                  <label className="label">แผนก</label>
                  <input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                </div>
                <div>
                  <label className="label">อาคาร</label>
                  <input className="input" value={form.building} onChange={e => setForm({ ...form, building: e.target.value })} />
                </div>
                <div>
                  <label className="label">ชั้น</label>
                  <input className="input" value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} />
                </div>
                <div>
                  <label className="label">ชื่อผู้ติดต่อ</label>
                  <input className="input" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
                </div>
                <div>
                  <label className="label">โทรศัพท์</label>
                  <input className="input" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn-primary" disabled={mut.isPending}>
                  {mut.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
