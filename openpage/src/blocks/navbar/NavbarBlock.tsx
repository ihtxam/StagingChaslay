import type { BlockConfig } from '../types'
import { Menu } from 'lucide-react'

interface NavbarProps {
  logo: string
  links: string[]
  ctaText: string
  ctaUrl?: string
  signInText?: string
  signInUrl?: string
}

function NavbarDefault({ props }: { props: NavbarProps }) {
  const { logo, links = [], ctaText } = props

  return (
    <nav className="bg-bg-0">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 @md:px-6 @lg:px-8">
        {/* Logo */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-green/10 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-green" />
          </div>
          <span className="truncate font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden @lg:flex items-center gap-6 shrink-0">
          {links.map((link, i) => (
            <span
              key={i}
              className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer whitespace-nowrap"
            >
              {link}
            </span>
          ))}
        </div>

        {/* CTA + mobile menu */}
        <div className="flex shrink-0 items-center gap-2 @md:gap-3">
          <button className="whitespace-nowrap px-3 @md:px-4 py-2 rounded-lg bg-green text-black text-[12px] @md:text-[13px] font-semibold hover:bg-green-dim transition-colors">
            {ctaText}
          </button>
          <button className="@lg:hidden w-9 h-9 shrink-0 rounded-lg border border-border-default flex items-center justify-center text-text-2 hover:text-text-0 hover:bg-bg-3 transition-colors">
            <Menu size={16} />
          </button>
        </div>
      </div>
    </nav>
  )
}

function NavbarCentered({ props }: { props: NavbarProps }) {
  const { logo, links = [], ctaText } = props
  const mid = Math.ceil(links.length / 2)
  const leftLinks = links.slice(0, mid)
  const rightLinks = links.slice(mid)

  return (
    <nav className="bg-bg-0">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 @md:px-6 @lg:px-8">
        {/* Left links */}
        <div className="hidden @lg:flex items-center gap-6 flex-1 min-w-0">
          {leftLinks.map((link, i) => (
            <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer whitespace-nowrap">
              {link}
            </span>
          ))}
        </div>

        {/* Center logo */}
        <div className="flex min-w-0 items-center gap-2 shrink-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-green/10 flex items-center justify-center">
            <div className="w-4 h-4 rounded-full bg-green" />
          </div>
          <span className="truncate font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
        </div>

        {/* Right links + CTA */}
        <div className="hidden @lg:flex items-center gap-6 flex-1 min-w-0 justify-end">
          {rightLinks.map((link, i) => (
            <span key={i} className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer whitespace-nowrap">
              {link}
            </span>
          ))}
          <button className="whitespace-nowrap px-4 py-2 rounded-lg bg-green text-black text-[13px] font-semibold hover:bg-green-dim transition-colors ml-2 shrink-0">
            {ctaText}
          </button>
        </div>

        {/* Mobile menu */}
        <button className="@lg:hidden w-9 h-9 shrink-0 rounded-lg border border-border-default flex items-center justify-center text-text-2 hover:text-text-0 hover:bg-bg-3 transition-colors">
          <Menu size={16} />
        </button>
      </div>
    </nav>
  )
}

function NavbarPill({ props }: { props: NavbarProps }) {
  const { logo, links = [], ctaText, signInText = 'Sign in' } = props

  return (
    <nav className="bg-bg-0 border-b border-border-subtle">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 @md:px-6 @lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-[15px] text-text-0 tracking-tight">{logo}</span>
        </div>
        <div className="hidden @lg:flex items-center gap-6 shrink-0">
          {links.map((link, i) => (
            <span
              key={i}
              className="text-[13px] text-text-2 hover:text-text-0 transition-colors cursor-pointer whitespace-nowrap"
            >
              {link}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3 @md:gap-4">
          <span className="hidden @sm:inline text-[13px] text-text-2 hover:text-text-0 cursor-pointer">
            {signInText}
          </span>
          <button className="whitespace-nowrap px-4 @md:px-5 py-2 rounded-full bg-stone-900 text-white text-[12px] @md:text-[13px] font-semibold">
            {ctaText}
          </button>
        </div>
      </div>
    </nav>
  )
}

export function NavbarBlock({ block }: { block: BlockConfig }) {
  const props = block.props as unknown as NavbarProps

  switch (block.variant) {
    case 'centered':
      return <NavbarCentered props={props} />
    case 'pill':
      return <NavbarPill props={props} />
    default:
      return <NavbarDefault props={props} />
  }
}
