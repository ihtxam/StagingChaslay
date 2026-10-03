import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Loader2,
  Menu,
  UserCircle2,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { APP_NAME, REBORN_LOGO_WHITE } from '@/lib/brand';
import { BRAND_BLUE_CHARCOAL, BRAND_WARM_WHITE } from '@/lib/brand-colors';
import { useI18n } from '@/lib/i18n';
import {
  STAFF_PIN_MAX_LENGTH,
  STAFF_PIN_MIN_LENGTH,
} from '@/lib/staff-pin';
import { isNetworkError } from '@/lib/webpos-offline/network';
import WebPosBlockingAlert from '@/components/WebPosBlockingAlert';

const PIN_MIN_LENGTH = STAFF_PIN_MIN_LENGTH;
const PIN_MAX_LENGTH = STAFF_PIN_MAX_LENGTH;
/** Pause so a longer PIN can be typed before verify runs (no OK button in gate mode). */
const PIN_AUTO_DELAY_MS = 420;

export type WebPosPinModalMode = 'gate' | 'switch';

type GateKey = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'clear' | '0' | 'enter';

const GATE_KEYS: GateKey[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'clear',
  '0',
  'enter',
];

function useLiveClock(locale: string) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeLocale = locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-GB';

  const timeParts = new Intl.DateTimeFormat(timeLocale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(now);

  const hour = timeParts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = timeParts.find((p) => p.type === 'minute')?.value ?? '';
  const dayPeriod = timeParts.find((p) => p.type === 'dayPeriod')?.value ?? '';

  const dateLabel = new Intl.DateTimeFormat(timeLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now);

  return { hour, minute, dayPeriod, dateLabel };
}

