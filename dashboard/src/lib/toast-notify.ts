import toast from 'react-hot-toast';

/** react-hot-toast v2 has no toast.info — use a neutral toast instead. */
export function toastInfo(message: string, opts?: Parameters<typeof toast>[1]) {
  return toast(message, {
    ...opts,
    icon: opts?.icon ?? 'ℹ️',
  });
}

let lastOrderPaidToast: { key: string; at: number } | null = null;

/** Paid ticket reload / stale cart — informational, not a failure. */
export function toastOrderAlreadyPaid(message: string) {
  const now = Date.now();
  if (lastOrderPaidToast?.key === message && now - lastOrderPaidToast.at < 10_000) {
    return;
  }
  lastOrderPaidToast = { key: message, at: now };
  toastInfo(message, { duration: 5000 });
}
