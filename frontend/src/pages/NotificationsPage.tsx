import { useQuery, useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Bell, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { getNotifications, checkNotifications } from '../lib/api';

const typeLabel: Record<string, { label: string; cls: string }> = {
  EXPIRY_30_DAYS: { label: 'ใกล้หมดอายุ 30 วัน', cls: 'badge-yellow' },
  EXPIRY_7_DAYS: { label: 'ใกล้หมดอายุ 7 วัน', cls: 'badge-red' },
  EXPIRY_1_DAY: { label: 'หมดอายุพรุ่งนี้!', cls: 'badge-red' },
  EXPIRED: { label: 'หมดอายุแล้ว', cls: 'badge-red' },
  RECALL: { label: 'เรียกคืน', cls: 'badge-red' },
  RETURN_REMINDER: { label: 'แจ้งเตือนคืนกล่อง', cls: 'badge-blue' },
  CUSTOM: { label: 'แจ้งเตือนพิเศษ', cls: 'badge-gray' },
};

export default function NotificationsPage() {
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications'], queryFn: getNotifications,
  });

  const checkMut = useMutation({
    mutationFn: checkNotifications,
    onSuccess: () => { toast.success('ตรวจสอบการแจ้งเตือนเสร็จสิ้น'); refetch(); },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">การแจ้งเตือน</h1>
          <p className="text-gray-500 text-sm">ประวัติการแจ้งเตือนทั้งหมด</p>
        </div>
        <button className="btn-secondary" onClick={() => checkMut.mutate()} disabled={checkMut.isPending}>
          <RefreshCw size={16} className={checkMut.isPending ? 'animate-spin' : ''} />
          ตรวจสอบและส่งการแจ้งเตือน
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">ยังไม่มีการแจ้งเตือน</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: {
            id: string; type: string; message: string; sentAt: string; status: string;
            batch: { box: { boxNumber: string }; batchNumber: string };
            recipients: { id: string; channel: string; status: string; user: { name: string; email: string } }[];
          }) => {
            const t = typeLabel[n.type] || { label: n.type, cls: 'badge-gray' };
            return (
              <div key={n.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={t.cls}>{t.label}</span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(n.sentAt), 'd MMM yy HH:mm', { locale: th })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">กล่อง: {n.batch.box.boxNumber} — {n.batch.batchNumber}</p>
                  </div>
                  <div className="flex-shrink-0">
                    {n.status === 'SENT' && <CheckCircle size={18} className="text-green-500" />}
                    {n.status === 'FAILED' && <XCircle size={18} className="text-red-500" />}
                    {n.status === 'PENDING' && <Clock size={18} className="text-yellow-500" />}
                  </div>
                </div>

                {n.recipients?.length > 0 && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                    {n.recipients.map(r => (
                      <div key={r.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${
                        r.status === 'SENT' ? 'bg-green-50 text-green-700' : r.status === 'FAILED' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'
                      }`}>
                        <span>{r.channel === 'EMAIL' ? '📧' : '💬'}</span>
                        <span>{r.user.name}</span>
                        {r.status === 'SENT' ? '✓' : r.status === 'FAILED' ? '✕' : '...'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
