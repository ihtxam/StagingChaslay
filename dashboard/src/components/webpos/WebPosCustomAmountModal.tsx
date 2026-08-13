import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import WebPosNumericKeypad from './WebPosNumericKeypad';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
};

export default function WebPosCustomAmountModal({ open, onClose, onConfirm }: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');

  useEffect(() => {
    if (open) setBuffer('');
  }, [open]);

  if (!open) return null;

  const amount = roundMoney2(Math.max(0, Number(buffer) || 0));
  const display = `CHF ${buffer || '0'}`;

  const confirm = () => {
    if (amount <= 0) return;
    onConfirm(amount);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xs rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div>
            <h3 className="font-semibold">{t('webPosCustomAmount')}</h3>
            <p className="text-xs text-stone-500">{t('webPosCustomAmountHint')}</p>
          </div>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-right text-2xl font-bold tabular-nums">
            {display}
          </div>
          <WebPosNumericKeypad
            mode="price"
            onModeChange={() => undefined}
            buffer={buffer}
            onBufferChange={setBuffer}
            onApply={confirm}
            showModeButtons={false}
            showQuickAdd={false}
            showSignToggle={false}
            compact
            applyLabel={t('webPosAddToCart')}
            applyDisabled={amount <= 0}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-lg border border-stone-200 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              onClick={() => setBuffer('')}
            >
              {t('clear')}
            </button>
            <button
              type="button"
              className="webpos-accent-btn rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40"
              disabled={amount <= 0}
              onClick={confirm}
            >
              {t('webPosAddToCart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
