import axios, { AxiosInstance } from 'axios';

/** Prefer same-origin /api in production; localhost only for local dev without env override. */
function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).trim();
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000/api';
    }
    return '/api';
  }
  return '/api';
}

const API_BASE_URL = resolveApiBaseUrl();

/** Absolute API base for native companions (Print Agent cloud-relay requires http(s) URL). */
export function resolveAbsoluteApiBaseUrl(): string {
  const base = resolveApiBaseUrl();
  if (/^https?:\/\//i.test(base)) return base.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const path = base.startsWith('/') ? base : `/${base}`;
    return `${window.location.origin}${path}`.replace(/\/$/, '');
  }
  return base.replace(/\/$/, '');
}

/** Site origin for Bridge Reborn tap-to-pay (no /api suffix), e.g. https://app.chaslay.com */
export function resolveApiOriginForBridge(): string {
  return resolveAbsoluteApiBaseUrl().replace(/\/api\/?$/, '');
}

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
  try {
    const locationId = localStorage.getItem('manupos_selected_location');
    if (locationId) {
      config.headers['X-Location-Id'] = locationId;
    }
  } catch {
    /* ignore */
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
  async (error) => {
    const cfg = error.config as (typeof error.config & { _locationRetry?: boolean }) | undefined;
    const locCode = error.response?.data?.code;
    const locMsg = String(error.response?.data?.error || '');
    if (
      cfg &&
      !cfg._locationRetry &&
      (locCode === 'LOCATION_ACCESS_DENIED' || /location not found/i.test(locMsg))
    ) {
      try {
        localStorage.removeItem('manupos_selected_location');
      } catch {
        /* ignore */
      }
      cfg._locationRetry = true;
      if (cfg.headers) {
        delete cfg.headers['X-Location-Id'];
        delete cfg.headers['x-location-id'];
      }
      return api.request(cfg);
    }
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
        !path.startsWith('/reset-password') &&
        !path.startsWith('/forgot-password') &&
        !path.startsWith('/login') &&
        !path.startsWith('/signin') &&
        !path.startsWith('/kds') &&
        !path.startsWith('/tv') &&
        path !== '/superadmin/login' &&
        path !== '/reseller/login' &&
        path !== '/merchant/login'
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
