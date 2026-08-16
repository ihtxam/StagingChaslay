import {
  ArrowLeft,
  ArrowRight,
  Ban,
  MessageSquare,
  MoreHorizontal,
  Printer,
  UtensilsCrossed,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { normalizeDashes, repairCatalogText } from '@/lib/text-encoding';
import WebPosNumericKeypad from './WebPosNumericKeypad';
import type { CartLine, KeypadMode, PosChannel } from './types';

type CartListTab = 'ordering' | 'ordered';

type Props = {
  cart: CartLine[];
  totals: { subtotal: number; tax: number; rounding: number; total: number; discount?: number };
  taxRate: number;
  money: (n: number) => string;
  selectedLineId: string | null;
  onSelectLine: (lineId: string | null) => void;
  keypadMode: KeypadMode;
  onKeypadModeChange: (mode: KeypadMode) => void;
  keypadBuffer: string;
  onKeypadBufferChange: (buf: string) => void;
  onKeypadApply: () => void;
  onKeypadAdjust: (delta: number) => void;
  onKeypadBackspace: () => void;
  channel: PosChannel | null;
  onChannelChange: (ch: 'takeaway' | 'delivery' | 'dine_in') => void;
  activeCourse: number;
  coursesEnabled: boolean;
  courseNumbers: number[];
  onSelectCourse: (course: number) => void;
  orderNote?: string;
  tableLabel?: string | null;
  tabNumber?: string | null;
  /** Counter-style dine-in ticket (D-001) when no table. */
  ticketDisplay?: string | null;
  customerLabel?: string | null;
  membershipName?: string | null;
  membershipPointsBalance?: number | null;
  onClearMembership?: () => void;
  fulfillmentLabel?: string | null;
  fulfillmentIsLater?: boolean;
  busy: boolean;
  orderSent: boolean;
  showNewOrder: boolean;
  sendLabel: string;
  onCustomer: () => void;
  onProvisionalReceipt: () => void;
  /** Switch order to dine-in and open table picker when needed. */
  onSwitchToDineIn: () => void;
  onCourse: () => void;
  onKitchenMessage: () => void;
  onSetTable: () => void;
  onSetTab: () => void;
  onSend: () => void;
  onNewOrder: () => void;
  onPayment: () => void;
  onCancelOrder: () => void;
  onCancelItem: () => void;
  onPayLater: () => void;
  onEditFulfillment?: () => void;
  showSend: boolean;
  hideTab: boolean;
  canCancelOrder: boolean;
  canCancelItem: boolean;
  /** Cart docked left or right of product grid */
  dockSide?: 'left' | 'right';
  /** Show Takeaway / Delivery channel tabs (retail may disable). */
  showChannelTabs?: boolean;
  /** Which fulfillment channels appear when tabs are shown. */
  channelTabOptions?: Array<'takeaway' | 'delivery' | 'dine_in'>;
  /** Kitchen message, SEND, set table - restaurant only. */
  kitchenEnabled?: boolean;
  /** When false (fast-food), hide Set table; Send is always available with kitchen. */
  tablesEnabled?: boolean;
  /** When true, dine-in menu action opens table picker. */
  requireTableForDineIn?: boolean;
  /** Hold current cart without kitchen send (retail / direct sale). */
  onHoldOrder?: () => void;
  /** Move whole open table order to another table. */
  onMoveTable?: () => void;
  /** Move selected cart line to another table. */
  onMoveDish?: () => void;
  /** Apply whole-bill discount. */
  onBillDiscount?: () => void;
  /** Open custom / open amount entry. */
  onCustomAmount?: () => void;
  canApplyBillDiscount?: boolean;
  billDiscountLabel?: string | null;
  /**
   * `page` = full-screen mobile cart (Odoo-style).
   * `side` = desktop docked cart.
   */
  layout?: 'side' | 'page';
  /** Mobile cart: back to products. */
  onBack?: () => void;
  /** Release table when dine-in cart is empty and nothing sent to kitchen. */
  canReleaseTable?: boolean;
  onReleaseTable?: () => void;
  /** Retail mode — simplified cart chrome and footer. */
  isRetail?: boolean;
};

function lineExtrasLabel(l: CartLine) {
  const parts: string[] = [];
  if (l.comboSelections.length) {
    parts.push(
      ...l.comboSelections.map((c) => {
        const productName = repairCatalogText(c.productName || '');
        const extras = (c.selectedExtras || []).map((e) => repairCatalogText(e.name || ''));
        return extras.length ? `${productName} (${extras.join(', ')})` : productName;
      })
    );
  }
  if (!l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => repairCatalogText(e.name || '')));
  } else if (l.comboSelections.length && l.selectedExtras.length) {
    parts.push(...l.selectedExtras.map((e) => repairCatalogText(e.name || '')));
  }
  return normalizeDashes(parts.join(', '));
}

