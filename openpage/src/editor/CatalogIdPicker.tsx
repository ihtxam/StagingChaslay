import { useMemo, useState } from 'react'
import { useCatalogStore } from '@/store/catalogStore'

function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string') return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
  return []
}

function joinIds(ids: string[]): string {
  return ids.join(', ')
}

type Props = {
  label: string
  mode: 'categories' | 'products'
  value: unknown
  onChange: (next: string) => void
  /** When set, only products in these categories are shown (products mode). */
  categoryFilter?: string[]
}

export function CatalogIdPicker({ label, mode, value, onChange, categoryFilter }: Props) {
  const { categories, products, loaded } = useCatalogStore()
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(parseIds(value)), [value])

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    return categories.filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [categories, query])

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const catSet = categoryFilter?.length ? new Set(categoryFilter) : null
    return products.filter((p) => {
      if (catSet && p.categoryId && !catSet.has(p.categoryId)) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q)
    })
  }, [products, query, categoryFilter])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(joinIds([...next]))
  }

  const selectAll = () => {
    if (mode === 'categories') onChange(joinIds(categories.map((c) => c.id)))
    else onChange(joinIds(products.map((p) => p.id)))
  }

  const clearAll = () => onChange('')

  if (!loaded) {
    return (
      <div className="mb-2.5">
        <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{label}</label>
        <p className="text-[10px] text-text-3 italic">Loading POS catalog…</p>
      </div>
    )
  }

  if (mode === 'categories' && !categories.length) {
    return (
      <div className="mb-2.5">
        <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{label}</label>
        <p className="text-[10px] text-text-3">No categories in your menu yet.</p>
      </div>
    )
  }

  if (mode === 'products' && !products.length) {
    return (
      <div className="mb-2.5">
        <label className="block text-[11.5px] text-text-2 mb-1 font-medium">{label}</label>
        <p className="text-[10px] text-text-3">No products in your menu yet.</p>
      </div>
    )
  }

  const rows =
    mode === 'categories'
      ? filteredCategories.map((c) => ({ id: c.id, name: c.name, sub: null as string | null }))
      : filteredProducts.map((p) => ({
          id: p.id,
          name: p.name,
          sub: categories.find((c) => c.id === p.categoryId)?.name || null,
        }))

  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-[11.5px] text-text-2 font-medium">{label}</label>
        <span className="text-[10px] text-text-3 tabular-nums">{selected.size} selected</span>
      </div>
      <input
        type="search"
        placeholder={mode === 'categories' ? 'Search categories…' : 'Search products…'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full mb-1.5 px-2 py-1 rounded border border-border-default bg-bg-2 text-text-0 text-xs outline-none focus:border-green"
      />
      <div className="flex gap-2 mb-1.5">
        <button type="button" onClick={selectAll} className="text-[10px] text-green hover:text-green-dim">
          Select all
        </button>
        <button type="button" onClick={clearAll} className="text-[10px] text-text-3 hover:text-text-2">
          Clear
        </button>
      </div>
      <div
        className="max-h-44 overflow-y-auto rounded border border-border-default bg-bg-2 divide-y divide-border-subtle"
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
      >
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-[10px] text-text-3 text-center">No matches</p>
        ) : (
          rows.map((row) => {
            const checked = selected.has(row.id)
            return (
              <label
                key={row.id}
                className="flex items-start gap-2 px-2 py-1.5 cursor-pointer hover:bg-bg-3 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(row.id)}
                  className="mt-0.5 shrink-0 accent-[var(--color-green,#22c55e)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-text-0 truncate">{row.name}</span>
                  {row.sub ? (
                    <span className="block text-[9px] text-text-3 truncate">{row.sub}</span>
                  ) : null}
                </span>
              </label>
            )
          })
        )}
      </div>
      <p className="mt-1 text-[9px] text-text-3">Leave empty to show all items from your live menu.</p>
    </div>
  )
}
