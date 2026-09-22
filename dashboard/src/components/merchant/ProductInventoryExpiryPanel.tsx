import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  loadExpiringLots,
  type ExpiringLot,
  type InvItem,
} from '@/pages/merchant/inventory/shared';

type Props = {
  productName: string;
  barcode: string;
  extraBarcodes?: string;
  invItems: InvItem[];
  onItemsChanged: () => void | Promise<void>;
};

function normalizeBarcode(value: string): string {
  return String(value || '').trim();
}

function collectBarcodes(barcode: string, extraBarcodes?: string): Set<string> {
  const codes = new Set<string>();
  const primary = normalizeBarcode(barcode);
  if (primary) codes.add(primary);
  for (const part of String(extraBarcodes || '').split(/[,;\s]+/)) {
    const code = normalizeBarcode(part);
    if (code) codes.add(code);
  }
  return codes;
}

function findLinkedItem(barcode: string, extraBarcodes: string | undefined, items: InvItem[]): InvItem | null {
  const codes = collectBarcodes(barcode, extraBarcodes);
  if (!codes.size) return null;
  return (
    items.find((item) => item.barcode && codes.has(normalizeBarcode(item.barcode))) || null
  );
}

export default function ProductInventoryExpiryPanel({
  productName,
  barcode,
  extraBarcodes,
  invItems,
  onItemsChanged,
}: Props) {
  const { t, formatDate } = useI18n();
  const [expiryDate, setExpiryDate] = useState('');
  const [receiveQty, setReceiveQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const [lots, setLots] = useState<ExpiringLot[]>([]);
  const [leadDays, setLeadDays] = useState(30);

  const linked = useMemo(
    () => findLinkedItem(barcode, extraBarcodes, invItems),
    [barcode, extraBarcodes, invItems]
  );

  const itemLots = useMemo(
    () => (linked ? lots.filter((lot) => lot.itemId === linked.id) : []),
    [linked, lots]
  );

  const loadLots = useCallback(async () => {
    if (!linked) {
      setLots([]);
      return;
    }
    try {
      const data = await loadExpiringLots();
      setLeadDays(data.leadDays);
      setLots(data.lots);
    } catch {
      setLots([]);
    }
  }, [linked]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  const primaryBarcode = normalizeBarcode(barcode);

  const createLinkedItem = async () => {
    if (!primaryBarcode) return;
    setBusy(true);
    try {
      await api.post('/merchant/inventory/items', {
        name: productName.trim() || primaryBarcode,
        barcode: primaryBarcode,
        perishable: true,
        onHand: 0,
      });
      toast.success(t('productExpiryItemCreated'));
      await onItemsChanged();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const togglePerishable = async (checked: boolean) => {
    if (!linked) return;
    setBusy(true);
    try {
      await api.put(`/merchant/inventory/items/${linked.id}`, { perishable: checked });
      await onItemsChanged();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const receiveWithExpiry = async () => {
    if (!linked) return;
    const qty = Number(receiveQty);
    if (!(qty > 0)) {
      toast.error(t('productExpiryQtyRequired'));
      return;
    }
    if (!expiryDate.trim()) {
      toast.error(t('storekeeperExpiryRequired'));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/merchant/inventory/items/${linked.id}/stock-in`, {
        qty,
        expiryDate: expiryDate.trim(),
      });
      toast.success(t('productExpiryStockReceived'));
      setExpiryDate('');
      setReceiveQty('1');
      await onItemsChanged();
      await loadLots();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{t('productExpirySection')}</p>
          <p className="text-xs muted">{t('productExpirySectionHint')}</p>
        </div>
        <Link
          to="/merchant/inventory/list?filter=expiring"
          className="text-xs font-semibold text-amber-900 underline"
        >
          {t('invNavStockTable')}
        </Link>
      </div>

      {!primaryBarcode ? (
        <p className="text-xs text-amber-900">{t('productExpiryNoBarcode')}</p>
      ) : !linked ? (
        <div className="space-y-2">
          <p className="text-xs text-amber-900">{t('productExpiryNoItem')}</p>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={busy}
            onClick={() => void createLinkedItem()}
          >
            {t('productExpiryCreateItem')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-stone-700">
            {t('productExpiryLinkedItem')}: <span className="font-semibold">{linked.name}</span>
            {' · '}
            {linked.onHand} {linked.unit}
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!linked.perishable}
              disabled={busy}
              onChange={(e) => void togglePerishable(e.target.checked)}
            />
            <span>{t('invPerishable')}</span>
          </label>
          <p className="text-[11px] muted">{t('invPerishableHint')}</p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block space-y-1">
              <span className="text-xs font-medium">{t('storekeeperExpiry')}</span>
              <input
                type="date"
                className="field-input"
                value={expiryDate}
                disabled={busy}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium">{t('productExpiryReceiveQty')}</span>
              <input
                type="number"
                min={0.0001}
                step="any"
                className="field-input"
                value={receiveQty}
                disabled={busy}
                onChange={(e) => setReceiveQty(e.target.value)}
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={busy}
                onClick={() => void receiveWithExpiry()}
              >
                {t('productExpiryReceive')}
              </button>
            </div>
          </div>

          {itemLots.length > 0 ? (
            <div className="rounded-md border border-red-200 bg-red-50/80 p-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-900">
                <AlertTriangle size={14} />
                {t('productExpiryLots', { count: itemLots.length, days: leadDays })}
              </p>
              <ul className="space-y-1 text-xs text-red-950">
                {itemLots.slice(0, 5).map((lot) => (
                  <li key={lot.id} className="flex justify-between gap-2">
                    <span>
                      {lot.qty} {lot.unit}
                    </span>
                    <span className={lot.expired ? 'font-bold' : ''}>
                      {lot.expired
                        ? t('invExpiryExpired')
                        : t('invExpiryDaysLeft', { days: lot.daysLeft ?? 0 })}
                      {' · '}
                      {formatDate(lot.expiryDate)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : linked.perishable ? (
            <p className="text-xs text-emerald-800">{t('productExpiryNoLotsSoon')}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
