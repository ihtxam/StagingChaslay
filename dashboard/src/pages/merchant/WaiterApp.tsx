import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChefHat,
  Loader2,
  LogOut,
  Minus,
  PanelLeft,
  Plus,
  ShoppingBag,
  Table2,
  UserCircle2,
  UtensilsCrossed,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { toastPrintError } from '@/lib/webpos-print-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import {
  cacheMerchantAutoPrintSettings,
} from '@/lib/webpos-print-relay';
import {
  backOfficeHomePath,
  canStaffOpenBackOffice,
  hasPermission,
  isMerchantOwnerJwt,
  loadWebPosStaffSession,
  saveWebPosStaffSession,
  clearWebPosStaffSession,
  notifyWebPosStaffSessionChanged,
  resolveWebPosStaffSession,
  webPosPinGateRequired,
  type WebPosStaffSession,
  type StaffRosterRow,
} from '@/lib/permissions';
import { useAuthStore } from '@/store/auth';
import {
  POS_SESSION_KICKED_EVENT,
  registerPosSession,
  clearPosSessionLocal,
  revokePosSession,
} from '@/lib/pos-session';
import {
  persistWaiterHeldOrder,
  printWaiterKitchen,
} from '@/lib/waiter-kitchen';
import { nextWebPosTicketNumber, webPosBackendOrderId } from '@/lib/webpos-receipt';
import { findHeldOrderForTable, parseHeldCartJson, buildHeldTableInfoMap, releaseHeldOrder } from '@/lib/webpos-held';
import type { TableHeldDisplay } from '@/components/webpos/WebPosTablesView';
import { resolveCartCheckoutGuard } from '@/lib/order-to-cart';
import type { MerchantOrder } from '@/lib/order-management';
import {
  pushCartLinesToKds,
  fetchKdsBoardStatus,
  buildKdsReadyMap,
  collectReadyLineIds,
  applyKdsReadyToCart,
  cartLineKitchenReady,
} from '@/lib/kds-push';
import { kitchenTicketKeyBase } from '@/lib/kitchen-progress';
import WebPosPinModal from '@/components/WebPosPinModal';
import WebPosBlockingAlert from '@/components/WebPosBlockingAlert';
import WebPosTablesView from '@/components/webpos/WebPosTablesView';
import WebPosProductArea from '@/components/webpos/WebPosProductArea';
import WebPosProductModifiersModal, {
  productHasModifiers,
  type ShopProductForModifiers,
} from '@/components/webpos/WebPosProductModifiersModal';
import type { CartLine, Category, PosCategoryId, PosChannel, Product } from '@/components/webpos/types';
import type { Permission } from '@/lib/permissions';
import type { ShopSelectedExtra } from '@/lib/shop-cart';

type WaiterTab = 'tables' | 'order';

