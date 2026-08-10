import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { APP_NAME, APP_PANEL_TITLE } from '@/lib/brand';

/** Temporary profile picker — remove when ready for production-only login. */
type ProfileKind = 'merchant' | 'reseller' | 'superadmin' | 'auto';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  profile: z.enum(['merchant', 'reseller', 'superadmin', 'auto']),
});

type LoginFormData = z.infer<typeof loginSchema>;

const resetSchema = z.object({
  email: z.string().email('Invalid email'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  profile: z.enum(['merchant', 'reseller', 'superadmin', 'staff']),
});

type ResetFormData = z.infer<typeof resetSchema>;

type LoginHit = {
  kind: 'superadmin' | 'reseller' | 'merchant';
  token: string;
  account: any;
  isOwner?: boolean;
};

async function tryLogin(
  profile: Exclude<ProfileKind, 'auto'>,
  email: string,
  password: string
): Promise<LoginHit | null> {
  const endpoint =
    profile === 'superadmin'
      ? '/auth/superadmin/login'
      : profile === 'reseller'
        ? '/auth/reseller/login'
        : '/auth/merchant/login';
  try {
    const response = await api.post(endpoint, { email, password });
    const { token, merchant, superadmin, reseller, isOwner } = response.data;
    if (profile === 'superadmin' && token && superadmin) {
      return { kind: 'superadmin', token, account: superadmin };
    }
    if (profile === 'reseller' && token && reseller) {
      return { kind: 'reseller', token, account: reseller };
    }
    if (profile === 'merchant' && token && merchant) {
      return { kind: 'merchant', token, account: merchant, isOwner };
    }
  } catch {
    /* try next */
  }
  return null;
}

function panelPath(kind: LoginHit['kind']): string {
  if (kind === 'superadmin') return '/superadmin';
  if (kind === 'reseller') return '/reseller';
  return '/merchant';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { profile: 'merchant', email: '', password: '' },
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
    reset: resetForm,
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { profile: 'merchant', email: '', newPassword: '' },
  });

  const profile = watch('profile');

  useEffect(() => {
    document.title = APP_PANEL_TITLE;
  }, []);

  const applyLogin = (hit: LoginHit) => {
    const { kind, token, account, isOwner } = hit;
    const isStaff = kind === 'merchant' && !!account.staffId;
    const user = {
      id: isStaff ? account.staffId : account.id,
      email: account.email,
      name: account.name,
      role: (kind === 'superadmin'
        ? 'superadmin'
        : kind === 'reseller'
          ? 'reseller'
          : isStaff
            ? 'staff'
            : 'merchant') as 'superadmin' | 'merchant' | 'staff' | 'reseller',
      merchantId: kind === 'merchant' ? account.id : undefined,
      resellerId: kind === 'reseller' ? account.id : undefined,
      staffId: isStaff ? account.staffId : undefined,
      roleName: isStaff
        ? account.roleName
        : kind === 'merchant' && isOwner !== false
          ? account.roleName || 'Owner'
          : account.roleName,
      permissions: account.permissions,
      isOwner: kind === 'merchant' && isOwner !== false && !isStaff,
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setToken(token);
    setUser(user);
    toast.success(`Signed in — opening ${kind} panel`);
    navigate(panelPath(kind));
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      let hit: LoginHit | null = null;
      if (data.profile === 'auto') {
        // Prefer merchant/staff, then reseller, then superadmin
        for (const kind of ['merchant', 'reseller', 'superadmin'] as const) {
          hit = await tryLogin(kind, data.email, data.password);
          if (hit) break;
        }
      } else {
        hit = await tryLogin(data.profile, data.email, data.password);
      }
      if (!hit) {
        throw new Error('Login failed. Check profile, email, and password.');
      }
      applyLogin(hit);
    } catch (error: any) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Login failed. Check profile, email, and password.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const onReset = async (data: ResetFormData) => {
    setResetBusy(true);
    try {
      await api.post('/auth/reset-login-password', {
        email: data.email,
        newPassword: data.newPassword,
        role: data.profile,
      });
      toast.success('Password updated. You can sign in now.');
      setShowReset(false);
      resetForm({ profile: data.profile, email: data.email, newPassword: '' });
    } catch (error: any) {
      toast.error(
        error.response?.data?.error || error.message || 'Could not reset password'
      );
    } finally {
      setResetBusy(false);
    }
  };

  const profileLabel =
    profile === 'auto'
      ? 'Auto'
      : profile === 'merchant'
        ? 'User / Merchant'
        : profile === 'reseller'
          ? 'Reseller'
          : 'Superadmin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-slate-800 p-3 rounded-xl">
              <LogIn className="w-6 h-6 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2">{APP_NAME}</h1>
          <p className="text-gray-600 text-center mb-6">Sign in to your panel</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Profile</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ['merchant', 'User'],
                    ['reseller', 'Reseller'],
                    ['superadmin', 'Superadmin'],
                    ['auto', 'Auto'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2.5 text-center text-xs font-bold ${
                      profile === value
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="radio"
                      value={value}
                      className="sr-only"
                      {...register('profile')}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Temporary. Auto tries User → Reseller → Superadmin from email/password.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="your@email.com"
                className="input"
                autoComplete="username"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className="input"
                autoComplete="current-password"
              />
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? 'Signing in...' : `Sign in (${profileLabel})`}
            </button>
          </form>

          <div className="mt-5 border-t border-stone-100 pt-4">
            <button
              type="button"
              className="text-sm font-semibold text-slate-700 underline-offset-2 hover:underline"
              onClick={() => setShowReset((v) => !v)}
            >
              {showReset ? 'Hide password reset' : 'Reset password'}
            </button>
            {showReset ? (
              <form onSubmit={handleResetSubmit(onReset)} className="mt-3 space-y-3">
                <p className="text-xs text-stone-500">
                  Temporary helper for merchants, staff users, resellers, and superadmin.
                </p>
                <div>
                  <label className="block text-xs font-medium mb-1">Account type</label>
                  <select {...registerReset('profile')} className="input text-sm">
                    <option value="merchant">Merchant (shop owner)</option>
                    <option value="staff">Staff user (panel login)</option>
                    <option value="reseller">Reseller</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Email</label>
                  <input
                    {...registerReset('email')}
                    type="email"
                    className="input text-sm"
                    placeholder="account@email.com"
                  />
                  {resetErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{resetErrors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">New password</label>
                  <input
                    {...registerReset('newPassword')}
                    type="password"
                    className="input text-sm"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  {resetErrors.newPassword && (
                    <p className="text-red-500 text-xs mt-1">{resetErrors.newPassword.message}</p>
                  )}
                </div>
                <button type="submit" disabled={resetBusy} className="btn-secondary w-full text-sm">
                  {resetBusy ? 'Updating…' : 'Update password'}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
