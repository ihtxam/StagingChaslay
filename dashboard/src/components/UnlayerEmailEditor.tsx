import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import EmailEditor, {
  type EditorRef,
  type EmailEditorProps,
} from 'react-email-editor';
import { useI18n } from '@/lib/i18n';

export type UnlayerDesign = Record<string, unknown>;

export type UnlayerEmailEditorHandle = {
  /** Export current design JSON + rendered HTML for save/send. */
  exportDesign: () => Promise<{ html: string; design: UnlayerDesign }>;
};

type Props = {
  /** Saved Unlayer design JSON (null = blank canvas). */
  designJson?: UnlayerDesign | null;
  minHeight?: string;
  className?: string;
};

const MERGE_TAGS = {
  name: {
    name: 'Customer name',
    value: '{{name}}',
    sample: 'Alex',
  },
  businessName: {
    name: 'Business name',
    value: '{{businessName}}',
    sample: 'My Shop',
  },
  shopUrl: {
    name: 'Shop URL',
    value: '{{shopUrl}}',
    sample: 'https://example.com',
  },
};

/**
 * Unlayer drag-and-drop email designer for merchant newsletters.
 * Requires network access to editor.unlayer.com at runtime.
 */
const UnlayerEmailEditor = forwardRef<UnlayerEmailEditorHandle, Props>(
  function UnlayerEmailEditor({ designJson, minHeight = '640px', className }, ref) {
    const { locale } = useI18n();
    const emailEditorRef = useRef<EditorRef>(null);
    const designKey = useMemo(
      () => JSON.stringify(designJson ?? null).slice(0, 120),
      [designJson]
    );

    const projectIdRaw = import.meta.env.VITE_UNLAYER_PROJECT_ID;
    const projectId = projectIdRaw ? Number(projectIdRaw) : undefined;

    useImperativeHandle(ref, () => ({
      exportDesign: () =>
        new Promise((resolve, reject) => {
          const unlayer = emailEditorRef.current?.editor;
          if (!unlayer) {
            reject(new Error('Email editor is not ready yet'));
            return;
          }
          unlayer.exportHtml((data) => {
            const html = String(data?.html || '').trim();
            const design = (data?.design || {}) as UnlayerDesign;
            if (!html) {
              reject(new Error('Newsletter body is empty'));
              return;
            }
            resolve({ html, design });
          });
        }),
    }));

    const onReady = useCallback<NonNullable<EmailEditorProps['onReady']>>(
      (unlayer) => {
        if (designJson && typeof designJson === 'object' && Object.keys(designJson).length > 0) {
          try {
            unlayer.loadDesign(designJson as never);
          } catch {
            /* blank if design is corrupt */
          }
        }
      },
      [designJson]
    );

    const options = useMemo((): EmailEditorProps['options'] => {
      const localeMap: Record<string, string> = {
        en: 'en-US',
        fr: 'fr-FR',
        de: 'de-DE',
      };
      return {
        displayMode: 'email',
        ...(projectId && Number.isFinite(projectId) ? { projectId } : {}),
        locale: localeMap[locale] || 'en-US',
        mergeTags: MERGE_TAGS,
        features: {
          textEditor: {
            spellChecker: true,
          },
        },
        appearance: {
          theme: 'modern_light' as const,
        },
      };
    }, [locale, projectId]);

    return (
      <div
        className={className}
        /* remount when switching campaigns so loadDesign runs cleanly */
        key={designKey}
      >
        <EmailEditor
          ref={emailEditorRef}
          onReady={onReady}
          minHeight={minHeight}
          options={options}
          style={{ borderRadius: 8, overflow: 'hidden' }}
        />
      </div>
    );
  }
);

export default UnlayerEmailEditor;
