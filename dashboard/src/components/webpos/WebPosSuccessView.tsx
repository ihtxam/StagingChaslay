import { ArrowRight, CheckCircle2, ChevronLeft, Printer, Send, Vault } from 'lucide-react';
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

type IconActionProps = {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  compact?: boolean;
  primary?: boolean;
};

function IconActionButton({ label, onClick, icon, compact = false, primary = false }: IconActionProps) {
  const sizeClass = compact
    ? primary
      ? 'h-14 w-14'
      : 'h-12 w-12'
    : primary
      ? 'h-16 w-16'
      : 'h-14 w-14';

  const colorClass = primary
    ? 'bg-violet-800 text-white hover:bg-violet-900'
    : 'bg-stone-100 text-stone-700 hover:bg-stone-200';

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl transition-colors ${sizeClass} ${colorClass}`}
    >
      {icon}
      <span className="sr-only">{label}</span>
    </button>
  );
}

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

  const iconSize = compact ? 20 : 22;
  const continueIconSize = compact ? 24 : 28;

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
        className={`flex flex-wrap items-center justify-center ${
          compact ? 'mt-12 gap-4' : 'mt-14 gap-5'
        }`}
      >
        {onBack ? (
          <IconActionButton
            compact={compact}
            label={t('webPosBack')}
            onClick={onBack}
            icon={<ChevronLeft size={iconSize} strokeWidth={2} />}
          />
        ) : null}
        {onPrint ? (
          <IconActionButton
            compact={compact}
            label={t('webPosPrint')}
            onClick={onPrint}
            icon={<Printer size={iconSize} strokeWidth={2} />}
          />
        ) : null}
        {onOpenDrawer ? (
          <IconActionButton
            compact={compact}
            label={t('webPosOpenDrawer')}
            onClick={onOpenDrawer}
            icon={<Vault size={iconSize} strokeWidth={2} />}
          />
        ) : null}
        {onSendReceipt ? (
          <IconActionButton
            compact={compact}
            label={t('webPosSendReceipt')}
            onClick={onSendReceipt}
            icon={<Send size={iconSize} strokeWidth={2} />}
          />
        ) : null}
        <IconActionButton
          compact={compact}
          primary
          label={t('webPosContinue')}
          onClick={onContinue}
          icon={<ArrowRight size={continueIconSize} strokeWidth={2.25} />}
        />
      </div>
    </div>
  );
}
