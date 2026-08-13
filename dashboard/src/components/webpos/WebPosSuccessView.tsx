import { CheckCircle2, ChevronLeft, Printer, Send, Vault } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  amount: number;
  changeDue?: number | null;
  onContinue: () => void;
  onPrint?: () => void;
  onSendReceipt?: () => void;
  onOpenDrawer?: () => void;
  onBack?: () => void;
  compact?: boolean;
};

export default function WebPosSuccessView({
  amount,
  changeDue,
  onContinue,
  onPrint,
  onSendReceipt,
  onOpenDrawer,
  onBack,
  compact = false,
}: Props) {
  const { t } = useI18n();
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100)
    .toString()
    .padStart(2, '0');

  const actionBtnClass = compact
    ? 'inline-flex min-w-[6.5rem] flex-1 items-center justify-center gap-2 rounded-xl bg-stone-100 px-5 py-4 text-sm font-semibold text-stone-700 hover:bg-stone-200'
    : 'inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-100 px-4 py-3.5 text-sm font-semibold text-stone-700 hover:bg-stone-200';

  const continueBtnClass = compact
    ? 'min-w-[8rem] flex-[1.3] rounded-xl bg-violet-800 px-7 py-4 text-base font-semibold text-white hover:bg-violet-900'
    : 'min-w-[7rem] flex-[1.3] rounded-xl bg-violet-800 px-6 py-3.5 text-sm font-semibold text-white hover:bg-violet-900';

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col items-center justify-center bg-white text-center ${
        compact
          ? 'rounded-3xl border border-stone-200 px-10 py-12 shadow-2xl'
          : 'px-6'
      }`}
    >
      <CheckCircle2
        size={compact ? 80 : 72}
        className="text-emerald-500"
        strokeWidth={1.5}
      />
      <p
        className={`mt-5 font-semibold uppercase tracking-[0.18em] text-stone-500 ${
          compact ? 'text-xs' : 'text-[11px]'
        }`}
      >
        {t('webPosAmountPaid')}
      </p>
      <p className="mt-3 tabular-nums tracking-tight text-stone-800">
        <span className={`font-medium text-stone-400 ${compact ? 'text-3xl' : 'text-2xl'}`}>
          CHF{' '}
        </span>
        <span className={`font-bold ${compact ? 'text-7xl' : 'text-5xl sm:text-6xl'}`}>
          {whole}
        </span>
        <span className={`font-medium text-stone-400 ${compact ? 'text-3xl' : 'text-2xl'}`}>
          .{cents}
        </span>
      </p>
      {changeDue != null && changeDue > 0 ? (
        <p
          className={`mt-5 font-semibold text-[var(--webpos-accent-text)] ${
            compact ? 'text-xl' : 'text-lg'
          }`}
        >
          {t('webPosChangeDue')}: CHF {changeDue.toFixed(2)}
        </p>
      ) : null}

      <div
        className={`flex w-full flex-wrap items-stretch justify-center ${
          compact ? 'mt-12 max-w-xl gap-3' : 'mt-10 max-w-lg gap-2'
        }`}
      >
        {onBack ? (
          <button type="button" onClick={onBack} className={actionBtnClass}>
            <ChevronLeft size={18} />
            {t('webPosBack')}
          </button>
        ) : null}
        {onPrint ? (
          <button type="button" onClick={onPrint} className={actionBtnClass}>
            <Printer size={18} />
            {t('webPosPrint')}
          </button>
        ) : null}
        {onOpenDrawer ? (
          <button type="button" onClick={onOpenDrawer} className={actionBtnClass}>
            <Vault size={18} />
            {t('webPosOpenDrawer')}
          </button>
        ) : null}
        {onSendReceipt ? (
          <button type="button" onClick={onSendReceipt} className={actionBtnClass}>
            <Send size={18} />
            {t('webPosSendReceipt')}
          </button>
        ) : null}
        <button type="button" onClick={onContinue} className={continueBtnClass}>
          {t('webPosContinue')}
        </button>
      </div>
    </div>
  );
}
