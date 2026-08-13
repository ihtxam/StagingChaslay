export const STORE_HOURS_DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

export type StoreHoursDayKey = (typeof STORE_HOURS_DAYS)[number]['key'];
export type HoursChannelKey = 'takeaway' | 'dine_in' | 'delivery' | 'display';

export type HoursSlot = { open: string; close: string };
export type ChannelHours = Record<string, HoursSlot[]>;
export type StoreHours = Record<string, ChannelHours>;

export const STORE_HOURS_CHANNELS: HoursChannelKey[] = [
  'takeaway',
  'dine_in',
  'delivery',
  'display',
];

export const STORE_HOURS_APPLY_CHANNELS: {
  key: HoursChannelKey;
  labelKey: 'hoursChannelPickup' | 'hoursChannelDineIn' | 'hoursChannelDelivery' | 'hoursChannelDisplay';
  hintKey:
    | 'hoursChannelPickupHint'
    | 'hoursChannelDineInHint'
    | 'hoursChannelDeliveryHint'
    | 'hoursChannelDisplayHint';
}[] = [
  { key: 'takeaway', labelKey: 'hoursChannelPickup', hintKey: 'hoursChannelPickupHint' },
  { key: 'dine_in', labelKey: 'hoursChannelDineIn', hintKey: 'hoursChannelDineInHint' },
  { key: 'delivery', labelKey: 'hoursChannelDelivery', hintKey: 'hoursChannelDeliveryHint' },
  { key: 'display', labelKey: 'hoursChannelDisplay', hintKey: 'hoursChannelDisplayHint' },
];

export function cloneHoursSlots(slots: HoursSlot[]): HoursSlot[] {
  return slots.map((s) => ({ open: s.open, close: s.close }));
}

export function mkWeekFromSlots(slots: HoursSlot[]): ChannelHours {
  return Object.fromEntries(STORE_HOURS_DAYS.map((d) => [d.key, cloneHoursSlots(slots)]));
}

export function emptyStoreHours(): StoreHours {
  const lunchDinner: HoursSlot[] = [
    { open: '11:00', close: '14:00' },
    { open: '17:00', close: '23:00' },
  ];
  return {
    takeaway: mkWeekFromSlots(lunchDinner),
    dine_in: mkWeekFromSlots(lunchDinner),
    delivery: mkWeekFromSlots(lunchDinner),
    display: mkWeekFromSlots(lunchDinner),
  };
}

function mkWeekFromChannel(ch: ChannelHours): ChannelHours {
  return Object.fromEntries(
    STORE_HOURS_DAYS.map((d) => [d.key, cloneHoursSlots(ch[d.key] || [])])
  );
}

export function mergeStoreHours(saved: StoreHours | null | undefined): StoreHours {
  const base = emptyStoreHours();
  if (!saved || typeof saved !== 'object') return base;
  const out: StoreHours = { ...base };
  for (const ch of STORE_HOURS_CHANNELS) {
    const incoming = saved[ch];
    if (!incoming || typeof incoming !== 'object') continue;
    const dayMap: ChannelHours = { ...(base[ch] || {}) };
    for (const d of STORE_HOURS_DAYS) {
      const slots = incoming[d.key];
      if (Array.isArray(slots)) {
        dayMap[d.key] = slots
          .filter((s) => s && s.open && s.close)
          .map((s) => ({ open: s.open, close: s.close }));
      }
    }
    out[ch] = dayMap;
  }
  if (!saved.display) out.display = mkWeekFromChannel(out.takeaway);
  return out;
}

export function formatDaySlots(slots: HoursSlot[] | undefined): string {
  if (!slots?.length) return 'Closed';
  return slots.map((s) => `${s.open}-${s.close}`).join(', ');
}

export function summarizeChannelHours(ch: ChannelHours): string {
  const groups: { start: string; end: string; text: string }[] = [];
  for (const d of STORE_HOURS_DAYS) {
    const text = formatDaySlots(ch[d.key]);
    const last = groups[groups.length - 1];
    if (last && last.text === text) {
      last.end = d.label;
    } else {
      groups.push({ start: d.label, end: d.label, text });
    }
  }
  return groups
    .map((g) => (g.start === g.end ? `${g.start} ${g.text}` : `${g.start}-${g.end} ${g.text}`))
    .join(' · ');
}
