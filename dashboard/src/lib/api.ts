import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Unauthenticated client for public pages (digital receipts). */
export const publicApi: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

publicApi.interceptors.request.use((config) => {
  const headers = config.headers as any;
  if (headers && typeof headers.delete === 'function') {
    headers.delete('Authorization');
    headers.delete('authorization');
  } else if (headers) {
    delete headers.Authorization;
    delete headers.authorization;
  }
  return config;
});

// Add token to requests; never force JSON Content-Type on FormData (breaks multer).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers as any;
    if (headers && typeof headers.delete === 'function') {
      headers.delete('Content-Type');
      headers.delete('content-type');
    } else if (headers) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
  }
  return config;
});

// Handle responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname || '';
      const reqUrl = String(error.config?.url || '');
      // Wrong staff PIN is not a session expiry — keep merchant JWT on WebPOS.
      if (reqUrl.includes('/staff/verify-pin')) {
        return Promise.reject(error);
      }
      if (
        !path.startsWith('/receipt') &&
        !path.startsWith('/receipts') &&
        !path.startsWith('/set-password') &&
        !path.startsWith('/login')
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('webpos_staff_session');
        localStorage.removeItem('webpos_staff_session_persist');
        sessionStorage.removeItem('sa_return_token');
        sessionStorage.removeItem('sa_return_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
