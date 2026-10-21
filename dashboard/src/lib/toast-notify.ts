import toast from 'react-hot-toast';

/** react-hot-toast v2 has no toast.info — use a neutral toast instead. */
export function toastInfo(message: string, opts?: Parameters<typeof toast>[1]) {
  return toast(message, {
    ...opts,
    icon: opts?.icon ?? 'ℹ️',
  });
}
