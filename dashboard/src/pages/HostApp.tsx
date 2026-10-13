import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useAuthStore, type User } from '@/store/auth';
import HostStation from '@/pages/merchant/HostStation';

type LoginResponse = {
  token?: string;
  kind?: string;
  isOwner?: boolean;
  merchant?: {
    id: string;
    email: string;
    name: string;
    staffId?: string;
    roleName?: string;
    permissions?: User['permissions'];
  };
};

function userFromHostLogin(data: LoginResponse): { user: User; token: string } | null {
  const token = data.token;
  const merchant = data.merchant;
  if (!token || !merchant) return null;
  const isStaff = !!merchant.staffId || data.kind === 'staff';
  return {
    token,
    user: {
      id: isStaff ? merchant.staffId! : merchant.id,
      email: merchant.email,
      name: merchant.name,
      role: isStaff ? 'staff' : 'merchant',
      merchantId: merchant.id,
      staffId: isStaff ? merchant.staffId : undefined,
      roleName: isStaff ? merchant.roleName : merchant.roleName || 'Owner',
      permissions: merchant.permissions,
      isOwner: !isStaff && data.isOwner !== false,
    },
  };
}

export default function HostApp() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = t('hostAppTitle');
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"][data-host-app]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/host.webmanifest';
      link.dataset.hostApp = '1';
      document.head.appendChild(link);
    }
    let capable = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]');
    if (!capable) {
      capable = document.createElement('meta');
      capable.name = 'apple-mobile-web-app-capable';
      capable.content = 'yes';
      document.head.appendChild(capable);
    }
    let title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (!title) {
      title = document.createElement('meta');
      title.name = 'apple-mobile-web-app-title';
      document.head.appendChild(title);
    }
    title.content = t('hostAppTitle');
    document.documentElement.classList.add('webpos-lock');
    return () => {
      link?.remove();
    };
  }, [t]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });
      const hit = userFromHostLogin(res.data);
      if (!hit) throw new Error(t('loginFailed'));
      setToken(hit.token);
      setUser(hit.user);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg || t('loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (user && token) {
    return (
      <div className="min-h-screen bg-[var(--bg)]">
        <HostStation />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#17252B] px-4 text-white">
      <h1 className="text-2xl font-semibold">{t('hostAppTitle')}</h1>
      <p className="mt-2 max-w-sm text-center text-sm text-white/70">{t('hostAppLoginHint')}</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 w-full max-w-sm space-y-3">
        <input
          className="input w-full text-black"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('email')}
        />
        <input
          className="input w-full text-black"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('password')}
        />
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {t('hostAppSignIn')}
        </button>
      </form>
      <Link to="/merchant/login" className="mt-4 text-sm text-white/70 underline">
        {t('loginTitle')}
      </Link>
    </div>
  );
}
