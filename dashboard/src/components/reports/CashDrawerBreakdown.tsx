import { useI18n } from '@/lib/i18n';

export type CashDrawerMovement = {
  type: string;
  amount: number;
  reason?: string | null;
  staffName?: string | null;
  createdAt?: string | null;
};

export type CashDrawerShift = {
  openingFloat: number;
  cashSales: number;
  cashIn?: number;
  cashOut?: number;
  cashRefunds?: number;
  movements?: CashDrawerMovement[];
  expectedCash: number;
  closingCashCounted?: number | null;
  variance?: number | null;
  staffName?: string | null;
};

function movementLabel(
  m: CashDrawerMovement,
  formatDateTime: (iso: string) => string
): string {
  const when = m.createdAt ? formatDateTime(m.createdAt) : '';
  const reason = (m.reason || m.staffName || '').trim();
  return [when, reason].filter(Boolean).join(' · ') || '—';
}

export function CashDrawerBreakdown({
  shifts,
  money,
}: {
  shifts: CashDrawerShift[];
  money: (n: number) => string;
}) {
  const { t, formatDateTime } = useI18n();
  if (!shifts.length) return null;

  return (
    <section className="card overflow-hidden !p-0">
      <h2 className="px-3 py-2 sm:px-4 text-sm font-semibold border-b border-[var(--border)]">
        {t('reportsCashDrawer')}
      </h2>
      <div className="divide-y divide-[var(--border)]">
        {shifts.map((s, idx) => {
          const cashIn = s.cashIn ?? 0;
          const cashOut = s.cashOut ?? 0;
          const cashRefunds = s.cashRefunds ?? 0;
          const cashSalesGross =
            Math.round((Number(s.cashSales || 0) + cashRefunds) * 100) / 100;
          const ins = (s.movements || []).filter(
            (m) => String(m.type).toLowerCase() !== 'out'
          );
          const outs = (s.movements || []).filter(
            (m) => String(m.type).toLowerCase() === 'out'
          );
          return (
            <div key={idx} className="p-3 space-y-3 text-sm">
              {s.staffName || shifts.length > 1 ? (
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  {s.staffName || `${t('reportsCashDrawer')} ${idx + 1}`}
                </p>
              ) : null}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {s.openingFloat > 0 ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide muted">
                      {t('reportsOpeningFloat')}
                    </p>
                    <p className="font-semibold tabular-nums mt-0.5">
                      {money(s.openingFloat)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {t('reportsFloatCarriesForward')}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] uppercase tracking-wide muted">
                    {t('webPosShiftCashSales')}
                  </p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {money(cashSalesGross)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide muted">
                    {t('webPosShiftCashIn')}
                  </p>
                  <p className="font-semibold tabular-nums mt-0.5 text-emerald-700">
                    {cashIn > 0 ? `+${money(cashIn)}` : money(0)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide muted">
                    {t('webPosShiftCashOut')}
                  </p>
                  <p className="font-semibold tabular-nums mt-0.5 text-rose-700">
                    {cashOut > 0 ? `−${money(cashOut)}` : money(0)}
                  </p>
                </div>
                {cashRefunds > 0 ? (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide muted">
                      {t('reportsCashRefunds')}
                    </p>
                    <p className="font-semibold tabular-nums mt-0.5 text-rose-700">
                      −{money(cashRefunds)}
                    </p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[11px] uppercase tracking-wide muted">
                    {t('webPosShiftExpectedDrawer')}
                  </p>
                  <p className="font-semibold tabular-nums mt-0.5">
                    {money(s.expectedCash)}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {t('reportsExpectedFormula')}
                  </p>
                </div>
                {s.closingCashCounted != null && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide muted">
                      {t('webPosShiftCountCash')}
                    </p>
                    <p className="font-semibold tabular-nums mt-0.5">
                      {money(s.closingCashCounted)}
                    </p>
                  </div>
                )}
                {s.variance != null && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide muted">
                      {t('reportsCashVariance')}
                    </p>
                    <p className="font-semibold tabular-nums mt-0.5">{money(s.variance)}</p>
                  </div>
                )}
              </div>
              {ins.length + outs.length > 0 ? (
                <ul className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {ins.map((m, mi) => (
                    <li
                      key={`in-${mi}`}
                      className="px-2.5 py-1.5 flex justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 truncate text-[var(--text-muted)]">
                        {t('webPosShiftCashIn')} · {movementLabel(m, formatDateTime)}
                      </span>
                      <span className="tabular-nums shrink-0 text-emerald-700">
                        +{money(m.amount)}
                      </span>
                    </li>
                  ))}
                  {outs.map((m, mi) => (
                    <li
                      key={`out-${mi}`}
                      className="px-2.5 py-1.5 flex justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 truncate text-[var(--text-muted)]">
                        {t('webPosShiftCashOut')} · {movementLabel(m, formatDateTime)}
                      </span>
                      <span className="tabular-nums shrink-0 text-rose-700">
                        −{money(m.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
