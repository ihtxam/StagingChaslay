import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  ChevronDown,
  CreditCard,
  Loader2,
  Plus,
  QrCode,
  Settings,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import ShopProductModifiersModal, {
  productHasModifiers,
  type ShopProductForModifiers,
} from '@/components/shop/ShopProductModifiersModal';
import { startQrCameraScan } from '@/lib/qr-camera-scan';
import {
  createKioskOrder,
  fetchKioskConfig,
  fetchKioskMenu,
  lookupKioskMembership,
  payKioskOrderAtTerminal,
  verifyKioskAdminPin,
  type KioskCartLine,
  type KioskConfig,
  type KioskMenuCategory,
} from '@/lib/kiosk-api';
import { useI18n, type Locale } from '@/lib/i18n';
import { setKioskAdminUnlocked } from '@/lib/kiosk-admin-session';

type Step =
  | 'attract'
  | 'table-badge'
  | 'membership'
  | 'menu'
  | 'cart-review'
  | 'checkout'
  | 'success';

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
};

function money(n: number): string {
  return `CHF ${n.toFixed(2)}`;
}

function lineTotal(line: KioskCartLine): number {
  const extras = (line.selectedExtras || []).reduce((s, e) => s + e.price, 0);
  return (line.price + extras) * line.quantity;
}

