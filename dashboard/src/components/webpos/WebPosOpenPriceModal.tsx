import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import WebPosKeypadModalShell from './WebPosKeypadModalShell';
import WebPosNumericKeypad from './WebPosNumericKeypad';

type Props = {
  open: boolean;
  productName?: string;
  onClose: () => void;
  onConfirm: (amount: number) => void;
};

export default function WebPosOpenPriceModal({
  open,
  productName,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [buffer, setBuffer] = useState('');

  useEffect(() => {
    if (!open) return;
    setBuffer('');
  }, [open]);

  const amount = roundMoney2(Math.max(0, Number(buffer) || 0));

  const submit = () => {
    if (amount <= 0) return;
    onConfirm(amount);
    onClose();
  };

  const title = productName
    ? `${t('webPosEnterPrice')} — ${productName}`
    : t('webPosEnterPrice');

  return (
    <WebPosKeypadModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={t('webPosOpenPriceHint')}
      size="lg"
      onEnter={submit}
    >
      <div className="rounded-xl border border-[var(--webpos-border,var(--border))] bg-[var(--webpos-bg,var(--bg))] px-5 py-4 text-right">
        <p className="text-3xl font-bold tabular-nums text-[var(--webpos-text,var(--text))]">
          CHF {buffer || '0'}
        </p>
      </div>
      <WebPosNumericKeypad
        mode="price"
        onModeChange={() => undefined}
        buffer={buffer}
        onBufferChange={setBuffer}
        onApply={submit}
        showModeButtons={false}
        showQuickAdd={false}
        showSignToggle={false}
        hideApply
      />
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="rounded-lg border border-[var(--webpos-border,var(--border))] py-3.5 text-sm font-semibold text-[var(--webpos-text,var(--text))] hover:bg-[var(--webpos-surface-2,var(--bg-muted))]"
          onClick={() => setBuffer('')}
        >
          {t('clear')}
        </button>
        <button
          type="button"
          className="webpos-accent-btn rounded-lg py-3.5 text-sm font-semibold disabled:opacity-40"
          disabled={amount <= 0}
          onClick={submit}
        >
          {t('webPosAddToCart')}
        </button>
      </div>
    </WebPosKeypadModalShell>
  );
}
