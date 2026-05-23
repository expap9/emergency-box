import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { login } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await login(form);
      setAuth(token, user);
      navigate('/dashboard');
    } catch {
      toast.error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-red-700 px-8 py-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4">
            <Package size={32} className="text-red-700" />
          </div>
          <h1 className="text-white text-2xl font-bold">Emergency Box</h1>
          <p className="text-red-200 text-sm mt-1">ระบบติดตามกล่องยาช่วยชีวิต</p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          <div>
            <label className="label">ชื่อผู้ใช้ / อีเมล</label>
            <input
              className="input"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder="กรอกชื่อผู้ใช้"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="กรอกรหัสผ่าน"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary w-full justify-center py-3 text-base" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="px-8 pb-6 text-center">
          <p className="text-xs text-gray-400">ระบบติดตาม Emergency Box — Hospital Pharmacy System</p>
        </div>
      </div>
    </div>
  );
}
