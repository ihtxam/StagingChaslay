import api from '@/lib/api';

export async function fetchInvoicePdf(orderId: string): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get(`/merchant/orders/${orderId}/invoice.pdf`, {
    responseType: 'blob',
  });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const disp = String(res.headers['content-disposition'] || '');
  const match = disp.match(/filename="([^"]+)"/i);
  return { blob, filename: match?.[1] || 'invoice.pdf' };
}

export async function viewInvoicePdf(orderId: string): Promise<void> {
  const { blob } = await fetchInvoicePdf(orderId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
}

export async function downloadInvoicePdf(orderId: string, filename?: string): Promise<void> {
  const { blob, filename: fromHeader } = await fetchInvoicePdf(orderId);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || fromHeader;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
