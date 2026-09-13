import { useMemo } from 'react';

const DIAL_CODES = [
  { iso: 'CH', dial: '+41' },
  { iso: 'DE', dial: '+49' },
  { iso: 'FR', dial: '+33' },
  { iso: 'IT', dial: '+39' },
  { iso: 'AT', dial: '+43' },
  { iso: 'BE', dial: '+32' },
  { iso: 'NL', dial: '+31' },
  { iso: 'GB', dial: '+44' },
  { iso: 'ES', dial: '+34' },
  { iso: 'PT', dial: '+351' },
  { iso: 'US', dial: '+1' },
] as const;

function splitPhone(value: string): { dial: string; local: string } {
  const raw = String(value || '').trim();
  const match = DIAL_CODES.find((c) => raw.startsWith(c.dial));
  if (match) {
    return { dial: match.dial, local: raw.slice(match.dial.length).replace(/^\s+/, '') };
  }
  if (raw.startsWith('+')) {
    const m = raw.match(/^(\+\d{1,3})\s*(.*)$/);
    if (m) return { dial: m[1], local: m[2] };
  }
  return { dial: '+41', local: raw.replace(/^0+/, '') };
}

type Props = {
  value: string;
  onChange: (full: string) => void;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
};

export default function ShopPhoneField({ value, onChange, invalid, placeholder, className }: Props) {
  const parts = useMemo(() => splitPhone(value), [value]);
  const known = DIAL_CODES.some((c) => c.dial === parts.dial);

  return (
    <div
      className={`flex overflow-hidden rounded-md border bg-white ${
        invalid ? 'border-rose-500' : 'border-stone-300'
      } ${className || ''}`}
    >
      <label className="sr-only" htmlFor="shop-phone-prefix">
        Country prefix
      </label>
      <select
        id="shop-phone-prefix"
        className="shrink-0 border-r border-stone-200 bg-stone-50 px-2 py-2 text-sm font-semibold text-stone-800"
        value={parts.dial}
        onChange={(e) => onChange(`${e.target.value}${parts.local}`.trim())}
      >
        {known ? null : <option value={parts.dial}>{parts.dial}</option>}
        {DIAL_CODES.map((c) => (
          <option key={c.iso} value={c.dial}>
            {c.iso} {c.dial}
          </option>
        ))}
      </select>
      <input
        className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"
        type="tel"
        inputMode="tel"
        placeholder={placeholder}
        value={parts.local}
        onChange={(e) => onChange(`${parts.dial}${e.target.value.replace(/^\s+/, '')}`)}
      />
    </div>
  );
}