type CartRow =
  | { kind: 'course'; course: number }
  | { kind: 'line'; line: CartLine };

function formatSentAt(ms?: number): string | null {
  if (!ms || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return null;
  }
}

export default function WebPosCartPanel({
  cart,
  totals,
  taxRate,
  money,
  selectedLineId,
  onSelectLine,
  keypadMode,
  onKeypadModeChange,
  keypadBuffer,
  onKeypadBufferChange,
  onKeypadApply,
  onKeypadAdjust,
  onKeypadBackspace,
  channel,
  onChannelChange,
  activeCourse,
  coursesEnabled,
  courseNumbers,
  onSelectCourse,
  orderNote,
  tableLabel,
  tabNumber,
  ticketDisplay,
  customerLabel,
  membershipName,
  membershipPointsBalance,
  onClearMembership,
  fulfillmentLabel,
  fulfillmentIsLater,
  busy,
  orderSent,
  showNewOrder,
  sendLabel,
  onCustomer,
  onProvisionalReceipt,
  onSwitchToDineIn,
  onCourse,
  onKitchenMessage,
  onSetTable,
  onSetTab,
  onSend,
  onNewOrder,
  onPayment,
  onCancelOrder,
  onCancelItem,
  onPayLater,
  onEditFulfillment,
  showSend,
  hideTab,
  canCancelOrder,
  canCancelItem,
  dockSide = 'right',
  showChannelTabs = true,
  channelTabOptions = ['takeaway', 'delivery'],
  kitchenEnabled = true,
  tablesEnabled = true,
  requireTableForDineIn = true,
  onHoldOrder,
  onMoveTable,
  onMoveDish,
  onBillDiscount,
  onCustomAmount,
  canApplyBillDiscount = true,
  billDiscountLabel,
  layout = 'side',
  onBack,
  canReleaseTable = false,
  onReleaseTable,
  isRetail = false,
}: Props) {
  const { t } = useI18n();
  const hasItems = cart.length > 0;
  const isPage = layout === 'page';
  const effectiveShowSend = kitchenEnabled && showSend;
  const channelOptions =
    channelTabOptions.length > 0 ? channelTabOptions : (['takeaway', 'delivery'] as const);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cartTab, setCartTab] = useState<CartListTab>('ordering');
  const sideBorder = dockSide === 'right' ? 'border-l' : 'border-r';

  useEffect(() => {
    if (!moreOpen) return;
    const close = () => setMoreOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('orientationchange', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('orientationchange', close);
    };
  }, [moreOpen]);

  const orderedLines = useMemo(() => cart.filter((l) => !!l.sentToKitchen), [cart]);
  const orderingLines = useMemo(() => cart.filter((l) => !l.sentToKitchen), [cart]);
  const showOrderTabs = kitchenEnabled && orderedLines.length > 0;
  const onOrderedTab = showOrderTabs && cartTab === 'ordered';
  /** Keypad only while a cart line is selected on Ordering (not Ordered history). */
  const keypadExpanded = !!selectedLineId && !onOrderedTab;
  const visibleCart = showOrderTabs
    ? cartTab === 'ordered'
      ? orderedLines
      : orderingLines
    : cart;

  useEffect(() => {
    if (!showOrderTabs) {
      setCartTab('ordering');
      return;
    }
    setCartTab(orderingLines.length === 0 ? 'ordered' : 'ordering');
  }, [showOrderTabs, orderingLines.length]);

  const rows = useMemo(() => {
    if (!coursesEnabled || courseNumbers.length === 0) {
      return visibleCart.map((line) => ({ kind: 'line' as const, line }));
    }
    const out: CartRow[] = [];
    const courses = courseNumbers.filter((course) =>
      visibleCart.some((l) => (l.courseNumber || 1) === course)
    );
    for (const course of courses) {
      out.push({ kind: 'course', course });
      for (const line of visibleCart.filter((l) => (l.courseNumber || 1) === course)) {
        out.push({ kind: 'line', line });
      }
    }
    return out;
  }, [visibleCart, courseNumbers, coursesEnabled]);

  const selectedLine = selectedLineId
    ? cart.find((l) => l.lineId === selectedLineId) || null
    : null;
  const canSendNow =
    (showOrderTabs ? orderingLines.length > 0 : hasItems) && !onOrderedTab;
  const retailBistroChannelRow =
    isRetail && showChannelTabs && channelTabOptions.includes('dine_in');
  const showMetaStrip =
    membershipName ||
    orderNote ||
    tableLabel ||
    tabNumber ||
    (!isRetail &&
      (ticketDisplay ||
        channel === 'dine_in' ||
        fulfillmentLabel ||
        channel === 'takeaway' ||
        channel === 'delivery'));

  return (
    <aside
      data-layout={isPage ? 'page' : 'side'}
      className={`webpos-cart-panel flex min-h-0 w-full flex-1 flex-col bg-white ${
        isPage
          ? 'border-0'
          : `${sideBorder} border-stone-200 lg:w-[min(22rem,34vw)] lg:shrink-0`
      }`}
    >
      {/* Channel tabs: Takeaway / Delivery / Dine-in (retail bistro: dine-in + choose time) */}
      {retailBistroChannelRow ? (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-stone-100 px-2 py-2">
          <button
            type="button"
            onClick={() => onChannelChange('dine_in')}
            className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide ${
              channel === 'dine_in'
                ? 'bg-[var(--webpos-accent)] text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t('dineIn')}
          </button>
          {onEditFulfillment ? (
            <button
              type="button"
              onClick={onEditFulfillment}
              className="inline-flex h-9 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 active:scale-[0.98]"
              title={t('webPosChooseTime')}
              aria-label={t('webPosChooseTime')}
            >
              <MoreHorizontal size={18} aria-hidden />
            </button>
          ) : null}
          {channelTabOptions.includes('delivery') ? (
            <button
              type="button"
              onClick={() => onChannelChange('delivery')}
              className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                channel === 'delivery'
                  ? 'bg-[var(--webpos-accent)] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {t('delivery')}
            </button>
          ) : null}
        </div>
      ) : showChannelTabs ? (
        <div
          className={`shrink-0 grid gap-1.5 border-b border-stone-100 px-2 py-2 ${
            channelOptions.length >= 3
              ? 'grid-cols-3'
              : channelOptions.length > 1
                ? 'grid-cols-2'
                : 'grid-cols-1'
          }`}
        >
          {channelOptions.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChannelChange(id)}
              className={`rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                channel === id
                  ? 'bg-[var(--webpos-accent)] text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {id === 'delivery'
                ? t('delivery')
                : id === 'dine_in'
                  ? t('dineIn')
                  : t('takeaway')}
            </button>
          ))}
        </div>
      ) : null}

      {/* Table / order type + ⋮ on one line */}
      <div className="relative shrink-0 border-b border-stone-100 px-2 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {tableLabel ? (
              <span className="inline-flex max-w-full items-center gap-2 truncate">
                <span className="inline-flex items-center truncate rounded-lg bg-sky-100 px-2.5 py-1.5 text-xs font-bold text-sky-900">
                  {t('table')} {tableLabel}
                </span>
                {canReleaseTable && onReleaseTable ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700 hover:bg-red-100"
                    onClick={onReleaseTable}
                  >
                    {t('webPosReleaseTable')}
                  </button>
                ) : null}
              </span>
            ) : tabNumber ? (
              <span className="inline-flex max-w-full items-center truncate rounded-lg bg-indigo-100 px-2.5 py-1.5 text-xs font-bold text-indigo-900">
                {t('webPosTab')} #{tabNumber}
              </span>
            ) : isRetail && channel === 'dine_in' ? (
              <span className="inline-flex max-w-full items-center truncate rounded-lg bg-sky-100 px-2.5 py-1.5 text-xs font-bold text-sky-900">
                {t('dineIn')}
                {ticketDisplay ? ` · ${ticketDisplay}` : ''}
              </span>
            ) : !isRetail ? (
              <span className="inline-flex max-w-full items-center truncate rounded-lg bg-stone-100 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-stone-700">
                {channel === 'dine_in'
                  ? ticketDisplay
                    ? `${t('dineIn')} · ${ticketDisplay}`
                    : t('dineIn')
                  : channel === 'delivery'
                    ? t('delivery')
                    : channel === 'takeaway'
                      ? t('takeaway')
                      : t('takeaway')}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
            onClick={() => setMoreOpen((v) => !v)}
            title={t('webPosMoreActions')}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label={t('webPosMoreActions')}
          >
            <MoreHorizontal size={18} aria-hidden />
          </button>
        </div>
        {moreOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[35] cursor-default border-0 bg-black/10 p-0"
              aria-label={t('close')}
              onClick={() => setMoreOpen(false)}
            />
            <div
              role="menu"
              className="absolute right-2 left-2 top-full z-[40] mt-1 rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                onClick={() => {
                  setMoreOpen(false);
                  onCustomer();
                }}
              >
                <User size={14} className="shrink-0 text-stone-500" />
                <span className="truncate">{customerLabel || t('webPosAddClient')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                disabled={!hasItems || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onProvisionalReceipt();
                }}
              >
                <Printer size={14} className="shrink-0 text-stone-500" />
                {t('webPosProvisionalReceipt')}
              </button>
              {kitchenEnabled && requireTableForDineIn && tablesEnabled ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => {
                    setMoreOpen(false);
                    onSwitchToDineIn();
                  }}
                >
                  <UtensilsCrossed size={14} className="shrink-0 text-stone-500" />
                  <span className="min-w-0 truncate">
                    {channel === 'dine_in' && tableLabel
                      ? `${t('dineIn')} · ${t('table')} ${tableLabel}`
                      : t('dineIn')}
                  </span>
                </button>
              ) : null}
              {canReleaseTable && onReleaseTable ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setMoreOpen(false);
                    onReleaseTable();
                  }}
                >
                  <Ban size={14} className="shrink-0" />
                  {t('webPosReleaseTable')}
                </button>
              ) : null}
              {kitchenEnabled ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50"
                  onClick={() => {
                    setMoreOpen(false);
                    onKitchenMessage();
                  }}
                >
                  <MessageSquare size={14} className="shrink-0 text-stone-500" />
                  {t('webPosKitchenMessage')}
                </button>
              ) : null}
              {onHoldOrder ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  disabled={!hasItems || busy}
                  onClick={() => {
                    setMoreOpen(false);
                    onHoldOrder();
                  }}
                >
                  {t('webPosHoldOrder')}
                </button>
              ) : null}
              {onMoveTable ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  disabled={!hasItems || busy || !tableLabel}
                  onClick={() => {
                    setMoreOpen(false);
                    onMoveTable();
                  }}
                >
                  {t('webPosMoveTable')}
                </button>
              ) : null}
              {onMoveDish ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  disabled={!selectedLineId || busy || !tableLabel}
                  onClick={() => {
                    setMoreOpen(false);
                    onMoveDish();
                  }}
                >
                  {t('webPosMoveDishTo')}
                </button>
              ) : null}
              {onBillDiscount ? (
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                  disabled={!hasItems || busy || !canApplyBillDiscount}
                  onClick={() => {
                    setMoreOpen(false);
                    onBillDiscount();
                  }}
                >
                  {billDiscountLabel
                    ? `${t('webPosBillDiscount')} (${billDiscountLabel})`
                    : t('webPosBillDiscount')}
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
                disabled={!hasItems || busy || channel === 'dine_in' || !channel}
                onClick={() => {
                  setMoreOpen(false);
                  onPayLater();
                }}
              >
                {t('webPosPayLater')}
              </button>
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                disabled={!canCancelItem || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onCancelItem();
                }}
              >
                <Ban size={14} className="shrink-0" />
                {t('webPosCancelItem')}
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                disabled={!canCancelOrder || busy}
                onClick={() => {
                  setMoreOpen(false);
                  onCancelOrder();
                }}
              >
                <Ban size={14} className="shrink-0" />
                {t('webPosCancelOrder')}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {showMetaStrip ? (
        <div className="shrink-0 flex flex-wrap items-center gap-1.5 border-b border-stone-100 px-3 py-1.5 text-[11px] text-stone-500">
          {membershipName ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded bg-teal-100 px-1.5 py-0.5 font-semibold text-teal-900">
              <span className="truncate">
                {membershipName}
                {membershipPointsBalance != null
                  ? ` · ${t('webPosPointsBalance').replace('{n}', String(membershipPointsBalance))}`
                  : ''}
              </span>
              {onClearMembership ? (
                <button
                  type="button"
                  className="shrink-0 rounded px-0.5 text-teal-700 hover:bg-teal-200/80"
                  title={t('webPosDetachMembership')}
                  aria-label={t('webPosDetachMembership')}
                  onClick={onClearMembership}
                >
                  ×
                </button>
              ) : null}
            </span>
          ) : null}
          {!isRetail && channel === 'dine_in' ? (
            <span className="rounded bg-sky-100 px-1.5 py-0.5 font-semibold text-sky-800">
              {ticketDisplay ? `${t('dineIn')} · ${ticketDisplay}` : t('dineIn')}
            </span>
          ) : null}
          {!isRetail && (channel === 'takeaway' || channel === 'delivery') ? (
            <div className="relative z-[5] flex w-full flex-wrap items-center gap-1.5">
              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
                {channel === 'delivery' ? t('delivery') : t('takeaway')}
                {': '}
                {fulfillmentIsLater && fulfillmentLabel
                  ? fulfillmentLabel
                  : t('webPosAsap')}
              </span>
              {onEditFulfillment ? (
                <button
                  type="button"
                  onClick={onEditFulfillment}
                  className="relative z-[6] inline-flex min-h-11 min-w-[2.75rem] touch-manipulation items-center justify-center rounded-lg border border-[var(--webpos-accent-border)] bg-[var(--webpos-accent-softer)] px-3 py-2 text-xs font-semibold text-[var(--webpos-accent-text)] hover:bg-[var(--webpos-accent-soft)] active:scale-[0.98]"
                  title={t('webPosChooseTime')}
                  aria-label={t('webPosChooseTime')}
                >
                  {t('webPosChooseTime')}
                </button>
              ) : null}
            </div>
          ) : null}
          {tableLabel ? (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-800">
              {t('table')} {tableLabel}
            </span>
          ) : null}
          {tabNumber ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">
              {t('webPosTab')} #{tabNumber}
            </span>
          ) : null}
          {orderNote ? <span className="truncate">{orderNote}</span> : null}
        </div>
      ) : null}

      {showOrderTabs ? (
        <div className="shrink-0 grid grid-cols-2 gap-1 border-b border-stone-100 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setCartTab('ordering')}
            className={`rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide ${
              cartTab === 'ordering'
                ? 'bg-[var(--webpos-accent)] text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t('webPosCartOrdering')}
            {orderingLines.length ? (
              <span className="ml-1 tabular-nums opacity-80">({orderingLines.length})</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setCartTab('ordered')}
            className={`rounded-lg px-2 py-2 text-xs font-bold uppercase tracking-wide ${
              cartTab === 'ordered'
                ? 'bg-stone-800 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t('webPosCartOrdered')}
            {orderedLines.length ? (
              <span className="ml-1 tabular-nums opacity-80">({orderedLines.length})</span>
            ) : null}
          </button>
        </div>
      ) : null}

      {/* Cart lines take remaining height; keypad + actions stay docked below */}
      <div
        className="webpos-cart-lines min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
        onClick={() => {
          if (selectedLineId) onSelectLine(null);
        }}
      >
        {!hasItems ? (
          <div className="py-8 text-center">
            <p className="text-sm text-stone-400">{t('webPosTapProducts')}</p>
            {!kitchenEnabled && onCancelOrder ? (
              <button
                type="button"
                disabled={busy || !canCancelOrder}
                onClick={onCancelOrder}
                className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
              >
                {t('webPosCancelOrder')}
              </button>
            ) : null}
          </div>
        ) : visibleCart.length === 0 ? (
          <p className="py-8 text-center text-sm text-stone-400">
            {cartTab === 'ordered' ? t('webPosCartOrderedEmpty') : t('webPosCartOrderingEmpty')}
          </p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => {
              if (row.kind === 'course') {
                const selected = activeCourse === row.course;
                return (
                  <li key={`course-${row.course}`}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCourse(row.course);
                      }}
                      aria-pressed={selected}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide ${
                        selected
                          ? 'bg-violet-600 text-white ring-2 ring-violet-300 ring-offset-1'
                          : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
                      }`}
                    >
                      {t('webPosCourse')} {row.course}
                      {selected ? (
                        <span className="ml-2 text-[10px] font-semibold normal-case tracking-normal opacity-90">
                          - {t('webPosCourseActive')}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              }
              const l = row.line;
              const selected = selectedLineId === l.lineId;
              const extras = lineExtrasLabel(l);
              const lineName = repairCatalogText(l.name || '');
              const sentAtLabel = formatSentAt(l.sentToKitchenAt);
              return (
                <li key={l.lineId}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLine(selected ? null : l.lineId);
                    }}
                    className={`w-full rounded-lg px-2 py-2 text-left transition ${
                      selected
                        ? 'bg-[var(--webpos-accent-softer)] ring-2 ring-[var(--webpos-accent-ring)]'
                        : 'hover:bg-stone-50'
                    } ${l.sentToKitchen ? 'opacity-80' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">
                          <span className="tabular-nums">
                            {l.isWeighed
                              ? `${Number(l.weightKg ?? l.quantity).toFixed(3)} kg`
                              : l.quantity}
                          </span>{' '}
                          {lineName}
                          {l.isWeighed ? (
                            <span className="ml-1 text-[10px] font-semibold text-stone-500">
                              @ {money(l.unitPrice)}/kg
                            </span>
                          ) : null}
                          {l.sentToKitchen ? (
                            <span className="ml-1 rounded bg-stone-200 px-1 text-[9px] font-bold uppercase text-stone-600">
                              {t('webPosSentBadge')}
                            </span>
                          ) : null}
                        </p>
                        {extras ? (
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            {'- '}
                            {extras}
                          </p>
                        ) : null}
                        {l.sentToKitchen && sentAtLabel ? (
                          <p className="mt-0.5 text-[11px] font-medium text-stone-500">
                            {t('webPosSentAt').replace('{time}', sentAtLabel)}
                          </p>
                        ) : null}
                        {l.lineDiscountPercent ? (
                          <p className="text-[11px] font-medium text-[var(--webpos-accent-text)]">
                            -{l.lineDiscountPercent}%
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {money(l.lineTotal)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Docked footer: totals + keypad + primary actions */}
      <div className="webpos-cart-dock mt-auto shrink-0">
        <div className="border-t border-stone-100 px-3 py-2">
          <div className="space-y-0.5 text-sm">
            {(totals.discount || 0) > 0 ? (
              <div className="flex justify-between text-[var(--webpos-accent-text)]">
                <span>
                  {t('discount')}
                  {billDiscountLabel ? ` (${billDiscountLabel})` : ''}
                </span>
                <span className="tabular-nums">-{money(totals.discount || 0)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-stone-500">
              <span>{t('webPosTax').replace('{rate}', String(taxRate))}</span>
              <span className="tabular-nums">{money(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>{t('webPosTotal')}</span>
              <span className="tabular-nums">{money(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Course + keypad: keypad only when a line is selected */}
        <div
          className={`border-t border-stone-100 bg-stone-50 transition-all ${
            keypadExpanded ? 'px-1.5 py-1' : 'px-1.5 py-0.5'
          }`}
        >
          {coursesEnabled && (keypadExpanded || !isPage) ? (
            <div className="mb-1">
              <p className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                {t('webPosCourse')} {activeCourse} - {t('webPosCourseActive')}
              </p>
              <button
                type="button"
                className="w-full rounded-md bg-violet-600 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-violet-700 disabled:opacity-40"
                onClick={onCourse}
                disabled={!hasItems}
                title={t('webPosAddNextCourse')}
              >
                + {t('webPosAddNextCourse')}
              </button>
            </div>
          ) : coursesEnabled && isPage && !keypadExpanded ? (
            <button
              type="button"
              className="mb-1 w-full rounded-md bg-violet-50 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100 disabled:opacity-40"
              onClick={onCourse}
              disabled={!hasItems}
            >
              + {t('webPosAddNextCourse')}
            </button>
          ) : null}

          {keypadExpanded ? (
            <>
              {selectedLine ? (
                <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
                  <p className="min-w-0 truncate text-xs font-semibold text-stone-700">
                    <span className="tabular-nums">
                      {selectedLine.isWeighed
                        ? `${Number(selectedLine.weightKg ?? selectedLine.quantity).toFixed(3)} kg`
                        : selectedLine.quantity}
                    </span>{' '}
                    {repairCatalogText(selectedLine.name || '')}
                  </p>
                  <button
                    type="button"
                    className="webpos-accent-btn shrink-0 rounded-md px-3 py-1 text-xs font-bold"
                    onClick={onKeypadApply}
                    disabled={busy}
                  >
                    {t('webPosKeypadApply')}
                  </button>
                </div>
              ) : null}
              <WebPosNumericKeypad
                mode={keypadMode}
                onModeChange={onKeypadModeChange}
                buffer={keypadBuffer}
                onBufferChange={onKeypadBufferChange}
                onApply={onKeypadApply}
                onAdjust={onKeypadAdjust}
                onBackspace={onKeypadBackspace}
                disabled={!selectedLineId}
                compact
                hideApply
              />
            </>
          ) : null}
        </div>

        <div
          className={`grid gap-1.5 border-t border-stone-200 bg-white p-2 ${
            isRetail
              ? isPage && onBack
                ? 'grid-cols-[auto_1fr_1fr]'
                : 'grid-cols-2'
              : isPage && onBack
                ? 'grid-cols-[auto_1fr_1fr_1fr]'
                : 'grid-cols-3'
          }`}
        >
          {isPage && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-full min-h-[2.75rem] w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
              aria-label={t('back')}
              title={t('back')}
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          {isRetail ? (
            <>
              <button
                type="button"
                disabled={!hasItems || busy}
                onClick={() => (onHoldOrder ? onHoldOrder() : onNewOrder())}
                className="rounded-lg bg-violet-700 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-violet-800 disabled:opacity-40"
              >
                {t('webPosHoldOrder')}
              </button>
              <button
                type="button"
                disabled={!hasItems || busy}
                onClick={onPayment}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--webpos-accent)] py-3 text-sm font-bold text-white hover:opacity-95 disabled:opacity-40"
                aria-label={t('webPosPayment')}
              >
                <ArrowRight size={20} aria-hidden />
              </button>
            </>
          ) : showNewOrder ? (
            <button
              type="button"
              disabled={busy}
              onClick={onNewOrder}
              className="col-span-2 rounded-lg bg-violet-700 py-3 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-40"
            >
              {t('webPosNew')}
            </button>
          ) : (
            <>
              {kitchenEnabled && !tablesEnabled ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSetTab}
                  className="rounded-lg bg-indigo-700 py-3 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-40"
                >
                  {tabNumber ? `#${tabNumber}` : t('webPosSetTab')}
                </button>
              ) : kitchenEnabled && tablesEnabled && !hideTab && !effectiveShowSend && !orderSent ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSetTable}
                  className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
                >
                  {tableLabel || t('webPosSetTable')}
                </button>
              ) : !kitchenEnabled ? (
                <button
                  type="button"
                  disabled={!hasItems || busy}
                  onClick={() => (onHoldOrder ? onHoldOrder() : onNewOrder())}
                  className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
                >
                  {onHoldOrder ? t('webPosHoldOrder') : t('webPosNew')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onSetTab}
                  className="rounded-lg bg-indigo-700 py-3 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-40"
                >
                  {tabNumber ? `#${tabNumber}` : t('webPosSetTab')}
                </button>
              )}
              {kitchenEnabled ? (
                <button
                  type="button"
                  disabled={!canSendNow || busy}
                  onClick={onSend}
                  className="rounded-lg bg-violet-700 py-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
                >
                  {sendLabel}
                </button>
              ) : (
                <div />
              )}
            </>
          )}
          {!isRetail ? (
            <button
              type="button"
              disabled={!hasItems || busy}
              onClick={onPayment}
              className="rounded-lg bg-stone-200 py-3 text-sm font-bold text-stone-800 hover:bg-stone-300 disabled:opacity-40"
            >
              {t('webPosPayment')}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
