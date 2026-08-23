import type { SiteConfig } from '@/blocks/types'
import { exportSiteToHTML } from '@/lib/export-html'
import type { CatalogCategory, CatalogProduct } from '@/store/catalogStore'

export const EMBED_SOURCE_PARENT = 'foodtruckpos'
export const EMBED_SOURCE_CHILD = 'openpage'

export type CmsCatalogPayload = {
  categories: CatalogCategory[]
  products: CatalogProduct[]
}

export type EmbedParentMessage =
  | {
      source: typeof EMBED_SOURCE_PARENT
      type: 'openpage:init'
      config?: SiteConfig | null
      mode?: 'page' | 'newsletter'
      title?: string
      catalog?: CmsCatalogPayload | null
      /** When true, child re-exports HTML once after init (CHASLAY_BLOCK migration). */
      migrateHtml?: boolean
    }
  | {
      source: typeof EMBED_SOURCE_PARENT
      type: 'openpage:requestSave'
    }

export type EmbedChildMessage =
  | { source: typeof EMBED_SOURCE_CHILD; type: 'openpage:ready' }
  | {
      source: typeof EMBED_SOURCE_CHILD
      type: 'openpage:saved'
      config: SiteConfig
      html: string
      migrateHtml?: boolean
    }

export function isEmbedMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1'
  } catch {
    return false
  }
}

export function postToParent(msg: EmbedChildMessage) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(msg, '*')
  }
}

export function exportConfigHtml(config: SiteConfig): string {
  return exportSiteToHTML(config)
}

export function newsletterStarter(title = 'Newsletter'): SiteConfig {
  const blocks = [
    {
      id: 'nl-hero',
      type: 'hero' as const,
      variant: 'minimal',
      props: {
        badge: 'Update',
        headline: title,
        subheadline: 'Share news, offers, and what’s cooking.',
        primaryCta: 'Order online',
      },
    },
    {
      id: 'nl-content',
      type: 'content' as const,
      variant: 'prose',
      props: {
        title: 'This week',
        body: 'Write your newsletter content here. Add images, offers, and a clear call to action.',
      },
    },
    {
      id: 'nl-cta',
      type: 'cta' as const,
      variant: 'simple',
      props: {
        headline: 'Ready to order?',
        subheadline: 'Skip the queue — order online for pickup or delivery.',
        buttonText: 'Open menu',
      },
    },
    {
      id: 'nl-footer',
      type: 'footer' as const,
      variant: 'minimal',
      props: {
        copyright: `${new Date().getFullYear()} ${title}`,
        links: ['Unsubscribe', 'Website'],
      },
    },
  ]
  return {
    name: title,
    blocks,
    pages: [{ id: 'page-home', name: 'Email', path: '/', blocks }],
  }
}
