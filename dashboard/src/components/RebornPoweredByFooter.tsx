import { APP_VERSION } from '@/lib/app-version';
import { MARKETING_ORIGIN, REBORN_MARK_R_WHITE } from '@/lib/brand';
import { useI18n } from '@/lib/i18n';

type Variant = 'panel' | 'shop' | 'login';

const variantClass: Record<Variant, string> = {
  panel:
    'reborn-powered-by reborn-powered-by--panel border-t border-stone-200/80 bg-stone-50/80 text-stone-500',
  shop: 'reborn-powered-by reborn-powered-by--shop border-t border-stone-100 bg-white text-stone-500',
  login: 'reborn-powered-by reborn-powered-by--login text-white/55',
};

type Props = {
  variant?: Variant;
  className?: string;
};

/** Minimal platform attribution — version sits on the same line as the R mark. */
export default function RebornPoweredByFooter({ variant = 'panel', className = '' }: Props) {
  const { t } = useI18n();
  const rootClass = `${variantClass[variant]} ${className}`.trim();
  const versionLabel = `v${APP_VERSION}`;

  return (
    <footer className={rootClass}>
      <a
        href={MARKETING_ORIGIN}
        target="_blank"
        rel="noopener noreferrer"
        className="reborn-powered-by__link mx-auto flex w-fit max-w-full items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium tracking-wide sm:text-xs"
        aria-label={`${t('poweredBy')} Reborn ${versionLabel} — rebornsense.com`}
      >
        <span className="shrink-0">{t('poweredBy')}</span>
        <img
          src={REBORN_MARK_R_WHITE}
          alt="Reborn"
          width={22}
          height={22}
          className="reborn-powered-by__mark h-[18px] w-auto shrink-0 sm:h-[20px]"
          loading="lazy"
          decoding="async"
        />
        <span className="reborn-powered-by__version shrink-0 tabular-nums opacity-70" title={versionLabel}>
          {versionLabel}
        </span>
      </a>
    </footer>
  );
}