function money(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

export default function WaiterApp({ appMode = true }: { appMode?: boolean }) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const merchantId = authUser?.merchantId;
  const jwtIsOwner = isMerchantOwnerJwt(authUser);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'gate' | 'switch'>('gate');
  const [posAuthAlert, setPosAuthAlert] = useState<{
    title?: string;
    message: string;
    variant?: 'error' | 'warning';
  } | null>(null);
  const [staffConfigured, setStaffConfigured] = useState(false);
  const [staffPinsKnown, setStaffPinsKnown] = useState(false);
  const [tab, setTab] = useState<WaiterTab>('tables');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [printSettings, setPrintSettings] = useState<Record<string, unknown> | null>(null);
  const [categoryId, setCategoryId] = useState<PosCategoryId>('all');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [channel, setChannel] = useState<PosChannel>('dine_in');
  const [tableId, setTableId] = useState<string | null>(null);
  const [tableLabel, setTableLabel] = useState<string | null>(null);
  const [ticketDisplay, setTicketDisplay] = useState<string | null>(null);
  const [ticketOrderNumber, setTicketOrderNumber] = useState<string | null>(null);
  const [orderNote, setOrderNote] = useState('');
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [sending, setSending] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false
  );
  const [heldTableIds, setHeldTableIds] = useState<string[]>([]);
  const [heldTableInfo, setHeldTableInfo] = useState<Record<string, TableHeldDisplay>>({});
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const activeHeldIdRef = useRef<string | null>(null);
  const paidBlockedRef = useRef(false);

  const pinRequired = webPosPinGateRequired({
    hasStaffPins: staffConfigured,
    pinSession: staff,
  });

  const openPinGate = useCallback(() => {
    setPinModalMode('gate');
    setPinModalOpen(true);
  }, []);

  const openPinSwitch = useCallback(() => {
    if (!staffConfigured) return;
    setPinModalMode('switch');
    setPinModalOpen(true);
  }, [staffConfigured]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsPhoneLayout(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const showBackOffice = canStaffOpenBackOffice(
    (staff?.permissions ?? authUser?.permissions) as Permission[] | undefined,
    authUser?.loginHome,
    jwtIsOwner
  );

  useEffect(() => {
    if (!staffPinsKnown) return;
    if (pinRequired) {
      clearPosSessionLocal();
      return;
    }
    void registerPosSession({
      sessionKind: 'waiter',
      platform: 'waiter_web',
      staffId: staff?.id || null,
      staffName: staff?.name || null,
    }).then((result) => {
      if (result.ok && result.kickedSessionIds.length > 0) {
        toast.info(t('webPosSessionReclaimed'));
      }
    });
  }, [staffPinsKnown, pinRequired, staff?.id, staff?.name, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [staffRes, configRes, catRes, prodRes] = await Promise.all([
          api.get('/merchant/staff'),
          api.get('/merchant/webpos-config'),
          api.get('/merchant/categories'),
          api.get('/merchant/products', { params: { limit: 500 } }),
        ]);
        if (cancelled) return;
        const list = (staffRes.data?.staff || []) as StaffRosterRow[];
        setStaffConfigured(list.some((s) => !!(s as { pinSet?: boolean }).pinSet));
        setStaffPinsKnown(true);
        const session = resolveWebPosStaffSession({
          staffList: list,
          authStaffId: authUser?.staffId,
          authRole: authUser?.role,
          authPermissions: authUser?.permissions,
        });
        setStaff(session);
        if (session) notifyWebPosStaffSessionChanged();
        setCategories(catRes.data?.categories || []);
        setProducts(prodRes.data?.products || []);
        setPrintSettings(configRes.data?.config?.posPrintSettings || null);
        cacheMerchantAutoPrintSettings(
          (configRes.data?.config?.posPrintSettings as { autoPrintKitchen?: boolean; autoPrintReceipt?: boolean } | undefined) || null
        );
      } catch (e: any) {
        toast.error(e.response?.data?.error || t('webPosLoadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, authUser?.staffId, authUser?.role, authUser?.permissions]);

  useEffect(() => {
    if (!loading && pinRequired) openPinGate();
  }, [loading, pinRequired, openPinGate]);

  useEffect(() => {
    let cancelled = false;
    const refreshHeldTables = async () => {
      try {
        const res = await api.get('/merchant/pos/held');
        if (cancelled) return;
        const rows = (res.data?.held || []) as Array<{
          cartJson?: Record<string, unknown> | null;
          staffName?: string | null;
          updatedAt?: string | null;
          createdAt?: string | null;
        }>;
        const ids = new Set<string>();
        for (const h of rows) {
          const tid = parseHeldCartJson(h.cartJson).tableId;
          if (typeof tid === 'string' && tid) ids.add(tid);
        }
        setHeldTableIds([...ids]);
        const infoMap = buildHeldTableInfoMap(rows);
        const display: Record<string, TableHeldDisplay> = {};
        for (const [tid, info] of Object.entries(infoMap)) {
          display[tid] = { staffName: info.staffName, itemCount: info.itemCount };
        }
        setHeldTableInfo(display);
      } catch {
        /* ignore */
      }
    };
    void refreshHeldTables();
    if (tab !== 'tables') {
      return () => {
        cancelled = true;
      };
    }
    const timer = window.setInterval(() => void refreshHeldTables(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ordersRefresh, tab]);

  const cartQtyByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of cart) {
      m.set(l.productId, (m.get(l.productId) || 0) + l.quantity);
    }
    return m;
  }, [cart]);

  const cartTotal = useMemo(
    () => roundMoney2(cart.reduce((s, l) => s + Number(l.lineTotal || 0), 0)),
    [cart]
  );

  const ensureTicket = useCallback(() => {
    const display = ticketDisplay?.trim();
    if (display) {
      if (ticketOrderNumber?.trim()) {
        return { display, orderNumber: ticketOrderNumber.trim() };
      }
      const orderNumber = webPosBackendOrderId(merchantId);
      setTicketOrderNumber(orderNumber);
      return { display, orderNumber };
    }
    const ticket = nextWebPosTicketNumber(merchantId);
    setTicketDisplay(ticket.display);
    setTicketOrderNumber(ticket.orderNumber);
    return ticket;
  }, [ticketDisplay, ticketOrderNumber, merchantId]);

  const waiterKdsTicketKey = kitchenTicketKeyBase(ticketDisplay || ticketOrderNumber || '');
  const [kdsReadyMap, setKdsReadyMap] = useState<Map<string, Set<string>>>(() => new Map());

  useEffect(() => {
    const hasSent = cart.some((l) => l.sentToKitchen);
    if (!hasSent) return;
    let cancelled = false;
    const syncReady = async () => {
      const board = await fetchKdsBoardStatus();
      if (cancelled) return;
      setKdsReadyMap(buildKdsReadyMap(board));
      const readyIds = collectReadyLineIds(board);
      if (!readyIds.size) return;
      setCart((prev) => applyKdsReadyToCart(prev, [...readyIds]));
    };
    void syncReady();
    const timer = window.setInterval(() => void syncReady(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cart.filter((l) => l.sentToKitchen).length, waiterKdsTicketKey]);

  /** Sync in-progress table/takeaway carts to /merchant/pos/held so main till Orders → Active lists them. */
  useEffect(() => {
    if (loading || pinRequired || tab !== 'order' || !cart.length || sending || paidBlockedRef.current) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const ticket = ensureTicket();
        try {
          const savedId = await persistWaiterHeldOrder({
            heldId: activeHeldIdRef.current,
            cartLines: cart,
            channel,
            tableId,
            tableLabel,
            ticketDisplay: ticket.display,
            ticketOrderNumber: ticket.orderNumber,
            staffId: staff?.id,
            staffName: staff?.name,
            sendToKitchen: cart.some((l) => l.sentToKitchen),
            orderNote,
            money,
          });
          if (cancelled) return;
          if (savedId) activeHeldIdRef.current = savedId;
          setOrdersRefresh((n) => n + 1);
        } catch (e) {
          console.warn('[waiter] held persist failed', e);
        }
      })();
    }, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    cart,
    channel,
    tableId,
    tableLabel,
    orderNote,
    tab,
    loading,
    pinRequired,
    sending,
    staff?.id,
    staff?.name,
    ensureTicket,
  ]);

  /** Clear cart when the same ticket was paid on another device (e.g. mobile checkout). */
  const clearPaidWaiterSession = useCallback(
    (order?: MerchantOrder | null) => {
      paidBlockedRef.current = true;
      const heldId = activeHeldIdRef.current;
      activeHeldIdRef.current = null;
      void releaseHeldOrder({
        heldId,
        ticketDisplay: ticketDisplay || order?.ticketDisplay,
        tableId,
        tabNumber: order?.tabNumber,
      });
      setCart([]);
      setTableId(null);
      setTableLabel(null);
      setTicketDisplay(null);
      setTicketOrderNumber(null);
      setOrderNote('');
      setTab('tables');
      setOrdersRefresh((n) => n + 1);
    },
    [ticketDisplay, tableId]
  );

  useEffect(() => {
    if (loading || pinRequired || tab !== 'order') return;
    const hasSent = cart.some((l) => l.sentToKitchen);
    if (!cart.length && !hasSent && !activeHeldIdRef.current && !ticketDisplay?.trim()) return;
    if (paidBlockedRef.current) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || paidBlockedRef.current) return;
      try {
        const res = await api.get('/merchant/orders', { params: { limit: 120 } });
        const orders = (res.data?.orders || []) as MerchantOrder[];
        const guard = resolveCartCheckoutGuard(
          orders,
          {
            ticketDisplay,
            tabNumber: null,
            tableId,
            ticketOrderNumber,
          },
          { requireSent: hasSent || !!activeHeldIdRef.current }
        );
        if (guard.action === 'blocked') {
          const num =
            guard.order.ticketDisplay?.trim() ||
            guard.order.orderNumber?.trim() ||
            '';
          toast.error(t('webPosOrderAlreadyPaid').replace('{number}', num));
          clearPaidWaiterSession(guard.order);
        }
      } catch {
        /* best-effort */
      }
    };
    void poll();
    const timer = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    cart,
    ticketDisplay,
    tableId,
    ticketOrderNumber,
    tab,
    loading,
    pinRequired,
    clearPaidWaiterSession,
    t,
  ]);

  const pushLine = (
    p: Product,
    unitPrice: number,
    selectedExtras: ShopSelectedExtra[] = [],
    qty = 1
  ) => {
    const q = Math.max(1, qty);
    const lineTotal = roundMoney2(unitPrice * q);
    setCart((prev) => [
      ...prev,
      {
        lineId: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productId: p.id,
        name: p.name,
        quantity: q,
        unitPrice,
        lineTotal,
        taxable: p.isTaxable !== false,
        categoryId: p.categoryId,
        selectedExtras,
        comboSelections: [],
      },
    ]);
  };

  const onProductClick = (p: Product) => {
    if (productHasModifiers(p as ShopProductForModifiers)) {
      setPendingProduct({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        allowExtras: p.allowExtras,
        extras: p.extras,
        modifierGroups: p.modifierGroups,
        specifications: p.specifications,
      });
      return;
    }
    pushLine(p, roundMoney2(Number(p.price) || 0));
  };

  const adjustQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.lineId !== lineId || l.sentToKitchen) return l;
          const q = Math.max(0, l.quantity + delta);
          if (q <= 0) return null;
          return {
            ...l,
            quantity: q,
            lineTotal: roundMoney2(l.unitPrice * q),
          };
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const loadHeldForTable = async (targetTableId: string) => {
    const res = await api.get('/merchant/pos/held');
    const rows = (res.data?.held || []) as Array<{ id: string; cartJson?: unknown; status?: string; updatedAt?: string; createdAt?: string }>;
    return findHeldOrderForTable(targetTableId, rows);
  };

  const applyHeldOrder = (held: { id: string; cartJson?: unknown }, table: { id: string; label: string }) => {
    const meta = parseHeldCartJson(held.cartJson);
    activeHeldIdRef.current = held.id;
    setCart(meta.cart || []);
    setChannel((meta.channel as PosChannel) || 'dine_in');
    setTableId(table.id);
    setTableLabel(table.label || meta.tableLabel || null);
    setTicketDisplay(meta.ticketDisplay || null);
    setTicketOrderNumber(meta.ticketOrderNumber || meta.ticketDisplay || null);
    setOrderNote(meta.orderNote || '');
  };

  const selectTable = async (table: { id: string; label: string }) => {
    paidBlockedRef.current = false;
    try {
      const held = await loadHeldForTable(table.id);
      if (held) {
        applyHeldOrder(held, table);
      } else {
        activeHeldIdRef.current = null;
        setCart([]);
        setTableId(table.id);
        setTableLabel(table.label);
        setChannel('dine_in');
        setTicketDisplay(null);
        setTicketOrderNumber(null);
        setOrderNote('');
        ensureTicket();
        if (heldTableIds.includes(table.id)) {
          toast(t('waiterTableOccupiedEmpty'), { icon: '⚠️' });
        }
      }
      setTab('order');
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('webPosLoadFailed')
      );
    }
  };

  const startTakeaway = () => {
    paidBlockedRef.current = false;
    setTableId(null);
    setTableLabel(null);
    setChannel('takeaway');
    ensureTicket();
    setTab('order');
  };

  useEffect(() => {
    if (loading || pinRequired) return;
    const tableParam = searchParams.get('table');
    if (!tableParam || tableId === tableParam) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get('/merchant/floor-plans/tables');
        if (cancelled) return;
        const rows = (res.data?.tables || []) as Array<{ id: string; label: string }>;
        const row = rows.find((tbl) => tbl.id === tableParam);
        selectTable({
          id: tableParam,
          label: row?.label || tableParam.slice(0, 6).toUpperCase(),
        });
      } catch {
        if (!cancelled) {
          selectTable({
            id: tableParam,
            label: tableParam.slice(0, 6).toUpperCase(),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, pinRequired, searchParams, tableId]);

  const resetOrder = () => {
    paidBlockedRef.current = false;
    activeHeldIdRef.current = null;
    setCart([]);
    setTableId(null);
    setTableLabel(null);
    setChannel('dine_in');
    setTicketDisplay(null);
    setTicketOrderNumber(null);
    setOrderNote('');
    setTab('tables');
  };

  useEffect(() => {
    const onKicked = () => {
      clearPosSessionLocal();
      clearWebPosStaffSession();
      setStaff(null);
      notifyWebPosStaffSessionChanged();
      resetOrder();
      setPosAuthAlert({
        title: t('webPosSessionKickedTitle'),
        message: t('webPosSessionKickedReclaim'),
        variant: 'warning',
      });
      openPinGate();
    };
    window.addEventListener(POS_SESSION_KICKED_EVENT, onKicked);
    return () => window.removeEventListener(POS_SESSION_KICKED_EVENT, onKicked);
  }, [t, openPinGate]);

  const onPinSuccess = async (s: {
    id: string;
    name: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    accessToken?: string;
  }) => {
    const session: WebPosStaffSession = {
      id: s.id,
      name: s.name,
      roleId: s.roleId,
      roleName: s.roleName,
      permissions: s.permissions as WebPosStaffSession['permissions'],
      accessToken: s.accessToken,
    };
    if (!hasPermission(session.permissions, 'USE_WEBPOS')) {
      toast.error(t('waiterNoPermission'));
      return;
    }
    setPosAuthAlert(null);
    clearPosSessionLocal();
    clearWebPosStaffSession();
    const reg = await registerPosSession({
      sessionKind: 'waiter',
      platform: 'waiter_web',
      staffId: session.id,
      staffName: session.name,
    });
    if (!reg.ok) {
      const schemaLag = /Failed query|does not exist|location_id|pos_sessions/i.test(
        reg.error || ''
      );
      if (!schemaLag) {
        setPosAuthAlert({
          title: t('webPosPinErrorTitle'),
          message: reg.error || t('webPosSessionRegisterFailed'),
          variant: 'error',
        });
        openPinGate();
        return;
      }
      console.warn('[waiter] session register skipped (schema):', reg.error);
    }
    saveWebPosStaffSession(session);
    setStaff(session);
    notifyWebPosStaffSessionChanged();
    setPinModalOpen(false);
    if (reg.ok && reg.kickedSessionIds.length > 0) {
      toast.info(t('webPosSessionReclaimed'));
    }
  };

  const handleSwitchUser = async () => {
    await revokePosSession();
    clearWebPosStaffSession();
    setStaff(null);
    notifyWebPosStaffSessionChanged();
    resetOrder();
    openPinSwitch();
  };

  const handleLogout = async () => {
    await revokePosSession();
    logout();
    navigate('/login', { replace: true });
  };

  const sendToKitchen = async () => {
    const unsent = cart.filter((l) => !l.sentToKitchen);
    if (!unsent.length) {
      toast.error(t('waiterNothingToSend'));
      return;
    }
    if (!hasPermission(staff?.permissions, 'SEND_KITCHEN')) {
      toast.error(t('waiterNoKitchenPermission'));
      return;
    }
    setSending(true);
    const ticket = ensureTicket();
    try {
      const sentAt = Date.now();
      const nextCart = cart.map((l) =>
        unsent.some((u) => u.lineId === l.lineId)
          ? { ...l, sentToKitchen: true, sentToKitchenAt: sentAt }
          : l
      );
      void pushCartLinesToKds({
        ticketKey: ticket.display,
        orderNumber: ticket.display,
        tableLabel,
        tabNumber: null,
        channel,
        lines: unsent,
      });
      await printWaiterKitchen({
        lines: unsent,
        channel,
        printSettings: printSettings as Parameters<typeof printWaiterKitchen>[0]['printSettings'],
        locale,
        staffName: staff?.name,
        tableLabel,
        orderNumber: ticket.display,
        t,
      });
      const savedId = await persistWaiterHeldOrder({
        heldId: activeHeldIdRef.current,
        cartLines: nextCart,
        channel,
        tableId,
        tableLabel,
        ticketDisplay: ticket.display,
        ticketOrderNumber: ticket.orderNumber,
        staffId: staff?.id,
        staffName: staff?.name,
        sendToKitchen: true,
        orderNote,
        money,
      });
      if (savedId) activeHeldIdRef.current = savedId;
      setCart(nextCart);
      setOrdersRefresh((n) => n + 1);
      toast.success(t('waiterSentToKitchen'));
    } catch (e: any) {
      toastPrintError(e, t, 'webPosKitchenPrintFailed');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-stone-500">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div
      className={`waiter-shell flex h-full min-h-0 flex-col bg-stone-950 text-stone-100 ${
        appMode ? 'waiter-app-mode' : ''
      }`}
      data-narrow={isPhoneLayout ? '1' : undefined}
      data-grid-step="0"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-800 px-3 py-2 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-stone-500 sm:text-xs">{t('waiterAppTitle')}</p>
          <div className="flex items-center gap-1.5">
            <p className="truncate font-semibold">{staff?.name || t('waiterAppSubtitle')}</p>
            {staffConfigured && staff ? (
              <button
                type="button"
                onClick={() => void handleSwitchUser()}
                className="inline-flex shrink-0 items-center justify-center rounded-md p-0.5 text-emerald-300 hover:bg-stone-800"
                aria-label={t('webPosSwitchUser')}
                title={t('webPosSwitchUser')}
              >
                <UserCircle2 size={16} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showBackOffice ? (
            <button
              type="button"
              onClick={() => navigate(backOfficeHomePath(staff?.permissions, false))}
              className="hidden items-center gap-2 rounded-xl border border-stone-700 px-3 py-2 text-sm sm:inline-flex"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
              {t('webPosBackOffice')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-700 px-2.5 py-2 text-sm sm:gap-2 sm:px-3"
            aria-label={t('logout')}
            title={t('logout')}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {tab === 'tables' ? (
          <div className="flex min-h-0 flex-1 flex-col p-3">
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={startTakeaway}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-semibold text-white"
              >
                <ShoppingBag className="h-6 w-6" aria-hidden />
                {t('waiterTakeaway')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-stone-800 bg-stone-900">
              <WebPosTablesView
                onSelectTable={selectTable}
                selectedTableId={tableId}
                draftTableIds={heldTableIds}
                tableHeldInfo={heldTableInfo}
                refreshToken={ordersRefresh}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col border-stone-800 lg:min-h-0 lg:flex-row">
              <div className="flex min-h-0 flex-1 flex-col border-stone-800 lg:border-r">
                <div className="flex shrink-0 items-center gap-2 border-b border-stone-800 px-3 py-2 text-sm">
                  {tableLabel ? (
                    <span className="rounded-full bg-stone-800 px-3 py-1">{tableLabel}</span>
                  ) : channel === 'takeaway' ? (
                    <span className="rounded-full bg-amber-900/50 px-3 py-1">{t('waiterTakeaway')}</span>
                  ) : null}
                  {ticketDisplay && (
                    <span className="text-stone-400">{ticketDisplay}</span>
                  )}
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-2 max-lg:max-h-[42vh]">
                  <WebPosProductArea
                    categories={categories}
                    products={products}
                    categoryId={categoryId}
                    onCategoryChange={setCategoryId}
                    onProductClick={onProductClick}
                    cartQtyByProduct={cartQtyByProduct}
                    productHasCombo={() => false}
                    productHasMods={(p) => productHasModifiers(p as ShopProductForModifiers)}
                    tileSize={isPhoneLayout ? 'md' : 'lg'}
                    isPhoneLayout={isPhoneLayout}
                    mobileGridStep={0}
                    showProductImages
                  />
                </div>
              </div>

            <aside className="flex w-full max-h-[48vh] shrink-0 flex-col border-t border-stone-800 lg:max-h-none lg:w-80 lg:border-t-0">
              <div className="border-b border-stone-800 px-4 py-3">
                <p className="text-sm font-semibold">{t('waiterCart')}</p>
                <p className="text-2xl font-bold tabular-nums">{money(cartTotal)}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-500">{t('waiterCartEmpty')}</p>
                ) : (
                  <ul className="space-y-2">
                    {cart.map((line) => {
                      const isKitchenReady = cartLineKitchenReady(
                        line,
                        waiterKdsTicketKey ? [waiterKdsTicketKey] : [],
                        kdsReadyMap
                      );
                      return (
                      <li
                        key={line.lineId}
                        className="flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {isKitchenReady ? (
                              <ChefHat
                                className="mr-1 inline-block h-4 w-4 shrink-0 text-emerald-400"
                                aria-label={t('webPosReadyBadge')}
                              />
                            ) : null}
                            {line.name}
                            {line.sentToKitchen ? (
                              <span className="ml-1 rounded bg-stone-800 px-1 text-[9px] font-bold uppercase text-stone-400">
                                {isKitchenReady ? t('webPosReadyBadge') : t('webPosSentBadge')}
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-stone-400">{money(line.lineTotal)}</p>
                        </div>
                        {!line.sentToKitchen && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded-lg bg-stone-800 p-2"
                              onClick={() => adjustQty(line.lineId, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-6 text-center tabular-nums">{line.quantity}</span>
                            <button
                              type="button"
                              className="rounded-lg bg-stone-800 p-2"
                              onClick={() => adjustQty(line.lineId, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="space-y-2 border-t border-stone-800 p-3">
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder={t('waiterOrderNote')}
                  rows={2}
                  className="w-full rounded-xl border border-stone-700 bg-stone-900 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={sending || !cart.some((l) => !l.sentToKitchen)}
                  onClick={() => void sendToKitchen()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-base font-semibold text-white disabled:opacity-40 sm:py-4 sm:text-lg"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <UtensilsCrossed className="h-5 w-5" />
                  )}
                  {t('waiterSendKitchen')}
                </button>
                <button
                  type="button"
                  onClick={resetOrder}
                  className="w-full rounded-xl border border-stone-700 py-2 text-sm"
                >
                  {t('waiterNewOrder')}
                </button>
              </div>
            </aside>
            </div>
          </>
        )}
      </div>

      <nav className="flex shrink-0 border-t border-stone-800 bg-stone-950">
        {(
          [
            ['tables', Table2, t('waiterTabTables')],
            ['order', UtensilsCrossed, t('waiterTabOrder')],
          ] as const
        ).map(([key, Icon, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              if (key === 'tables') setOrdersRefresh((n) => n + 1);
            }}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs ${
              tab === key ? 'text-emerald-400' : 'text-stone-500'
            }`}
          >
            <Icon className="h-6 w-6" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <WebPosBlockingAlert
        open={!!posAuthAlert}
        title={posAuthAlert?.title}
        message={posAuthAlert?.message || ''}
        variant={posAuthAlert?.variant || 'error'}
        onDismiss={() => setPosAuthAlert(null)}
        minMs={posAuthAlert?.variant === 'warning' ? 4000 : 8000}
      />
      <WebPosPinModal
        open={pinModalOpen}
        mode={pinModalMode}
        onClose={() => setPinModalOpen(false)}
        onSuccess={onPinSuccess}
      />

      {pendingProduct && (
        <WebPosProductModifiersModal
          product={pendingProduct}
          showProductImages
          onClose={() => setPendingProduct(null)}
          onConfirm={({ selectedExtras, unitPrice, quantity }) => {
            const prod = products.find((p) => p.id === pendingProduct.id);
            if (prod) pushLine(prod, unitPrice, selectedExtras, quantity);
            setPendingProduct(null);
          }}
        />
      )}
    </div>
  );
}
