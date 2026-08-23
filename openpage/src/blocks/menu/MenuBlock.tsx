import { UtensilsCrossed } from 'lucide-react'
import type { BlockConfig } from '../types'

export function MenuBlock({ block }: { block: BlockConfig }) {
  const props = block.props as {
    title?: string
    mode?: string
    showPrices?: boolean
    limit?: number
  }
  const count = Math.min(12, Number(props.limit) || 6)
  return (
    <section className="px-6 @md:px-10 py-10 @md:py-14 bg-bg-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <UtensilsCrossed size={18} className="text-green" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green">Live POS menu</span>
        </div>
        <h2 className="text-xl @md:text-2xl font-semibold text-text-0 mb-2">
          {props.title || 'Our menu'}
        </h2>
        <p className="text-sm text-text-2 mb-6">
          Products load from your online shop catalog when published ({props.mode || 'featured'} ·{' '}
          {props.showPrices === false ? 'no prices' : 'with prices'}).
        </p>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="shrink-0 w-40 @md:w-48">
              <div className="aspect-[4/5] rounded-2xl bg-bg-2 border border-border-default mb-2" />
              <div className="h-3 w-24 rounded bg-bg-3 mb-1" />
              {props.showPrices !== false ? <div className="h-2 w-12 rounded bg-bg-3" /> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
