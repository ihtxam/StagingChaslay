import { Clock } from 'lucide-react'
import type { BlockConfig } from '../types'

export function HoursBlock({ block }: { block: BlockConfig }) {
  const props = block.props as { title?: string; channel?: string }
  return (
    <section className="px-6 @md:px-10 py-10 @md:py-14 bg-bg-1">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={18} className="text-green" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-green">Store hours</span>
        </div>
        <h2 className="text-xl @md:text-2xl font-semibold text-text-0 mb-4">
          {props.title || 'Opening hours'}
        </h2>
        <div className="rounded-xl border border-border-default bg-bg-0 p-4 space-y-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="flex justify-between text-sm text-text-1">
              <span>{d}</span>
              <span className="text-text-2">11:00–22:00</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-text-3">
          Channel: {props.channel || 'all'} · synced from Settings → Hours on publish.
        </p>
      </div>
    </section>
  )
}
