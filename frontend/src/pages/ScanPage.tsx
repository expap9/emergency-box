import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  Package, MapPin, AlertTriangle, CheckCircle, Clock,
  ArrowRight, RotateCcw, HandHeart, Bell, ChevronDown,
  ChevronUp, Loader2, CircleCheck,
} from 'lucide-react';
import { scanGetBox, scanGetWards, scanDistribute, scanLoan, scanReturn, scanRequestStock } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BoxInfo {
  batchNumber: string;
  batchStatus: string;       // ACTIVE | DISTRIBUTED | RETURNED | EXPIRED | RECALLED
  expiryDate: string;
  daysToExpiry: number;
  isRecyclable: boolean;     // expiryDate > today + 30 days
  box: { boxNumber: string } | null;
  medications: { name: string; genericName: string; strength?: string; unit: string; quantity: number }[];
  currentLocation: {
    distributionId: string;
    type: string;
    wardName?: string;
    wardCode?: string;
    wardFloor?: string;
    wardBuilding?: string;
    borrowerName?: string;
    borrowerDept?: string;
    loanPurpose?: string;
    distributedAt: string;
    expectedReturnAt?: string;
  } | null;
}

interface Ward { id: string; name: string; code: string; floor?: string; building?: string; }

type Action = 'distribute' | 'loan' | 'return' | 'request-stock';

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExpiryBanner({ date }: { date: string }) {
  const days = differenceInDays(new Date(date), new Date());
  if (days < 0) return (
    <div className="bg-red-600 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
      <AlertTriangle size={16} /> กล่องนี้หมดอายุแล้ว! กรุณาแจ้งห้องยา
    </div>
  );
  if (days <= 7) return (
    <div className="bg-orange-500 text-white px-4 py-2 text-sm font-semibold flex items-center gap-2">
      <AlertTriangle size={16} /> ใกล้หมดอายุ — อีก {days} วัน
    </div>
  );
  if (days <= 30) return (
    <div className="bg-yellow-400 text-yellow-900 px-4 py-2 text-sm font-semibold flex items-center gap-2">
      <Clock size={16} /> หมดอายุใน {days} วัน
    </div>
  );
  return null;
}

function SuccessScreen({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 px-6 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
        <CircleCheck size={44} className="text-green-600" />
      </div>
      <div>
        <p className="text-xl font-bold text-gray-800">บันทึกสำเร็จ</p>
        <p className="text-gray-600 mt-2 leading-relaxed">{message}</p>
      </div>
      <button onClick={onBack} className="btn-primary px-8 py-3 text-base">
        กลับหน้าหลัก
      </button>
    </div>
  );
}

// ─── Action Forms ─────────────────────────────────────────────────────────────

