import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import ShopAuthShell from '@/components/shop/ShopAuthShell';
import ShopPhoneField from '@/components/shop/ShopPhoneField';
import { SHOP_BTN_PRIMARY_CLASS, SHOP_INPUT_CLASS, SHOP_LABEL_CLASS } from '@/lib/shop-input';
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
  merchantName = '',
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
          <label className="block">
            <span className={SHOP_LABEL_CLASS}>{t('shopEmail')}</span>
            <input
              className={SHOP_INPUT_CLASS}
              type="email"
              placeholder="m@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {info ? <p className="text-sm text-emerald-700">{info}</p> : null}
          <button type="submit" disabled={busy} className={`w-full ${SHOP_BTN_PRIMARY_CLASS}`}>
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
            <label className="block">
              <span className={SHOP_LABEL_CLASS}>{t('shopFirstName')}</span>
              <input
                className={SHOP_INPUT_CLASS}
                value={registerFirstName}
                onChange={(e) => setRegisterFirstName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className={SHOP_LABEL_CLASS}>{t('shopLastName')}</span>
              <input
                className={SHOP_INPUT_CLASS}
                value={registerLastName}
                onChange={(e) => setRegisterLastName(e.target.value)}
              />
            </label>
          </div>
          <label className="block">
            <span className={SHOP_LABEL_CLASS}>{t('shopEmail')}</span>
            <input
              className={SHOP_INPUT_CLASS}
              type="email"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className={SHOP_LABEL_CLASS}>{t('shopPhone')}</span>
            <ShopPhoneField value={registerPhone} onChange={setRegisterPhone} />
          </label>
          <label className="block">
            <span className={SHOP_LABEL_CLASS}>{t('shopPassword')}</span>
            <input
              className={SHOP_INPUT_CLASS}
              type="password"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label className="block">
            <span className={SHOP_LABEL_CLASS}>{t('shopConfirmPassword')}</span>
            <input
              className={SHOP_INPUT_CLASS}
              type="password"
              value={registerPassword2}
              onChange={(e) => setRegisterPassword2(e.target.value)}
              required
              minLength={6}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={busy} className={`w-full ${SHOP_BTN_PRIMARY_CLASS}`}>
            {busy ? t('shopLoading') : t('shopCreateAccount')}
          </button>
        </form>
      ) : (
        <form onSubmit={onLogin} className="space-y-3">
          <label className="block">
            <span className={SHOP_LABEL_CLASS}>{t('shopEmail')}</span>
            <input
              className={SHOP_INPUT_CLASS}
              type="email"
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
            />
          </label>
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className={SHOP_LABEL_CLASS + ' mb-0'}>{t('shopPassword')}</span>
              <Link
                to={joinShopPath(base, 'forgot-password')}
                className="text-xs text-stone-500 hover:text-stone-800"
              >
                {t('shopForgotPassword')}
              </Link>
            </div>
            <input
              className={`mt-1 ${SHOP_INPUT_CLASS}`}
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={busy} className={`w-full ${SHOP_BTN_PRIMARY_CLASS}`}>
            {busy ? t('shopLoading') : t('shopLogIn')}
          </button>
        </form>
      )}
    </ShopAuthShell>
  );
}
