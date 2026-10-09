import { MODULE_PRICE_BOOK } from '@/lib/module-price-book';

const GROUP_LABEL: Record<string, string> = {
  core: 'Core',
  guest: 'Guest',
  service: 'Service',
};

export default function ModulePriceBook({ compact = false }: { compact?: boolean }) {
  const groups = ['core', 'guest', 'service'] as const;
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div>
        <p className="text-sm font-semibold text-stone-900">Module price book</p>
        <p className="text-xs text-stone-500">
          Suggested CHF/month for dealers — POS first, then shop, website, reservations, KDS. Same catalog
          as SpotOn/Eats365: one menu, priced channels.
        </p>
      </div>
      {groups.map((group) => (
        <div key={group}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            {GROUP_LABEL[group]}
          </p>
          <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
            {MODULE_PRICE_BOOK.filter((row) => row.group === group).map((row) => (
              <div key={row.key} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-800">{row.label}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-rose-800">
                    {row.suggestedMonthlyChf.toFixed(0)}
                    <span className="text-[11px] font-medium text-stone-400"> CHF/mo</span>
                  </p>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-stone-500">{row.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
