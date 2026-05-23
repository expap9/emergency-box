import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { getUsers, createUser, updateUser } from '../lib/api';

interface User { id: string; username: string; name: string; email: string; role: string; telegramId?: string; isActive: boolean; }
const roleMap: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: 'ผู้ดูแลระบบ', cls: 'badge-red' },
  PHARMACIST: { label: 'เภสัชกร', cls: 'badge-blue' },
  STAFF: { label: 'เจ้าหน้าที่', cls: 'badge-green' },
  VIEWER: { label: 'ดูอย่างเดียว', cls: 'badge-gray' },
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: getUsers });
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', role: 'STAFF', telegramId: '' });

  const mut = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = { ...data, ...(editing && !data.password && { password: undefined }) };
      return editing ? updateUser(editing.id, payload) : createUser(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'แก้ไขผู้ใช้สำเร็จ' : 'เพิ่มผู้ใช้สำเร็จ');
      setShowModal(false); setEditing(null);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ username: u.username, name: u.name, email: u.email, password: '', role: u.role, telegramId: u.telegramId || '' });
    setShowModal(true);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ผู้ใช้งาน</h1>
          <p className="text-gray-500 text-sm">จัดการบัญชีผู้ใช้ในระบบ</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setForm({ username: '', name: '', email: '', password: '', role: 'STAFF', telegramId: '' }); setShowModal(true); }}>
          <Plus size={18} /> เพิ่มผู้ใช้
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="table-header">ชื่อ</th>
              <th className="table-header">Username</th>
              <th className="table-header">Email</th>
              <th className="table-header">Telegram ID</th>
              <th className="table-header">บทบาท</th>
              <th className="table-header">สถานะ</th>
              <th className="table-header">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u: User) => {
              const role = roleMap[u.role] || { label: u.role, cls: 'badge-gray' };
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-red-700 text-xs font-bold">{u.name[0]}</span>
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-gray-600">{u.username}</td>
                  <td className="table-cell text-sm text-gray-600">{u.email}</td>
                  <td className="table-cell text-sm text-gray-400">{u.telegramId || '-'}</td>
                  <td className="table-cell"><span className={role.cls}>{role.label}</span></td>
                  <td className="table-cell">
                    {u.isActive ? <span className="badge-green">ใช้งาน</span> : <span className="badge-red">ระงับ</span>}
                  </td>
                  <td className="table-cell">
                    <button onClick={() => openEdit(u)} className="text-xs text-red-600 hover:underline">แก้ไข</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">{editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</h2>
            </div>
            <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="label">Username <span className="text-red-500">*</span></label>
                  <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required disabled={!!editing} />
                </div>
                <div>
                  <label className="label">บทบาท</label>
                  <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    {Object.entries(roleMap).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Email <span className="text-red-500">*</span></label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="col-span-2">
                  <label className="label">{editing ? 'รหัสผ่านใหม่ (ว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน'} {!editing && <span className="text-red-500">*</span>}</label>
                  <input type="password" className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editing} minLength={6} />
                </div>
                <div className="col-span-2">
                  <label className="label">Telegram Chat ID (สำหรับแจ้งเตือน)</label>
                  <input className="input" value={form.telegramId} onChange={e => setForm({ ...form, telegramId: e.target.value })} placeholder="เช่น 123456789" />
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
