import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { APP_NAME, APP_PANEL_TITLE } from '@/lib/brand';
import { useI18n, type Locale } from '@/lib/i18n';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ResetPasswordPage() {
  const { t, locale, setLocale } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    document.title = `${APP_NAME} — ${t('resetPasswordTitle')}`;
  }, [t]);

  useEffect(() => {
    if (!token) {
      setError(t('resetPasswordInvalid'));
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await axios.get(`${API_BASE}/auth/reset-password/${encodeURIComponent(token)}`);
        setEmail(res.data?.reset?.email || '');
        setError('');
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          t('resetPasswordInvalid');
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, t]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t('resetPasswordMin'));
      return;
    }
    if (password !== confirm) {
      toast.error(t('resetPasswordMismatch'));
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/auth/reset-password`, { token, password });
      toast.success(t('resetPasswordSuccess'));
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toast.error(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ||
          t('resetPasswordInvalid')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b3d3a] flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.35),_transparent_55%)] pointer-events-none" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-teal-100/80">{APP_PANEL_TITLE}</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-2xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">{t('resetPasswordTitle')}</h2>
          <p className="text-sm text-slate-500">{t('resetPasswordHint')}</p>

          {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}

          {!loading && error && (
            <div className="space-y-3">
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
              <Link to="/login" className="text-sm text-teal-800 underline">
                {t('forgotPasswordBack')}
              </Link>
            </div>
          )}

          {!loading && !error && (
            <form onSubmit={onSubmit} className="space-y-3">
              {email && (
                <div className="text-sm bg-slate-50 border rounded px-3 py-2 text-slate-700">
                  {email}
                </div>
              )}
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('resetPasswordNew')}</span>
                <input
                  type="password"
                  className="input mt-1 py-2.5"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">{t('resetPasswordConfirm')}</span>
                <input
                  type="password"
                  className="input mt-1 py-2.5"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-lg bg-teal-800 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? t('resetPasswordSaving') : t('resetPasswordSubmit')}
              </button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-slate-600 underline">
                  {t('forgotPasswordBack')}
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-1" role="group" aria-label={t('language')}>
          {(['en', 'fr', 'de'] as Locale[]).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                locale === code ? 'bg-white text-teal-900' : 'text-teal-100/80 hover:text-white'
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
