import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import WebPosKeypadModalShell from './WebPosKeypadModalShell';
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

  const amount = roundMoney2(Math.max(0, Number(buffer) || 0));
  const display = `CHF ${buffer || '0'}`;

  const confirm = () => {
    if (amount <= 0) return;
    onConfirm(amount);
    onClose();
  };

  return (
    <WebPosKeypadModalShell
      open={open}
      onClose={onClose}
      title={t('webPosCustomAmount')}
      subtitle={t('webPosCustomAmountHint')}
    >
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
        hideApply
      />
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          className="rounded-lg border border-stone-200 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          onClick={() => setBuffer('')}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          className="webpos-accent-btn rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          disabled={amount <= 0}
          onClick={confirm}
        >
          {t('webPosAddToCart')}
        </button>
      </div>
    </WebPosKeypadModalShell>
  );
}
