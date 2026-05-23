import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pill, Plus, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import { getMedications, createMedication, updateMedication } from '../lib/api';

interface Med { id: string; name: string; genericName: string; strength?: string; unit: string; standardQty: number; description?: string; sortOrder: number; isActive: boolean; }
type MedForm = Omit<Med, 'id' | 'isActive'>;
const emptyForm: MedForm = { name: '', genericName: '', strength: '', unit: 'Amp', standardQty: 1, description: '', sortOrder: 0 };

export default function MedicationsPage() {
  const qc = useQueryClient();
  const { data: meds = [], isLoading } = useQuery({ queryKey: ['medications'], queryFn: getMedications });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Med | null>(null);
  const [form, setForm] = useState<MedForm>(emptyForm);

  const mut = useMutation({
    mutationFn: (data: MedForm) => editing ? updateMedication(editing.id, data) : createMedication(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      toast.success(editing ? 'แก้ไขข้อมูลยาสำเร็จ' : 'เพิ่มรายการยาสำเร็จ');
      setShowModal(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const openEdit = (m: Med) => {
    setEditing(m);
    setForm({ name: m.name, genericName: m.genericName, strength: m.strength || '', unit: m.unit, standardQty: m.standardQty, description: m.description || '', sortOrder: m.sortOrder });
    setShowModal(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">รายการยา</h1>
          <p className="text-gray-500 text-sm">ยาใน Emergency Box ({meds.length} รายการ)</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm(emptyForm); setShowModal(true); }}>
          <Plus size={18} /> เพิ่มยา
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header w-8">#</th>
              <th className="table-header">ชื่อยา</th>
              <th className="table-header">Generic Name</th>
              <th className="table-header">Strength</th>
              <th className="table-header text-center">จำนวนมาตรฐาน</th>
              <th className="table-header">หน่วย</th>
              <th className="table-header">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {meds.map((m: Med, i: number) => (
              <tr key={m.id} className="hover:bg-gray-50 group">
                <td className="table-cell text-gray-400 text-xs">{i + 1}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 rounded p-1">
                      <Pill size={14} className="text-purple-600" />
                    </div>
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="table-cell text-sm text-gray-600">{m.genericName}</td>
                <td className="table-cell text-sm">{m.strength || '-'}</td>
                <td className="table-cell text-center">
                  <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm font-semibold">{m.standardQty}</span>
                </td>
                <td className="table-cell text-sm">{m.unit}</td>
                <td className="table-cell">
                  <button onClick={() => openEdit(m)} className="text-xs text-red-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity">แก้ไข</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'แก้ไขรายการยา' : 'เพิ่มรายการยาใหม่'}</h2>
            </div>
            <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">ชื่อทางการค้า <span className="text-red-500">*</span></label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <label className="label">Generic Name <span className="text-red-500">*</span></label>
                  <input className="input" value={form.genericName} onChange={e => setForm({ ...form, genericName: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Strength / Concentration</label>
                  <input className="input" value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} placeholder="1 mg/mL" />
                </div>
                <div>
                  <label className="label">หน่วย <span className="text-red-500">*</span></label>
                  <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                    {['Amp', 'Vial', 'Tab', 'Cap', 'mL', 'g'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">จำนวนมาตรฐาน <span className="text-red-500">*</span></label>
                  <input type="number" min="1" className="input" value={form.standardQty}
                    onChange={e => setForm({ ...form, standardQty: parseInt(e.target.value) || 1 })} required />
                </div>
                <div>
                  <label className="label">ลำดับที่</label>
                  <input type="number" min="0" className="input" value={form.sortOrder}
                    onChange={e => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="col-span-2">
                  <label className="label">หมายเหตุ</label>
                  <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
