import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { format, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import QRCodeSVG from 'react-qr-code';
import { Printer, ChevronLeft, Check, AlertTriangle, MapPin, RotateCcw, RefreshCw, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBatch, printSticker, distributeBox, getWards, refillBatch, recallBatch } from '../lib/api';

const RECYCLE_DAYS = 30; // must match backend scan.ts

export default function StickerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedWard, setSelectedWard] = useState('');
  const [refillExpiry, setRefillExpiry] = useState('');
  const [refillNotes, setRefillNotes] = useState('');
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallReason, setRecallReason] = useState('');

  const { data: batch, refetch, isLoading: batchLoading, isError: batchError } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => getBatch(id!),
    retry: 1,
  });
  const { data: wards = [] } = useQuery({ queryKey: ['wards'], queryFn: getWards });

  const printMut = useMutation({
    mutationFn: () => printSticker(id!),
    onSuccess: () => { toast.success('บันทึกการพิมพ์สติกเกอร์แล้ว'); refetch(); },
  });

  const distributeMut = useMutation({
    mutationFn: ({ wardId }: { wardId: string }) => distributeBox({ batchId: id!, wardId }),
    onSuccess: () => {
      toast.success('จ่ายกล่องออกไปหอผู้ป่วยแล้ว');
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/distributions');
    },
    onError: () => toast.error('ไม่สามารถจ่ายกล่องได้'),
  });

  const refillMut = useMutation({
    mutationFn: () => refillBatch(id!, { expiryDate: refillExpiry, notes: refillNotes }),
    onSuccess: () => {
      toast.success('ลงยาใหม่เรียบร้อย — พร้อมจ่ายออก');
      qc.invalidateQueries({ queryKey: ['batch', id] });
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      refetch();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error ?? 'ไม่สามารถลงยาใหม่ได้');
    },
  });

  const recallMut = useMutation({
    mutationFn: () => recallBatch(id!, recallReason.trim()),
    onSuccess: () => {
      toast.success('ยกเลิก QR Code เรียบร้อยแล้ว');
      qc.invalidateQueries({ queryKey: ['batch', id] });
      qc.invalidateQueries({ queryKey: ['batches'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowRecallModal(false);
      setRecallReason('');
      refetch();
    },
    onError: () => toast.error('ไม่สามารถยกเลิก QR Code ได้'),
  });

  // Days remaining for the new refill expiry date the user typed
  const refillDaysRemaining = refillExpiry
    ? differenceInDays(new Date(refillExpiry), new Date())
    : null;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    onAfterPrint: () => printMut.mutate(),
    documentTitle: `Sticker-${batch?.batchNumber}`,
  });

  if (batchLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" />
    </div>
  );

  if (batchError || !batch) return (
    <div className="max-w-4xl mx-auto space-y-4">
      <button onClick={() => navigate(-1)} className="btn-secondary p-2">
        <ChevronLeft size={18} />
      </button>
      <div className="card text-center py-16 space-y-3">
        <AlertTriangle size={40} className="text-red-400 mx-auto" />
        <p className="text-gray-700 font-medium">ไม่พบข้อมูล Batch นี้</p>
        <p className="text-sm text-gray-400">อาจถูกลบ ยกเลิก หรือลิงก์ไม่ถูกต้อง</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => refetch()} className="btn-secondary">ลองใหม่</button>
          <button onClick={() => navigate('/batches')} className="btn-primary">ไปหน้า Batches</button>
        </div>
      </div>
    </div>
  );

  const qrUrl = `${window.location.origin}/scan/${batch.qrCode ?? batch.box?.qrCode ?? ''}`;
  const nearExpiry = (new Date(batch.expiryDate).getTime() - Date.now()) / 86400000 < 30;

  // Find active distribution (batch currently out)
  const activeDist = (batch.distributions as {
    id: string; status: string; type: string;
    distributedAt: string; returnedAt?: string;
    ward?: { name: string; code: string; floor?: string; building?: string } | null;
    borrowerName?: string; borrowerDept?: string;
    distributedBy: { name: string };
  }[])?.find(d => d.status === 'ACTIVE');

  // Most recent returned distribution
  const lastDist = (batch.distributions as {
    id: string; status: string;
    distributedAt: string; returnedAt?: string;
    ward?: { name: string } | null;
    returnedBy?: { name: string } | null;
    performedByNameReturn?: string;
  }[])?.find(d => d.status === 'RETURNED');

  // Count total cycles (total distributions)
  const totalCycles = batch.distributions?.length ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">สติกเกอร์กล่อง Emergency</h1>
          <p className="text-gray-500 text-sm">{batch.batchNumber}</p>
        </div>
        {totalCycles > 0 && (
          <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
            หมุนเวียน {totalCycles} รอบ
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sticker Preview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">ตัวอย่างสติกเกอร์</h2>
            {batch.stickerPrinted && (
              <span className="badge-green flex items-center gap-1">
                <Check size={12} /> พิมพ์แล้ว
              </span>
            )}
          </div>

          {/* Printable Sticker */}
          <div ref={printRef} className="border-2 border-gray-800 rounded-lg p-4 bg-white max-w-sm mx-auto">
            <div className="text-center mb-3">
              <div className="bg-red-700 text-white py-1.5 px-4 rounded font-bold text-sm mb-1">
                🏥 EMERGENCY BOX
              </div>
              <p className="text-xs text-gray-500">ระบบติดตามกล่องยาช่วยชีวิต</p>
            </div>

            <div className="flex gap-3 items-start">
              <div className="flex-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">หมายเลข:</span>
                  <span className="font-bold text-base">{batch.box?.boxNumber ?? batch.batchNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Batch:</span>
                  <span className="font-medium text-xs">{batch.batchNumber}</span>
                </div>
                <div className={`flex justify-between border-t pt-1 mt-1 ${nearExpiry ? 'text-red-700' : ''}`}>
                  <span className="font-semibold">วันหมดอายุ:</span>
                  <span className="font-bold">{format(new Date(batch.expiryDate), 'd MMM yyyy', { locale: th })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">จัดวันที่:</span>
                  <span>{format(new Date(batch.preparedDate), 'd MMM yy', { locale: th })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">โดย:</span>
                  <span>{batch.preparedBy?.name}</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <QRCodeSVG value={qrUrl} size={80} />
                <p className="text-center text-xs mt-1 text-gray-400">สแกนเพื่อดูข้อมูล</p>
              </div>
            </div>

            <div className="border-t mt-2 pt-2">
              <p className="text-xs font-semibold text-gray-600 mb-1">รายการยา ({batch.medications?.length} รายการ)</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {batch.medications?.map((m: {
                  medication: { name: string; unit: string };
                  quantity: number;
                }, i: number) => (
                  <p key={i} className="text-xs text-gray-700">
                    {i + 1}. {m.medication.name} x{m.quantity} {m.medication.unit}
                  </p>
                ))}
              </div>
            </div>

            {nearExpiry && (
              <div className="mt-2 bg-red-50 border border-red-300 rounded p-1.5 flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-red-600" />
                <p className="text-xs text-red-700 font-medium">ใกล้หมดอายุ — โปรดตรวจสอบ</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4 justify-center">
            <button onClick={() => handlePrint()} className="btn-primary">
              <Printer size={18} /> พิมพ์สติกเกอร์
            </button>
          </div>
        </div>

        {/* Right panel — changes based on batch status */}
        <div className="card space-y-4">

          {/* ── DISTRIBUTED: currently out ── */}
          {batch.status === 'DISTRIBUTED' && activeDist && (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <h2 className="font-semibold text-blue-800">กำลังจ่ายออกอยู่</h2>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-blue-800">
                  <MapPin size={16} />
                  <span className="font-semibold text-lg">
                    {activeDist.ward?.name ?? activeDist.borrowerName ?? 'ไม่ระบุ'}
                  </span>
                </div>
                {activeDist.ward?.floor && (
                  <p className="text-sm text-blue-600">ชั้น {activeDist.ward.floor} {activeDist.ward.building ?? ''}</p>
                )}
                <p className="text-xs text-gray-500">
                  จ่ายออกเมื่อ: {format(new Date(activeDist.distributedAt), 'd MMM yyyy HH:mm', { locale: th })}
                </p>
                <p className="text-xs text-gray-500">
                  วันหมดอายุ:{' '}
                  <span className={differenceInDays(new Date(batch.expiryDate), new Date()) < 30 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
                    {format(new Date(batch.expiryDate), 'd MMM yyyy', { locale: th })}
                    {' '}(อีก {differenceInDays(new Date(batch.expiryDate), new Date())} วัน)
                  </span>
                </p>
                {activeDist.type === 'LOAN' && (
                  <span className="badge-yellow">ยืมออก</span>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 text-center">
                  เมื่อรับกล่องคืน สแกน QR บนกล่อง หรือไปที่หน้า <strong>จ่าย/รับคืน</strong>
                </p>
              </div>
            </>
          )}

          {/* ── RETURNED: waiting for refill ── */}
          {batch.status === 'RETURNED' && (
            <>
              <div className="flex items-center gap-2">
                <RotateCcw size={18} className="text-green-600" />
                <h2 className="font-semibold text-green-800">รับคืนแล้ว — รอลงยาใหม่</h2>
              </div>

              {lastDist && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                  <p>รับคืนจาก: <span className="font-medium text-gray-700">{lastDist.ward?.name ?? 'ห้องยา'}</span></p>
                  {lastDist.returnedAt && (
                    <p>เมื่อ: {format(new Date(lastDist.returnedAt), 'd MMM yyyy HH:mm', { locale: th })}</p>
                  )}
                  <p className="mt-1 text-blue-600">หมุนเวียนแล้ว {totalCycles} รอบ</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="label">วันหมดอายุใหม่ <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    className="input"
                    value={refillExpiry}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setRefillExpiry(e.target.value)}
                  />
                  {/* Warn if chosen expiry is within 30 days — cannot be distributed */}
                  {refillDaysRemaining !== null && refillDaysRemaining <= RECYCLE_DAYS && (
                    <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
                      <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">
                        วันหมดอายุที่เลือกเหลือเพียง <strong>{refillDaysRemaining} วัน</strong> — ต้องเกิน {RECYCLE_DAYS} วัน
                        จึงจะจ่ายออกได้ กรุณาเลือกวันที่นานกว่านี้
                      </p>
                    </div>
                  )}
                  {refillDaysRemaining !== null && refillDaysRemaining > RECYCLE_DAYS && (
                    <p className="text-xs text-green-600 mt-1">✓ เหลือ {refillDaysRemaining} วัน — จ่ายออกได้</p>
                  )}
                </div>
                <div>
                  <label className="label">หมายเหตุ (ถ้ามี)</label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="เช่น เปลี่ยนยาบางรายการ"
                    value={refillNotes}
                    onChange={e => setRefillNotes(e.target.value)}
                  />
                </div>
                <button
                  className="btn-success w-full justify-center"
                  disabled={!refillExpiry || (refillDaysRemaining !== null && refillDaysRemaining <= RECYCLE_DAYS) || refillMut.isPending}
                  onClick={() => refillMut.mutate()}
                >
                  <RefreshCw size={16} />
                  {refillMut.isPending ? 'กำลังบันทึก...' : '✓ ยืนยันลงยาใหม่ — พร้อมจ่ายออก'}
                </button>
              </div>
            </>
          )}

          {/* ── ACTIVE: ready to distribute ── */}
          {batch.status === 'ACTIVE' && (
            <>
              <h2 className="font-semibold">จ่ายกล่องไปหอผู้ป่วย</h2>
              <p className="text-sm text-gray-500">
                หลังพิมพ์สติกเกอร์แล้ว สามารถจ่ายกล่องไปหอผู้ป่วยได้เลย
              </p>

              <div>
                <label className="label">เลือกหอผู้ป่วย</label>
                <select className="input" value={selectedWard} onChange={e => setSelectedWard(e.target.value)}>
                  <option value="">-- เลือกหอผู้ป่วย --</option>
                  {wards.map((w: { id: string; name: string; code: string }) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              <button
                className="btn-success w-full justify-center"
                disabled={!selectedWard || distributeMut.isPending}
                onClick={() => distributeMut.mutate({ wardId: selectedWard })}
              >
                {distributeMut.isPending ? 'กำลังบันทึก...' : '✓ จ่ายกล่องไปหอผู้ป่วย'}
              </button>
            </>
          )}

          {/* ── RECALLED / EXPIRED ── */}
          {(batch.status === 'RECALLED' || batch.status === 'EXPIRED') && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <XCircle size={32} className="text-red-500" />
              <p className="font-semibold text-red-700">
                {batch.status === 'RECALLED' ? 'QR Code ถูกยกเลิกแล้ว' : 'กล่องหมดอายุแล้ว'}
              </p>
              {batch.notes && (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">เหตุผล: {batch.notes}</p>
              )}
            </div>
          )}

          {/* ── Recall button (shown for all active statuses) ── */}
          {batch.status !== 'RECALLED' && batch.status !== 'EXPIRED' && (
            <div className="border-t pt-4 mt-2">
              <button
                onClick={() => setShowRecallModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                <XCircle size={15} />
                ยกเลิก QR Code นี้
              </button>
            </div>
          )}

          {/* Medication list (always shown) */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">รายการยาในกล่อง</p>
            <div className="space-y-2">
              {batch.medications?.map((m: {
                medication: { name: string; genericName: string; strength: string; unit: string };
                quantity: number;
                lotNumber: string;
                expiryDate: string;
              }, i: number) => (
                <div key={i} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{i + 1}. {m.medication.name}</span>
                    <span className="text-xs text-gray-400 ml-1">{m.medication.strength}</span>
                    {m.lotNumber && <span className="text-xs text-gray-400 ml-1">Lot: {m.lotNumber}</span>}
                  </div>
                  <span className="font-semibold">{m.quantity} {m.medication.unit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recall Modal ── */}
      {showRecallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <XCircle size={20} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">ยกเลิก QR Code</h2>
                  <p className="text-sm text-gray-500">{batch.batchNumber}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  เมื่อยกเลิกแล้ว QR Code นี้จะ<strong>ใช้งานไม่ได้อีก</strong> — ต้องออก QR Code ใหม่แทน
                </p>
              </div>
              <div>
                <label className="label">เหตุผลในการยกเลิก <span className="text-red-500">*</span></label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="เช่น ยาหมดอายุก่อนกำหนด, สูญหาย, ยาไม่ครบ..."
                  value={recallReason}
                  onChange={e => setRecallReason(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="p-6 border-t flex gap-3 justify-end">
              <button
                className="btn-secondary"
                onClick={() => { setShowRecallModal(false); setRecallReason(''); }}
              >
                ยกเลิก
              </button>
              <button
                className="btn-primary bg-red-600 hover:bg-red-700 justify-center"
                disabled={!recallReason.trim() || recallMut.isPending}
                onClick={() => recallMut.mutate()}
              >
                <XCircle size={16} />
                {recallMut.isPending ? 'กำลังบันทึก...' : 'ยืนยันยกเลิก QR Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
