import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useReactToPrint } from 'react-to-print';
import { format, addMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import QRCodeSVG from 'react-qr-code';
import { ChevronLeft, QrCode, Printer, AlertTriangle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { bulkIssueQr } from '../lib/api';

interface IssuedBatch {
  id: string;
  batchNumber: string;
  qrCode: string;
  qrUrl: string;
  qrCodeDataUrl: string;
  expiryDate: string;
  preparedBy: { name: string };
}

export default function QrIssuePage() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  const [expiryDate, setExpiryDate] = useState(format(addMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [quantity, setQuantity] = useState(10);
  const [notes, setNotes] = useState('');
  const [issued, setIssued] = useState<IssuedBatch[]>([]);

  const issueMut = useMutation({
    mutationFn: bulkIssueQr,
    onSuccess: (data: IssuedBatch[]) => {
      setIssued(data);
      toast.success(`ออก QR Code สำเร็จ ${data.length} ดวง`);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    },
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `QR-Stickers-${format(new Date(), 'yyyyMMdd')}`,
    onAfterPrint: () => toast.success('พิมพ์สติกเกอร์เรียบร้อย'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expiryDate) return toast.error('กรุณาเลือกวันหมดอายุ');
    if (new Date(expiryDate) <= new Date()) return toast.error('วันหมดอายุต้องเป็นวันในอนาคต');
    issueMut.mutate({ expiryDate, quantity, notes: notes.trim() || undefined });
  };

  const daysUntilExpiry = Math.floor((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  const nearExpiry = daysUntilExpiry <= 30;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary p-2">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">ออก QR Code กล่อง Emergency</h1>
          <p className="text-gray-500 text-sm">ห้องยาเท่านั้น — ออกสติกเกอร์พร้อมวันหมดอายุ ใช้แปะกล่องยา</p>
        </div>
      </div>

      {/* Form */}
      {issued.length === 0 && (
        <form onSubmit={handleSubmit} className="card space-y-6">
          <h2 className="font-semibold text-lg border-b pb-3">ข้อมูลกล่อง</h2>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="label">วันหมดอายุกล่อง <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="input"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
              />
              {nearExpiry && expiryDate && (
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  กล่องที่เหลือน้อยกว่า 30 วันจะจ่ายออกไม่ได้
                </p>
              )}
              {!nearExpiry && expiryDate && (
                <p className="text-xs text-green-600 mt-1">เหลือ {daysUntilExpiry} วัน — จ่ายออกได้</p>
              )}
            </div>

            <div>
              <label className="label">จำนวน QR Code (ดวง) <span className="text-red-500">*</span></label>
              <input
                type="number"
                className="input"
                min={1}
                max={100}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                required
              />
              <p className="text-xs text-gray-400 mt-1">สูงสุด 100 ดวงต่อครั้ง</p>
            </div>
          </div>

          <div>
            <label className="label">หมายเหตุ</label>
            <input
              className="input"
              placeholder="เช่น Lot ยา xxx, จัดชุดพิเศษ (ถ้ามี)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">ℹ️ ระบบจะสร้าง QR Code ให้อัตโนมัติ</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-700">
              <li>แต่ละ QR Code มี UUID เฉพาะตัว — ไม่ซ้ำกันเด็ดขาด</li>
              <li>ยาในกล่อง 11 รายการมาตรฐาน (บันทึก Lot ได้ในหน้าจัดยากล่อง)</li>
              <li>สามารถจ่ายออกได้เมื่อเหลืออายุเกิน 30 วัน</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>ยกเลิก</button>
            <button type="submit" className="btn-primary" disabled={issueMut.isPending}>
              <QrCode size={18} />
              {issueMut.isPending ? `กำลังสร้าง ${quantity} ดวง...` : `สร้าง QR Code ${quantity} ดวง`}
            </button>
          </div>
        </form>
      )}

      {/* Result: sticker grid */}
      {issued.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle size={20} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-700">สร้าง QR Code สำเร็จ {issued.length} ดวง</p>
                <p className="text-xs text-gray-500">หมดอายุ: {format(new Date(issued[0].expiryDate), 'd MMMM yyyy', { locale: th })}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setIssued([]); }}
                className="btn-secondary"
              >
                ออกชุดใหม่
              </button>
              <button onClick={() => handlePrint()} className="btn-primary">
                <Printer size={18} />
                พิมพ์ทั้งหมด ({issued.length} ดวง)
              </button>
            </div>
          </div>

          {/* Printable area */}
          <div ref={printRef}>
            {/* Print title (only shows in print) */}
            <div className="hidden print:block text-center mb-4">
              <p className="font-bold text-lg">QR Code กล่อง Emergency — {format(new Date(issued[0].expiryDate), 'd MMMM yyyy', { locale: th })}</p>
              <p className="text-sm text-gray-500">ออกโดย: {issued[0].preparedBy?.name} · {format(new Date(), 'd MMM yyyy HH:mm', { locale: th })}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
              {issued.map((batch) => {
                const expiry = new Date(batch.expiryDate);
                const days = Math.floor((expiry.getTime() - Date.now()) / 86400000);
                return (
                  <div
                    key={batch.id}
                    className="border-2 border-gray-800 rounded-lg p-2.5 bg-white text-center print:break-inside-avoid"
                  >
                    <div className="bg-red-700 text-white py-1 px-2 rounded text-xs font-bold mb-2">
                      🏥 EMERGENCY BOX
                    </div>

                    <div className="flex justify-center mb-2">
                      <QRCodeSVG value={batch.qrUrl} size={90} />
                    </div>

                    <div className="space-y-0.5 text-left">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">หมายเลข:</span>
                        <span className="font-bold text-xs">{batch.batchNumber}</span>
                      </div>
                      <div className={`flex justify-between text-xs border-t pt-1 mt-1 ${days <= 30 ? 'text-orange-600' : ''}`}>
                        <span className="font-semibold">หมดอายุ:</span>
                        <span className="font-bold">{format(expiry, 'd MMM yyyy', { locale: th })}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">เหลือ:</span>
                        <span className={days <= 30 ? 'text-orange-600 font-semibold' : 'text-green-700'}>
                          {days} วัน
                        </span>
                      </div>
                    </div>

                    <p className="text-center text-gray-400 text-xs mt-1.5">สแกนเพื่อจ่าย/รับคืน</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
