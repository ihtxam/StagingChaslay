import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import ShopAuthShell from '@/components/shop/ShopAuthShell';
import { joinShopPath } from '@/lib/shop-paths';
import { saveCustomerToken } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';

type Props = {
  shopKey: string;
  base: string;
  merchantName?: string;
  logoUrl?: string | null;
  onAuthed: (token: string) => Promise<void>;
};

export default function ShopAccountGuestAuth({
  shopKey,
  base,
  merchantName = 'Shop',
  logoUrl,
  onAuthed,
}: Props) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const isRegister = /\/register\/?$/.test(pathname);
  const isForgot = /\/forgot-password\/?$/.test(pathname);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [registerFirstName, setRegisterFirstName] = useState('');
  const [registerLastName, setRegisterLastName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPassword2, setRegisterPassword2] = useState('');

  const [resetEmail, setResetEmail] = useState('');

  const homePath = base || '/';

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      saveCustomerToken(shopKey, res.data.token);
      await onAuthed(res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopLoginFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerPassword2) {
      setError(t('shopPasswordsMustMatch'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/register`, {
        email: registerEmail,
        password: registerPassword,
        firstName: registerFirstName,
        lastName: registerLastName,
        phone: registerPhone,
      });
      saveCustomerToken(shopKey, res.data.token);
      await onAuthed(res.data.token);
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopRegisterFailed'));
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await axios.post(`/api/shop/${shopKey}/auth/forgot-password`, { email: resetEmail });
      setInfo(t('shopResetEmailSent'));
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopResetFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (isForgot) {
    return (
      <ShopAuthShell
        merchantName={merchantName}
        logoUrl={logoUrl}
        backHref={homePath}
        title={t('shopResetPasswordTitle')}
        footer={
          <Link to={joinShopPath(base, 'account')} className="underline font-medium text-stone-800">
            {t('shopBackToLogin')}
          </Link>
        }
      >
        <h2 className="text-lg font-bold text-stone-900 mb-2">{t('shopResetPasswordHeading')}</h2>
        <p className="text-sm text-stone-500 mb-4">{t('shopResetPasswordHint')}</p>
        <form onSubmit={onForgot} className="space-y-3">
          <label className="block text-sm font-medium text-stone-700">
            {t('shopEmail')}
            <input
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              type="email"
              placeholder="m@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[var(--shop-accent,#e11d48)] py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? t('shopLoading') : t('shopSendResetLink')}
          </button>
        </form>
      </ShopAuthShell>
    );
  }

  const title = isRegister
    ? t('shopWelcomeTo').replace('{name}', merchantName)
    : t('shopWelcomeTo').replace('{name}', merchantName);
  const subtitle = isRegister ? t('shopCreateAccountSubtitle') : t('shopSignInSubtitle');

  return (
    <ShopAuthShell
      merchantName={merchantName}
      logoUrl={logoUrl}
      backHref={homePath}
      title={title}
      subtitle={subtitle}
      footer={
        <p>
          {isRegister ? t('shopHaveAccount') : t('shopDontHaveAccount')}{' '}
          <Link
            to={joinShopPath(base, isRegister ? 'account' : 'register')}
            className="underline font-medium text-stone-900"
          >
            {isRegister ? t('shopLogIn') : t('shopCreateAccount')}
          </Link>
        </p>
      }
    >
      {isRegister ? (
        <form onSubmit={onRegister} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              placeholder={t('shopFirstName')}
              value={registerFirstName}
              onChange={(e) => setRegisterFirstName(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              placeholder={t('shopLastName')}
              value={registerLastName}
              onChange={(e) => setRegisterLastName(e.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            type="email"
            placeholder="you@example.com"
            value={registerEmail}
            onChange={(e) => setRegisterEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            placeholder={t('shopPhone')}
            value={registerPhone}
            onChange={(e) => setRegisterPhone(e.target.value.replace(/[^\d+\s()-]/g, ''))}
          />
          <input
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            type="password"
            placeholder={t('shopPasswordMin6')}
            value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
            type="password"
            placeholder={t('shopConfirmPassword')}
            value={registerPassword2}
            onChange={(e) => setRegisterPassword2(e.target.value)}
            required
            minLength={6}
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[var(--shop-accent,#e11d48)] py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? t('shopLoading') : t('shopCreateAccount')}
          </button>
        </form>
      ) : (
        <form onSubmit={onLogin} className="space-y-3">
          <label className="block text-sm font-medium text-stone-700">
            {t('shopEmail')}
            <input
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              type="email"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </label>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium text-stone-700">{t('shopPassword')}</label>
              <Link
                to={joinShopPath(base, 'forgot-password')}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                {t('shopForgotPassword')}
              </Link>
            </div>
            <input
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[var(--shop-accent,#e11d48)] py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? t('shopLoading') : t('shopLogIn')}
          </button>
        </form>
      )}
    </ShopAuthShell>
  );
}
