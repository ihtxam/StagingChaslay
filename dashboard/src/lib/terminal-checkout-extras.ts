import { roundMoney2 } from '@/lib/money';

/** Checkout extras shape used after terminal POI approval (WebPOS). */
export type TerminalCheckoutExtras = {
  method?: string;
  discountPercent?: number;
  discountAmount?: number;
  tipAmount?: number;
  roundingAmount?: number;
  total?: number;
  amountTendered?: number | null;
  changeDue?: number | null;
  tenders?: Array<{ method: string; amount: number; giftCardNumber?: string }>;
  [key: string]: unknown;
};

export type TerminalPaymentCapture = {
  tipAmount?: number | null;
  authorizedAmount?: number | null;
};

const AUTO_COVER_METHODS = new Set([
  'cash',
  'card',
  'terminal',
  'pay_later',
  'invoice',
]);

function normPayMethod(method: string | undefined | null): string {
  return String(method || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

/**
 * Ensure WebPOS checkout extras carry tip, paid total, and tender lines for sync + receipts.
 * VAT stays on merchandise only (receipt code uses total − tip − rounding).
 */
export function normalizePosCheckoutExtras(
  extras: TerminalCheckoutExtras,
  paymentMethod: string
): TerminalCheckoutExtras {
  const method = normPayMethod(paymentMethod || extras.method || 'cash');
  const tip = roundMoney2(Math.max(0, Number(extras.tipAmount) || 0));
  const rounding = roundMoney2(Number(extras.roundingAmount) || 0);
  const total = roundMoney2(Math.max(0, Number(extras.total) || 0));

  let tenders = (extras.tenders || [])
    .map((row) => ({
      ...row,
      amount: roundMoney2(row.amount),
    }))
    .filter((row) => row.amount > 0);

  if (!tenders.length && total > 0.001) {
    tenders = [{ method, amount: total }];
  } else if (tenders.length === 1 && AUTO_COVER_METHODS.has(normPayMethod(tenders[0]!.method))) {
    tenders = [{ ...tenders[0]!, amount: total }];
  } else if (tenders.length > 1) {
    const paidSum = roundMoney2(tenders.reduce((s, row) => s + row.amount, 0));
    if (Math.abs(paidSum - total) > 0.02) {
      const autoIdx = tenders.findIndex((row) => AUTO_COVER_METHODS.has(normPayMethod(row.method)));
      if (autoIdx >= 0) {
        const others = roundMoney2(
          tenders.reduce((s, row, idx) => (idx === autoIdx ? s : s + row.amount), 0)
        );
        tenders = tenders.map((row, idx) =>
          idx === autoIdx ? { ...row, amount: roundMoney2(Math.max(0, total - others)) } : row
        );
      }
    }
  }

  let amountTendered = extras.amountTendered;
  if (amountTendered == null && (method === 'card' || method === 'terminal')) {
    amountTendered = total;
  } else if (amountTendered == null && tenders.length === 1) {
    amountTendered = tenders[0]!.amount;
  }

  return {
    ...extras,
    method: extras.method || paymentMethod,
    tipAmount: tip,
    roundingAmount: rounding,
    total,
    tenders,
    amountTendered:
      amountTendered != null ? roundMoney2(Number(amountTendered)) : amountTendered,
  };
}

/**
 * Merge Adyen terminal gratuity into checkout extras: order total, tip line, and terminal tender.
 * Tips are stored separately from merchandise tax (VAT is computed on total − tip − rounding).
 */
export function applyTerminalTipToCheckoutExtras(
  extras: TerminalCheckoutExtras | null | undefined,
  opts: {
    /** Amount charged on the terminal before gratuity (merchandise + rounding − POS tip). */
    basePayable: number;
    capture: TerminalPaymentCapture;
  }
): TerminalCheckoutExtras | null {
  const basePayable = roundMoney2(Math.max(0, opts.basePayable));
  const parsedTip = roundMoney2(Math.max(0, Number(opts.capture.tipAmount) || 0));
  const authorizedRaw = opts.capture.authorizedAmount;
  const authorized =
    authorizedRaw != null && Number.isFinite(Number(authorizedRaw))
      ? roundMoney2(Math.max(0, Number(authorizedRaw)))
      : null;

  let terminalTip = parsedTip;
  let paidTotal = roundMoney2(basePayable + terminalTip);

  if (authorized != null && authorized > basePayable + 0.001) {
    paidTotal = authorized;
    if (terminalTip <= 0.001) {
      terminalTip = roundMoney2(Math.max(0, authorized - basePayable));
    }
  } else if (authorized != null && authorized > 0.001 && terminalTip <= 0.001) {
    paidTotal = authorized;
  }

  if (terminalTip <= 0.001 && Math.abs(paidTotal - basePayable) <= 0.001) {
    return extras ?? null;
  }

  const priorTip = roundMoney2(extras?.tipAmount || 0);
  const totalTip = roundMoney2(priorTip + terminalTip);

  const patchTenders = (tenders: TerminalCheckoutExtras['tenders']) => {
    if (!tenders?.length) {
      return [{ method: 'terminal', amount: paidTotal }];
    }
    let touched = false;
    const next = tenders.map((row) => {
      if (String(row.method || '').replace(/-/g, '_') !== 'terminal') return row;
      touched = true;
      return { ...row, amount: paidTotal };
    });
    if (!touched) {
      next.push({ method: 'terminal', amount: paidTotal });
    }
    return next;
  };

  if (extras) {
    return normalizePosCheckoutExtras(
      {
        ...extras,
        method: extras.method || 'terminal',
        tipAmount: totalTip,
        total: paidTotal,
        amountTendered: roundMoney2(extras.amountTendered ?? paidTotal),
        tenders: patchTenders(extras.tenders),
      },
      'terminal'
    );
  }

  return normalizePosCheckoutExtras(
    {
      method: 'terminal',
      discountPercent: 0,
      discountAmount: 0,
      tipAmount: totalTip,
      roundingAmount: 0,
      total: paidTotal,
      amountTendered: paidTotal,
      changeDue: null,
      tenders: [{ method: 'terminal', amount: paidTotal }],
    },
    'terminal'
  );
}
