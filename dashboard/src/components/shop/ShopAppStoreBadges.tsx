import { PLATFORM_MARKETING_ORIGIN } from '@/lib/brand';

type Props = {
  className?: string;
};

/** App store badges — links to Reborn marketing until per-merchant URLs exist. */
export default function ShopAppStoreBadges({ className = '' }: Props) {
  const href = `${PLATFORM_MARKETING_ORIGIN.replace(/\/+$/, '')}/`;
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-black px-3 py-2 text-left text-xs text-white hover:bg-black/80 transition-colors"
      >
        <span className="text-lg leading-none" aria-hidden>
          
        </span>
        <span>
          <span className="block text-[10px] leading-tight opacity-80">Download on the</span>
          <span className="block text-sm font-semibold leading-tight">App Store</span>
        </span>
      </a>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-black px-3 py-2 text-left text-xs text-white hover:bg-black/80 transition-colors"
      >
        <span className="text-base leading-none" aria-hidden>
          ▶
        </span>
        <span>
          <span className="block text-[10px] leading-tight opacity-80">GET IT ON</span>
          <span className="block text-sm font-semibold leading-tight">Google Play</span>
        </span>
      </a>
    </div>
  );
}
