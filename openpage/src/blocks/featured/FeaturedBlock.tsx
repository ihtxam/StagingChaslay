import { ArrowRight } from 'lucide-react'
import type { BlockConfig } from '../types'

interface FeaturedItem {
  title?: string
  image?: string
  price?: string
  url?: string
}

interface FeaturedProps {
  title?: string
  viewAllText?: string
  viewAllUrl?: string
  items?: FeaturedItem[]
}

function FeaturedRow({ props }: { props: FeaturedProps }) {
  const items = (props.items || []).length
    ? props.items!
    : [
        { title: 'Item 1' },
        { title: 'Item 2' },
        { title: 'Item 3' },
        { title: 'Item 4' },
        { title: 'Item 5' },
      ]

  return (
    <section className="px-6 @md:px-10 py-10 @md:py-14 bg-bg-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-xl @md:text-2xl font-semibold tracking-tight text-text-0">
            {props.title || 'Featured'}
          </h2>
          {(props.viewAllText || props.viewAllUrl) && (
            <a
              href={props.viewAllUrl || '/menu'}
              className="text-sm font-medium text-text-2 hover:text-text-0 inline-flex items-center gap-1"
            >
              {props.viewAllText || 'View menu'}
              <ArrowRight size={14} />
            </a>
          )}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
          {items.map((item, i) => (
            <a
              key={i}
              href={item.url || '/menu'}
              className="snap-start shrink-0 w-44 @md:w-52 group"
            >
              <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-bg-2 border border-border-default mb-2">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title || ''}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-bg-3 to-bg-4" />
                )}
              </div>
              {item.title && (
                <p className="text-sm font-medium text-text-0 truncate">{item.title}</p>
              )}
              {item.price && (
                <p className="text-xs text-text-2 mt-0.5">{item.price}</p>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export function FeaturedBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as FeaturedProps
  return <FeaturedRow props={props} />
}
