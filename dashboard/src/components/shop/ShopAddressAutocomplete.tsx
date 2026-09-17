import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useI18n } from '@/lib/i18n';

export type ShopAddressSuggestion = {
  id: string;
  displayAddress: string;
  houseNumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  latitude: number;
  longitude: number;
};

type Props = {
  shopKey: string;
  value: string;
  className?: string;
  onChange: (street: string) => void;
  onPick: (suggestion: ShopAddressSuggestion) => void;
};

export default function ShopAddressAutocomplete({
  shopKey,
  value,
  className,
  onChange,
  onPick,
}: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<ShopAddressSuggestion[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3 || !shopKey) {
      setItems([]);
      setLoading(false);
      setError(false);
      return;
    }
    const id = window.setTimeout(() => {
      const n = ++seq.current;
      setLoading(true);
      setError(false);
      axios
        .get(`/api/shop/${shopKey}/address-suggest`, { params: { q, lang: locale } })
        .then((res) => {
          if (n !== seq.current) return;
          setItems(Array.isArray(res.data?.suggestions) ? res.data.suggestions : []);
        })
        .catch(() => {
          if (n !== seq.current) return;
          setItems([]);
          setError(true);
        })
        .finally(() => {
          if (n !== seq.current) return;
          setLoading(false);
        });
    }, 280);
    return () => window.clearTimeout(id);
  }, [value, shopKey, locale]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (s: ShopAddressSuggestion) => {
    onPick(s);
    setOpen(false);
    setItems([]);
  };

  const showList = open && value.trim().length >= 3;

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={className}
        placeholder={t('shopSearchAddress')}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!showList || !items.length) {
            if (e.key === 'Escape') setOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(items.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const s = items[active];
            if (s) pick(s);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-stone-500">{t('shopAddressSearching')}</p>
          ) : error ? (
            <p className="px-3 py-2.5 text-sm text-stone-500">{t('shopAddressSearchFailed')}</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-stone-500">{t('shopNoAddressResults')}</p>
          ) : (
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {items.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      i === active ? 'bg-amber-50 text-stone-900' : 'text-stone-800 hover:bg-stone-50'
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                  >
                    {s.displayAddress}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
            {t('shopOsmAttribution')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
