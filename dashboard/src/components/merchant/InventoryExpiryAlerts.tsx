import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { playOrderAlertOnce } from '@/lib/order-alert';

type ExpiringLot = {
  id: string;
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
  expiryDate: string;
  daysLeft: number | null;
  expired: boolean;
};

const DISMISS_KEY = 'merchant_inv_expiry_dismissed';

function lotFingerprint(lots: ExpiringLot[]): string {
  return lots
    .map((l) => l.id)
    .sort()
    .join(',');
}

export default function InventoryExpiryAlerts() {
  const { t, formatDate } = useI18n();
  const [lots, setLots] = useState<ExpiringLot[]>([]);
  const [leadDays, setLeadDays] = useState(30);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const prevCountRef = useRef(0);
  const disabledRef = useRef(false);

  const fingerprint = useMemo(() => lotFingerprint(lots), [lots]);

  const load = useCallback(async () => {
    if (disabledRef.current) return;
    try {
      const res = await api.get('/merchant/inventory/expiring-soon', {
        validateStatus: (status) => status < 500,
      });
      if (res.status === 404 || res.status === 403 || res.status === 400 || res.status === 401) {
        disabledRef.current = true;
        return;
      }
      if (res.status !== 200) return;
      const next = (res.data.lots || []) as ExpiringLot[];
      setLeadDays(Number(res.data.leadDays) || 30);
      setLots(next);
      if (next.length > prevCountRef.current && prevCountRef.current >= 0) {
        playOrderAlertOnce();
      }
      prevCountRef.current = next.length;
    } catch {
      /* inventory addon may be off */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    try {
      setDismissedFor(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissedFor(null);
    }
  }, [fingerprint]);

  if (!lots.length || dismissedFor === fingerprint) return null;

  const urgent = lots.filter((l) => l.expired || (l.daysLeft != null && l.daysLeft <= 7));

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, fingerprint);
    } catch {
      /* ignore */
    }
    setDismissedFor(fingerprint);
  };

  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div className="min-w-0">
            <p className="font-semibold">
              {t('invExpiryAlertsTitle', { count: lots.length, days: leadDays })}
            </p>
            <p className="text-xs opacity-90">{t('invExpiryAlertsHint')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/merchant/inventory/list" className="text-xs font-semibold underline">
            {t('invNavStockTable')}
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg p-1 text-amber-900/70 hover:bg-amber-100 hover:text-amber-950"
            aria-label={t('dismiss')}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-xs">
        {(urgent.length ? urgent : lots).slice(0, 5).map((lot) => (
          <li key={lot.id} className="flex justify-between gap-2">
            <span>
              {lot.itemName} · {lot.qty} {lot.unit}
            </span>
            <span className={lot.expired ? 'font-bold text-red-700' : ''}>
              {lot.expired
                ? t('invExpiryExpired')
                : t('invExpiryDaysLeft', { days: lot.daysLeft ?? 0 })}
              {' · '}
              {formatDate(lot.expiryDate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