function DistributeForm({ qrCode, wards, onSuccess, onCancel }: {
  qrCode: string; wards: Ward[]; onSuccess: (msg: string) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ wardId: '', performedBy: '', performedByRole: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.wardId || !form.performedBy.trim()) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    setLoading(true);
    try {
      const res = await scanDistribute(qrCode, form);
      onSuccess(res.message);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
        📋 บันทึกการจ่ายกล่องไปหอผู้ป่วย — กรุณากรอกข้อมูลให้ครบ
      </div>
      <div>
        <label className="label">หอผู้ป่วยที่รับกล่อง <span className="text-red-500">*</span></label>
        <select className="input text-base py-3" value={form.wardId} onChange={e => setForm({ ...form, wardId: e.target.value })} required>
          <option value="">— เลือกหอผู้ป่วย —</option>
          {wards.map(w => (
            <option key={w.id} value={w.id}>
              {w.name}{w.building ? ` (อาคาร ${w.building}${w.floor ? ` ชั้น ${w.floor}` : ''})` : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">ชื่อผู้รับกล่อง <span className="text-red-500">*</span></label>
        <input className="input text-base py-3" placeholder="ชื่อ-นามสกุล" value={form.performedBy}
          onChange={e => setForm({ ...form, performedBy: e.target.value })} required />
      </div>
      <div>
        <label className="label">ตำแหน่ง / บทบาท</label>
        <input className="input text-base py-3" placeholder="เช่น พยาบาล, เจ้าหน้าที่" value={form.performedByRole}
          onChange={e => setForm({ ...form, performedByRole: e.target.value })} />
      </div>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary py-3 justify-center text-base">ยกเลิก</button>
        <button type="submit" className="btn-primary py-3 justify-center text-base" disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : '✓ บันทึก'}
        </button>
      </div>
    </form>
  );
}

function LoanForm({ qrCode, onSuccess, onCancel }: {
  qrCode: string; onSuccess: (msg: string) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ performedBy: '', borrowerDept: '', borrowerContact: '', loanPurpose: '', expectedReturnDays: '3' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.performedBy.trim()) { setError('กรุณาระบุชื่อผู้ยืม'); return; }
    setLoading(true);
    try {
      const res = await scanLoan(qrCode, { ...form, expectedReturnDays: parseInt(form.expectedReturnDays) || 3 });
      onSuccess(res.message);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'เกิดข้อผิดพลาด');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">
        🤝 บันทึกการยืมกล่อง — ระบุชื่อและแผนกเพื่อติดตามกล่องได้
      </div>
      <div>
        <label className="label">ชื่อผู้ยืม <span className="text-red-500">*</span></label>
        <input className="input text-base py-3" placeholder="ชื่อ-นามสกุล" value={form.performedBy}
          onChange={e => setForm({ ...form, performedBy: e.target.value })} required />
      </div>
      <div>
        <label className="label">แผนก / หน่วยงาน</label>
        <input className="input text-base py-3" placeholder="เช่น แผนกอุบัติเหตุ" value={form.borrowerDept}
          onChange={e => setForm({ ...form, borrowerDept: e.target.value })} />
      </div>
      <div>
        <label className="label">เบอร์ติดต่อ</label>
        <input className="input text-base py-3" placeholder="เบอร์โทรภายใน / มือถือ" value={form.borrowerContact}
          onChange={e => setForm({ ...form, borrowerContact: e.target.value })} type="tel" />
      </div>
      <div>
        <label className="label">วัตถุประสงค์</label>
        <input className="input text-base py-3" placeholder="เหตุผลในการยืม" value={form.loanPurpose}
          onChange={e => setForm({ ...form, loanPurpose: e.target.value })} />
      </div>
      <div>
        <label className="label">กำหนดคืน (วัน)</label>
        <select className="input text-base py-3" value={form.expectedReturnDays}
          onChange={e => setForm({ ...form, expectedReturnDays: e.target.value })}>
          {['1', '2', '3', '7', '14', '30'].map(d => <option key={d} value={d}>{d} วัน</option>)}
        </select>
      </div>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary py-3 justify-center text-base">ยกเลิก</button>
        <button type="submit" className="btn-primary py-3 justify-center text-base" disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : '✓ บันทึก'}
        </button>
      </div>
    </form>
  );
}

function ReturnForm({ qrCode, currentLocation, onSuccess, onCancel }: {
  qrCode: string;
  currentLocation: BoxInfo['currentLocation'];
  onSuccess: (msg: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ performedBy: '', condition: 'GOOD', conditionNotes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const conditions = [
    { value: 'GOOD', label: '✅ สมบูรณ์ดี', desc: 'ยาครบ กล่องสมบูรณ์' },
    { value: 'FAIR', label: '🟡 พอใช้', desc: 'กล่องมีรอยใช้งาน แต่ยาครบ' },
    { value: 'DAMAGED', label: '🔴 ชำรุด', desc: 'กล่องหรืออุปกรณ์เสียหาย' },
    { value: 'INCOMPLETE', label: '⚠️ ยาไม่ครบ', desc: 'ยาถูกใช้ไปหรือขาดหายไป' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.performedBy.trim()) { setError('กรุณาระบุชื่อผู้รับคืน'); return; }
    setLoading(true);
    try {
      const res = await scanReturn(qrCode, form);
      onSuccess(res.message);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'เกิดข้อผิดพลาด');
    } finally { setLoading(false); }
  };

  const from = currentLocation?.wardName ?? currentLocation?.borrowerName ?? 'ไม่ระบุ';

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
        📦 รับคืนกล่องจาก <strong>{from}</strong> — กรุณาตรวจสอบสภาพกล่องก่อนกด บันทึก
      </div>
      <div>
        <label className="label">ชื่อผู้รับคืน <span className="text-red-500">*</span></label>
        <input className="input text-base py-3" placeholder="ชื่อ-นามสกุล" value={form.performedBy}
          onChange={e => setForm({ ...form, performedBy: e.target.value })} required />
      </div>
      <div>
        <label className="label">สภาพกล่องที่รับคืน <span className="text-red-500">*</span></label>
        <div className="space-y-2 mt-1">
          {conditions.map(c => (
            <label key={c.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
              form.condition === c.value ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'
            }`}>
              <input type="radio" name="condition" value={c.value} checked={form.condition === c.value}
                onChange={() => setForm({ ...form, condition: c.value })} className="mt-0.5" />
              <div>
                <p className="font-medium text-sm">{c.label}</p>
                <p className="text-xs text-gray-500">{c.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      {(form.condition === 'DAMAGED' || form.condition === 'INCOMPLETE') && (
        <div>
          <label className="label">รายละเอียด <span className="text-red-500">*</span></label>
          <textarea className="input text-base" rows={3}
            placeholder="อธิบายความเสียหาย / ยาที่ขาดหายไป"
            value={form.conditionNotes}
            onChange={e => setForm({ ...form, conditionNotes: e.target.value })} />
        </div>
      )}
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary py-3 justify-center text-base">ยกเลิก</button>
        <button type="submit" className="btn-success py-3 justify-center text-base" disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : '✓ รับคืน'}
        </button>
      </div>
    </form>
  );
}

function RequestStockForm({ qrCode, onSuccess, onCancel }: {
  qrCode: string; onSuccess: (msg: string) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ performedBy: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.performedBy.trim()) { setError('กรุณาระบุชื่อ'); return; }
    setLoading(true);
    try {
      const res = await scanRequestStock(qrCode, form);
      onSuccess(res.message);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'เกิดข้อผิดพลาด');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-800">
        🔔 แจ้งห้องยาให้จัดยาใส่กล่องใหม่ — ห้องยาจะได้รับการแจ้งเตือนทันที
      </div>
      <div>
        <label className="label">ชื่อผู้แจ้ง <span className="text-red-500">*</span></label>
        <input className="input text-base py-3" placeholder="ชื่อ-นามสกุล" value={form.performedBy}
          onChange={e => setForm({ ...form, performedBy: e.target.value })} required />
      </div>
      <div>
        <label className="label">หมายเหตุ / เหตุผล</label>
        <textarea className="input text-base" rows={3}
          placeholder="เช่น ยาหมด, กล่องเสียหาย, ใกล้หมดอายุ"
          value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{error}</p>}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary py-3 justify-center text-base">ยกเลิก</button>
        <button type="submit" className="btn-primary py-3 justify-center text-base" disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : '📢 แจ้งห้องยา'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const DEMO_MEDS = [
  { name: 'Epinephrine', genericName: 'Epinephrine (Adrenaline)', strength: '1 mg/mL', unit: 'Amp', quantity: 5 },
  { name: 'Atropine', genericName: 'Atropine Sulfate', strength: '0.6 mg/mL', unit: 'Amp', quantity: 5 },
  { name: 'Amiodarone', genericName: 'Amiodarone HCl', strength: '150 mg/3 mL', unit: 'Amp', quantity: 3 },
  { name: 'Lidocaine', genericName: 'Lidocaine HCl', strength: '100 mg/5 mL', unit: 'Amp', quantity: 3 },
  { name: 'Dopamine', genericName: 'Dopamine HCl', strength: '200 mg/5 mL', unit: 'Amp', quantity: 2 },
  { name: 'Sodium Bicarbonate', genericName: 'Sodium Bicarbonate', strength: '8.4% 50 mL', unit: 'Vial', quantity: 2 },
  { name: 'Calcium Gluconate', genericName: 'Calcium Gluconate', strength: '10% 10 mL', unit: 'Amp', quantity: 2 },
  { name: 'Dextrose 50%', genericName: 'Dextrose 50%', strength: '50% 50 mL', unit: 'Vial', quantity: 2 },
  { name: 'Adenosine', genericName: 'Adenosine', strength: '6 mg/2 mL', unit: 'Vial', quantity: 2 },
  { name: 'Magnesium Sulfate', genericName: 'Magnesium Sulfate', strength: '50% 10 mL', unit: 'Amp', quantity: 2 },
  { name: 'Morphine', genericName: 'Morphine Sulfate', strength: '10 mg/mL', unit: 'Amp', quantity: 3 },
];

const DEMO_BOX_DISTRIBUTED: BoxInfo = {
  batchNumber: 'QR-20250501-142000-001',
  batchStatus: 'DISTRIBUTED',
  expiryDate: new Date(Date.now() + 5 * 86400000).toISOString(),
  daysToExpiry: 5,
  isRecyclable: false,
  box: null,
  medications: DEMO_MEDS.slice(0, 3),
  currentLocation: {
    distributionId: 'demo-dist-1',
    type: 'WARD',
    wardName: 'หน่วยผู้ป่วยวิกฤต (ICU)',
    wardCode: 'ICU',
    wardFloor: '5',
    wardBuilding: 'A',
    distributedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    expectedReturnAt: new Date(Date.now() + 10 * 86400000).toISOString(),
  },
};

const DEMO_BOX: BoxInfo = {
  batchNumber: 'QR-20250522-090000-001',
  batchStatus: 'ACTIVE',
  expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
  daysToExpiry: 365,
  isRecyclable: true,
  box: null,
  medications: DEMO_MEDS,
  currentLocation: null,
};

const DEMO_WARDS: Ward[] = [
  { id: '1', name: 'หอผู้ป่วยอายุรกรรมชาย', code: 'MED-M', floor: '3', building: 'A' },
  { id: '2', name: 'หน่วยผู้ป่วยวิกฤต (ICU)', code: 'ICU', floor: '5', building: 'A' },
  { id: '3', name: 'ห้องฉุกเฉิน', code: 'ER', floor: '1', building: 'A' },
  { id: '4', name: 'หอผู้ป่วยศัลยกรรม', code: 'SURG', floor: '4', building: 'A' },
];

export default function ScanPage() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get('demo');
  const isDemo = demoMode === '1' || demoMode === '2';
  const demoBox = demoMode === '2' ? DEMO_BOX_DISTRIBUTED : DEMO_BOX;

  const [box, setBox] = useState<BoxInfo | null>(isDemo ? demoBox : null);
  const [wards, setWards] = useState<Ward[]>(isDemo ? DEMO_WARDS : []);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!isDemo);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [showMeds, setShowMeds] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [boxData, wardData] = await Promise.all([
        scanGetBox(qrCode!),
        scanGetWards(),
      ]);
      setBox(boxData);
      setWards(wardData);
    } catch {
      setError('ไม่พบกล่องนี้ในระบบ หรือ QR Code ไม่ถูกต้อง');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (!isDemo) load(); }, [qrCode]);

  const handleSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setActiveAction(null);
  };

  const handleBack = () => {
    setSuccessMsg('');
    load(); // reload updated box info
  };

  // ─── Loading ───
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 size={40} className="animate-spin text-red-600 mx-auto" />
        <p className="text-gray-500 mt-3 text-sm">กำลังโหลดข้อมูลกล่อง...</p>
      </div>
    </div>
  );

  // ─── Error ───
  if (error || !box) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={36} className="text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-800">ไม่พบกล่องนี้</h1>
        <p className="text-gray-500 mt-2 text-sm">{error || 'QR Code ไม่ถูกต้องหรือกล่องยังไม่ได้ลงทะเบียนในระบบ'}</p>
        <p className="text-gray-400 mt-4 text-xs">กรุณาติดต่อห้องยา</p>
      </div>
    </div>
  );

  const { currentLocation, medications, expiryDate, daysToExpiry, batchStatus, isRecyclable } = box;
  const isActive = currentLocation !== null;
  const isExpired = daysToExpiry < 0;
  const isNearExpiry = !isExpired && !isRecyclable; // returned zone: 0-30 days
  const hasStock = medications.length > 0;
  // Can distribute/loan only when: not distributed, not expired, still recyclable
  const canDistribute = !isActive && hasStock && !isExpired && isRecyclable && batchStatus !== 'RECALLED';
  // Near-expiry box returned to pharmacy — can't go out again
  const isLockedNearExpiry = !isActive && isNearExpiry && batchStatus === 'RETURNED';

  // ─── Success screen ───
  if (successMsg) return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-red-700 text-white px-4 py-4 flex items-center gap-3">
        <Package size={20} />
        <span className="font-bold">กล่อง {box.batchNumber}</span>
      </div>
      <SuccessScreen message={successMsg} onBack={handleBack} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-red-700 text-white px-4 pt-6 pb-10">
        <div className="max-w-lg mx-auto">
          <p className="text-red-200 text-xs uppercase tracking-widest mb-1">Emergency Box</p>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{box.batchNumber}</h1>
            <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
              isExpired ? 'bg-red-900 text-red-200' :
              isActive ? 'bg-blue-500 text-white' :
              isLockedNearExpiry ? 'bg-orange-500 text-white' :
              'bg-green-500 text-white'
            }`}>
              {isExpired ? 'หมดอายุ' : isActive ? 'จ่ายออกแล้ว' : isLockedNearExpiry ? 'ใกล้หมดอายุ' : 'พร้อมจ่าย'}
            </div>
          </div>
          {expiryDate && (
            <p className="text-red-200 text-sm mt-1">
              หมดอายุ: {format(new Date(expiryDate), 'd MMMM yyyy', { locale: th })}
              {daysToExpiry >= 0 && (
                <span className="ml-2 text-red-100">({daysToExpiry} วัน)</span>
              )}
            </p>
          )}
          {box.box && <p className="text-red-300 text-xs mt-0.5">กล่อง: {box.box.boxNumber}</p>}
        </div>
      </div>

      {/* Expiry warning banner */}
      {expiryDate && <ExpiryBanner date={expiryDate} />}

      <div className="max-w-lg mx-auto px-4 -mt-6 space-y-4">

        {/* Current Location Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <MapPin size={16} className="text-red-600" />
            <span className="font-semibold text-gray-800">ตำแหน่งปัจจุบัน</span>
          </div>
          <div className="px-5 py-4">
            {isActive ? (
              <div className="space-y-2">
                {currentLocation.type === 'WARD' ? (
                  <>
                    <p className="text-xl font-bold text-gray-800">{currentLocation.wardName}</p>
                    {(currentLocation.wardBuilding || currentLocation.wardFloor) && (
                      <p className="text-sm text-gray-500">
                        {currentLocation.wardBuilding && `อาคาร ${currentLocation.wardBuilding} `}
                        {currentLocation.wardFloor && `ชั้น ${currentLocation.wardFloor}`}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-gray-800">{currentLocation.borrowerName}</p>
                    {currentLocation.borrowerDept && (
                      <p className="text-sm text-gray-500">{currentLocation.borrowerDept}</p>
                    )}
                    {currentLocation.loanPurpose && (
                      <p className="text-xs text-gray-400">วัตถุประสงค์: {currentLocation.loanPurpose}</p>
                    )}
                  </>
                )}
                <p className="text-xs text-gray-400">
                  จ่ายออกเมื่อ {format(new Date(currentLocation.distributedAt), 'd MMM yy HH:mm', { locale: th })}
                  {currentLocation.expectedReturnAt && (
                    <> · กำหนดคืน {format(new Date(currentLocation.expectedReturnAt), 'd MMM yy', { locale: th })}</>
                  )}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-700">อยู่ที่ห้องยา</p>
                  <p className="text-xs text-gray-500">{hasStock ? 'พร้อมจ่ายออก' : 'ยังไม่มียาในกล่อง'}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons or Active Form */}
        {activeAction ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Form header */}
            <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
              <span className="font-semibold text-gray-700">
                {activeAction === 'distribute' && '📋 จ่ายกล่องไปหอผู้ป่วย'}
                {activeAction === 'loan' && '🤝 ยืมกล่อง'}
                {activeAction === 'return' && '📦 รับคืนกล่อง'}
                {activeAction === 'request-stock' && '🔔 แจ้งขอลงยา'}
              </span>
              <button onClick={() => setActiveAction(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                ยกเลิก
              </button>
            </div>

            {activeAction === 'distribute' && (
              <DistributeForm qrCode={qrCode!} wards={wards}
                onSuccess={handleSuccess} onCancel={() => setActiveAction(null)} />
            )}
            {activeAction === 'loan' && (
              <LoanForm qrCode={qrCode!}
                onSuccess={handleSuccess} onCancel={() => setActiveAction(null)} />
            )}
            {activeAction === 'return' && (
              <ReturnForm qrCode={qrCode!} currentLocation={currentLocation}
                onSuccess={handleSuccess} onCancel={() => setActiveAction(null)} />
            )}
            {activeAction === 'request-stock' && (
              <RequestStockForm qrCode={qrCode!}
                onSuccess={handleSuccess} onCancel={() => setActiveAction(null)} />
            )}
          </div>
        ) : (
          /* Action Buttons */
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-800">ดำเนินการ</p>
              <p className="text-xs text-gray-400 mt-0.5">เลือกสิ่งที่ต้องการทำกับกล่องนี้</p>
            </div>
            <div className="divide-y divide-gray-50">

              {/* Return — only if distributed */}
              {isActive && (
                <button onClick={() => setActiveAction('return')}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-green-50 transition-colors text-left group">
                  <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors flex-shrink-0">
                    <RotateCcw size={20} className="text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800">รับคืนกล่อง</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      คืนจาก {currentLocation?.wardName ?? currentLocation?.borrowerName ?? '—'}
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-green-500 transition-colors" />
                </button>
              )}

              {/* Distribute — only if recyclable */}
              {canDistribute && (
                <button onClick={() => setActiveAction('distribute')}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50 transition-colors text-left group">
                  <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                    <ArrowRight size={20} className="text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">จ่ายกล่องไปหอผู้ป่วย</p>
                    <p className="text-xs text-gray-500 mt-0.5">บันทึกการจ่ายกล่องออกจากห้องยา</p>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                </button>
              )}

              {/* Loan — only if recyclable */}
              {canDistribute && (
                <button onClick={() => setActiveAction('loan')}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-purple-50 transition-colors text-left group">
                  <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors flex-shrink-0">
                    <HandHeart size={20} className="text-purple-700" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">ยืมกล่อง</p>
                    <p className="text-xs text-gray-500 mt-0.5">บันทึกการยืมชั่วคราว / ให้บุคคลนำไป</p>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-purple-500 transition-colors" />
                </button>
              )}

              {/* Near-expiry lock: returned but can't go out again */}
              {isLockedNearExpiry && (
                <div className="flex items-center gap-4 px-5 py-4 bg-orange-50">
                  <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-orange-700">ไม่สามารถจ่ายออกได้</p>
                    <p className="text-xs text-orange-600">เหลืออายุ {daysToExpiry} วัน (ต้องเกิน 30 วัน) — กรุณาแจ้งห้องยาออก QR ใหม่</p>
                  </div>
                </div>
              )}

              {/* Request Stock — always available */}
              <button onClick={() => setActiveAction('request-stock')}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-orange-50 transition-colors text-left group">
                <div className="w-11 h-11 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-200 transition-colors flex-shrink-0">
                  <Bell size={20} className="text-orange-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">แจ้งขอลงยา / เติมกล่อง</p>
                  <p className="text-xs text-gray-500 mt-0.5">แจ้งห้องยาให้จัดยาใส่กล่องใหม่</p>
                </div>
                <ArrowRight size={18} className="text-gray-300 group-hover:text-orange-500 transition-colors" />
              </button>

              {/* Expired warning */}
              {isExpired && !isActive && (
                <div className="flex items-center gap-4 px-5 py-4 bg-red-50">
                  <div className="w-11 h-11 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-red-700">กล่องหมดอายุแล้ว</p>
                    <p className="text-xs text-red-500">ไม่สามารถจ่ายออกได้ กรุณาแจ้งห้องยาออก QR Code ใหม่</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Medication List */}
        {medications.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowMeds(!showMeds)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <span className="font-semibold text-gray-800">
                รายการยาในกล่อง ({medications.length} รายการ)
              </span>
              {showMeds ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>
            {showMeds && (
              <div className="border-t divide-y divide-gray-50">
                {medications.map((m, i) => (
                  <div key={i} className="flex justify-between items-start px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{i + 1}. {m.name}</p>
                      <p className="text-xs text-gray-400">{m.genericName}{m.strength ? ` — ${m.strength}` : ''}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 whitespace-nowrap ml-3">
                      {m.quantity} {m.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-xs text-gray-400 pt-2 space-y-1">
          <p>{box.batchNumber}</p>
          <p>ข้อมูลนี้แสดงเฉพาะกล่องที่สแกนเท่านั้น</p>
          <p className="text-gray-300">EBTS — Hospital Emergency Box Tracking</p>
        </div>
      </div>
    </div>
  );
}
