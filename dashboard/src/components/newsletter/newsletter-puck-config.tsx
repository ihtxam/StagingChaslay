import type { MouseEvent } from 'react';
import type { Config, Data } from '@measured/puck';
import HugeRteEditor from '@/components/editor/HugeRteEditor';
import PuckImageField from './PuckImageField';

export {
  defaultNewsletterPuckCopy,
  defaultNewsletterPuckData,
  newsletterCopyFromT,
  newsletterPuckDataOrDefault,
  type NewsletterPuckCopy,
} from '@/lib/newsletter/puck-utils';

export type PuckNewsletterBlockProps = {
  Heading: { text: string; level: 'h1' | 'h2' | 'h3' };
  Text: { content: string };
  Button: { label: string; url: string; color: string; size: 'sm' | 'md' | 'lg' };
  Image: { src: string; alt: string; href: string };
  Spacer: { height: number };
};

export type PuckNewsletterRootProps = {
  background: string;
};

function preventCanvasNav(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest('a')) e.preventDefault();
}

function headingSize(level: string): { tag: 'h1' | 'h2' | 'h3'; fontSize: number; pad: string } {
  if (level === 'h3') return { tag: 'h3', fontSize: 18, pad: '12px 28px 6px' };
  if (level === 'h2') return { tag: 'h2', fontSize: 22, pad: '16px 28px 8px' };
  return { tag: 'h1', fontSize: 28, pad: '20px 28px 8px' };
}

function buttonMetrics(size: string): { pad: string; fontSize: number } {
  if (size === 'sm') return { pad: '8px 14px', fontSize: 13 };
  if (size === 'lg') return { pad: '16px 26px', fontSize: 17 };
  return { pad: '12px 20px', fontSize: 15 };
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
    content: { title: 'Content', components: ['Heading', 'Text', 'Image', 'Button', 'Spacer'] },
  },
  components: {
    Heading: {
      label: 'Heading',
      fields: {
        text: {
          type: 'custom',
          label: 'Text',
          render: ({ value, onChange, readOnly }) => (
            <HugeRteEditor
              value={String(value || '')}
              onChange={onChange}
              minHeight={88}
              disabled={readOnly}
              variant="compact"
            />
          ),
        },
        level: {
          type: 'radio',
          label: 'Size',
          options: [
            { label: 'Large', value: 'h1' },
            { label: 'Medium', value: 'h2' },
            { label: 'Small', value: 'h3' },
          ],
        },
      },
      defaultProps: { text: 'Newsletter headline', level: 'h1' },
      render: ({ text, level }) => {
        const { tag: Tag, fontSize } = headingSize(level);
        return (
          <Tag
            style={{
              margin: level === 'h1' ? '20px 28px 8px' : '16px 28px 8px',
              fontFamily: 'Georgia, serif',
              color: '#0c0a09',
              fontSize,
              lineHeight: 1.25,
            }}
            dangerouslySetInnerHTML={{ __html: text || '' }}
          />
        );
      },
    },
    Text: {
      label: 'Text',
      fields: {
        content: {
          type: 'custom',
          label: 'Body',
          render: ({ value, onChange, readOnly }) => (
            <HugeRteEditor
              value={String(value || '')}
              onChange={onChange}
              minHeight={200}
              disabled={readOnly}
              variant="email"
            />
          ),
        },
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
    Image: {
      label: 'Image',
      fields: {
        src: {
          type: 'custom',
          label: 'Image',
          render: ({ value, onChange, readOnly }) => (
            <PuckImageField value={String(value || '')} onChange={onChange} readOnly={readOnly} />
          ),
        },
        alt: { type: 'text', label: 'Alt text' },
        href: { type: 'text', label: 'Link (optional)' },
      },
      defaultProps: { src: '', alt: '', href: '' },
      render: ({ src, alt, href }) => {
        if (!src) {
          return (
            <div
              style={{
                margin: '8px 28px',
                padding: 24,
                border: '1px dashed #d6d3d1',
                borderRadius: 8,
                color: '#a8a29e',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              Image
            </div>
          );
        }
        const img = (
          <img
            src={src}
            alt={alt || ''}
            style={{ display: 'block', width: '100%', height: 'auto', border: 0 }}
          />
        );
        return (
          <div onClick={preventCanvasNav} style={{ padding: '8px 28px 16px' }}>
            {href ? (
              <a href={href} onClick={(e) => e.preventDefault()}>
                {img}
              </a>
            ) : (
              img
            )}
          </div>
        );
      },
    },
    Button: {
      label: 'Button',
      fields: {
        label: {
          type: 'custom',
          label: 'Label',
          render: ({ value, onChange, readOnly }) => (
            <HugeRteEditor
              value={String(value || '')}
              onChange={onChange}
              minHeight={72}
              disabled={readOnly}
              variant="compact"
            />
          ),
        },
        url: { type: 'text', label: 'URL' },
        color: { type: 'text', label: 'Color (#hex)' },
        size: {
          type: 'radio',
          label: 'Size',
          options: [
            { label: 'Small', value: 'sm' },
            { label: 'Medium', value: 'md' },
            { label: 'Large', value: 'lg' },
          ],
        },
      },
      defaultProps: { label: 'Order online', url: '{{shopUrl}}', color: '#0f766e', size: 'md' },
      render: ({ label, color, size }) => {
        const metrics = buttonMetrics(size);
        return (
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
                padding: metrics.pad,
                fontSize: metrics.fontSize,
                borderRadius: 8,
              }}
              dangerouslySetInnerHTML={{ __html: label || 'Button' }}
            />
          </div>
        );
      },
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
  return Array.isArray(o.content) && o.engine !== 'native' && o.engine !== 'openpage' && !('headline' in o);
}
