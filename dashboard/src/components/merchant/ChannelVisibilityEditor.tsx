import { useI18n } from '@/lib/i18n';
import {
  CATALOG_VISIBILITY_UI_CHANNELS,
  type CatalogChannel,
  type CatalogVisibility,
  normalizeCatalogVisibility,
} from '@/lib/catalog-visibility';

type Props = {
  value: unknown;
  onChange: (next: CatalogVisibility) => void;
  className?: string;
};

export default function ChannelVisibilityEditor({ value, onChange, className = '' }: Props) {
  const { t } = useI18n();
  const normalized = normalizeCatalogVisibility(value);

  const toggle = (channel: CatalogChannel) => {
    const has = normalized.channels.includes(channel);
    const next = has
      ? normalized.channels.filter((c) => c !== channel)
      : [...normalized.channels, channel];
    onChange(normalizeCatalogVisibility({ channels: next }));
  };

  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wide muted mb-2">
        {t('catalogVisibilityTitle')}
      </p>
      <div className="flex flex-wrap gap-2">
        {CATALOG_VISIBILITY_UI_CHANNELS.map((channel) => {
          const active = normalized.channels.includes(channel);
          return (
            <button
              key={channel}
              type="button"
              onClick={() => toggle(channel)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] text-stone-600'
              }`}
            >
              {t(`catalogChannel_${channel}`)}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] muted">{t('catalogVisibilityHint')}</p>
      <p className="mt-1 text-[11px] muted">{t('catalogVisibilityShopFulfillmentHint')}</p>
    </div>
  );
}
