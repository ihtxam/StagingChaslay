import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type CommissionOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  subtotal: number;
  total: number;
  commission: number;
};

type CommissionReport = {
  month: string;
  commissionPercent: number;
  orderCount: number;
  ordersSubtotal: number;
  totalCommission: number;
  orders: CommissionOrder[];
};

function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function money(amount: number, currency = 'CHF') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split('-');
  if (!y || !m) return key;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

type Props = {
  resellerMode?: boolean;
  merchantId?: string;
  merchantName?: string;
};

export default function ShopCommissionSection({
  resellerMode = false,
  merchantId,
  merchantName,
}: Props) {
  const { t } = useI18n();
  const [month, setMonth] = useState(monthKey());
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = resellerMode && merchantId
        ? `/reseller/merchants/${merchantId}/shop-commission`
        : '/merchant/shop-commission';
      const res = await api.get(url, { params: { month } });
      setReport(res.data.report || null);
    } catch (err: any) {
      setReport(null);
      toast.error(err.response?.data?.error || t('shopCommissionLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [merchantId, month, resellerMode, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const monthOptions = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i += 1) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      out.push(monthKey(d));
    }
    return out;
  }, []);

  const downloadPdf = async () => {
    if (!resellerMode || !merchantId) return;
    setDownloading(true);
    try {
      const res = await api.get(`/reseller/merchants/${merchantId}/shop-commission/pdf`, {
        params: { month },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `shop-commission-${month}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('shopCommissionPdfFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t('shopCommissionTitle')}</h2>
          <p className="text-sm text-stone-600 mt-1">{t('shopCommissionHint')}</p>
          {resellerMode && merchantName ? (
            <p className="text-sm text-stone-700 mt-1">{merchantName}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="block text-stone-600 mb-1">{t('shopCommissionMonth')}</span>
            <select className="input" value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions.map((key) => (
                <option key={key} value={key}>
                  {formatMonthLabel(key)}
                </option>
              ))}
            </select>
          </label>
          {resellerMode ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={downloading || loading}
              onClick={() => void downloadPdf()}
            >
              {downloading ? '…' : t('shopCommissionDownloadPdf')}
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">{t('loading')}</p>
      ) : report ? (
        <>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-stone-50 p-3">
              <p className="text-xs text-stone-500">{t('shopCommissionRate')}</p>
              <p className="text-xl font-bold">{report.commissionPercent}%</p>
            </div>
            <div className="rounded-xl border bg-stone-50 p-3">
              <p className="text-xs text-stone-500">{t('shopCommissionOrders')}</p>
              <p className="text-xl font-bold">{report.orderCount}</p>
            </div>
            <div className="rounded-xl border bg-stone-50 p-3">
              <p className="text-xs text-stone-500">{t('shopCommissionSubtotal')}</p>
              <p className="text-xl font-bold">{money(report.ordersSubtotal)}</p>
            </div>
            <div className="rounded-xl border bg-teal-50 p-3">
              <p className="text-xs text-teal-700">{t('shopCommissionDue')}</p>
              <p className="text-xl font-bold text-teal-900">{money(report.totalCommission)}</p>
            </div>
          </div>

          {report.orders.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('date')}</th>
                    <th className="px-3 py-2 text-left">{t('orders')}</th>
                    <th className="px-3 py-2 text-right">{t('shopCommissionSubtotal')}</th>
                    <th className="px-3 py-2 text-right">{t('total')}</th>
                    <th className="px-3 py-2 text-right">{t('shopCommissionDue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.orders.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.createdAt
                          ? new Date(row.createdAt).toLocaleDateString(undefined, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.orderNumber}</td>
                      <td className="px-3 py-2 text-right">{money(row.subtotal)}</td>
                      <td className="px-3 py-2 text-right">{money(row.total)}</td>
                      <td className="px-3 py-2 text-right font-medium">{money(row.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-stone-500">{t('shopCommissionNoOrders')}</p>
          )}
        </>
      ) : (
        <p className="text-sm text-stone-500">{t('shopCommissionNotConfigured')}</p>
      )}
    </section>
  );
}
