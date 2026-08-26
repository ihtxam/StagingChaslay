import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
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

export default function InventoryExpiryAlerts() {
  const { t, formatDate } = useI18n();
  const [lots, setLots] = useState<ExpiringLot[]>([]);
  const [leadDays, setLeadDays] = useState(30);
  const prevCountRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/merchant/inventory/expiring-soon');
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

  if (!lots.length) return null;

  const urgent = lots.filter((l) => l.expired || (l.daysLeft != null && l.daysLeft <= 7));

  return (
    <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          <div>
            <p className="font-semibold">
              {t('invExpiryAlertsTitle', { count: lots.length, days: leadDays })}
            </p>
            <p className="text-xs opacity-90">{t('invExpiryAlertsHint')}</p>
          </div>
        </div>
        <Link to="/merchant/inventory/list" className="text-xs font-semibold underline">
          {t('invNavStockTable')}
        </Link>
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
