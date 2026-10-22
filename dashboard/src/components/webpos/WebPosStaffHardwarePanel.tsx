import { Printer } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type PrinterProfile = {
  id: string;
  name: string;
  printReceipts?: boolean;
  printKitchenTickets?: boolean;
};

export function WebPosStaffHardwarePanel({
  printers,
  onTestReceipt,
  onReprintLast,
  reprintAvailable,
}: {
  printers: PrinterProfile[];
  onTestReceipt?: () => void;
  onReprintLast?: () => void;
  reprintAvailable?: boolean;
}) {
  const { t } = useI18n();
  if (!printers.length && !onTestReceipt && !onReprintLast) return null;

  return (
    <div className="space-y-1.5 border-b border-stone-100 pb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
        {t('webPosStaffHardwareTitle')}
      </p>
      <ul className="space-y-1 text-xs text-stone-700">
        {printers.map((p) => (
          <li key={p.id} className="flex items-center gap-1.5 rounded border border-stone-200 px-2 py-1">
            <Printer size={12} aria-hidden />
            <span className="truncate">{p.name}</span>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-1.5">
        {onTestReceipt ? (
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
            onClick={onTestReceipt}
          >
            {t('testPrinter')}
          </button>
        ) : null}
        {onReprintLast ? (
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            disabled={!reprintAvailable}
            onClick={onReprintLast}
          >
            {t('webPosReprintTitle')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
