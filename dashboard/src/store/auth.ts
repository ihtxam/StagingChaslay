import { create } from 'zustand';
import type { Permission } from '@/lib/permissions';
import { clearWebPosStaffSession } from '@/lib/permissions';
import api from '@/lib/api';

export interface User {
  id: string;
  email: string;
  role: 'superadmin' | 'merchant' | 'staff' | 'reseller';
  name: string;
  merchantId?: string;
  staffId?: string;
  resellerId?: string;
  roleName?: string;
  permissions?: Permission[];
  isOwner?: boolean;
  impersonatedBy?: string;
  inventoryAddonEnabled?: boolean;
  signageAddonEnabled?: boolean;
  kdsAddonEnabled?: boolean;
  odsAddonEnabled?: boolean;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  hydrated: boolean;
  impersonating: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  /** Switch into a merchant panel while stashing the superadmin session. */
  startImpersonation: (token: string, merchantUser: User) => void;
  /** Restore the stashed superadmin session. Returns false if none stored. */
  stopImpersonation: () => boolean;
  /** Re-fetch role/permissions from server (staff role changes in portal). */
  refreshSession: () => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

const RETURN_TOKEN_KEY = 'sa_return_token';
const RETURN_USER_KEY = 'sa_return_user';

function readStoredAuth(): { token: string | null; user: User | null; impersonating: boolean } {
  if (typeof window === 'undefined') {
    return { token: null, user: null, impersonating: false };
  }
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    const impersonating = !!sessionStorage.getItem(RETURN_TOKEN_KEY);
    if (token && raw) {
      return { token, user: JSON.parse(raw) as User, impersonating };
    }
  } catch {
    // ignore corrupt storage
  }
  return { token: null, user: null, impersonating: false };
}

function clearReturnSession() {
  sessionStorage.removeItem(RETURN_TOKEN_KEY);
  sessionStorage.removeItem(RETURN_USER_KEY);
}

const initial = readStoredAuth();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: initial.user,
  token: initial.token,
  isLoading: false,
  hydrated: true,
  impersonating: initial.impersonating,
  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ isLoading: loading }),
  startImpersonation: (token, merchantUser) => {
    const { token: currentToken, user: currentUser } = get();
    if (
      currentToken &&
      (currentUser?.role === 'superadmin' || currentUser?.role === 'reseller')
    ) {
      sessionStorage.setItem(RETURN_TOKEN_KEY, currentToken);
      sessionStorage.setItem(RETURN_USER_KEY, JSON.stringify(currentUser));
    }
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(merchantUser));
    set({ token, user: merchantUser, impersonating: true });
  },
  stopImpersonation: () => {
    const returnToken = sessionStorage.getItem(RETURN_TOKEN_KEY);
    const returnUserRaw = sessionStorage.getItem(RETURN_USER_KEY);
    if (!returnToken || !returnUserRaw) {
      return false;
    }
    try {
      const returnUser = JSON.parse(returnUserRaw) as User;
      clearReturnSession();
      localStorage.setItem('token', returnToken);
      localStorage.setItem('user', JSON.stringify(returnUser));
      set({ token: returnToken, user: returnUser, impersonating: false });
      return true;
    } catch {
      clearReturnSession();
      return false;
    }
  },
  refreshSession: async () => {
    const token = get().token || localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await api.get('/auth/me');
      const { user, role, token: refreshedToken } = res.data;
      if (!user || !role) return;

      const updated: User = {
        id: user.staffId || user.id,
        email: user.email,
        name: user.name,
        role: role as User['role'],
        merchantId: user.merchantId,
        staffId: user.staffId,
        resellerId: user.resellerId,
        roleName: user.roleName,
        permissions: user.permissions as Permission[] | undefined,
        isOwner: role === 'merchant' && user.isOwner !== false,
        impersonatedBy: get().user?.impersonatedBy,
        inventoryAddonEnabled: !!(user.inventoryAddonEnabled || user.inventoryEnabled),
        signageAddonEnabled: !!(user.signageAddonEnabled || user.signageEnabled),
      };

      if (refreshedToken) {
        localStorage.setItem('token', refreshedToken);
        set({ token: refreshedToken });
      }
      localStorage.setItem('user', JSON.stringify(updated));
      set({ user: updated });
    } catch {
      /* session refresh is best-effort */
    }
  },
  logout: () => {
    clearReturnSession();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearWebPosStaffSession();
    set({ user: null, token: null, impersonating: false });
  },
  hydrate: () => {
    const stored = readStoredAuth();
    set({ ...stored, hydrated: true });
    void get().refreshSession();
  },
}));
