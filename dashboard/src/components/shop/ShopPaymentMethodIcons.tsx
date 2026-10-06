/** Monochrome payment marks for shop footer (decorative; actual methods vary by merchant). */
export default function ShopPaymentMethodIcons({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 text-stone-400 ${className}`.trim()}
      aria-hidden
    >
      <svg viewBox="0 0 38 24" className="h-5 w-auto" fill="currentColor">
        <rect x="1" y="4" width="36" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="4" y="14" width="10" height="2" rx="0.5" />
        <rect x="4" y="10" width="14" height="2" rx="0.5" opacity="0.7" />
      </svg>
      <svg viewBox="0 0 38 24" className="h-5 w-auto" fill="currentColor">
        <path d="M8.2 4.5h21.6c1.4 0 2.5 1.1 2.5 2.5v10c0 1.4-1.1 2.5-2.5 2.5H8.2c-1.4 0-2.5-1.1-2.5-2.5V7c0-1.4 1.1-2.5 2.5-2.5zm2.8 8.2c0 .9.7 1.6 1.6 1.6h.9c.9 0 1.6-.7 1.6-1.6v-.1c0-.9-.7-1.6-1.6-1.6h-.9c-.9 0-1.6.7-1.6 1.6v.1zm8.4 0c0 .9.7 1.6 1.6 1.6h.9c.9 0 1.6-.7 1.6-1.6v-.1c0-.9-.7-1.6-1.6-1.6h-.9c-.9 0-1.6.7-1.6 1.6v.1z" />
      </svg>
      <svg viewBox="0 0 38 24" className="h-5 w-auto" fill="currentColor">
        <path d="M17.5 12.8v-1.6h8.9c.4 2.1-.5 3.6-1.9 4.7-1.2 1-2.9 1.6-5 1.6-4.3 0-7.7-3.5-7.7-7.8S15.2 1.9 19.5 1.9c2.4 0 4.1.9 5.4 2.1l2.4-2.3C25.5 1.2 22.8 0 19.5 0 12.4 0 6.7 5.6 6.7 12.7s5.7 12.7 12.8 12.7c3.5 0 6.1-1.1 8.1-3.2 2.1-2.1 2.7-5.1 2.7-7.5 0-.7-.1-1.2-.2-1.9h-11z" />
      </svg>
      <svg viewBox="0 0 38 24" className="h-5 w-auto" fill="currentColor">
        <path d="M14.5 8.5c-.9 0-1.6.7-1.6 1.6v3.8c0 .9.7 1.6 1.6 1.6h9c.9 0 1.6-.7 1.6-1.6v-3.8c0-.9-.7-1.6-1.6-1.6h-9zm-3.2-2.5h14.4c2.2 0 4 1.8 4 4v8.5c0 2.2-1.8 4-4 4H11.3c-2.2 0-4-1.8-4-4V10c0-2.2 1.8-4 4-4z" opacity="0.85" />
        <path d="M13.2 14.8c1.1-.8 2.5-1.2 4-1.2 1.2 0 2.3.3 3.2.9l1.4-1.6c-1.2-.9-2.7-1.4-4.6-1.4-2.2 0-4.1.9-5.4 2.3l1.4 1z" />
      </svg>
    </div>
  );
}
