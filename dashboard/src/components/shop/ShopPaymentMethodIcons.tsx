import { resolvePanelAppOrigin } from '@/lib/brand';

/** Payment brand marks for shop footer (decorative; actual methods vary by merchant). */
const PAYMENT_FILES = [
  { file: 'visa.svg', alt: 'Visa' },
  { file: 'mastercard.svg', alt: 'Mastercard' },
  { file: 'amex.svg', alt: 'American Express' },
  { file: 'twint.svg', alt: 'TWINT' },
  { file: 'paypal.svg', alt: 'PayPal' },
  { file: 'postfinance.svg', alt: 'PostFinance' },
] as const;

function paymentIconUrl(file: string): string {
  // Shop path hubs (order.rebornsense.com) proxy HTML to the API; nested /payment-logos/*
  // must be loaded from the panel/dashboard origin (same pattern as getRebornLogoWhiteUrl).
  const origin = resolvePanelAppOrigin().replace(/\/+$/, '');
  return `${origin}/payment-logos/${file}`;
}

export default function ShopPaymentMethodIcons({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shop-payment-method-icons flex flex-wrap items-center gap-2 ${className}`.trim()}
      aria-label="Payment methods"
    >
      {PAYMENT_FILES.map((mark) => (
        <span
          key={mark.file}
          className="inline-flex h-7 items-center justify-center rounded bg-white/95 px-1.5 shadow-sm ring-1 ring-black/5"
        >
          <img
            src={paymentIconUrl(mark.file)}
            alt={mark.alt}
            width={42}
            height={28}
            className="h-6 w-auto max-h-6 object-contain"
            loading="lazy"
            decoding="async"
          />
        </span>
      ))}
    </div>
  );
}
