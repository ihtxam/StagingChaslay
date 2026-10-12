import { useRef, useState } from 'react';
import { uploadPageBuilderImage } from '@/lib/chaslay-pagebuilder/upload-image';
import { normalizeMediaUrl } from '@/chaslay-pagebuilder/utils/media-url';
import { useI18n } from '@/lib/i18n';

type PuckImageFieldProps = {
  value?: string;
  onChange: (url: string) => void;
  readOnly?: boolean;
};

/** Compact image picker for Advanced Editor blocks — upload or paste a URL. */
export default function PuckImageField({ value, onChange, readOnly }: PuckImageFieldProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const src = normalizeMediaUrl(value);

  const onFile = async (file: File | undefined) => {
    if (!file || readOnly) return;
    setError(null);
    setBusy(true);
    try {
      const url = await uploadPageBuilderImage(file, {
        maxBytes: 500 * 1024,
        targetBytes: 320 * 1024,
        maxWidth: 1400,
      });
      onChange(normalizeMediaUrl(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const applyUrl = () => {
    const next = normalizeMediaUrl(urlDraft);
    if (!next) return;
    onChange(next);
    setUrlDraft('');
  };

  return (
    <div className="space-y-2 text-sm">
      {src ? (
        <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-muted)]">
          <img src={src} alt="" className="max-h-36 w-full object-contain bg-white" />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || readOnly}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? '…' : src ? t('newsletterImageReplace') : t('newsletterImageUpload')}
        </button>
        {src ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={readOnly}
            onClick={() => onChange('')}
          >
            {t('newsletterImageRemove')}
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <input
          className="input text-xs"
          value={urlDraft}
          disabled={readOnly}
          placeholder="https://…"
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              applyUrl();
            }
          }}
        />
        <button type="button" className="btn-secondary text-xs shrink-0" disabled={readOnly} onClick={applyUrl}>
          {t('newsletterImageAddUrl')}
        </button>
      </div>
      {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
    </div>
  );
}
