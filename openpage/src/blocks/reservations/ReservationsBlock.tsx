import { CalendarDays } from 'lucide-react'
import type { BlockConfig } from '../types'

export function ReservationsBlock({ block }: { block: BlockConfig }) {
  const props = block.props as { title?: string }
  return (
    <section className="px-6 @md:px-10 py-10 @md:py-14 bg-bg-0">
      <div className="max-w-xl mx-auto rounded-2xl border border-border-default bg-bg-1 p-6 text-center">
        <CalendarDays size={28} className="mx-auto text-green mb-3" />
        <h2 className="text-xl font-semibold text-text-0">{props.title || 'Book a table'}</h2>
        <p className="mt-2 text-sm text-text-2">Reservation widget links to your booking page.</p>
        <span className="mt-4 inline-block rounded-lg bg-green px-5 py-2.5 text-sm font-semibold text-black">
          Book now
        </span>
      </div>
    </section>
  )
}