export default function KioskApp() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { locale, setLocale } = useI18n();
  const [step, setStep] = useState<Step>('attract');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [menu, setMenu] = useState<KioskMenuCategory[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const [tableMode, setTableMode] = useState<'table' | 'badge'>('table');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [membership, setMembership] = useState<{ id: string; holderName?: string } | null>(null);
  const [scanningMembership, setScanningMembership] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [cart, setCart] = useState<KioskCartLine[]>([]);
  const [modifierProduct, setModifierProduct] = useState<ShopProductForModifiers | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [adminPinOpen, setAdminPinOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinSubmitting, setAdminPinSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimer = useRef<number | null>(null);

  const slides = config?.settings.promoSlides?.length
    ? config.settings.promoSlides
    : [{ title: config?.merchant.name || 'Welcome', subtitle: 'Tap Start order to begin' }];

  const enabledLangs = config?.settings.enabledLanguages || ['en'];
  const cashEnabled = config?.settings.cashPaymentEnabled !== false;
  const cardEnabled = config?.settings.cardPaymentEnabled !== false;
  const cartTotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart]);

  const activeCategory = menu.find((c) => c.id === activeCategoryId) || menu[0];
  const tableLabel =
    config?.tables.find((t) => t.id === selectedTableId)?.label || selectedTableId;

  const resetSession = useCallback(() => {
    setStep('attract');
    setTableMode('table');
    setSelectedTableId('');
    setBadgeNumber('');
    setMembership(null);
    setCart([]);
    setOrderId('');
    setOrderNumber('');
    setModifierProduct(null);
  }, []);

  const bumpIdle = useCallback(() => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    const secs = config?.settings.idleTimeoutSeconds ?? 120;
    if (step !== 'attract' && step !== 'success') {
      idleTimer.current = window.setTimeout(resetSession, secs * 1000);
    }
  }, [config?.settings.idleTimeoutSeconds, resetSession, step]);

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await fetchKioskConfig(token);
        setConfig(cfg);
        setLocale((cfg.settings.defaultLanguage as Locale) || 'en');
        const cats = await fetchKioskMenu(token);
        setMenu(cats);
        if (cats[0]?.id) setActiveCategoryId(cats[0].id);
        if (cfg.settings.tableMode === 'badge') setTableMode('badge');
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        toast.error(err.response?.data?.error || 'Kiosk unavailable');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, setLocale]);

  useEffect(() => {
    if (step !== 'attract') return;
    const timer = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [step, slides.length]);

  useEffect(() => {
    bumpIdle();
    const events = ['pointerdown', 'keydown', 'touchstart'];
    const handler = () => bumpIdle();
    events.forEach((e) => window.addEventListener(e, handler));
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [bumpIdle]);

  useEffect(() => {
    if (!scanningMembership || !videoRef.current) return;
    let stream: MediaStream | null = null;
    let scanHandle: { stop: () => void } | null = null;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        scanHandle = startQrCameraScan(video, (raw) => {
          void (async () => {
            try {
              const card = await lookupKioskMembership(token, raw.trim());
              setMembership({ id: card.id, holderName: card.holderName || card.customerName });
              setScanningMembership(false);
              setStep('menu');
            } catch {
              toast.error('Membership not found');
            }
          })();
          return true;
        });
      } catch {
        toast.error('Camera access required for membership scan');
        setScanningMembership(false);
      }
    })();
    return () => {
      scanHandle?.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanningMembership, token]);

  const addProduct = (item: KioskMenuCategory['items'][number]) => {
    const asModifier: ShopProductForModifiers = {
      id: item.id,
      name: item.name,
      price: item.price,
      description: item.description,
      image: item.image,
      modifierGroups: item.modifierGroups as ShopProductForModifiers['modifierGroups'],
    };
    if (productHasModifiers(asModifier)) {
      setModifierProduct(asModifier);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === item.id && !l.selectedExtras?.length);
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          id: `${item.id}-${Date.now()}`,
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const submitOrder = async (paymentMethod: 'cash' | 'card') => {
    if (!config || !cart.length) return;
    setSubmitting(true);
    try {
      const order = await createKioskOrder(config.merchant.slug, {
        kioskToken: token,
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          selectedExtras: (l.selectedExtras || []).map((e) => ({ id: e.id })),
        })),
        paymentMethod,
        tableId: tableMode === 'table' ? selectedTableId : undefined,
        badgeNumber: tableMode === 'badge' ? badgeNumber : undefined,
        locationSlug: config.settings.locationSlug || undefined,
        customerName:
          tableMode === 'badge' && badgeNumber
            ? `Badge ${badgeNumber}`
            : tableLabel
              ? `Table ${tableLabel}`
              : membership?.holderName || 'Kiosk guest',
      });
      const oid = order?.id;
      const onum = order?.orderNumber || '';
      if (!oid) throw new Error('Order was not created');
      setOrderId(oid);
      setOrderNumber(onum);
      if (paymentMethod === 'card') {
        await payKioskOrderAtTerminal(token, oid);
      }
      setStep('success');
      window.setTimeout(resetSession, 12000);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Order failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAdminPin = async () => {
    setAdminPinSubmitting(true);
    try {
      await verifyKioskAdminPin(token, adminPin);
      setKioskAdminUnlocked(token, adminPin);
      setAdminPinOpen(false);
      setAdminPin('');
      navigate(`/kiosk/${token}/admin`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Invalid code');
    } finally {
      setAdminPinSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 text-white">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-6 text-center text-white">
        <p className="text-xl font-semibold">Kiosk unavailable</p>
        <p className="mt-2 text-stone-400">Check the kiosk link or contact staff.</p>
      </div>
    );
  }

  const slide = slides[slideIndex % slides.length];

  return (
    <div className="flex min-h-screen flex-col bg-stone-100 text-stone-900 select-none touch-manipulation">
      {/* Top bar: promo slider + language */}
      <header className="relative overflow-hidden bg-stone-950 text-white">
        <div className="flex min-h-[120px] items-stretch">
          {slide.imageUrl ? (
            <img
              src={slide.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          ) : null}
          <div className="relative z-10 flex flex-1 flex-col justify-center px-6 py-4">
            <p className="text-2xl font-bold tracking-tight md:text-3xl">{slide.title}</p>
            {slide.subtitle ? (
              <p className="mt-1 text-sm text-stone-200 md:text-base">{slide.subtitle}</p>
            ) : null}
          </div>
          <div className="relative z-10 flex items-start gap-2 p-3">
            <button
              type="button"
              aria-label="Kiosk settings"
              onClick={() => setAdminPinOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white hover:bg-black/60"
            >
              <Settings className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="flex h-11 items-center gap-1 rounded-full border border-white/30 bg-black/40 px-4 text-sm font-semibold uppercase"
              >
                {locale}
                <ChevronDown className="h-4 w-4" />
              </button>
              {langOpen ? (
                <ul className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-stone-700 bg-stone-900 shadow-xl">
                  {enabledLangs.map((code) => (
                    <li key={code}>
                      <button
                        type="button"
                        className="block w-full px-4 py-3 text-left text-sm hover:bg-stone-800"
                        onClick={() => {
                          setLocale(code as Locale);
                          setLangOpen(false);
                        }}
                      >
                        {LANG_LABELS[code] || code.toUpperCase()}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {step !== 'attract' && step !== 'success' ? (
              <div className="flex h-11 items-center rounded-full bg-emerald-500 px-4 text-sm font-bold text-white">
                {money(cartTotal)}
                <ShoppingBag className="ml-2 h-4 w-4" />
                <span className="ml-1">{cartCount}</span>
              </div>
            ) : null}
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="relative z-10 flex justify-center gap-2 pb-3">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${i === slideIndex ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        {step === 'attract' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
            <UtensilsCrossed className="h-20 w-20 text-emerald-600" strokeWidth={1.5} />
            <h1 className="text-center text-4xl font-bold">{config.merchant.name}</h1>
            <p className="max-w-md text-center text-lg text-stone-600">
              Order here — pay at the counter or by card on our terminal.
            </p>
            <button
              type="button"
              onClick={() => setStep('table-badge')}
              className="rounded-2xl bg-emerald-600 px-16 py-5 text-2xl font-bold text-white shadow-lg active:scale-[0.98]"
            >
              Start order
            </button>
          </div>
        ) : null}

        {step === 'table-badge' ? (
          <div className="flex flex-1 flex-col p-6 md:p-10">
            <h2 className="text-3xl font-bold">Where are you sitting?</h2>
            <p className="mt-2 text-stone-600">Choose your table or enter your table badge number.</p>
            {config.settings.tableMode === 'both' ? (
              <div className="mt-6 flex gap-3">
                {(['table', 'badge'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTableMode(mode)}
                    className={`flex-1 rounded-xl border-2 py-4 text-lg font-semibold ${
                      tableMode === mode
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    {mode === 'table' ? 'Table' : 'Badge number'}
                  </button>
                ))}
              </div>
            ) : null}
            {tableMode === 'table' ? (
              <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {config.tables.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTableId(t.id)}
                    className={`rounded-xl border-2 py-6 text-xl font-bold ${
                      selectedTableId === t.id
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-8">
                <label className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                  Badge number on your table
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={badgeNumber}
                  onChange={(e) => setBadgeNumber(e.target.value)}
                  className="mt-2 w-full max-w-xs rounded-2xl border-2 border-stone-200 bg-white px-6 py-5 text-4xl font-bold"
                  placeholder="12"
                />
              </div>
            )}
            <div className="mt-auto flex gap-4 pt-8">
              <button type="button" onClick={resetSession} className="kiosk-btn-secondary flex-1">
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </button>
              <button
                type="button"
                disabled={tableMode === 'table' ? !selectedTableId : !badgeNumber.trim()}
                onClick={() =>
                  setStep(config.settings.membershipScanEnabled ? 'membership' : 'menu')
                }
                className="kiosk-btn-primary flex-[2]"
              >
                Continue <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 'membership' ? (
          <div className="flex flex-1 flex-col items-center p-6 md:p-10">
            <QrCode className="h-16 w-16 text-emerald-600" />
            <h2 className="mt-4 text-3xl font-bold">Member rewards</h2>
            <p className="mt-2 max-w-lg text-center text-stone-600">
              Scan your membership QR code to earn points on this order.
            </p>
            {scanningMembership ? (
              <video ref={videoRef} className="mt-6 max-h-64 w-full max-w-md rounded-2xl bg-black" muted playsInline />
            ) : (
              <button
                type="button"
                onClick={() => setScanningMembership(true)}
                className="kiosk-btn-primary mt-8 min-w-[240px]"
              >
                Scan QR code
              </button>
            )}
            <div className="mt-auto flex w-full max-w-lg gap-4 pt-8">
              <button type="button" onClick={() => setStep('table-badge')} className="kiosk-btn-secondary flex-1">
                Back
              </button>
              <button type="button" onClick={() => setStep('menu')} className="kiosk-btn-secondary flex-1">
                Skip
              </button>
            </div>
          </div>
        ) : null}

        {step === 'menu' ? (
          <div className="flex flex-1 overflow-hidden">
            <nav className="w-36 shrink-0 overflow-y-auto border-r border-stone-200 bg-white md:w-48">
              {menu.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategoryId(cat.id)}
                  className={`block w-full border-b border-stone-100 px-3 py-4 text-left text-sm font-semibold md:px-4 md:text-base ${
                    activeCategory?.id === cat.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </nav>
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <h2 className="mb-4 text-2xl font-bold">{activeCategory?.name}</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {(activeCategory?.items || []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addProduct(item)}
                      className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm active:scale-[0.98]"
                    >
                      {item.image ? (
                        <img src={item.image} alt="" className="h-28 w-full object-cover md:h-36" />
                      ) : (
                        <div className="flex h-28 items-center justify-center bg-stone-100 md:h-36">
                          <Plus className="h-8 w-8 text-stone-400" />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-3">
                        <p className="font-semibold leading-tight">{item.name}</p>
                        <p className="mt-auto pt-2 text-lg font-bold text-emerald-700">
                          {money(item.price)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-stone-200 bg-white p-4">
                <button type="button" onClick={() => setStep('membership')} className="kiosk-btn-secondary">
                  Back
                </button>
                <button
                  type="button"
                  disabled={!cart.length}
                  onClick={() => setStep('cart-review')}
                  className="kiosk-btn-primary ml-auto min-w-[160px]"
                >
                  Review order <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'cart-review' ? (
          <div className="flex flex-1 flex-col p-6 md:p-10">
            <h2 className="text-3xl font-bold">Your order</h2>
            <ul className="mt-6 flex-1 space-y-3 overflow-y-auto">
              {cart.map((line) => (
                <li
                  key={line.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-4"
                >
                  <div>
                    <p className="font-semibold">
                      {line.quantity}× {line.name}
                    </p>
                    {(line.selectedExtras || []).map((e) => (
                      <p key={e.id} className="text-sm text-stone-500">
                        + {e.name}
                      </p>
                    ))}
                  </div>
                  <p className="text-lg font-bold">{money(lineTotal(line))}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-right text-3xl font-bold">{money(cartTotal)}</p>
            <div className="mt-6 flex gap-4">
              <button type="button" onClick={() => setStep('menu')} className="kiosk-btn-secondary flex-1">
                Back to menu
              </button>
              <button type="button" onClick={() => setStep('checkout')} className="kiosk-btn-primary flex-[2]">
                Checkout
              </button>
            </div>
          </div>
        ) : null}

        {step === 'checkout' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 md:p-10">
            <h2 className="text-3xl font-bold">How would you like to pay?</h2>
            <p className="text-4xl font-bold text-emerald-700">{money(cartTotal)}</p>
            <div className="grid w-full max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
              {cashEnabled ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitOrder('cash')}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white p-8 active:scale-[0.98]"
              >
                <Banknote className="h-12 w-12 text-amber-600" />
                <span className="text-xl font-bold">Pay with cash</span>
                <span className="text-sm text-stone-500">Pay at the counter</span>
              </button>
              ) : null}
              {cardEnabled ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitOrder('card')}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-8 active:scale-[0.98]"
              >
                <CreditCard className="h-12 w-12 text-emerald-700" />
                <span className="text-xl font-bold">Pay by card</span>
                <span className="text-sm text-stone-500">Use payment terminal</span>
              </button>
              ) : null}
            </div>
            {!cashEnabled && !cardEnabled ? (
              <p className="text-center text-stone-600">No payment methods are enabled for this kiosk.</p>
            ) : null}
            {submitting ? (
              <p className="flex items-center gap-2 text-stone-600">
                <Loader2 className="h-5 w-5 animate-spin" /> Processing…
              </p>
            ) : null}
            <button type="button" onClick={() => setStep('cart-review')} className="kiosk-btn-secondary mt-4">
              Back
            </button>
          </div>
        ) : null}

        {step === 'success' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-emerald-100 p-6">
              <ShoppingBag className="h-16 w-16 text-emerald-600" />
            </div>
            <h2 className="text-4xl font-bold">Thank you!</h2>
            {orderNumber ? (
              <p className="text-2xl text-stone-600">
                Order <span className="font-bold text-stone-900">#{orderNumber}</span>
              </p>
            ) : null}
            <p className="max-w-md text-stone-600">
              Your order has been sent to the kitchen. Please wait for your number to be called.
            </p>
          </div>
        ) : null}
      </main>

      {modifierProduct ? (
        <ShopProductModifiersModal
          product={modifierProduct}
          wide
          compact={false}
          touchLarge
          showProductImages
          onClose={() => setModifierProduct(null)}
          onConfirm={(extras, unitPrice, options) => {
            const qty = options?.qty ?? 1;
            setCart((prev) => [
              ...prev,
              {
                id: `${modifierProduct.id}-${Date.now()}`,
                productId: modifierProduct.id,
                name: modifierProduct.name,
                price: unitPrice,
                quantity: qty,
                selectedExtras: extras.map((e) => ({
                  id: e.id,
                  name: e.name,
                  price: e.price,
                })),
              },
            ]);
            setModifierProduct(null);
          }}
        />
      ) : null}

      {adminPinOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-stone-900 p-6 text-white shadow-2xl">
            <h2 className="text-xl font-bold">Kiosk back panel</h2>
            <p className="mt-2 text-sm text-stone-400">Enter admin code</p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              className="mt-4 w-full rounded-xl border-2 border-stone-600 bg-stone-800 px-4 py-3 text-center text-2xl tracking-widest"
              placeholder="••••"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border border-stone-600 px-4 py-3 font-semibold"
                onClick={() => {
                  setAdminPinOpen(false);
                  setAdminPin('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adminPin.length < 4 || adminPinSubmitting}
                onClick={() => void submitAdminPin()}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 font-semibold disabled:opacity-40"
              >
                {adminPinSubmitting ? 'Checking…' : 'Unlock'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
