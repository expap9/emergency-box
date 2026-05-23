import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Package, ClipboardList, ArrowLeftRight, Building2,
  Pill, BarChart3, Bell, Users, Settings, LogOut, Menu, X, QrCode, ChevronDown
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/boxes', icon: Package, label: 'กล่อง Emergency' },
  { to: '/batches', icon: ClipboardList, label: 'จัดยากล่อง' },
  { to: '/distributions', icon: ArrowLeftRight, label: 'จ่าย / รับคืน' },
  { to: '/wards', icon: Building2, label: 'หอผู้ป่วย' },
  { to: '/medications', icon: Pill, label: 'รายการยา' },
  { to: '/reports', icon: BarChart3, label: 'รายงาน' },
  { to: '/notifications', icon: Bell, label: 'การแจ้งเตือน' },
];

const pharmacyItems = [
  { to: '/qr-issue', icon: QrCode, label: 'ออก QR Code' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'ผู้ใช้งาน' },
  { to: '/settings', icon: Settings, label: 'ตั้งค่า' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: typeof LayoutDashboard; label: string }) => (
    <NavLink
      to={to}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'bg-red-700 text-white' : 'text-red-100 hover:bg-red-700/50'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-red-700">
        <div className="bg-white rounded-lg p-2">
          <Package size={20} className="text-red-600" />
        </div>
        <div>
          <p className="font-bold text-white text-sm">Emergency Box</p>
          <p className="text-red-200 text-xs">Tracking System</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => <NavItem key={item.to} {...item} />)}

        {(user?.role === 'ADMIN' || user?.role === 'PHARMACIST') && (
          <>
            <div className="pt-3 pb-1 px-4">
              <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">ห้องยา</p>
            </div>
            {pharmacyItems.map(item => <NavItem key={item.to} {...item} />)}
          </>
        )}

        {(user?.role === 'ADMIN') && (
          <>
            <div className="pt-3 pb-1 px-4">
              <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">จัดการระบบ</p>
            </div>
            {adminItems.map(item => <NavItem key={item.to} {...item} />)}
          </>
        )}
      </nav>

      {(user?.role === 'ADMIN' || user?.role === 'PHARMACIST') && (
        <div className="p-3 border-t border-red-700">
          <button
            onClick={() => { setSidebarOpen(false); navigate('/qr-issue'); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-white text-red-700 rounded-lg text-sm font-semibold hover:bg-red-50 transition-colors"
          >
            <QrCode size={18} />
            ออก QR Code
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-red-800 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-red-800 flex flex-col">
            <button onClick={() => setSidebarOpen(false)} className="absolute top-4 right-4 text-white">
              <X size={20} />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <QrCode size={16} className="text-gray-500" />
              <span className="text-sm text-gray-600">สแกน QR เพื่อดูข้อมูลกล่อง</span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-700 text-xs font-bold">{user?.name?.[0] || 'U'}</span>
              </div>
              <span className="hidden sm:block text-sm font-medium">{user?.name}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                <div className="px-4 py-2 border-b">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
