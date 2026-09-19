import type { Data } from '@measured/puck';

export const NEWSLETTER_PUCK_BLOCK_TYPES = ['Heading', 'Text', 'Button', 'Spacer'] as const;
export type NewsletterPuckBlockType = (typeof NEWSLETTER_PUCK_BLOCK_TYPES)[number];

const ALLOWED_TYPES = new Set<string>(NEWSLETTER_PUCK_BLOCK_TYPES);

const DEFAULT_PROPS: Record<NewsletterPuckBlockType, Record<string, unknown>> = {
  Heading: { text: 'Newsletter headline', level: 'h1' },
  Text: { content: '<p></p>' },
  Button: { label: 'Order online', url: '{{shopUrl}}', color: '#0f766e' },
  Spacer: { height: 24 },
};

function puckItemId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `puck-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function asProps(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

function sanitizeProps(type: NewsletterPuckBlockType, raw: Record<string, unknown>): Record<string, unknown> {
  const defaults = DEFAULT_PROPS[type];
  const props = { ...defaults, ...raw };
  if (type === 'Heading') {
    props.level = props.level === 'h2' ? 'h2' : 'h1';
    props.text = String(props.text ?? '');
  }
  if (type === 'Text') {
    props.content = String(props.content ?? '');
  }
  if (type === 'Button') {
    props.label = String(props.label ?? defaults.label);
    props.url = String(props.url ?? defaults.url);
    const color = String(props.color ?? '');
    props.color = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#0f766e';
  }
  if (type === 'Spacer') {
    const height = Number(props.height);
    props.height = Number.isFinite(height) ? Math.max(8, Math.min(120, height)) : 24;
  }
  return props;
}

function normalizeContentItems(items: unknown): Data['content'] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === 'object' && typeof (item as { type?: unknown }).type === 'string')
    .filter((item) => ALLOWED_TYPES.has((item as { type: string }).type))
    .map((item) => {
      const block = item as { id?: string; type: NewsletterPuckBlockType; props?: Record<string, unknown> };
      const rawProps = asProps(block.props);
      const id = String(rawProps.id || block.id || puckItemId());
      const props = sanitizeProps(block.type, rawProps);
      props.id = id;
      return {
        type: block.type,
        props,
      };
    });
}

function normalizeZones(zones: unknown): Data['zones'] {
  if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return {};
  const result: NonNullable<Data['zones']> = {};
  for (const [key, value] of Object.entries(zones as Record<string, unknown>)) {
    result[key] = normalizeContentItems(value);
  }
  return result;
}

/** Puck 0.20 droppable ids live on `props.id`. Missing ids crash with `droppable.id.toString`. */
export function normalizePuckData(data: Data | null | undefined | Record<string, unknown>): Data {
  const raw: Partial<Data> =
    data && typeof data === 'object' ? (data as Partial<Data>) : { content: [], zones: {} };

  const rootProps =
    raw.root?.props && typeof raw.root.props === 'object' && !Array.isArray(raw.root.props)
      ? (raw.root.props as Record<string, unknown>)
      : {};

  return {
    root: {
      props: {
        background: '#f5f5f4',
        ...rootProps,
      },
    },
    content: normalizeContentItems(raw.content),
    zones: normalizeZones(raw.zones),
  } as Data;
}

/**
 * True for an empty canvas or the old 3-block factory default (heading + text + one button).
 * Used so Visual design opens on the polished template instead of a blank/3-button landing.
 */
export function isSparseNewsletterPuckData(data: Data | null | undefined): boolean {
  const content = Array.isArray(data?.content) ? data.content : [];
  if (content.length === 0) return true;
  if (content.length !== 3) return false;
  const [a, b, c] = content;
  if (a?.type !== 'Heading' || b?.type !== 'Text' || c?.type !== 'Button') return false;
  const heading = String((a.props as { text?: unknown } | undefined)?.text || '').trim();
  return heading === 'Newsletter' || heading === 'Newsletter headline';
}

export type NewsletterPuckCopy = {
  headerTitle: string;
  headerTagline: string;
  greetingHeading: string;
  greetingBody: string;
  featuredHeading: string;
  featuredBody: string;
  promoHeading: string;
  promoBody: string;
  ctaLabel: string;
  footer: string;
};

export const defaultNewsletterPuckCopy: NewsletterPuckCopy = {
  headerTitle: '{{businessName}}',
  headerTagline:
    '<p style="margin:0;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;color:#0f766e;">This week’s newsletter</p>',
  greetingHeading: 'Hello {{name}},',
  greetingBody:
    '<p>Thanks for being with us. Here is what’s new — a few highlights from the kitchen, plus a little something extra when you order online.</p>',
  featuredHeading: 'This week’s highlight',
  featuredBody:
    '<p>Tell the story of a seasonal special, a new dish, or a weekend event. Edit this block to match what you want customers to notice first.</p>',
  promoHeading: 'A little something extra',
  promoBody:
    '<p>Enjoy 10% off your next online order this week. Use your usual account at checkout — no code needed. We would love to see you again.</p>',
  ctaLabel: 'Order online',
  footer:
    '<p style="margin:0 0 8px;">Questions? Reply to this email or visit us at <a href="{{shopUrl}}" style="color:#0f766e;">{{shopUrl}}</a>.</p><p style="margin:0;font-size:12px;color:#78716c;">You’re receiving this because you ordered from {{businessName}}. Not interested anymore? Reply with “unsubscribe” and we will take you off the list.</p>',
};

function block(type: NewsletterPuckBlockType, id: string, props: Record<string, unknown>) {
  return { type, props: { id, ...props } };
}

export function defaultNewsletterPuckData(copy: Partial<NewsletterPuckCopy> = {}): Data {
  const c = { ...defaultNewsletterPuckCopy, ...copy };
  return normalizePuckData({
    root: { props: { background: '#f5f5f4' } },
    content: [
      block('Heading', 'nl-header', { text: c.headerTitle, level: 'h1' }),
      block('Text', 'nl-tagline', { content: c.headerTagline }),
      block('Spacer', 'nl-sp-1', { height: 12 }),
      block('Heading', 'nl-greet-h', { text: c.greetingHeading, level: 'h2' }),
      block('Text', 'nl-greet', { content: c.greetingBody }),
      block('Spacer', 'nl-sp-2', { height: 16 }),
      block('Heading', 'nl-feat-h', { text: c.featuredHeading, level: 'h2' }),
      block('Text', 'nl-feat', { content: c.featuredBody }),
      block('Spacer', 'nl-sp-3', { height: 16 }),
      block('Heading', 'nl-promo-h', { text: c.promoHeading, level: 'h2' }),
      block('Text', 'nl-promo', { content: c.promoBody }),
      block('Button', 'nl-cta', { label: c.ctaLabel, url: '{{shopUrl}}', color: '#0f766e' }),
      block('Spacer', 'nl-sp-4', { height: 20 }),
      block('Text', 'nl-footer', { content: c.footer }),
    ],
    zones: {},
  } as Data);
}

export function newsletterPuckDataOrDefault(
  data: Data | null | undefined,
  copy: Partial<NewsletterPuckCopy> = {}
): Data {
  const normalized = normalizePuckData(data);
  if (isSparseNewsletterPuckData(normalized)) return defaultNewsletterPuckData(copy);
  return normalized;
}

export function newsletterCopyFromT(t: (key: string) => string): NewsletterPuckCopy {
  return {
    headerTitle: t('newsletterPuckHeaderTitle'),
    headerTagline: t('newsletterPuckHeaderTagline'),
    greetingHeading: t('newsletterPuckGreetingHeading'),
    greetingBody: t('newsletterPuckGreetingBody'),
    featuredHeading: t('newsletterPuckFeaturedHeading'),
    featuredBody: t('newsletterPuckFeaturedBody'),
    promoHeading: t('newsletterPuckPromoHeading'),
    promoBody: t('newsletterPuckPromoBody'),
    ctaLabel: t('newsletterPuckCta'),
    footer: t('newsletterPuckFooter'),
  };
}
