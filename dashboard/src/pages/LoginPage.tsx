import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { homePathForUser } from '@/lib/auth-home';
import { posEmbedReturnPath } from '@/pages/PosEmbedPage';
import { APP_NAME, APP_PANEL_TITLE, APP_TAGLINE, REBORN_LOGO_WHITE } from '@/lib/brand';
import { BRAND_BLUE_CHARCOAL, BRAND_BURGUNDY, BRAND_WARM_WHITE } from '@/lib/brand-colors';
import { useI18n, type Locale } from '@/lib/i18n';
import { clearWebPosStaffSession } from '@/lib/permissions';
import type { StaffLoginHome } from '@/lib/staff-login-home';
import { useAuthStore, type User } from '@/store/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

type LoginFormData = z.infer<typeof loginSchema>;

function loginErrorMessage(
  error: unknown,
  t: (key: string) => string
): string {
  const err = error as {
    response?: { data?: { error?: string }; status?: number };
    message?: string;
    code?: string;
  };
  if (err.response?.data?.error) return err.response.data.error;
  if (err.response?.status === 500 || err.response?.status === 502 || err.response?.status === 503) {
    return t('loginServerUnavailable');
  }
  const msg = String(err.message || '');
  if (
    err.code === 'ERR_NETWORK' ||
    /network error|failed to fetch|load failed|networkerror/i.test(msg)
  ) {
    return t('loginNetworkError');
  }
  return msg || t('loginFailed');
}

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
    loginHome?: StaffLoginHome;
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
      loginHome: isStaff ? merchant.loginHome : undefined,
      isOwner: !isStaff && data.isOwner !== false,
      inventoryAddonEnabled: !!(merchant.inventoryAddonEnabled || merchant.inventoryEnabled),
      signageAddonEnabled: !!(merchant.signageAddonEnabled || merchant.signageEnabled),
      maxLocations: Math.max(0, Number(merchant.maxLocations ?? 1)),
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
      toast.error(loginErrorMessage(error, t));
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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: BRAND_BLUE_CHARCOAL }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top, rgba(128, 0, 32, 0.35), transparent 55%)`,
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={REBORN_LOGO_WHITE}
            alt={APP_NAME}
            className="h-24 w-auto max-w-[200px] object-contain"
          />
          <p className="mt-4 text-sm opacity-80" style={{ color: BRAND_WARM_WHITE }}>
            {t('loginTagline')}
          </p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl" style={{ backgroundColor: BRAND_WARM_WHITE }}>
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
                      className="text-sm font-medium hover:underline"
                      style={{ color: BRAND_BURGUNDY }}
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
                  className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: BRAND_BURGUNDY }}
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
                  className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: BRAND_BURGUNDY }}
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
                className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND_BURGUNDY }}
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
                  ? 'text-white'
                  : 'opacity-75 hover:opacity-100'
              }`}
              style={locale === code ? { backgroundColor: BRAND_BURGUNDY } : { color: BRAND_WARM_WHITE }}
            >
              {code}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] opacity-50" style={{ color: BRAND_WARM_WHITE }}>{APP_TAGLINE}</p>
      </div>
    </div>
  );
}
