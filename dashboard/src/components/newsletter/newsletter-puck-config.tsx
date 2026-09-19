import type { MouseEvent } from 'react';
import type { Config, Data } from '@measured/puck';

export {
  defaultNewsletterPuckCopy,
  defaultNewsletterPuckData,
  newsletterCopyFromT,
  newsletterPuckDataOrDefault,
  type NewsletterPuckCopy,
} from '@/lib/newsletter/puck-utils';

export type PuckNewsletterBlockProps = {
  Heading: { text: string; level: 'h1' | 'h2' };
  Text: { content: string };
  Button: { label: string; url: string; color: string };
  Spacer: { height: number };
};

export type PuckNewsletterRootProps = {
  background: string;
};

function preventCanvasNav(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest('a')) e.preventDefault();
}

export const newsletterPuckConfig: Config<PuckNewsletterBlockProps, PuckNewsletterRootProps> = {
  root: {
    fields: {
      background: { type: 'text', label: 'Background color' },
    },
    defaultProps: {
      background: '#f5f5f4',
    },
    render: ({ children, background }) => (
      <div
        style={{
          background: background || '#f5f5f4',
          padding: 24,
          minHeight: 280,
        }}
      >
        <div
          style={{
            maxWidth: 560,
            margin: '0 auto',
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e7e5e4',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: 6, background: '#0f766e' }} />
          <div style={{ padding: '8px 0 16px' }}>{children}</div>
        </div>
      </div>
    ),
  },
  categories: {
    content: { title: 'Content', components: ['Heading', 'Text', 'Button', 'Spacer'] },
  },
  components: {
    Heading: {
      label: 'Heading',
      fields: {
        text: { type: 'text', label: 'Text' },
        level: {
          type: 'select',
          label: 'Size',
          options: [
            { label: 'Large', value: 'h1' },
            { label: 'Medium', value: 'h2' },
          ],
        },
      },
      defaultProps: { text: 'Newsletter headline', level: 'h1' },
      render: ({ text, level }) => {
        const Tag = level === 'h2' ? 'h2' : 'h1';
        const isHeader = level !== 'h2';
        return (
          <Tag
            style={{
              margin: isHeader ? '20px 28px 8px' : '16px 28px 8px',
              fontFamily: 'Georgia, serif',
              color: '#0c0a09',
              fontSize: isHeader ? 28 : 22,
              lineHeight: 1.25,
            }}
          >
            {text || ''}
          </Tag>
        );
      },
    },
    Text: {
      label: 'Text',
      fields: {
        content: { type: 'textarea', label: 'Body' },
      },
      defaultProps: {
        content: '<p>Write your message here. Use {{name}} and {{shopUrl}} placeholders.</p>',
      },
      render: ({ content }) => (
        <div
          onClick={preventCanvasNav}
          style={{
            padding: '0 28px 8px',
            fontSize: 16,
            lineHeight: 1.55,
            color: '#44403c',
            fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
          }}
          dangerouslySetInnerHTML={{ __html: content || '' }}
        />
      ),
    },
    Button: {
      label: 'Button',
      fields: {
        label: { type: 'text', label: 'Label' },
        url: { type: 'text', label: 'URL' },
        color: { type: 'text', label: 'Color (#hex)' },
      },
      defaultProps: { label: 'Order online', url: '{{shopUrl}}', color: '#0f766e' },
      render: ({ label, color }) => (
        <div style={{ padding: '8px 28px 16px' }}>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              display: 'inline-block',
              background: color || '#0f766e',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 700,
              padding: '12px 20px',
              borderRadius: 8,
            }}
          >
            {label || 'Button'}
          </a>
        </div>
      ),
    },
    Spacer: {
      label: 'Spacer',
      fields: {
        height: { type: 'number', label: 'Height (px)' },
      },
      defaultProps: { height: 24 },
      render: ({ height }) => <div style={{ height: Math.max(8, Number(height) || 24) }} />,
    },
  },
};

export function isPuckNewsletterDesign(raw: unknown): raw is Data {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (o.engine === 'puck') return true;
  return Array.isArray(o.content) && o.engine !== 'native' && !('headline' in o);
}
