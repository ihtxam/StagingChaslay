import { MoreVertical, Printer, Wifi, Usb } from 'lucide-react';
import { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { SettingsDemoPrinterRow } from '@/lib/settings-printer-demo-rows';

export type SettingsPrinterRowProfile = {
  id: string;
  name: string;
  portName?: string | null;
  printReceipts?: boolean;
  printKitchenTickets?: boolean;
  printEndOfDayReports?: boolean;
};

type RowProps = {
  profile: SettingsPrinterRowProfile;
  connectionDetail: string;
  connectionKind: 'usb' | 'wifi' | 'other';
  status: 'connected' | 'attention';
  demo?: boolean;
  testing?: boolean;
  onTest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  expanded?: boolean;
};

export function inferPrinterConnectionMeta(
  name: string,
  portName?: string | null
): { kind: 'usb' | 'wifi' | 'other'; detail: string } {
  const port = String(portName || '').trim();
  const lower = `${name} ${port}`.toLowerCase();
  if (/\d{1,3}(?:\.\d{1,3}){3}/.test(lower) || lower.includes('wifi') || lower.includes('network')) {
    const ip = lower.match(/\d{1,3}(?:\.\d{1,3}){3}/)?.[0];
    return {
      kind: 'wifi',
      detail: ip ? `WiFi · ${ip}` : port ? `WiFi · ${port}` : 'WiFi',
    };
  }
  if (lower.includes('usb') || /^com\d/i.test(port)) {
    return {
      kind: 'usb',
      detail: port ? `USB · ${port}` : `USB · ${name}`.slice(0, 120),
    };
  }
  return { kind: 'other', detail: port || name };
}

export function SettingsPrinterProfileRow({
  profile,
  connectionDetail,
  connectionKind,
  status,
  demo = false,
  testing = false,
  onTest,
  onEdit,
  onDelete,
  expanded = false,
}: RowProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const roles: Array<{ key: string; label: string; on: boolean }> = [
    { key: 'r', label: t('printRoleReceipts'), on: !!profile.printReceipts },
    { key: 'k', label: t('printRoleKitchen'), on: !!profile.printKitchenTickets },
    { key: 'e', label: t('printRoleEod'), on: !!profile.printEndOfDayReports },
  ].filter((r) => r.on);

  const ConnIcon = connectionKind === 'wifi' ? Wifi : Usb;
  const statusLabel =
    status === 'connected' ? t('settingsPrinterConnected') : t('settingsPrinterAttention');
  const statusColor = status === 'connected' ? 'bg-emerald-500' : 'bg-amber-500';

  return (
    <div
      className={`rounded-xl border bg-[var(--bg-elevated)] p-4 shadow-sm ${
        demo ? 'border-dashed border-teal-200/80 bg-teal-50/30' : 'border-[var(--border)]'
      } ${expanded ? 'ring-2 ring-teal-200/80' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(19, 169, 154, 0.12)' }}
          >
            <Printer className="h-5 w-5 text-[#13A99A]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex h-2 w-2 rounded-full ${statusColor}`} aria-hidden />
              <span className="text-xs font-semibold text-[var(--text-muted)]">{statusLabel}</span>
              {demo ? (
                <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                  {t('settingsPrinterDemoBadge')}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-sm font-bold text-[var(--text)]">{profile.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <ConnIcon size={12} className="shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{connectionDetail}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="hidden min-w-[8rem] flex-col gap-1 sm:flex">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('settingsPrinterPrintsFor')}
            </span>
            <div className="flex flex-wrap gap-1">
              {roles.length ? (
                roles.map((r) => (
                  <span
                    key={r.key}
                    className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200/80"
                  >
                    {r.label}
                  </span>
                ))
              ) : (
                <span className="text-xs text-[var(--text-muted)]">—</span>
              )}
            </div>
          </div>
          {!demo && onTest ? (
            <button
              type="button"
              className="btn-primary text-xs px-3 py-1.5"
              disabled={!profile.name?.trim() || testing}
              onClick={onTest}
            >
              {testing ? t('loading') : t('settingsPrinterTest')}
            </button>
          ) : null}
          {!demo && onEdit ? (
            <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={onEdit}>
              {t('edit')}
            </button>
          ) : null}
          {!demo && onDelete ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--text-muted)] hover:bg-stone-50"
                aria-label={t('actions')}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[8rem] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                  >
                    {t('delete')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 sm:hidden">
        {roles.map((r) => (
          <span
            key={r.key}
            className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 ring-1 ring-teal-200/80"
          >
            {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SettingsDemoPrinterRow({ row }: { row: SettingsDemoPrinterRow }) {
  return (
    <SettingsPrinterProfileRow
      profile={{
        id: row.id,
        name: row.name,
        printReceipts: row.printReceipts,
        printKitchenTickets: row.printKitchenTickets,
        printEndOfDayReports: row.printEndOfDayReports,
      }}
      connectionDetail={row.connectionDetail}
      connectionKind={row.connectionKind}
      status={row.status}
      demo
    />
  );
}
