import type { BlockConfig, SiteConfig } from '@/blocks/types'
import { themePresets } from '@/lib/theme-presets'

const amber = themePresets.find((p) => p.id === 'amber')?.theme

/** Default FoodTruckPOS site — no Brand / Features / Pricing SaaS blocks. */
export function foodTruckStarter(name = 'Food truck'): SiteConfig {
  const year = new Date().getFullYear()
  const blocks: BlockConfig[] = [
    {
      id: 'block-navbar',
      type: 'navbar',
      variant: 'default',
      props: {
        logo: name,
        links: ['Menu', 'About', 'Find us'],
        ctaText: 'Order now',
        ctaUrl: '/menu',
      },
    },
    {
      id: 'block-hero',
      type: 'hero',
      variant: 'gradient',
      props: {
        badge: 'Food truck',
        headline: name,
        subheadline:
          'Street food with real flavor. Order ahead for pickup — or find us on the road.',
        primaryCta: 'See the menu',
        primaryCtaUrl: '/menu',
        secondaryCta: 'Order online',
        secondaryCtaUrl: '/menu',
      },
    },
    {
      id: 'block-features',
      type: 'features',
      variant: 'list',
      props: {
        label: 'Why us',
        title: 'Made for the street',
        subtitle: 'Same kitchen as our truck — order ahead and skip the queue.',
        items: [
          {
            icon: 'Flame',
            title: 'Cooked fresh',
            description: 'Hot off the grill, never sitting under a lamp.',
          },
          {
            icon: 'MapPin',
            title: 'Find the truck',
            description: 'Order ahead so it’s ready when you arrive.',
          },
          {
            icon: 'Zap',
            title: 'Order in minutes',
            description: 'Pickup or delivery — checkout on your phone.',
          },
        ],
      },
    },
    {
      id: 'block-stats',
      type: 'stats',
      variant: 'bar',
      props: {
        items: [
          { value: 'Daily', label: 'Fresh prep' },
          { value: 'Local', label: 'Ingredients' },
          { value: 'Fast', label: 'Pickup' },
          { value: '5★', label: 'Regulars' },
        ],
      },
    },
    {
      id: 'block-testimonials',
      type: 'testimonials',
      variant: 'cards',
      props: {
        title: 'From the line',
        items: [
          {
            name: 'Jordan',
            role: 'Regular',
            quote: 'Best stop on my lunch route. Ordering ahead is a game changer.',
            rating: 5,
          },
          {
            name: 'Samira',
            role: 'Office crew',
            quote: 'We order for the whole team — always hot, always on time.',
            rating: 5,
          },
        ],
      },
    },
    {
      id: 'block-cta',
      type: 'cta',
      variant: 'simple',
      props: {
        headline: 'Hungry now?',
        subheadline: 'Browse the menu and we’ll have it ready.',
        buttonText: 'Start your order',
        buttonUrl: '/menu',
      },
    },
    {
      id: 'block-footer',
      type: 'footer',
      variant: 'simple',
      props: {
        logo: name,
        copyright: `${year} ${name}. All rights reserved.`,
        links: ['Menu', 'Reservations'],
      },
    },
  ]

  return {
    name,
    theme: amber,
    pages: [{ id: 'page-home', name: 'Home', path: '/', blocks }],
    blocks,
  }
}
