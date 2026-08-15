import { ArrowRight, CheckCircle2, ChevronLeft, Printer, Send, Vault } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { qrImageUrl } from '@/lib/qr';

export type SuccessSplitPart = {
  id: string;
  label: string;
  amount: number;
  url?: string;
};

type Props = {
  amount: number;
  changeDue?: number | null;
  /** Digital receipt URL for single-ticket QR (same payload as thermal receipt). */
  receiptUrl?: string | null;
  /** Per-ticket breakdown after a split bill checkout. */
  splitParts?: SuccessSplitPart[];
  onContinue: () => void;
  onPrint?: () => void;
  onPrintPart?: (partId: string) => void;
  onPrintAll?: () => void;
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

function formatChf(amount: number): { whole: string; cents: string } {
  const whole = Math.floor(amount);
  const cents = Math.round((amount - whole) * 100)
    .toString()
    .padStart(2, '0');
  return { whole: String(whole), cents };
}

function AmountDisplay({
  amount,
  compact,
  size = 'hero',
}: {
  amount: number;
  compact?: boolean;
  size?: 'hero' | 'inline';
}) {
  const { whole, cents } = formatChf(amount);
  if (size === 'inline') {
    return (
      <span className="tabular-nums font-bold text-stone-800">
        CHF {whole}.{cents}
      </span>
    );
  }
  return (
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
  );
}

function ReceiptQr({
  url,
  label,
  compact,
}: {
  url: string;
  label: string;
  compact?: boolean;
}) {
  const size = compact ? 100 : 120;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <img
        src={qrImageUrl(url, size)}
        alt={label}
        width={size}
        height={size}
        className="rounded-lg border border-stone-200 bg-white p-1"
      />
      <p className="max-w-[140px] text-center text-[10px] font-medium uppercase tracking-wide text-stone-400">
        {label}
      </p>
    </div>
  );
}

export default function WebPosSuccessView({
  amount,
  changeDue,
  receiptUrl,
  splitParts,
  onContinue,
  onPrint,
  onPrintPart,
  onPrintAll,
  onSendReceipt,
  onOpenDrawer,
  onBack,
  compact = false,
}: Props) {
  const { t } = useI18n();
  const iconSize = compact ? 20 : 22;
  const continueIconSize = compact ? 24 : 28;
  const isSplit = (splitParts?.length ?? 0) > 1;
  const splitTotal = isSplit
    ? splitParts!.reduce((sum, part) => sum + part.amount, 0)
    : amount;

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
      <AmountDisplay amount={isSplit ? splitTotal : amount} compact={compact} />

      {isSplit ? (
        <p className={`mt-2 text-sm font-medium text-stone-500 ${compact ? 'px-2' : ''}`}>
          {t('webPosSplitOrderTitle').replace('{count}', String(splitParts!.length))}
        </p>
      ) : null}

      {changeDue != null && changeDue > 0 ? (
        <p
          className={`mt-5 font-semibold text-[var(--webpos-accent-text)] ${
            compact ? 'text-xl' : 'text-lg'
          }`}
        >
          {t('webPosChangeDue')}: CHF {changeDue.toFixed(2)}
        </p>
      ) : null}

      {isSplit ? (
        <div
          className={`mt-6 w-full max-w-md space-y-3 text-left ${
            compact ? 'max-h-[40vh] overflow-y-auto pr-1' : ''
          }`}
        >
          {splitParts!.map((part, idx) => (
            <div
              key={part.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {t('webPosTicket')} {idx + 1}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-stone-800">
                    {part.label || t('webPosSplitBillN').replace('{n}', String(idx + 1))}
                  </p>
                  <p className="mt-2">
                    <AmountDisplay amount={part.amount} size="inline" />
                  </p>
                </div>
                {part.url ? (
                  <ReceiptQr
                    url={part.url}
                    label={t('webPosDigitalReceipt')}
                    compact={compact}
                  />
                ) : null}
              </div>
              {onPrintPart ? (
                <button
                  type="button"
                  onClick={() => onPrintPart(part.id)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <Printer size={16} />
                  {t('webPosPrintTicketN').replace('{n}', String(idx + 1))}
                </button>
              ) : null}
            </div>
          ))}
          {onPrintAll ? (
            <button
              type="button"
              onClick={onPrintAll}
              className="webpos-accent-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
            >
              <Printer size={16} />
              {t('webPosPrintAllSplits')}
            </button>
          ) : null}
        </div>
      ) : receiptUrl ? (
        <div className="mt-6">
          <ReceiptQr url={receiptUrl} label={t('webPosDigitalReceipt')} compact={compact} />
        </div>
      ) : null}

      <div
        className={`flex flex-wrap items-center justify-center ${
          compact ? 'mt-8 gap-4' : 'mt-10 gap-5'
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
        {!isSplit && onPrint ? (
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