export default function WebPosPinModal({
  open,
  mode = 'switch',
  onClose,
  onSuccess,
  onLeave,
  onLogout,
  productName,
  logoUrl,
}: {
  open: boolean;
  /** `gate` = fullscreen unlock before register; `switch` = compact switch-user modal */
  mode?: WebPosPinModalMode;
  onClose: () => void;
  onSuccess: (staff: {
    id: string;
    name: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    accessToken?: string;
    preferredTerminalId?: string | null;
  }) => void;
  /** Owner/manager escape from PIN gate back to the merchant panel. */
  onLeave?: () => void;
  /** Sign out of the merchant account (clears JWT + PIN session). */
  onLogout?: () => void;
  /** Bottom-left label; defaults to translated product name. */
  productName?: string | null;
  /** Bottom-right logo; defaults to Reborn white logo. */
  logoUrl?: string | null;
}) {
  const { t, locale } = useI18n();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const busyRef = useRef(false);
  const autoTimerRef = useRef<number | null>(null);
  const isGate = mode === 'gate';
  const clock = useLiveClock(locale);

  const clearAutoTimer = () => {
    if (autoTimerRef.current != null) {
      window.clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      clearAutoTimer();
      setPin('');
      setError('');
      setShake(false);
      setMenuOpen(false);
      busyRef.current = false;
      setBusy(false);
    }
  }, [open]);

  useEffect(() => () => clearAutoTimer(), []);

  if (!open) return null;

  const failPin = (message: string) => {
    setError(message);
    setPin('');
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  const pinErrorMessage = (error: unknown): string => {
    if (!navigator.onLine || isNetworkError(error)) {
      return t('webPosPinNoInternet');
    }
    const err = error as { response?: { data?: { error?: string } } };
    return err.response?.data?.error || t('webPosPinInvalid');
  };

  const submitPin = async (value: string) => {
    clearAutoTimer();
    if (busyRef.current) return;
    if (value.length < PIN_MIN_LENGTH) {
      setError(t('webPosPinHint'));
      return;
    }
    if (!navigator.onLine) {
      failPin(t('webPosPinNoInternet'));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/merchant/staff/verify-pin', { pin: value });
      onSuccess(res.data.staff);
      if (!isGate) onClose();
    } catch (e: unknown) {
      failPin(pinErrorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const scheduleAutoSubmit = (value: string) => {
    clearAutoTimer();
    if (value.length < PIN_MIN_LENGTH) return;
    autoTimerRef.current = window.setTimeout(() => {
      autoTimerRef.current = null;
      void submitPin(value);
    }, PIN_AUTO_DELAY_MS);
  };

  const appendDigit = (d: string) => {
    if (pin.length >= PIN_MAX_LENGTH || busyRef.current) return;
    clearAutoTimer();
    const next = pin + d;
    setPin(next);
    setError('');
    if (next.length >= PIN_MAX_LENGTH) {
      void submitPin(next);
      return;
    }
    if (next.length >= PIN_MIN_LENGTH) {
      scheduleAutoSubmit(next);
    }
  };

  const backspace = () => {
    if (busyRef.current) return;
    clearAutoTimer();
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleGateKey = (key: GateKey) => {
    if (key === 'clear') backspace();
    else if (key === 'enter') void submitPin(pin);
    else appendDigit(key);
  };

  const switchKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'] as const;

  const dots = Math.max(
    PIN_MIN_LENGTH,
    Math.min(pin.length > 0 ? pin.length : PIN_MIN_LENGTH, PIN_MAX_LENGTH)
  );

  const footerProductName = productName?.trim() || t('webPosPinProductName');
  const footerLogoUrl = logoUrl?.trim() || REBORN_LOGO_WHITE;

  const gateKeypad = (
    <div className="webpos-pin-gate-keypad mx-auto grid w-full max-w-[min(17rem,82vw)] grid-cols-3 gap-1.5 sm:max-w-[18rem] sm:gap-2">
      {GATE_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={busy}
          onClick={() => handleGateKey(key)}
          className="webpos-pin-gate-key flex h-[2.75rem] w-full items-center justify-center rounded-xl bg-[#B8324A] text-xl font-semibold text-white transition-colors hover:bg-[#c94d62] disabled:opacity-50 sm:h-[3.25rem] sm:text-2xl md:h-12 lg:h-14 lg:text-[1.65rem]"
          aria-label={
            key === 'clear'
              ? t('webPosPinClear')
              : key === 'enter'
                ? t('webPosPinEnter')
                : key
          }
        >
          {busy && key === 'enter' ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : key === 'clear' ? (
            <X className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
          ) : key === 'enter' ? (
            <ArrowRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );

  const switchKeypad = (
    <div className="grid grid-cols-3 gap-2">
      {switchKeys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={busy}
          onClick={() => {
            if (key === '⌫') backspace();
            else if (key === 'OK') void submitPin(pin);
            else appendDigit(key);
          }}
          className={`font-semibold disabled:opacity-50 ${
            key === 'OK'
              ? 'webpos-accent-btn rounded-xl py-3 text-lg'
              : 'webpos-keypad-key'
          }`}
        >
          {busy && key === 'OK' ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : key}
        </button>
      ))}
    </div>
  );

  const pinDots = (
    <div className="flex justify-center gap-3">
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className={`rounded-full transition-colors ${
            isGate ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-3 w-3'
          } ${
            i < pin.length
              ? 'bg-white'
              : isGate
                ? 'bg-white/25'
                : 'bg-[var(--webpos-border,var(--border))]'
          }`}
        />
      ))}
    </div>
  );

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  if (isGate) {
    const hasMenu = Boolean(onLeave || onLogout);

    const gate = (
      <div
        className="fixed inset-0 z-[120] flex flex-col overflow-hidden"
        style={{ backgroundColor: BRAND_BLUE_CHARCOAL, color: BRAND_WARM_WHITE }}
      >
        <WebPosBlockingAlert
          open={!!error}
          title={t('webPosPinErrorTitle')}
          message={error}
          onDismiss={() => setError('')}
          minMs={6000}
        />

        {hasMenu ? (
          <div className="absolute left-0 top-0 z-10 p-4 sm:p-6">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white/90 hover:bg-white/10"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={t('webPosPinMenu')}
            >
              <Menu className="h-6 w-6" />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  aria-label={t('close')}
                  onClick={() => setMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="relative z-20 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[#0f1c22] shadow-2xl"
                >
                  {onLeave ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-4 py-3 text-left text-sm font-medium text-white/90 hover:bg-white/10"
                      onClick={() => {
                        setMenuOpen(false);
                        onLeave();
                      }}
                    >
                      {t('webPosBackOffice')}
                    </button>
                  ) : null}
                  {onLogout ? (
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-4 py-3 text-left text-sm font-medium text-white/70 hover:bg-white/10"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout();
                      }}
                    >
                      {t('logout')}
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden min-[640px]:flex-row ${
            shake ? 'webpos-pin-shake' : ''
          }`}
        >
          <section className="webpos-pin-gate-clock flex shrink-0 flex-col items-center justify-start px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center min-[640px]:min-h-0 min-[640px]:flex-1 min-[640px]:justify-start min-[640px]:px-5 min-[640px]:pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-6 lg:pb-4 lg:pt-8">
            <div className="flex items-baseline justify-center gap-1 sm:gap-2">
              <span className="webpos-pin-gate-time text-[clamp(2.5rem,9vw,5.5rem)] font-extralight leading-none tracking-tight lg:text-[clamp(3.5rem,12vw,7rem)]">
                {clock.hour}:{clock.minute}
              </span>
              {clock.dayPeriod ? (
                <span className="webpos-pin-gate-ampm text-[clamp(0.85rem,2.5vw,1.35rem)] font-light uppercase tracking-wide text-white/80 lg:text-[clamp(1rem,3vw,1.75rem)]">
                  {clock.dayPeriod}
                </span>
              ) : null}
            </div>
            <p className="webpos-pin-gate-date mt-2 max-w-md text-[clamp(0.8rem,2vw,1.1rem)] font-light leading-snug text-white/85 lg:mt-4 lg:text-[clamp(0.95rem,2.2vw,1.35rem)]">
              {clock.dateLabel}
            </p>
          </section>

          <section className="webpos-pin-gate-entry flex min-h-0 flex-1 flex-col items-center justify-start overflow-y-auto overscroll-contain px-4 pb-2 pt-1 min-[640px]:px-5 min-[640px]:pb-3 lg:px-6 lg:pb-4 lg:pt-4">
            <div className="mb-3 flex w-full max-w-md flex-col items-center gap-1.5 text-center sm:mb-4 sm:gap-2">
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-white/80 sm:h-7 sm:w-7" aria-hidden />
              ) : null}
              <h1 className="text-lg font-semibold leading-tight tracking-tight sm:text-xl lg:text-2xl">
                {t('webPosPinGateTitle')}
              </h1>
              <p className="max-w-sm text-xs leading-snug text-white/65 sm:text-sm">
                {t('webPosPinGateHint')}
              </p>
            </div>

            <div className="mb-3 sm:mb-4">{pinDots}</div>

            {error ? (
              <div className="mb-4 w-full max-w-md rounded-xl border border-red-400/60 bg-red-950/80 px-4 py-3 text-center">
                <p className="text-base font-semibold text-red-100">{error}</p>
              </div>
            ) : null}

            {gateKeypad}
          </section>
        </div>

        <footer className="webpos-pin-gate-footer z-10 flex shrink-0 items-end justify-between gap-3 border-t border-white/5 px-4 py-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-2.5 lg:px-8">
          <p className="min-w-0 truncate text-[11px] font-medium tracking-wide text-white/70 sm:text-xs lg:text-sm">
            {footerProductName}
          </p>
          <img
            src={footerLogoUrl}
            alt={APP_NAME}
            className="h-6 w-auto max-w-[min(36vw,9rem)] shrink-0 object-contain object-right sm:h-7 lg:h-9"
          />
        </footer>
      </div>
    );
    return portalTarget ? createPortal(gate, portalTarget) : gate;
  }

  const switchModal = (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <WebPosBlockingAlert
        open={!!error}
        title={t('webPosPinErrorTitle')}
        message={error}
        onDismiss={() => setError('')}
        minMs={5000}
      />
      <div
        className={`w-full max-w-xs rounded-2xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-surface,var(--bg-elevated))] p-5 text-[var(--webpos-text,var(--text))] shadow-2xl ${
          shake ? 'webpos-pin-shake' : ''
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[var(--webpos-text,var(--text))]">
            <UserCircle2 className="h-5 w-5" />
            <h2 className="font-semibold">{t('webPosPinTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--webpos-text-muted,var(--text-muted))] hover:bg-[var(--webpos-surface-2,var(--bg-muted))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">{pinDots}</div>

        {error ? (
          <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center">
            <p className="text-sm font-semibold text-red-800">{error}</p>
          </div>
        ) : null}

        {switchKeypad}

        {onLogout ? (
          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-[var(--webpos-border,var(--border))] py-2.5 text-sm font-semibold text-[var(--webpos-text-muted,var(--text-muted))] hover:bg-[var(--webpos-surface-2,var(--bg-muted))]"
            onClick={onLogout}
          >
            {t('logout')}
          </button>
        ) : null}
      </div>
    </div>
  );
  return portalTarget ? createPortal(switchModal, portalTarget) : switchModal;
}
