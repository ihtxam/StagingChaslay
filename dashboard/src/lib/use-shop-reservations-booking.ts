import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { hmZurich, ymdZurich } from '@/components/shop/InlineReservationsWidget';
import { formatShopVacationMessage } from '@/lib/shop-ordering-status';
import {
  evaluatePartyBookingGate,
  resolveLargePartyCallThreshold,
} from '@/lib/reservation-party-threshold';

export type ReservationSlot = {
  time: string;
  available: boolean;
  waitlistAvailable?: boolean;
  remainingCovers: number;
  discountPercent?: number;
  discountLabel?: string | null;
  promoKind?: string | null;
  promoIcon?: 'percent' | 'wine' | 'dine' | string | null;
};

export type ReservationPeekBanner = {
  message: string;
  icon: 'percent' | 'wine' | 'dine';
};

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function useShopReservationsBooking(shopKey: string, t: TranslateFn) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState(() => ymdZurich());
  const [slots, setSlots] = useState<ReservationSlot[]>([]);
  const [peekBanner, setPeekBanner] = useState<ReservationPeekBanner | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [time, setTime] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [done, setDone] = useState<{
    code: string;
    status: string;
    reservedAt: string;
    extras?: { quotedWaitMinutes?: number | null; depositAmount?: number | null } | null;
  } | null>(null);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/reservations/config`);
        if (cancelled) return;
        setConfig(res.data.config);
        const min = Number(res.data.config?.settings?.minPartySize) || 1;
        setPartySize(Math.max(2, min));
      } catch (e: any) {
        if (!cancelled) setError(e.response?.data?.error || t('shopReservationsUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t]);

  useEffect(() => {
    if (!shopKey || !config) return;
    let cancelled = false;
    setSlotsLoading(true);
    setTime('');
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}/reservations/slots`, {
          params: { date, partySize },
        });
        if (cancelled) return;
        setPeekBanner(res.data.peekBanner || null);
        setSlots(
          (res.data.slots || []).filter((s: ReservationSlot) => {
            if (date !== ymdZurich()) return true;
            const leadH = Number(config?.settings?.minHoursBefore) || 0;
            const nowHm = hmZurich();
            const [nh, nm] = nowHm.split(':').map(Number);
            const nowMins = nh * 60 + nm + Math.max(0, leadH) * 60;
            const [sh, sm] = String(s.time || '00:00').split(':').map(Number);
            return sh * 60 + sm > nowMins;
          })
        );
      } catch (e: any) {
        if (!cancelled) {
          setSlots([]);
          setError(e.response?.data?.error || t('shopReservationsSlotsFailed'));
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, config, date, partySize, t]);

  const maxDate = useMemo(() => {
    const days = Number(config?.settings?.maxDaysAhead) || 30;
    const [y, m, d] = ymdZurich().split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
  }, [config]);

  const minParty = Number(config?.settings?.minPartySize) || 1;
  const maxParty = Number(config?.settings?.maxPartySize) || 12;
  const largePartyCallThreshold = resolveLargePartyCallThreshold(
    config?.settings?.largePartyCallThreshold,
  );
  const reservationPhone = String(config?.phone || '').trim();
  const slotIntervalMinutes = Number(config?.settings?.slotIntervalMinutes) || 30;
  const minHoursBefore = Number(config?.settings?.minHoursBefore) || 0;
  const waitlistEnabled = config?.settings?.waitlistEnabled !== false;

  const partyGate = useMemo(
    () => evaluatePartyBookingGate(partySize, minParty, maxParty, largePartyCallThreshold),
    [partySize, minParty, maxParty, largePartyCallThreshold],
  );

  const dateOptions = useMemo(() => {
    const days = Math.min(Math.max(Number(config?.settings?.maxDaysAhead) || 30, 1), 90);
    const [y0, m0, d0] = ymdZurich().split('-').map(Number);
    const out: Array<{
      value: string;
      weekday: string;
      dayNum: string;
      month: string;
      isToday: boolean;
    }> = [];
    for (let i = 0; i < Math.min(days, 14); i += 1) {
      const dt = new Date(Date.UTC(y0, m0 - 1, d0 + i, 12, 0, 0));
      const value = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
      const labelDate = new Date(`${value}T12:00:00+02:00`);
      out.push({
        value,
        weekday: labelDate.toLocaleDateString('fr-CH', { weekday: 'short' }).replace('.', '').toUpperCase(),
        dayNum: String(dt.getUTCDate()),
        month: labelDate.toLocaleDateString('fr-CH', { month: 'short' }).replace('.', '').toUpperCase(),
        isToday: i === 0,
      });
    }
    return out;
  }, [config]);

  const lunchSlots = useMemo(
    () => slots.filter((s) => {
      const h = Number(String(s.time).split(':')[0]);
      return h < 16;
    }),
    [slots]
  );
  const dinnerSlots = useMemo(
    () => slots.filter((s) => {
      const h = Number(String(s.time).split(':')[0]);
      return h >= 16;
    }),
    [slots]
  );

  const submit = async (payload?: { guestName?: string }) => {
    const name = (payload?.guestName ?? guestName).trim();
    if (config?.acceptingReservations === false) {
      setError(t('shopNotAcceptingReservations'));
      return null;
    }
    if (config?.vacation?.active) {
      setError(
        formatShopVacationMessage(t, 'reservations', {
          returnDate: config.vacation.returnDate,
          returnTime: config.vacation.returnTime,
        })
      );
      return null;
    }
    if (partyGate.blocked) {
      if (partyGate.reason === 'call_threshold') {
        setError(t('shopReservationsLargePartyCall', { count: largePartyCallThreshold ?? partySize, phone: reservationPhone || '—' }));
      } else if (partyGate.reason === 'above_max') {
        setError(t('shopReservationsLargePartyMax', { max: maxParty, phone: reservationPhone || '—' }));
      } else {
        setError(t('shopReservationsParty'));
      }
      return null;
    }
    if (!time) {
      setError(t('shopReservationsPickTime'));
      return null;
    }
    if (!name) {
      setError(t('name'));
      return null;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await axios.post(`/api/shop/${shopKey}/reservations`, {
        guestName: name,
        guestPhone,
        guestEmail: guestEmail || undefined,
        partySize,
        date,
        time,
        notes: [notes, marketingOptIn ? '[marketing:opt-in]' : ''].filter(Boolean).join(' ').trim() || undefined,
        policyAccepted,
      });
      const result = {
        code: res.data.reservation.code,
        status: res.data.reservation.status,
        reservedAt: res.data.reservation.reservedAt,
        extras: res.data.reservation.extras || null,
      };
      setDone(result);
      return result;
    } catch (err: any) {
      setError(err.response?.data?.error || t('shopReservationsBookFailed'));
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const activePeekBanner = useMemo((): ReservationPeekBanner | null => {
    if (time) {
      const slot = slots.find((s) => s.time === time);
      if (slot?.discountLabel) {
        return {
          message: slot.discountLabel,
          icon: (slot.promoIcon as ReservationPeekBanner['icon']) || 'percent',
        };
      }
    }
    return peekBanner;
  }, [peekBanner, slots, time]);

  const canSubmit =
    !!time &&
    !partyGate.blocked &&
    config?.acceptingReservations !== false &&
    !config?.vacation?.active &&
    (!config?.settings?.depositEnabled || policyAccepted);

  return {
    loading,
    error,
    setError,
    config,
    partySize,
    setPartySize,
    minParty,
    maxParty,
    largePartyCallThreshold,
    reservationPhone,
    partyGate,
    slotIntervalMinutes,
    minHoursBefore,
    waitlistEnabled,
    date,
    setDate,
    maxDate,
    dateOptions,
    slots,
    peekBanner: activePeekBanner,
    slotsLoading,
    lunchSlots,
    dinnerSlots,
    time,
    setTime,
    guestName,
    setGuestName,
    guestPhone,
    setGuestPhone,
    guestEmail,
    setGuestEmail,
    notes,
    setNotes,
    policyAccepted,
    setPolicyAccepted,
    marketingOptIn,
    setMarketingOptIn,
    submitting,
    done,
    submit,
    canSubmit,
  };
}
