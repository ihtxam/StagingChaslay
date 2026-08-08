import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  busy?: boolean;
  initialEmail?: string;
  onClose: () => void;
  onSend: (email: string) => void | Promise<void>;
};

export default function WebPosSendReceiptModal({
  open,
  busy = false,
  initialEmail = '',
  onClose,
  onSend,
}: Props) {
  const { t } = useI18n();
  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail || '');
  }, [open, initialEmail]);

  if (!open) return null;

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h2 className="text-base font-semibold text-stone-800">{t('webPosSendReceipt')}</h2>
          <button
            type="button"
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            onClick={onClose}
            disabled={busy}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || busy) return;
            void onSend(email.trim());
          }}
        >
          <p className="text-sm text-stone-500">{t('webPosSendReceiptEmailHint')}</p>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t('webPosCustomerEmail')}
            </span>
            <input
              type="email"
              autoFocus
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-sm outline-none ring-[var(--webpos-accent-ring)] focus:bg-white focus:ring-2"
              placeholder="name@example.com"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
              onClick={onClose}
              disabled={busy}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="webpos-accent-btn flex-1 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40"
              disabled={!valid || busy}
            >
              {busy ? t('webPosSendingReceipt') : t('webPosSendReceipt')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
