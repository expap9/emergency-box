import axios from 'axios';

// ใน production ใช้ VITE_API_URL (Railway URL), dev ใช้ Vite proxy
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (data: { username: string; password: string }) =>
  api.post('/auth/login', data).then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);
export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  api.post('/auth/change-password', data).then(r => r.data);

// Boxes
export const getBoxes = () => api.get('/boxes').then(r => r.data);
export const getBox = (id: string) => api.get(`/boxes/${id}`).then(r => r.data);
export const createBox = (data: { boxNumber: string; notes?: string }) =>
  api.post('/boxes', data).then(r => r.data);
export const deleteBox = (id: string) => api.delete(`/boxes/${id}`).then(r => r.data);
export const getBoxQR = (id: string) => api.get(`/boxes/${id}/qrcode`).then(r => r.data);

// Batches
export const getBatches = (params?: Record<string, string>) =>
  api.get('/batches', { params }).then(r => r.data);
export const getBatch = (id: string) => api.get(`/batches/${id}`).then(r => r.data);
export const createBatch = (data: unknown) => api.post('/batches', data).then(r => r.data);
export const printSticker = (id: string) => api.post(`/batches/${id}/print-sticker`).then(r => r.data);
export const recallBatch = (id: string, reason: string) =>
  api.post(`/batches/${id}/recall`, { reason }).then(r => r.data);
export const bulkIssueQr = (data: { expiryDate: string; quantity: number; notes?: string }) =>
  api.post('/batches/bulk-issue', data).then(r => r.data);

// Medications
export const getMedications = () => api.get('/medications').then(r => r.data);
export const createMedication = (data: unknown) => api.post('/medications', data).then(r => r.data);
export const updateMedication = (id: string, data: unknown) =>
  api.put(`/medications/${id}`, data).then(r => r.data);

// Wards
export const getWards = () => api.get('/wards').then(r => r.data);
export const createWard = (data: unknown) => api.post('/wards', data).then(r => r.data);
export const updateWard = (id: string, data: unknown) => api.put(`/wards/${id}`, data).then(r => r.data);
export const getWardBoxes = (id: string) => api.get(`/wards/${id}/current-boxes`).then(r => r.data);

// Distributions
export const getDistributions = (params?: Record<string, string>) =>
  api.get('/distributions', { params }).then(r => r.data);
export const distributeBox = (data: { batchId: string; wardId: string; expectedReturnDays?: number }) =>
  api.post('/distributions', data).then(r => r.data);
export const returnBox = (id: string, data: { condition: string; conditionNotes?: string }) =>
  api.post(`/distributions/${id}/return`, data).then(r => r.data);

// Reports
export const getDashboard = () => api.get('/reports/dashboard').then(r => r.data);
export const getExpiryReport = (days?: number) =>
  api.get('/reports/expiry', { params: { days } }).then(r => r.data);
export const getDistributionReport = (params?: Record<string, string>) =>
  api.get('/reports/distributions', { params }).then(r => r.data);
export const getMonthlyStats = (months?: number) =>
  api.get('/reports/monthly', { params: { months } }).then(r => r.data);
export const getWardReport = () => api.get('/reports/wards').then(r => r.data);

// Notifications
export const getNotifications = () => api.get('/notifications').then(r => r.data);
export const checkNotifications = () => api.post('/notifications/check').then(r => r.data);

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data);
export const saveSettings = (data: Record<string, string>) => api.put('/settings', data).then(r => r.data);

// Public Scan routes (no auth header needed, 8s timeout)
const scanApi = axios.create({ baseURL: `${API_BASE}/scan`, timeout: 8000 });

export const scanGetBox = (qrCode: string) => scanApi.get(`/${qrCode}`).then(r => r.data);
export const scanGetWards = () => scanApi.get('/_wards').then(r => r.data);
export const scanDistribute = (qrCode: string, data: {
  wardId: string; performedBy: string; performedByRole?: string; expectedReturnDays?: number;
}) => scanApi.post(`/${qrCode}/distribute`, data).then(r => r.data);
export const scanLoan = (qrCode: string, data: {
  performedBy: string; borrowerDept?: string; borrowerContact?: string;
  loanPurpose?: string; expectedReturnDays?: number;
}) => scanApi.post(`/${qrCode}/loan`, data).then(r => r.data);
export const scanReturn = (qrCode: string, data: {
  performedBy: string; condition: string; conditionNotes?: string;
}) => scanApi.post(`/${qrCode}/return`, data).then(r => r.data);
export const scanRequestStock = (qrCode: string, data: {
  performedBy: string; notes?: string;
}) => scanApi.post(`/${qrCode}/request-stock`, data).then(r => r.data);

// Users
export const getUsers = () => api.get('/users').then(r => r.data);
export const createUser = (data: unknown) => api.post('/users', data).then(r => r.data);
export const updateUser = (id: string, data: unknown) => api.put(`/users/${id}`, data).then(r => r.data);
export const updateProfile = (data: unknown) => api.put('/users/profile/me', data).then(r => r.data);
