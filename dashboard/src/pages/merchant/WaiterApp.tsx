import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2,
  LogOut,
  Minus,
  PanelLeft,
  Plus,
  ShoppingBag,
  Table2,
  UtensilsCrossed,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { toastPrintError } from '@/lib/webpos-print-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { roundMoney2 } from '@/lib/money';
import {
  readDeviceAutoPrintKitchen,
  writeDeviceAutoPrintKitchen,
} from '@/lib/webpos-print-relay';
import {
  backOfficeHomePath,
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
  nextWaiterTicketNumber,
  persistWaiterHeldOrder,
  printWaiterKitchen,
} from '@/lib/waiter-kitchen';
import WebPosPinModal from '@/components/WebPosPinModal';
import WebPosBlockingAlert from '@/components/WebPosBlockingAlert';
import WebPosTablesView from '@/components/webpos/WebPosTablesView';
import WebPosProductArea from '@/components/webpos/WebPosProductArea';
import WebPosProductModifiersModal, {
  productHasModifiers,
  type ShopProductForModifiers,
} from '@/components/webpos/WebPosProductModifiersModal';
import WaiterSettingsDropdown from '@/components/webpos/WaiterSettingsDropdown';
import type { CartLine, Category, PosCategoryId, PosChannel, Product } from '@/components/webpos/types';
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
  const jwtIsOwner = isMerchantOwnerJwt(authUser);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<WebPosStaffSession | null>(() => loadWebPosStaffSession());
  const [pinGateOpen, setPinGateOpen] = useState(false);
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoPrintKitchen, setAutoPrintKitchen] = useState(() => readDeviceAutoPrintKitchen(true));
  const [heldTableIds, setHeldTableIds] = useState<string[]>([]);
  const [ordersRefresh, setOrdersRefresh] = useState(0);

  const pinRequired = webPosPinGateRequired({
    hasStaffPins: staffConfigured,
    pinSession: staff,
  });

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
        const ps = configRes.data?.config?.posPrintSettings as { autoPrintKitchen?: boolean } | undefined;
        if (ps?.autoPrintKitchen != null) {
          setAutoPrintKitchen(readDeviceAutoPrintKitchen(ps.autoPrintKitchen !== false));
        }
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
    if (!loading && pinRequired) setPinGateOpen(true);
  }, [loading, pinRequired]);

  useEffect(() => {
    writeDeviceAutoPrintKitchen(autoPrintKitchen);
  }, [autoPrintKitchen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/merchant/pos/held');
        if (cancelled) return;
        const ids = new Set<string>();
        for (const h of (res.data?.held || []) as Array<{ cartJson?: Record<string, unknown> | null }>) {
          const tid = h.cartJson?.tableId;
          if (typeof tid === 'string' && tid) ids.add(tid);
        }
        setHeldTableIds([...ids]);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ordersRefresh]);

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
    if (ticketDisplay && ticketOrderNumber) {
      return { display: ticketDisplay, orderNumber: ticketOrderNumber };
    }
    const display = nextWaiterTicketNumber();
    setTicketDisplay(display);
    setTicketOrderNumber(display);
    return { display, orderNumber: display };
  }, [ticketDisplay, ticketOrderNumber]);

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

  const selectTable = (table: { id: string; label: string }) => {
    setTableId(table.id);
    setTableLabel(table.label);
    setChannel('dine_in');
    ensureTicket();
    setTab('order');
  };

  const startTakeaway = () => {
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
      setPinGateOpen(true);
    };
    window.addEventListener(POS_SESSION_KICKED_EVENT, onKicked);
    return () => window.removeEventListener(POS_SESSION_KICKED_EVENT, onKicked);
  }, [t]);

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
      setPosAuthAlert({
        title: t('webPosPinErrorTitle'),
        message: reg.error || t('webPosSessionRegisterFailed'),
        variant: 'error',
      });
      setPinGateOpen(true);
      return;
    }
    saveWebPosStaffSession(session);
    setStaff(session);
    notifyWebPosStaffSessionChanged();
    setPinGateOpen(false);
    if (reg.kickedSessionIds.length > 0) {
      toast.info(t('webPosSessionReclaimed'));
    }
  };

  const handleLogout = async () => {
    await revokePosSession();
    clearWebPosStaffSession();
    setStaff(null);
    notifyWebPosStaffSessionChanged();
    resetOrder();
    setPinGateOpen(true);
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
      await printWaiterKitchen({
        lines: unsent,
        channel,
        printSettings: printSettings as Parameters<typeof printWaiterKitchen>[0]['printSettings'],
        locale,
        staffName: staff?.name,
        tableLabel,
        orderNumber: ticket.orderNumber,
        t,
      });
      await persistWaiterHeldOrder({
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
      setCart(nextCart);
      setOrdersRefresh((n) => n + 1);
      toast.success(t('waiterSentToKitchen'));
      resetOrder();
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
    >
      <header className="flex shrink-0 items-center justify-between border-b border-stone-800 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">{t('waiterAppTitle')}</p>
          <p className="font-semibold">{staff?.name || t('waiterAppSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <WaiterSettingsDropdown
            open={settingsOpen}
            onToggle={() => setSettingsOpen((v) => !v)}
            onClose={() => setSettingsOpen(false)}
            autoPrintKitchen={autoPrintKitchen}
            onAutoPrintKitchenChange={setAutoPrintKitchen}
          />
          {hasPermission(staff?.permissions, 'MANAGE_PRODUCTS') ||
          hasPermission(staff?.permissions, 'VIEW_ORDER_HISTORY') ? (
            <button
              type="button"
              onClick={() => navigate(backOfficeHomePath(staff?.permissions, false))}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-700 px-3 py-2 text-sm"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
              {t('webPosBackOffice')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-700 px-3 py-2 text-sm"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t('logout')}
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
                refreshToken={ordersRefresh}
              />
            </div>
          </div>
        ) : (
          <>
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
              <div className="min-h-0 flex-1 overflow-auto p-2">
                <WebPosProductArea
                  categories={categories}
                  products={products}
                  categoryId={categoryId}
                  onCategoryChange={setCategoryId}
                  onProductClick={onProductClick}
                  cartQtyByProduct={cartQtyByProduct}
                  productHasCombo={() => false}
                  productHasMods={(p) => productHasModifiers(p as ShopProductForModifiers)}
                  tileSize="lg"
                  showProductImages
                />
              </div>
            </div>

            <aside className="flex w-full shrink-0 flex-col border-t border-stone-800 lg:w-80 lg:border-t-0">
              <div className="border-b border-stone-800 px-4 py-3">
                <p className="text-sm font-semibold">{t('waiterCart')}</p>
                <p className="text-2xl font-bold tabular-nums">{money(cartTotal)}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                {cart.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-500">{t('waiterCartEmpty')}</p>
                ) : (
                  <ul className="space-y-2">
                    {cart.map((line) => (
                      <li
                        key={line.lineId}
                        className="flex items-center gap-2 rounded-xl bg-stone-900 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{line.name}</p>
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
                    ))}
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-semibold text-white disabled:opacity-40"
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
        open={pinGateOpen}
        mode="gate"
        onClose={() => setPinGateOpen(false)}
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
