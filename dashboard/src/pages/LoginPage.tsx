import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { homePathForUser } from '@/lib/auth-home';
import { posEmbedReturnPath } from '@/pages/PosEmbedPage';
import { APP_NAME, APP_PANEL_TITLE, APP_TAGLINE } from '@/lib/brand';
import { useI18n, type Locale } from '@/lib/i18n';
import { clearWebPosStaffSession } from '@/lib/permissions';
import { useAuthStore, type User } from '@/store/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginFormData = z.infer<typeof loginSchema>;

type UnifiedLoginResponse = {
  token?: string;
  kind?: 'superadmin' | 'reseller' | 'merchant' | 'staff';
  superadmin?: { id: string; email: string; name: string };
  reseller?: { id: string; email: string; name: string };
  merchant?: {
    id: string;
    email: string;
    name: string;
    staffId?: string;
    roleName?: string;
    permissions?: User['permissions'];
  };
  isOwner?: boolean;
};

async function legacyLogin(email: string, password: string): Promise<UnifiedLoginResponse> {
  for (const endpoint of ['/auth/merchant/login', '/auth/reseller/login', '/auth/superadmin/login'] as const) {
    try {
      const response = await api.post<UnifiedLoginResponse>(endpoint, { email, password });
      if (response.data?.token) return response.data;
    } catch {
      /* try next account type */
    }
  }
  throw new Error('Invalid email or password');
}

function userFromLogin(data: UnifiedLoginResponse): { user: User; token: string } | null {
  const token = data.token;
  if (!token) return null;

  if (data.superadmin) {
    return {
      token,
      user: {
        id: data.superadmin.id,
        email: data.superadmin.email,
        name: data.superadmin.name,
        role: 'superadmin',
      },
    };
  }

  if (data.reseller) {
    return {
      token,
      user: {
        id: data.reseller.id,
        email: data.reseller.email,
        name: data.reseller.name,
        role: 'reseller',
        resellerId: data.reseller.id,
      },
    };
  }

  const merchant = data.merchant;
  if (!merchant) return null;
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
      inventoryAddonEnabled: !!(merchant.inventoryAddonEnabled || merchant.inventoryEnabled),
      signageAddonEnabled: !!(merchant.signageAddonEnabled || merchant.signageEnabled),
    },
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale, setLocale } = useI18n();
  const { user, token, setUser, setToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot' | 'sent'>(
    location.pathname.includes('forgot-password') ? 'forgot' : 'login'
  );
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

  useEffect(() => {
    if (user && token) {
      navigate(posEmbedReturnPath() ?? homePathForUser(user), { replace: true });
    }
  }, [user, token, navigate]);

  const onSubmit = async (form: LoginFormData) => {
    setIsLoading(true);
    try {
      let data: UnifiedLoginResponse;
      try {
        const response = await api.post<UnifiedLoginResponse>('/auth/login', {
          email: form.email.trim(),
          password: form.password,
        });
        data = response.data;
      } catch (unifiedError: unknown) {
        const status = (unifiedError as { response?: { status?: number } }).response?.status;
        if (status !== 404) throw unifiedError;
        data = await legacyLogin(form.email.trim(), form.password);
      }
      const hit = userFromLogin(data);
      if (!hit) {
        throw new Error(t('loginFailed'));
      }

      localStorage.setItem('token', hit.token);
      localStorage.setItem('user', JSON.stringify(hit.user));
      clearWebPosStaffSession();
      setToken(hit.token);
      setUser(hit.user);
      toast.success(t('loginWelcome'));
      navigate(posEmbedReturnPath() ?? homePathForUser(hit.user), { replace: true });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      toast.error(err.response?.data?.error || err.message || t('loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const onForgotSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = forgotEmail.trim();
    if (!email || !email.includes('@')) {
      toast.error(t('loginEmailInvalid'));
      return;
    }
    setForgotLoading(true);
    try {
      const response = await api.post<{ message?: string }>('/auth/forgot-password', { email });
      setView('sent');
      toast.success(response.data?.message || t('forgotPasswordSent'));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string }; status?: number } };
      if (err.response?.status === 429) {
        toast.error(err.response?.data?.error || t('forgotPasswordRateLimit'));
      } else {
        setView('sent');
        toast.success(t('forgotPasswordSent'));
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b3d3a] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.35),_transparent_55%)] pointer-events-none" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-white/15">
            <img
              src="/favicon.png"
              alt=""
              className="h-12 w-12 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.hidden = false;
              }}
            />
            <span hidden className="text-2xl font-bold tracking-tight text-teal-800">
              C
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-teal-100/80">{t('loginTagline')}</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          {view === 'login' && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{t('loginTitle')}</h2>
              <p className="mt-1 mb-6 text-sm text-slate-500">{t('loginSubtitle')}</p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="login-email">
                    {t('loginEmail')}
                  </label>
                  <input
                    id="login-email"
                    {...register('email')}
                    type="email"
                    placeholder="name@company.com"
                    className="input py-2.5"
                    autoComplete="username"
                    autoFocus
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{t('loginEmailInvalid')}</p>
                  )}
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-700" htmlFor="login-password">
                      {t('password')}
                    </label>
                    <button
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-sm font-medium text-teal-800 hover:underline"
                    >
                      {t('forgotPassword')}
                    </button>
                  </div>
                  <input
                    id="login-password"
                    {...register('password')}
                    type="password"
                    placeholder="••••••••"
                    className="input py-2.5"
                    autoComplete="current-password"
                  />
                  {errors.password && (
                    <p className="text-red-500 text-sm mt-1">{t('loginPasswordMin')}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full rounded-lg bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {isLoading ? t('loginSigningIn') : t('loginSignIn')}
                </button>
              </form>
            </>
          )}

          {view === 'forgot' && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{t('forgotPasswordTitle')}</h2>
              <p className="mt-1 mb-6 text-sm text-slate-500">{t('forgotPasswordHint')}</p>
              <form onSubmit={onForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="forgot-email">
                    {t('loginEmail')}
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="input py-2.5"
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-lg bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {forgotLoading ? t('forgotPasswordSending') : t('forgotPasswordSubmit')}
                </button>
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="w-full text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  {t('forgotPasswordBack')}
                </button>
              </form>
            </>
          )}

          {view === 'sent' && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">{t('forgotPasswordTitle')}</h2>
              <p className="mt-3 text-sm text-slate-600">{t('forgotPasswordSent')}</p>
              <button
                type="button"
                onClick={() => setView('login')}
                className="mt-6 w-full rounded-lg bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                {t('forgotPasswordBack')}
              </button>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-1" role="group" aria-label={t('language')}>
          {(['en', 'fr', 'de'] as Locale[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                locale === code
                  ? 'bg-white text-teal-900'
                  : 'text-teal-100/80 hover:text-white'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-teal-100/50">{APP_TAGLINE}</p>
      </div>
    </div>
  );
}
