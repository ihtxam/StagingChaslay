import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useI18n } from '@/lib/i18n';

type Props = {
  shopKey: string;
  street: string;
  zipCode?: string;
  city?: string;
  value: string;
  className?: string;
  required?: boolean;
  onChange: (value: string) => void;
};

export default function ShopHouseNumberSuggest({
  shopKey,
  street,
  zipCode = '',
  city = '',
  value,
  className,
  required,
  onChange,
}: Props) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [numbers, setNumbers] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const line = street.trim();
    if (line.length < 3 || !shopKey) {
      setNumbers([]);
      setLoading(false);
      return;
    }
    const id = window.setTimeout(() => {
      const n = ++seq.current;
      setLoading(true);
      axios
        .get(`/api/shop/${shopKey}/house-number-suggest`, {
          params: { street: line, zip: zipCode, city, lang: locale },
        })
        .then((res) => {
          if (n !== seq.current) return;
          setNumbers(Array.isArray(res.data?.numbers) ? res.data.numbers : []);
        })
        .catch(() => {
          if (n !== seq.current) return;
          setNumbers([]);
        })
        .finally(() => {
          if (n !== seq.current) return;
          setLoading(false);
        });
    }, 280);
    return () => window.clearTimeout(id);
  }, [street, zipCode, city, shopKey, locale]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const showList = open && street.trim().length >= 3 && (loading || numbers.length > 0);

  const pick = (num: string) => {
    onChange(num);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        className={className}
        placeholder={t('shopHouseNumber')}
        value={value}
        required={required}
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
          if (!showList || !numbers.length) {
            if (e.key === 'Escape') setOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => Math.min(numbers.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter' && numbers[active]) {
            e.preventDefault();
            pick(numbers[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2.5 text-sm text-stone-500">{t('shopAddressSearching')}</p>
          ) : (
            <ul role="listbox" className="max-h-40 overflow-y-auto py-1">
              {numbers.map((num, i) => (
                <li key={num}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`w-full px-3 py-2 text-left text-sm ${
                      i === active ? 'bg-amber-50 text-stone-900' : 'text-stone-800 hover:bg-stone-50'
                    }`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(num)}
                  >
                    {num}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
