/** Payment brand marks for shop footer (decorative; actual methods vary by merchant). */
const PAYMENT_MARKS = [
  { src: '/shop/payments/visa.svg', alt: 'Visa', w: 42 },
  { src: '/shop/payments/mastercard.svg', alt: 'Mastercard', w: 32 },
  { src: '/shop/payments/amex.svg', alt: 'American Express', w: 42 },
  { src: '/shop/payments/twint.svg', alt: 'TWINT', w: 52 },
  { src: '/shop/payments/apple-pay.svg', alt: 'Apple Pay', w: 44 },
  { src: '/shop/payments/google-pay.svg', alt: 'Google Pay', w: 44 },
] as const;

export default function ShopPaymentMethodIcons({ className = '' }: { className?: string }) {
  return (
    <div
      className={`shop-payment-method-icons flex flex-wrap items-center gap-2.5 ${className}`.trim()}
      aria-label="Payment methods"
    >
      {PAYMENT_MARKS.map((mark) => (
        <img
          key={mark.src}
          src={mark.src}
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
