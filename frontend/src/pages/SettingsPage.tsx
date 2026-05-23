import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Save, Bell, Mail, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, saveSettings } from '../lib/api';

export default function SettingsPage() {
  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const mut = useMutation({
    mutationFn: saveSettings,
    onSuccess: () => toast.success('บันทึกการตั้งค่าเรียบร้อย'),
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ตั้งค่าระบบ</h1>
        <p className="text-gray-500 text-sm">กำหนดค่าต่าง ๆ ของระบบ</p>
      </div>

      <div className="card space-y-5">
        <h2 className="font-semibold flex items-center gap-2"><Settings size={18} className="text-gray-500" /> ข้อมูลทั่วไป</h2>
        <div>
          <label className="label">ชื่อโรงพยาบาล</label>
          <input className="input" value={form.hospital_name || ''} onChange={e => set('hospital_name', e.target.value)} />
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="font-semibold flex items-center gap-2"><Bell size={18} className="text-yellow-500" /> การแจ้งเตือน</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label">แจ้งเตือนก่อนหมดอายุ (วัน)</label>
            <input type="number" className="input" value={form.alert_days_30 || '30'} onChange={e => set('alert_days_30', e.target.value)} />
          </div>
          <div>
            <label className="label">แจ้งเตือนรอบที่ 2 (วัน)</label>
            <input type="number" className="input" value={form.alert_days_7 || '7'} onChange={e => set('alert_days_7', e.target.value)} />
          </div>
          <div>
            <label className="label">แจ้งเตือนวันสุดท้าย (วัน)</label>
            <input type="number" className="input" value={form.alert_days_1 || '1'} onChange={e => set('alert_days_1', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">กำหนดวันคืนกล่อง (วัน)</label>
          <input type="number" className="input max-w-xs" value={form.default_return_days || '30'} onChange={e => set('default_return_days', e.target.value)} />
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="font-semibold flex items-center gap-2"><Mail size={18} className="text-blue-500" /> การส่ง Email</h2>
        <p className="text-sm text-gray-500 bg-blue-50 rounded-lg p-3">
          กำหนดค่า SMTP ใน environment variable (.env) ของ backend ดู .env.example สำหรับรายละเอียด
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>SMTP Host: <code className="bg-gray-100 px-1 rounded">กำหนดใน .env ของ backend</code></div>
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="font-semibold flex items-center gap-2"><MessageSquare size={18} className="text-green-500" /> Telegram Bot</h2>
        <p className="text-sm text-gray-500 bg-green-50 rounded-lg p-3">
          กำหนด TELEGRAM_BOT_TOKEN ใน .env และให้ผู้ใช้แต่ละคนกำหนด Telegram Chat ID ในโปรไฟล์ของตัวเอง
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
          <p className="font-medium">วิธีหา Telegram Chat ID:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-600">
            <li>เพิ่ม Bot ของคุณใน Telegram</li>
            <li>ส่งข้อความ /start ให้ Bot</li>
            <li>เปิด: <code className="bg-gray-200 px-1 rounded">https://api.telegram.org/bot[TOKEN]/getUpdates</code></li>
            <li>หา chat.id ใน JSON ที่ได้</li>
          </ol>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary px-8" onClick={() => mut.mutate(form)} disabled={mut.isPending}>
          <Save size={18} /> {mut.isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>
      </div>
    </div>
  );
}
