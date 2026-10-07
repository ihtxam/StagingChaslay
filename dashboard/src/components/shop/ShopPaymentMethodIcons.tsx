import { resolvePanelAppOrigin } from '@/lib/brand';

/** Payment brand marks for shop footer (decorative; actual methods vary by merchant). */
const PAYMENT_FILES = [
  { file: 'visa.svg', alt: 'Visa', w: 42 },
  { file: 'mastercard.svg', alt: 'Mastercard', w: 32 },
  { file: 'amex.svg', alt: 'American Express', w: 42 },
  { file: 'paypal.svg', alt: 'PayPal', w: 52 },
  { file: 'twint.svg', alt: 'TWINT', w: 52 },
  { file: 'postfinance.svg', alt: 'PostFinance', w: 72 },
] as const;

function paymentIconUrl(file: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin.replace(/\/+$/, '')}/shop/payments/${file}`;
  }
  const origin = resolvePanelAppOrigin().replace(/\/+$/, '');
  return `${origin}/shop/payments/${file}`;
}

export default function ShopPaymentMethodIcons({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shop-payment-method-icons flex flex-wrap items-center gap-2.5 ${className}`.trim()}
      aria-label="Payment methods"
    >
      {PAYMENT_FILES.map((mark) => (
        <img
          key={mark.file}
          src={paymentIconUrl(mark.file)}
          alt={mark.alt}
          width={mark.w}
          height={20}
          className="h-5 w-auto max-h-5 object-contain opacity-95"
          loading="lazy"
          decoding="async"
        />
      ))}
    </div>
  );
}
