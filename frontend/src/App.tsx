import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BoxesPage from './pages/BoxesPage';
import BatchesPage from './pages/BatchesPage';
import NewBatchPage from './pages/NewBatchPage';
import DistributionsPage from './pages/DistributionsPage';
import WardsPage from './pages/WardsPage';
import MedicationsPage from './pages/MedicationsPage';
import ReportsPage from './pages/ReportsPage';
import ScanPage from './pages/ScanPage';
import StickerPage from './pages/StickerPage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import QrIssuePage from './pages/QrIssuePage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/scan/:qrCode" element={<ScanPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="boxes" element={<BoxesPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="batches/new" element={<NewBatchPage />} />
            <Route path="batches/:id/sticker" element={<StickerPage />} />
            <Route path="distributions" element={<DistributionsPage />} />
            <Route path="wards" element={<WardsPage />} />
            <Route path="medications" element={<MedicationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="qr-issue" element={<QrIssuePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
