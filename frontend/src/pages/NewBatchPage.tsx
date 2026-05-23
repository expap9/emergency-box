import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, addMonths } from 'date-fns';
import { ChevronLeft, Plus, Minus, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBoxes, getMedications, createBatch } from '../lib/api';

interface MedItem { medicationId: string; quantity: number; lotNumber: string; expiryDate: string; }

export default function NewBatchPage() {
  const navigate = useNavigate();
  const { data: boxes = [] } = useQuery({ queryKey: ['boxes'], queryFn: getBoxes });
  const { data: meds = [] } = useQuery({ queryKey: ['medications'], queryFn: getMedications });

  const [boxId, setBoxId] = useState('');
  const [expiryDate, setExpiryDate] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [medications, setMedications] = useState<MedItem[]>([]);

  // Auto-populate medications when meds loaded
  const initMeds = (medList: { id: string; standardQty: number }[]) => {
    if (medications.length === 0) {
      setMedications(medList.map(m => ({
        medicationId: m.id, quantity: m.standardQty, lotNumber: '', expiryDate: '',
      })));
    }
  };
  if (meds.length > 0 && medications.length === 0) initMeds(meds);

  const createMut = useMutation({
    mutationFn: createBatch,
    onSuccess: (data) => {
      toast.success('จัดยากล่องสำเร็จ!');
      navigate(`/batches/${data.id}/sticker`);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่'),
  });

  const updateMed = (idx: number, field: keyof MedItem, value: string | number) => {
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxId) return toast.error('กรุณาเลือกกล่อง');
    const validMeds = medications.filter(m => m.quantity > 0);
    createMut.mutate({ boxId, expiryDate, medications: validMeds, notes });
  };

  const availableBoxes = boxes.filter((b: { status: string }) => b.status === 'AVAILABLE');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">จัดยาใส่กล่อง Emergency</h1>
          <p className="text-gray-500 text-sm">บันทึกการจัดยาและออกสติกเกอร์</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Box & Expiry */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-lg border-b pb-3">ข้อมูลกล่อง</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">กล่อง Emergency <span className="text-red-500">*</span></label>
              <select className="input" value={boxId} onChange={e => setBoxId(e.target.value)} required>
                <option value="">-- เลือกกล่อง --</option>
                {availableBoxes.map((b: { id: string; boxNumber: string }) => (
                  <option key={b.id} value={b.id}>{b.boxNumber}</option>
                ))}
              </select>
              {availableBoxes.length === 0 && <p className="text-xs text-red-500 mt-1">ไม่มีกล่องว่าง กรุณาเพิ่มกล่องก่อน</p>}
            </div>
            <div>
              <label className="label">วันหมดอายุของกล่อง <span className="text-red-500">*</span></label>
              <input type="date" className="input" value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)} required />
              <p className="text-xs text-gray-400 mt-1">วันหมดอายุกล่อง = วันหมดอายุของยาที่หมดอายุก่อนสุด</p>
            </div>
          </div>
          <div>
            <label className="label">หมายเหตุ</label>
            <input className="input" placeholder="หมายเหตุ (ถ้ามี)" value={notes}
              onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Medications Table */}
        <div className="card">
          <h2 className="font-semibold text-lg border-b pb-3 mb-4">รายการยาในกล่อง ({medications.length} รายการ)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">รายการยา</th>
                  <th className="table-header text-center">จำนวน</th>
                  <th className="table-header">Lot No.</th>
                  <th className="table-header">วันหมดอายุ (ยา)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medications.map((item, idx) => {
                  const med = meds.find((m: { id: string }) => m.id === item.medicationId);
                  return (
                    <tr key={item.medicationId} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div>
                          <p className="font-medium">{med?.name}</p>
                          <p className="text-xs text-gray-400">{med?.genericName} {med?.strength}</p>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => updateMed(idx, 'quantity', Math.max(0, item.quantity - 1))}
                            className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                            <Minus size={12} />
                          </button>
                          <input type="number" min="0" className="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm"
                            value={item.quantity} onChange={e => updateMed(idx, 'quantity', parseInt(e.target.value) || 0)} />
                          <button type="button" onClick={() => updateMed(idx, 'quantity', item.quantity + 1)}
                            className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                            <Plus size={12} />
                          </button>
                          <span className="text-xs text-gray-400">{med?.unit}</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <input className="input text-sm py-1" placeholder="Lot number" value={item.lotNumber}
                          onChange={e => updateMed(idx, 'lotNumber', e.target.value)} />
                      </td>
                      <td className="table-cell">
                        <input type="date" className="input text-sm py-1" value={item.expiryDate}
                          onChange={e => updateMed(idx, 'expiryDate', e.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>ยกเลิก</button>
          <button type="submit" className="btn-primary" disabled={createMut.isPending}>
            <Printer size={18} />
            {createMut.isPending ? 'กำลังบันทึก...' : 'บันทึก & พิมพ์สติกเกอร์'}
          </button>
        </div>
      </form>
    </div>
  );
}
