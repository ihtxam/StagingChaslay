import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  buildCalendarMonthGrid,
  shiftCalendarViewYm,
} from '@/lib/reservation-calendar-month';
import { ymdZurich } from '@/lib/date-format';

export type CalendarReservationRow = {
  id: string;
  guestName: string;
  partySize: number;
  reservedAt: string;
  status: string;
};

type Props = {
  viewYm: string;
  onViewYmChange: (next: string) => void;
  byDay: Map<string, CalendarReservationRow[]>;
  selectedYmd: string | null;
  onSelectDay: (ymd: string) => void;
  variant?: 'panel' | 'webpos';
};

export default function ReservationsCalendarView({
  viewYm,
  onViewYmChange,
  byDay,
  selectedYmd,
  onSelectDay,
  variant = 'panel',
}: Props) {
  const { t, locale } = useI18n();
  const todayYmd = ymdZurich();
  const grid = useMemo(() => buildCalendarMonthGrid(viewYm), [viewYm]);

  const monthLabel = useMemo(() => {
    const [y, m] = viewYm.split('-').map(Number);
    const loc = locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH';
    return new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(
      new Date(Date.UTC(y, m - 1, 1))
    );
  }, [viewYm, locale]);

  const weekdays = useMemo(() => {
    const loc = locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH';
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(
        new Date(Date.UTC(2024, 0, 1 + i))
      )
    );
  }, [locale]);

  const isWebpos = variant === 'webpos';
  const cellBase = isWebpos
    ? 'min-h-[4.5rem] rounded-lg border p-1.5 text-left transition-colors'
    : 'min-h-[5rem] rounded-md border p-2 text-left transition-colors';
  const cellIdle = isWebpos
    ? 'border-[var(--webpos-border)] bg-[var(--webpos-surface)] hover:bg-[var(--webpos-surface-2)]'
    : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-muted)]';
  const cellSelected = isWebpos
    ? 'border-[var(--webpos-accent)] bg-[var(--webpos-surface-2)] ring-1 ring-[var(--webpos-accent)]'
    : 'border-[var(--text)] bg-[var(--bg-muted)] ring-1 ring-[var(--text)]';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={isWebpos ? 'rounded-lg border border-[var(--webpos-border)] p-2' : 'btn-secondary p-2'}
          onClick={() => onViewYmChange(shiftCalendarViewYm(viewYm, -1))}
          aria-label={t('previous')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold">{monthLabel}</p>
        <button
          type="button"
          className={isWebpos ? 'rounded-lg border border-[var(--webpos-border)] p-2' : 'btn-secondary p-2'}
          onClick={() => onViewYmChange(shiftCalendarViewYm(viewYm, 1))}
          aria-label={t('next')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: grid.firstWeekdayMon0 }).map((_, i) => (
          <span key={`pad-${i}`} className="min-h-[4.5rem]" aria-hidden />
        ))}
        {grid.days.map((ymd) => {
          const list = byDay.get(ymd) || [];
          const dayNum = Number(ymd.split('-')[2]);
          const selected = selectedYmd === ymd;
          const isToday = ymd === todayYmd;
          const pending = list.some((r) => r.status === 'pending');
          return (
            <button
              key={ymd}
              type="button"
              className={`${cellBase} ${selected ? cellSelected : cellIdle}`}
              onClick={() => onSelectDay(ymd)}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-xs font-bold ${isToday ? (isWebpos ? 'text-[var(--webpos-accent)]' : 'text-teal-700') : ''}`}
                >
                  {dayNum}
                </span>
                {list.length > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      pending
                        ? 'bg-amber-100 text-amber-900'
                        : isWebpos
                          ? 'bg-[var(--webpos-accent)]/15 text-[var(--webpos-text)]'
                          : 'bg-stone-200 text-stone-800'
                    }`}
                  >
                    {list.length}
                  </span>
                ) : null}
              </div>
              <ul className="mt-1 space-y-0.5 text-[10px] leading-tight opacity-90">
                {list.slice(0, 3).map((r) => (
                  <li key={r.id} className="truncate">
                    {r.guestName}
                    <span className="opacity-70"> · {r.partySize}</span>
                  </li>
                ))}
                {list.length > 3 ? (
                  <li className="font-semibold opacity-70">+{list.length - 3}</li>
                ) : null}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}
