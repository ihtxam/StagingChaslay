import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

export type MultiSelectOption = { id: string; label: string };

type Props = {
  label: string;
  helperText?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export default function SearchableMultiSelect({
  label,
  helperText,
  placeholder = 'Search…',
  options,
  value,
  onChange,
  disabled,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const optionMap = useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);

  const selected = useMemo(
    () => value.map((id) => ({ id, label: optionMap.get(id) || id })),
    [value, optionMap]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => {
      if (value.includes(o.id)) return false;
      if (!q) return true;
      return o.label.toLowerCase().includes(q);
    });
  }, [options, query, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const add = (id: string) => {
    if (value.includes(id)) return;
    onChange([...value, id]);
    setQuery('');
  };

  const remove = (id: string) => {
    onChange(value.filter((x) => x !== id));
  };

  return (
    <div className="block text-sm" ref={rootRef}>
      <span className="font-medium">{label}</span>
      {helperText ? <p className="text-xs text-[var(--text-muted)] mt-0.5">{helperText}</p> : null}
      <div
        className={`mt-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1.5 ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        {selected.length ? (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {selected.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs dark:border-stone-600 dark:bg-stone-800"
              >
                {item.label}
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-stone-200 dark:hover:bg-stone-700"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => remove(item.id)}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (e.key === 'Enter' && filtered[0]) {
              e.preventDefault();
              add(filtered[0].id);
            }
          }}
        />
        {open && filtered.length ? (
          <ul
            id={listId}
            role="listbox"
            className="mt-1 max-h-40 overflow-y-auto rounded border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm"
          >
            {filtered.slice(0, 80).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-[var(--bg-muted)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    add(o.id);
                    setOpen(true);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open && query && !filtered.length ? (
          <p className="mt-1 px-1 text-xs text-[var(--text-muted)]">No matches</p>
        ) : null}
      </div>
    </div>
  );
}
