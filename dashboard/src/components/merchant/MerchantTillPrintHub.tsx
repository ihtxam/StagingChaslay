import { useTillPrintHub } from '@/hooks/useTillPrintHub';

/** Isolated so Dashboard chunk does not pull webpos-print-relay at init. */
export default function MerchantTillPrintHub({ enabled }: { enabled: boolean }) {
  useTillPrintHub({ enabled });
  return null;
}
