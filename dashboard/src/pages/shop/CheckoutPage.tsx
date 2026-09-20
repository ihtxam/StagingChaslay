import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  cartSubtotal,
  clearCart,
  clearCustomerToken,
  emptyDraft,
  groupCartForDisplay,
  loadCart,
  loadCustomerToken,
  removeOfferInstance,
  resolveShopKey,
  resolveShopLocationSlug,
  saveCart,
  saveCustomerToken,
  shopBasePath,
  shopCustomerAuthConfig,
  type ShopCheckoutDraft,
  type ShopChannel,
} from '@/lib/shop-cart';
import {
  buildScheduleDays,
  buildScheduleDayForDate,
  isChannelOpenAt,
  localDateTimeToIso,
  type StoreHours,
} from '@/lib/shop-hours';
import { roundMoney2, roundTo005, roundingAdjustment } from '@/lib/money';
import { formatShopChannelEta } from '@/lib/shop-eta';
import { adjustTaxForOrderDiscount } from '@/lib/tax-discount';
import { shopDocumentTitle } from '@/lib/brand';
import { localizedShopCopy } from '@/lib/shop-site-settings';
import { isLocale, useI18n } from '@/lib/i18n';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import ZipCityFields from '@/components/shop/ZipCityFields';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopDeliveryAddressPopup from '@/components/shop/ShopDeliveryAddressPopup';
import ShopPhoneField from '@/components/shop/ShopPhoneField';
import ShopPaymentModal from '@/components/shop/ShopPaymentModal';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import { SHOP_INPUT_CLASS, SHOP_LABEL_CLASS } from '@/lib/shop-input';
import { withDeliveryMinOrderStatus } from '@/lib/shop-delivery';
import ShopCartThresholdSlot from '@/components/shop/ShopCartThresholdSlot';
import { Check, ShoppingBag, Trophy } from 'lucide-react';
import {
  buildCategoryDeliveryPricingMap,
  resolveShopItemDeliveryMarkup,
} from '@/lib/shop-delivery-pricing';
import { normalizeAdyenPaymentSession, shopCheckoutOriginPayload } from '@/lib/adyen-checkout';

type WhenMode = 'asap' | 'later';
type FieldErrors = {
  customerName?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

function splitCustomerName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

function buildCustomerFullName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  zipCode?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

const ADDRESS_LABELS = ['home', 'office', 'other'] as const;

function showCheckoutError(message: string | null | undefined) {
  const text = String(message || '').trim();
  if (!text) return;
  toast.error(text);
}

type ShopAppliedOffer = {
  offerId?: string;
  name?: string;
  badgeLabel?: string | null;
  discount?: number;
  offerType?: string;
  description?: string | null;
};

function parseBuyGetLabel(label: string): { buy: number; get: number } | null {
  const m = String(label || '').match(/(\d+)\s*\+\s*(\d+)/);
  if (!m) return null;
  const buy = Number(m[1]);
  const get = Number(m[2]);
  if (!Number.isFinite(buy) || !Number.isFinite(get) || buy < 1 || get < 1) return null;
  return { buy, get };
}

function bestBogoProduct(
  items: { name: string; quantity: number; loyaltyReward?: boolean }[],
  buy: number,
  get: number
) {
  const group = buy + get;
  let best: { name: string; quantity: number; sets: number; free: number } | null = null;
  for (const item of items) {
    if (item.loyaltyReward) continue;
    const qty = Math.max(0, Number(item.quantity) || 0);
    const sets = Math.floor(qty / group);
    if (!best || sets > best.sets || (sets === best.sets && qty > best.quantity)) {
      best = { name: item.name, quantity: qty, sets, free: sets * get };
    }
  }
  return best;
}

export default function CheckoutPage() {
  const { t, setLocale, locale, formatDateTime } = useI18n();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug: string; locationSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const locSlug = resolveShopLocationSlug({ locationSlug });
  const basePath = useMemo(() => shopBasePath(shopKey, locSlug), [shopKey, locSlug]);
  const navigate = useNavigate();
  const { theme: cmsTheme, site: shopSite } = useShopCmsTheme(shopKey);

  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [merchant, setMerchant] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [customTipOpen, setCustomTipOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [checkingZone, setCheckingZone] = useState(false);
  const [customer, setCustomer] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [wantCreateAccount, setWantCreateAccount] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<any>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [whenMode, setWhenMode] = useState<WhenMode>('asap');
  const [scheduleDayOffset, setScheduleDayOffset] = useState(0);
  const [showAllScheduleSlots, setShowAllScheduleSlots] = useState(false);
  const [chooseScheduleDateOpen, setChooseScheduleDateOpen] = useState(false);
  const [scheduleCalendarDate, setScheduleCalendarDate] = useState('');
  const [customScheduleDay, setCustomScheduleDay] = useState<
    ReturnType<typeof buildScheduleDayForDate>
  >(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState('');
  const [paymentSession, setPaymentSession] = useState<any>(null);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [paymentDemoMode, setPaymentDemoMode] = useState(false);
  const [paymentDemoError, setPaymentDemoError] = useState('');
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [redeemRate, setRedeemRate] = useState(100);
  /** Explicit "Pay with points" option on the payment step */
  const [payWithPoints, setPayWithPoints] = useState(false);
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardLookupError, setGiftCardLookupError] = useState<string | null>(null);
  const [giftCardsEnabled, setGiftCardsEnabled] = useState(false);
  const [appliedOffers, setAppliedOffers] = useState<ShopAppliedOffer[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState<(typeof ADDRESS_LABELS)[number]>('home');
  const [savingAddress, setSavingAddress] = useState(false);
  const [deliveryAddressOpen, setDeliveryAddressOpen] = useState(false);
  const [channelBeforeDelivery, setChannelBeforeDelivery] = useState<ShopChannel | null>(null);
  const [voucherInputOpen, setVoucherInputOpen] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);
  const [cartPopupOpen, setCartPopupOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const phoneLocalRef = useRef<HTMLInputElement>(null);
  const [showMoreScheduleDays, setShowMoreScheduleDays] = useState(false);
  const scheduleCalendarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shopKey) return;
    const stored = loadCart(shopKey);
    if (!stored?.items?.length) {
      navigate(`${basePath || '/'}`, { replace: true });
      return;
    }
    setDraft(stored);
    const storedNames = splitCustomerName(stored.customerName || '');
    setFirstName(storedNames.first);
    setLastName(storedNames.last);
    if (stored.scheduledFor) setWhenMode('later');
    if (stored.deliveryInfo) setDeliveryInfo(stored.deliveryInfo);

    const boot = async () => {
      try {
        const [shopRes, payRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(`/api/shop/${shopKey}/payment-options`),
        ]);
        setMerchant(shopRes.data.data);
        setGiftCardsEnabled(!!shopRes.data.data?.giftCards?.enabled);
        setPaymentOptions(payRes.data.options);
        if (isLocale(shopRes.data.data?.language)) {
          try {
            const stored = localStorage.getItem('manupos_shop_lang');
            if (!isLocale(stored)) setLocale(shopRes.data.data.language);
          } catch {
            setLocale(shopRes.data.data.language);
          }
        }

        const token = loadCustomerToken(shopKey);
        if (token) {
          try {
            const me = await axios.get(`/api/shop/${shopKey}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setCustomer(me.data.customer);
            const addrs: SavedAddress[] = Array.isArray(me.data.customer.addresses)
              ? me.data.customer.addresses
              : [];
            setSavedAddresses(addrs);
            const preferred =
              addrs.find((a) => a.isDefault) ||
              addrs[0] ||
              null;
            setSelectedAddressId(preferred?.id || null);
            const loggedInName = me.data.customer.name || '';
            const loggedInNames = splitCustomerName(loggedInName);
            setFirstName(loggedInNames.first);
            setLastName(loggedInNames.last);
            setDraft((d) => ({
              ...d,
              authMode: 'login',
              customerName: loggedInName || d.customerName,
              customerEmail: me.data.customer.email || d.customerEmail,
              customerPhone: me.data.customer.phone || d.customerPhone,
              address: preferred?.address || me.data.customer.defaultAddress || d.address,
              zipCode: preferred?.zipCode || me.data.customer.defaultZip || d.zipCode,
              city: preferred?.city || me.data.customer.defaultCity || d.city,
              lat: preferred?.latitude ?? d.lat,
              lng: preferred?.longitude ?? d.lng,
            }));
            setWantCreateAccount(false);
            setShowLogin(false);
            try {
              const loyaltyRes = await axios.get(`/api/shop/${shopKey}/loyalty`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              setLoyaltyBalance(Number(loyaltyRes.data.balance) || 0);
              setRedeemRate(Number(loyaltyRes.data.program?.redeemPointsPerChf) || 100);
            } catch {
              /* loyalty optional when disabled or unavailable */
            }
          } catch (e: any) {
            if (e.response?.status === 401) {
              clearCustomerToken(shopKey);
            }
          }
        }
      } catch (e: any) {
        showCheckoutError(e.response?.data?.error || t('shopFailedCheckout'));
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [shopKey, navigate]);

  useEffect(() => {
    if (!shopKey || !draft.items.length) return;
    saveCart(shopKey, draft);
  }, [draft, shopKey]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (localizedShopCopy(shopSite?.metaTitle, locale)) return;
    if (merchant?.name) document.title = shopDocumentTitle(merchant.name);
  }, [merchant?.name, shopSite?.metaTitle, locale]);

  /** Preview promotional offers for the cart */
  useEffect(() => {
    if (!shopKey || !draft.items.length) {
      setOfferDiscount(0);
      setAppliedOffers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hasBaked = draft.items.some((i) => !!i.offerId && !i.loyaltyReward);
        const res = await axios.post(`/api/shop/${shopKey}/offers/preview`, {
          channel: draft.channel,
          scheduledFor:
            whenMode === 'later' && draft.scheduledFor
              ? localDateTimeToIso(draft.scheduledFor)
              : null,
          items: draft.items.map((i) => ({
            productId: i.id,
            categoryId: i.categoryId || null,
            name: i.name,
            // Use catalog price when offer is already baked into `price`
            unitPrice: i.offerId && i.catalogPrice != null ? i.catalogPrice : i.price,
            quantity: i.quantity,
            loyaltyReward: !!i.loyaltyReward,
            offerId: i.offerId || null,
          })),
        });
        if (cancelled) return;
        const appliedRaw = Array.isArray(res.data.applied) ? res.data.applied : [];
        const activeRaw = Array.isArray(res.data.activeOffers) ? res.data.activeOffers : [];
        const mapped: ShopAppliedOffer[] = appliedRaw.map((a: ShopAppliedOffer) => {
          const meta = (activeRaw as Array<ShopAppliedOffer & { id?: string }>).find(
            (o) => o.id && o.id === a.offerId
          );
          return {
            offerId: a.offerId,
            name: a.name || meta?.name || '',
            badgeLabel: a.badgeLabel || meta?.badgeLabel || null,
            discount: Number(a.discount) || 0,
            offerType: a.offerType || meta?.offerType,
            description: meta?.description || a.description || null,
          };
        });
        // Cart lines already include deal prices - don't subtract the same offer again
        if (hasBaked) {
          setOfferDiscount(0);
          setAppliedOffers([]);
        } else {
          setOfferDiscount(Number(res.data.discount) || 0);
          setAppliedOffers(mapped);
        }
      } catch (err) {
        console.warn('[shop] offers preview failed', err);
        if (!cancelled) {
          setOfferDiscount(0);
          setAppliedOffers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, draft.items, draft.channel, draft.scheduledFor, whenMode]);

  /** Keep item prices in sync when switching takeaway ↔ delivery (menu markup / category pricing). */
  const categoryPricingEnabled = merchant?.categoryPricingEnabled === true;
  const deliveryMenuMarkup = useMemo(() => {
    const n = Number(merchant?.deliveryMenuMarkup ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [merchant]);
  const categoryDeliveryMap = useMemo(
    () => buildCategoryDeliveryPricingMap(merchant?.categoryDeliveryPricing || []),
    [merchant?.categoryDeliveryPricing]
  );

  useEffect(() => {
    if (!merchant) return;
    setDraft((prev) => {
      let changed = false;
      const items = prev.items.map((item) => {
        if (item.loyaltyReward) return item;
        const addMarkup = resolveShopItemDeliveryMarkup(
          categoryPricingEnabled,
          prev.channel,
          item.categoryId,
          deliveryMenuMarkup,
          categoryDeliveryMap
        );
        const extrasTotal = roundMoney2(
          (item.selectedExtras || []).reduce((s, e) => s + Number(e.price || 0), 0) +
            (item.comboSelections || []).reduce(
              (s, c) =>
                s +
                Number(c.extraPrice || 0) +
                (c.selectedExtras || []).reduce((x, e) => x + Number(e.price || 0), 0),
              0
            )
        );
        const base =
          typeof item.basePrice === 'number' && Number.isFinite(item.basePrice)
            ? item.basePrice
            : roundMoney2(Number(item.catalogPrice ?? item.price ?? 0) - extrasTotal);
        const catalogUnit = roundMoney2(base + addMarkup + extrasTotal);
        if (item.offerId) {
          if (item.price === 0) {
            if (item.catalogPrice !== catalogUnit) {
              changed = true;
              return { ...item, basePrice: base, catalogPrice: catalogUnit, price: 0 };
            }
            return item;
          }
          if (item.catalogPrice && item.catalogPrice > 0) {
            const ratio = item.price / item.catalogPrice;
            const nextPrice = roundMoney2(catalogUnit * Math.min(1, ratio));
            if (nextPrice !== item.price || item.catalogPrice !== catalogUnit || item.basePrice !== base) {
              changed = true;
              return { ...item, basePrice: base, catalogPrice: catalogUnit, price: nextPrice };
            }
            return item;
          }
        }
        const nextPrice = catalogUnit;
        if (!Number.isFinite(nextPrice)) return item;
        if (nextPrice !== item.price || item.basePrice !== base) {
          changed = true;
          return { ...item, basePrice: base, price: nextPrice };
        }
        return item;
      });
      if (!changed) return prev;
      return { ...prev, items };
    });
  }, [draft.channel, merchant, categoryDeliveryMap, categoryPricingEnabled, deliveryMenuMarkup]);

  const taxRate = useMemo(() => {
    if (!merchant) return 0;
    if (draft.channel === 'dine_in') return Number(merchant.taxDineInRate ?? merchant.vatRate ?? 0);
    if (draft.channel === 'delivery') return Number(merchant.taxDeliveryRate ?? merchant.vatRate ?? 0);
    return Number(merchant.taxTakeawayRate ?? merchant.vatRate ?? 0);
  }, [merchant, draft.channel]);

  const channelOpen = useMemo(() => {
    if (!merchant) return false;
    const fromApi = merchant.channels?.[draft.channel]?.open;
    if (typeof fromApi === 'boolean') return fromApi;
    return isChannelOpenAt(merchant.storeHours as StoreHours, draft.channel as ShopChannel).open;
  }, [merchant, draft.channel]);

  const leadMinutes = useMemo(() => {
    const eta = Number(merchant?.channels?.[draft.channel]?.etaMinutes);
    const minDelay = Number(merchant?.minPreOrderDelayMinutes);
    const base = Number.isFinite(eta) && eta > 0 ? eta : 30;
    const delay = Number.isFinite(minDelay) && minDelay > 0 ? minDelay : 0;
    return Math.max(15, base, delay);
  }, [merchant, draft.channel]);

  const shopLocale = locale === 'fr' ? 'fr-CH' : locale === 'de' ? 'de-CH' : 'en-CH';

  const scheduleDays = useMemo(() => {
    if (!merchant) return [];
    return buildScheduleDays({
      storeHours: merchant.storeHours as StoreHours,
      channel: draft.channel as ShopChannel,
      leadMinutes,
      intervalMinutes: 15,
      horizonDays: 14,
      locale: shopLocale,
    });
  }, [merchant, draft.channel, leadMinutes, shopLocale]);

  const scheduleDayTitle = (offset: number) => {
    if (offset === 0) return t('shopToday');
    if (offset === 1) return t('shopTomorrow');
    if (offset === 2) return t('shopDayAfterTomorrow');
    return t('shopPlusDays').replace('{n}', String(offset));
  };

  const activeScheduleDay = useMemo(() => {
    if (customScheduleDay) return customScheduleDay;
    if (!scheduleDays.length) return null;
    return (
      scheduleDays.find((d) => d.offset === scheduleDayOffset) ||
      scheduleDays[0]
    );
  }, [customScheduleDay, scheduleDays, scheduleDayOffset]);

  const sortedScheduleSlots = useMemo(() => {
    const slots = [...(activeScheduleDay?.slots || [])];
    slots.sort((a, b) => a.value.localeCompare(b.value));
    return slots;
  }, [activeScheduleDay]);

  const visibleScheduleSlots = showAllScheduleSlots
    ? sortedScheduleSlots
    : sortedScheduleSlots.slice(0, 8);
  const hiddenScheduleSlotCount = Math.max(0, sortedScheduleSlots.length - visibleScheduleSlots.length);

  const todayScheduleDay = scheduleDays.find((d) => d.offset === 0) || null;
  const tomorrowScheduleDay = scheduleDays.find((d) => d.offset === 1) || null;
  const dayAfterScheduleDay = scheduleDays.find((d) => d.offset === 2) || null;
  const extraScheduleDays = scheduleDays.filter((d) => d.offset > 2);

  const renderScheduleDayButton = (day: (typeof scheduleDays)[number]) => (
    <button
      key={day.offset}
      type="button"
      className={`min-w-0 px-1.5 py-2 text-center border rounded-md ${
        activeScheduleDay?.offset === day.offset && !customScheduleDay
          ? 'bg-stone-900 text-white border-stone-900'
          : 'bg-white border-stone-300'
      }`}
      onClick={() => {
        setScheduleDayOffset(day.offset);
        setCustomScheduleDay(null);
        setChooseScheduleDateOpen(false);
        setShowAllScheduleSlots(false);
        patch({ scheduledFor: day.slots[0]?.value || '' });
      }}
    >
      <span className="font-semibold block text-xs sm:text-sm leading-tight">
        {scheduleDayTitle(day.offset)}
      </span>
      <span className="text-[10px] sm:text-[11px] opacity-80 block truncate">
        {day.weekday} {day.dateLabel}
      </span>
    </button>
  );

  const scheduleCalendarMin = new Date().toISOString().slice(0, 10);
  const scheduleCalendarMaxDate = new Date();
  scheduleCalendarMaxDate.setDate(scheduleCalendarMaxDate.getDate() + 60);
  const scheduleCalendarMax = scheduleCalendarMaxDate.toISOString().slice(0, 10);

  const openScheduleCalendarPicker = () => {
    setWhenMode('later');
    setChooseScheduleDateOpen(true);
    setShowMoreScheduleDays(true);
    window.requestAnimationFrame(() => {
      const input = scheduleCalendarRef.current;
      if (!input) return;
      input.focus();
      try {
        input.showPicker?.();
      } catch {
        input.click();
      }
    });
  };

  const onScheduleCalendarPick = (ymd: string) => {
    setScheduleCalendarDate(ymd);
    setShowAllScheduleSlots(false);
    if (!ymd || !merchant) {
      setCustomScheduleDay(null);
      return;
    }
    const [y, m, d] = ymd.split('-').map(Number);
    const day = buildScheduleDayForDate({
      storeHours: merchant.storeHours as StoreHours,
      channel: draft.channel as ShopChannel,
      year: y,
      month: m,
      day: d,
      leadMinutes,
      intervalMinutes: 15,
      locale: shopLocale,
    });
    setCustomScheduleDay(day);
    if (day?.slots[0]) {
      patch({ scheduledFor: day.slots[0].value });
    }
  };

  // When closed (or ASAP unavailable), force "later" and auto-pick first slot - only if scheduled orders are allowed.
  useEffect(() => {
    if (!merchant) return;
    const allowScheduled = merchant.scheduledOrdersEnabled !== false;
    if (!allowScheduled) {
      if (whenMode !== 'asap') setWhenMode('asap');
      if (draft.scheduledFor) setDraft((d) => ({ ...d, scheduledFor: '' }));
      return;
    }
    if (!scheduleDays.length) return;
    if (!channelOpen && whenMode === 'asap') {
      setWhenMode('later');
    }
    if (whenMode === 'later') {
      if (customScheduleDay) return;
      const day =
        scheduleDays.find((d) => d.offset === scheduleDayOffset) ||
        scheduleDays.find((d) => d.offset === 0) ||
        scheduleDays[0];
      if (!day) return;
      if (day.offset !== scheduleDayOffset) setScheduleDayOffset(day.offset);
      const stillValid = day.slots.some((s) => s.value === draft.scheduledFor);
      if (!stillValid) {
        setDraft((d) => ({ ...d, scheduledFor: day.slots[0].value }));
      }
    } else if (whenMode === 'asap' && draft.scheduledFor) {
      setDraft((d) => ({ ...d, scheduledFor: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merchant, channelOpen, whenMode, scheduleDays, scheduleDayOffset, draft.channel, customScheduleDay]);

  const subtotal = roundMoney2(cartSubtotal(draft.items));
  const voucherDiscount = roundMoney2(Math.max(0, Number(draft.voucherDiscount) || 0));
  const effectiveDeliveryInfo = useMemo(
    () => withDeliveryMinOrderStatus(deliveryInfo, subtotal),
    [deliveryInfo, subtotal]
  );
  const minOrderThreshold = draft.channel === 'delivery'
    ? Number(effectiveDeliveryInfo?.zone?.minOrderAmount || 0)
    : 0;
  const freeDeliveryThreshold = draft.channel === 'delivery'
    ? Number(effectiveDeliveryInfo?.zone?.freeDeliveryMinOrder || 0)
    : 0;
  const deliveryFee = roundMoney2(
    draft.channel === 'delivery' ? Number(effectiveDeliveryInfo?.zone?.deliveryFee || 0) : 0
  );
  const tip = roundTo005(Math.max(0, Number(draft.tipAmount) || 0));
  const taxOpts = {
    taxIncludedInPrice: merchant?.taxIncludedInPrice === true,
    vatAfterDiscount: merchant?.vatAfterDiscount !== false,
  };
  const grossTax = roundMoney2(((subtotal + deliveryFee) * taxRate) / 100);
  const taxAfterOffer = adjustTaxForOrderDiscount(
    grossTax,
    subtotal + deliveryFee,
    offerDiscount + voucherDiscount,
    taxOpts
  );
  const rewardPointsInCart = draft.items
    .filter((i) => i.loyaltyReward)
    .reduce((s, i) => s + (i.rewardPointsCost || 0) * i.quantity, 0);
  const loyaltyEnabled = !!merchant?.loyalty?.enabled && !!customer;
  const rate = Math.max(1, Math.floor(redeemRate || 100));
  const balanceAfterRewards = Math.max(0, loyaltyBalance - rewardPointsInCart);
  // Points can cover food + delivery + tax (not tip / card fee)
  const redeemableBase = roundMoney2(
    Math.max(0, subtotal - offerDiscount - voucherDiscount) + deliveryFee + taxAfterOffer
  );
  const maxCashPoints = Math.min(
    Math.floor(Math.max(0, redeemableBase)) * rate,
    Math.floor(balanceAfterRewards / rate) * rate
  );
  const pointsToRedeem = payWithPoints
    ? Math.min(
        Math.max(0, Math.floor(Number(draft.pointsToRedeem) || 0)),
        maxCashPoints
      )
    : 0;
  const pointsDiscount = Math.floor(pointsToRedeem / rate);
  const tax = adjustTaxForOrderDiscount(
    grossTax,
    subtotal + deliveryFee,
    offerDiscount + voucherDiscount + pointsDiscount,
    taxOpts
  );
  const preGiftTotal =
    Math.max(0, subtotal + deliveryFee + tax - offerDiscount - voucherDiscount - pointsDiscount) + tip;
  const giftCardDiscount =
    draft.giftCardCode?.trim() && giftCardBalance > 0
      ? roundMoney2(Math.min(giftCardBalance, preGiftTotal))
      : 0;
  const preCardTotal = Math.max(0, preGiftTotal - giftCardDiscount);
  const cardFeeFixed = Number(paymentOptions?.cardFeeFixed || 0) || 0;
  const cardFeePercent = Number(paymentOptions?.cardFeePercent || 0) || 0;
  const remainingAfterPoints = Math.max(0, redeemableBase - pointsDiscount) + tip;
  const cardFee =
    draft.paymentMethod === 'card' && remainingAfterPoints > 0
      ? roundTo005(Math.max(0, cardFeeFixed + (preCardTotal * cardFeePercent) / 100))
      : 0;
  const rawTotal = preCardTotal + cardFee;
  const rounding = roundingAdjustment(rawTotal);
  const total = roundTo005(rawTotal);
  const itemCount = draft.items.reduce((sum, item) => sum + item.quantity, 0);
  const checkoutReady = useMemo(() => {
    if (merchant?.acceptingOrders === false || merchant?.vacation?.active) return false;
    if (!firstName.trim() || !lastName.trim() || !draft.customerPhone.trim()) return false;
    if (!draft.customerEmail.trim()) return false;
    if (whenMode === 'asap' && !channelOpen) return false;
    if (whenMode === 'later') {
      if (merchant?.scheduledOrdersEnabled === false) return false;
      if (!draft.scheduledFor || scheduleDays.length === 0) return false;
    }
    if (draft.channel === 'delivery') {
      if (!draft.address.trim() || !draft.zipCode.trim() || !draft.city.trim()) return false;
      if (!effectiveDeliveryInfo?.deliverable || !effectiveDeliveryInfo?.meetsMinOrder) return false;
    }
    return draft.items.length > 0;
  }, [
    merchant,
    firstName,
    lastName,
    draft.items.length,
    draft.customerPhone,
    draft.customerEmail,
    draft.channel,
    draft.address,
    draft.zipCode,
    draft.city,
    draft.scheduledFor,
    wantCreateAccount,
    whenMode,
    channelOpen,
    effectiveDeliveryInfo,
    scheduleDays.length,
  ]);
  const pointsCoverFullOrder = payWithPoints && pointsDiscount > 0 && total <= 0.001;

  const patch = (p: Partial<ShopCheckoutDraft>) => setDraft((d) => ({ ...d, ...p }));

  const resolvePersonalFields = () => {
    const resolvedFirst = (firstNameRef.current?.value ?? firstName).trim();
    const resolvedLast = (lastNameRef.current?.value ?? lastName).trim();
    const phoneLocal = phoneLocalRef.current?.value?.trim();
    const resolvedPhone = phoneLocal
      ? `${draft.customerPhone.match(/^(\+\d{1,3})/)?.[1] || '+41'}${phoneLocal}`.trim()
      : draft.customerPhone.trim();
    const fullName = buildCustomerFullName(resolvedFirst, resolvedLast);
    return {
      firstName: resolvedFirst,
      lastName: resolvedLast,
      fullName,
      phone: resolvedPhone,
    };
  };

  const syncPersonalFieldsFromDom = () => {
    const resolved = resolvePersonalFields();
    if (resolved.firstName !== firstName) setFirstName(resolved.firstName);
    if (resolved.lastName !== lastName) setLastName(resolved.lastName);
    if (resolved.phone && resolved.phone !== draft.customerPhone) {
      patch({ customerPhone: resolved.phone, customerName: resolved.fullName });
    } else if (resolved.fullName) {
      patch({ customerName: resolved.fullName });
    }
    return resolved;
  };

  const applyVoucher = async () => {
    const code = voucherInput.trim();
    if (!code) return;
    setApplyingVoucher(true);
    try {
      const token = loadCustomerToken(shopKey);
      const res = await axios.post(
        `/api/shop/${shopKey}/vouchers/validate`,
        { code, subtotal },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      patch({
        voucherCode: res.data.code,
        voucherDiscount: Number(res.data.discount) || 0,
        voucherName: res.data.name || res.data.code,
      });
      setVoucherInputOpen(false);
      setVoucherInput('');
    } catch (e: any) {
      showCheckoutError(e.response?.data?.error || t('shopVoucherInvalid'));
    } finally {
      setApplyingVoucher(false);
    }
  };

  const removeVoucher = () => {
    patch({ voucherCode: '', voucherDiscount: 0, voucherName: '' });
    setVoucherInput('');
    setVoucherInputOpen(false);
  };

  useEffect(() => {
    if (!draft.voucherCode || voucherDiscount <= 0) return;
    const token = loadCustomerToken(shopKey);
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.post(
          `/api/shop/${shopKey}/vouchers/validate`,
          { code: draft.voucherCode, subtotal },
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );
        if (cancelled) return;
        const nextDiscount = Number(res.data.discount) || 0;
        if (nextDiscount !== voucherDiscount) {
          patch({ voucherDiscount: nextDiscount, voucherName: res.data.name || draft.voucherCode });
        }
      } catch {
        if (!cancelled) removeVoucher();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, draft.voucherCode]);

  const setLineQty = (lineId: string, quantity: number) => {
    setDraft((d) => {
      const target = d.items.find((i) => (i.lineId || i.id) === lineId);
      let items = d.items;
      if (target?.offerInstanceId) {
        // Locked deal: only whole-offer removal
        if (quantity > 0) return d;
        items = removeOfferInstance(d.items, target.offerInstanceId);
      } else {
        items =
          quantity <= 0
            ? d.items.filter((i) => (i.lineId || i.id) !== lineId)
            : d.items.map((i) =>
                (i.lineId || i.id) === lineId ? { ...i, quantity } : i
              );
      }
      const next = { ...d, items };
      if (shopKey) saveCart(shopKey, next);
      if (!items.length) {
        clearCart(shopKey);
        navigate(`${basePath || '/'}`, { replace: true });
      }
      return next;
    });
  };

  const removeLine = (lineId: string) => setLineQty(lineId, 0);

  const removeOfferBlock = (offerInstanceId: string) => {
    setDraft((d) => {
      const items = removeOfferInstance(d.items, offerInstanceId);
      const next = { ...d, items };
      if (shopKey) saveCart(shopKey, next);
      if (!items.length) {
        clearCart(shopKey);
        navigate(`${basePath || '/'}`, { replace: true });
      }
      return next;
    });
  };

  const checkDelivery = async (options?: { requireMinOrder?: boolean }) => {
    if (draft.channel !== 'delivery') return true;
    if (!draft.address.trim()) {
      showCheckoutError(t('shopEnterDeliveryAddress'));
      return false;
    }
    setCheckingZone(true);
    try {
      let lat = draft.lat;
      let lng = draft.lng;
      if (lat == null || lng == null) {
        const geoRes = await axios.post(`/api/shop/${shopKey}/geocode`, {
          query: [draft.address, draft.zipCode, draft.city].filter(Boolean).join(', '),
        });
        lat = geoRes.data.found ? Number(geoRes.data.lat) : undefined;
        lng = geoRes.data.found ? Number(geoRes.data.lng) : undefined;
        if (lat != null && lng != null) patch({ lat, lng });
      }
      const res = await axios.post(`/api/shop/${shopKey}/check-delivery`, {
        lat,
        lng,
        zipCode: draft.zipCode,
        subtotal,
      });
      setDeliveryInfo(res.data);
      patch({ deliveryInfo: res.data });
      const live = withDeliveryMinOrderStatus(res.data, subtotal);
      if (!res.data.deliverable) {
        showCheckoutError(res.data.error || t('shopOutsideDelivery'));
        return false;
      }
      if (options?.requireMinOrder && !live.meetsMinOrder) {
        showCheckoutError(live.message || t('shopMinOrderNotMet'));
        return false;
      }
      return true;
    } catch (e: any) {
      showCheckoutError(e.response?.data?.error || t('shopCouldNotVerifyAddress'));
      return false;
    } finally {
      setCheckingZone(false);
    }
  };

  const refreshLoyalty = async (authToken: string) => {
    try {
      const loyaltyRes = await axios.get(`/api/shop/${shopKey}/loyalty`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setLoyaltyBalance(Number(loyaltyRes.data.balance) || 0);
      setRedeemRate(Number(loyaltyRes.data.program?.redeemPointsPerChf) || 100);
    } catch {
      /* optional */
    }
  };

  const addressLabelText = (label: string) => {
    if (label === 'home') return t('shopAddressHome');
    if (label === 'office') return t('shopAddressOffice');
    if (label === 'other') return t('shopAddressOther');
    return label;
  };

  const applySavedAddress = (a: SavedAddress) => {
    setSelectedAddressId(a.id);
    setDeliveryInfo(null);
    patch({
      address: a.address || '',
      zipCode: a.zipCode || '',
      city: a.city || '',
      lat: a.latitude ?? undefined,
      lng: a.longitude ?? undefined,
    });
  };

  const saveCurrentAddress = async () => {
    if (!customer || !draft.address.trim()) return;
    const token = loadCustomerToken(shopKey);
    if (!token) return;
    setSavingAddress(true);
    try {
      let lat = draft.lat;
      let lng = draft.lng;
      if (lat == null || lng == null) {
        const geo = await axios.post(`/api/shop/${shopKey}/geocode`, {
          query: [draft.address, draft.zipCode, draft.city].filter(Boolean).join(', '),
        });
        if (geo.data.found) {
          lat = Number(geo.data.lat);
          lng = Number(geo.data.lng);
          patch({ lat, lng });
        }
      }
      const res = await axios.post(
        `/api/shop/${shopKey}/auth/addresses`,
        {
          label: saveLabel,
          address: draft.address.trim(),
          zipCode: draft.zipCode.trim() || null,
          city: draft.city.trim() || null,
          latitude: lat ?? null,
          longitude: lng ?? null,
          isDefault: savedAddresses.length === 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const saved = res.data.address as SavedAddress;
      setSavedAddresses((prev) => {
        const without = prev.filter((a) => a.id !== saved.id);
        return saved.isDefault
          ? [saved, ...without.map((a) => ({ ...a, isDefault: false }))]
          : [...without, saved];
      });
      setSelectedAddressId(saved.id);
    } catch (e: any) {
      showCheckoutError(e.response?.data?.error || t('shopCouldNotSaveAddress'));
    } finally {
      setSavingAddress(false);
    }
  };

  const applyAuthedCustomer = async (
    token: string,
    nextCustomer: any,
    authMode: 'login' | 'register',
    emailFallback: string
  ) => {
    saveCustomerToken(shopKey, token);
    setCustomer(nextCustomer);
    const addrs: SavedAddress[] = Array.isArray(nextCustomer?.addresses) ? nextCustomer.addresses : [];
    setSavedAddresses(addrs);
    const preferred = addrs.find((a) => a.isDefault) || addrs[0] || null;
    setSelectedAddressId(preferred?.id || null);
    await refreshLoyalty(token);
    setWantCreateAccount(false);
    setShowLogin(false);
    setShowRegister(false);
    setPassword('');
    setConfirmPassword('');
    const names = splitCustomerName(nextCustomer?.name || '');
    if (names.first) setFirstName(names.first);
    if (names.last) setLastName(names.last);
    patch({
      authMode,
      customerName: nextCustomer?.name || '',
      customerEmail: nextCustomer?.email || emailFallback,
      customerPhone: nextCustomer?.phone || '',
      address: preferred?.address || nextCustomer?.defaultAddress || draft.address,
      zipCode: preferred?.zipCode || nextCustomer?.defaultZip || draft.zipCode,
      city: preferred?.city || nextCustomer?.defaultCity || draft.city,
      lat: preferred?.latitude ?? draft.lat,
      lng: preferred?.longitude ?? draft.lng,
    });
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/login`, {
        email: loginEmail,
        password: loginPassword,
      });
      await applyAuthedCustomer(res.data.token, res.data.customer, 'login', loginEmail);
    } catch (err: any) {
      showCheckoutError(err.response?.data?.error || t('shopLoginFailed'));
    }
  };

  const onRegisterFromPerks = async (e: FormEvent) => {
    e.preventDefault();
    const email = (loginEmail || draft.customerEmail).trim();
    if (!email || password.length < 6) {
      showCheckoutError(t('shopEmailPasswordRequired'));
      return;
    }
    if (password !== confirmPassword) {
      showCheckoutError(t('shopPasswordsMustMatch'));
      return;
    }
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/register`, {
        email,
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: draft.customerPhone || undefined,
      });
      await applyAuthedCustomer(res.data.token, res.data.customer, 'register', email);
    } catch (err: any) {
      showCheckoutError(err.response?.data?.error || t('shopCouldNotCreateAccount'));
    }
  };

  const registerAccount = async () => {
    if (!draft.customerEmail.trim() || password.length < 6) {
      showCheckoutError(t('shopEmailPasswordRequired'));
      return false;
    }
    if (password !== confirmPassword) {
      showCheckoutError(t('shopPasswordsMustMatch'));
      return false;
    }
    try {
      const res = await axios.post(`/api/shop/${shopKey}/auth/register`, {
        email: draft.customerEmail,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: draft.customerPhone,
      });
      saveCustomerToken(shopKey, res.data.token);
      setCustomer(res.data.customer);
      await refreshLoyalty(res.data.token);
      setWantCreateAccount(false);
      setPassword('');
      setConfirmPassword('');
      patch({ authMode: 'register' });
      return true;
    } catch (err: any) {
      showCheckoutError(err.response?.data?.error || t('shopCouldNotCreateAccount'));
      return false;
    }
  };

  const goPayment = async (personal?: ReturnType<typeof resolvePersonalFields>): Promise<boolean> => {
    const resolved = personal || syncPersonalFieldsFromDom();
    const { fullName, phone } = resolved;
    patch({ customerName: fullName, customerPhone: phone });
    if (!fullName || !phone) {
      return false;
    }
    if (!customer && wantCreateAccount) {
      const ok = await registerAccount();
      if (!ok) return false;
    } else if (!customer) {
      patch({ authMode: 'guest' });
    }
    if (whenMode === 'asap' && !channelOpen) {
      showCheckoutError(
        merchant?.scheduledOrdersEnabled === false
          ? t('shopOrdersOnlyWhenOpen')
          : t('shopClosedChooseLater')
      );
      return false;
    }
    if (whenMode === 'later' && merchant?.scheduledOrdersEnabled === false) {
      showCheckoutError(t('shopOrdersOnlyWhenOpen'));
      return false;
    }
    if (whenMode === 'later' && !draft.scheduledFor) {
      showCheckoutError(t('shopChooseDayAndTime'));
      return false;
    }
    if (whenMode === 'later' && scheduleDays.length === 0) {
      showCheckoutError(t('shopNoOpeningHours'));
      return false;
    }
    if (draft.channel === 'delivery') {
      const ok = await checkDelivery({ requireMinOrder: true });
      if (!ok) return false;
    }
    return true;
  };

  const submitCheckout = async () => {
    const resolved = syncPersonalFieldsFromDom();
    const next: FieldErrors = {};
    if (!resolved.firstName) next.customerFirstName = t('shopFirstNameRequired');
    if (!resolved.lastName) next.customerLastName = t('shopLastNameRequired');
    if (!resolved.fullName) next.customerName = t('shopFullNameFieldRequired');
    if (!resolved.phone) next.customerPhone = t('shopPhoneFieldRequired');
    if (!draft.customerEmail.trim()) {
      next.customerEmail = t('shopEmailFieldRequired');
    }
    if (!customer && wantCreateAccount) {
      if (password.length < 6) next.customerEmail = next.customerEmail || t('shopEmailPasswordRequired');
      if (password !== confirmPassword) {
        showCheckoutError(t('shopPasswordsMustMatch'));
        setFieldErrors(next);
        return;
      }
    }
    setFieldErrors(next);
    if (Object.keys(next).length) {
      showCheckoutError(
        next.customerFirstName ||
          next.customerLastName ||
          next.customerName ||
          next.customerPhone ||
          next.customerEmail
      );
      return;
    }
    patch({ customerName: resolved.fullName, customerPhone: resolved.phone });
    const ok = await goPayment(resolved);
    if (!ok) return;
    await placeOrder(resolved);
  };

  const placeOrder = async (personal?: ReturnType<typeof resolvePersonalFields>) => {
    if (merchant?.acceptingOrders === false) {
      showCheckoutError(t('shopNotAcceptingOrders'));
      return;
    }
    if (merchant?.vacation?.active) {
      showCheckoutError(t('shopVacationOrdersBlocked'));
      return;
    }
    setSubmitting(true);
    try {
      if (draft.channel === 'delivery') {
        const ok = await checkDelivery({ requireMinOrder: true });
        if (!ok) {
          setSubmitting(false);
          return;
        }
      }

      const token = loadCustomerToken(shopKey);
      const customerFullName =
        personal?.fullName || buildCustomerFullName(firstName, lastName) || draft.customerName;
      const customerPhone = personal?.phone || draft.customerPhone;
      const res = await axios.post(
        `/api/shop/${shopKey}/orders`,
        {
          items: draft.items.map((i) => ({
            productId: i.id,
            quantity: i.quantity,
            selectedExtras: (i.selectedExtras || [])
              .filter((e) => e.id && !String(e.id).startsWith('combo:'))
              .map((e) => ({ id: e.id })),
            comboSelections: (i.comboSelections || []).map((c) => ({
              slotId: c.slotId,
              slotName: c.slotName,
              productId: c.productId,
              selectedExtras: (c.selectedExtras || []).map((e) => ({ id: e.id })),
            })),
            loyaltyReward: !!i.loyaltyReward,
          })),
          fulfillmentChannel: draft.channel,
          customerName: customerFullName,
          customerEmail: draft.customerEmail || undefined,
          customerPhone,
          shippingAddress: draft.channel === 'delivery' ? draft.address : undefined,
          city: draft.city,
          zipCode: draft.zipCode,
          lat: draft.lat,
          lng: draft.lng,
          notes: draft.notes || undefined,
          tipAmount: tip,
          paymentMethod: pointsCoverFullOrder ? 'cash' : draft.paymentMethod,
          pointsToRedeem: loyaltyEnabled && payWithPoints ? pointsToRedeem : 0,
          scheduledFor:
            whenMode === 'later' && draft.scheduledFor
              ? localDateTimeToIso(draft.scheduledFor)
              : null,
          guestCheckout: draft.authMode === 'guest',
          voucherCode: draft.voucherCode?.trim() || undefined,
          giftCardCode: draft.giftCardCode?.trim() || undefined,
          locationSlug: locSlug || undefined,
          ...shopCheckoutOriginPayload(shopBasePath(shopKey, locSlug)),
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );

      const order = res.data.order;

      const payCard = !pointsCoverFullOrder && draft.paymentMethod === 'card';
      if (payCard) {
        const session = res.data.paymentSession;
        const normalized = normalizeAdyenPaymentSession(session);
        setPaymentOrderId(order.id);
        setPaymentTotal(Number(order.total) || total);
        if (normalized) {
          setPaymentSession(normalized);
          setPaymentDemoMode(false);
          setPaymentDemoError('');
          try {
            sessionStorage.setItem(`manupos_pay_${order.id}`, JSON.stringify(normalized));
          } catch {
            /* ignore */
          }
        } else {
          setPaymentSession(null);
          setPaymentDemoMode(true);
          setPaymentDemoError(
            (session && typeof session.error === 'string' && session.error) || t('shopCardNotConfigured')
          );
        }
        setPaymentModalOpen(true);
        return;
      }

      clearCart(shopKey);
      navigate(`${shopBasePath(shopKey, locSlug)}/order/${order.id}`);
    } catch (err: any) {
      showCheckoutError(err.response?.data?.error || t('shopCheckoutFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const channelOptions = useMemo(() => {
    const channels = merchant?.channels || {};
    const all: { id: ShopChannel; label: string }[] = [
      { id: 'takeaway', label: t('shopPickup') },
      { id: 'delivery', label: t('shopDelivery') },
      { id: 'dine_in', label: t('shopDineIn') },
    ];
    return all.filter((c) => channels[c.id]?.enabled);
  }, [merchant, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f5f2] text-stone-600">
        {t('shopLoadingCheckout')}
      </div>
    );
  }


  const channelLabel =
    draft.channel === 'delivery' ? t('shopDelivery') : draft.channel === 'dine_in' ? t('shopDineIn') : t('shopPickup');

  const fulfillmentLocked = !!draft.fulfillmentConfirmed;

  const showChannelPicker =
    !fulfillmentLocked &&
    channelOptions.length > 1 &&
    (String(merchant?.channelSelectMode || 'checkout') === 'checkout' ||
      String(merchant?.channelSelectMode || '') === 'popup_start' ||
      String(merchant?.channelSelectMode || '') === 'menu');

  const patchChannel = (channel: ShopChannel) => {
    if (channel === 'delivery') {
      setChannelBeforeDelivery(draft.channel);
      setDeliveryAddressOpen(true);
      return;
    }
    setDraft((d) => ({ ...d, channel }));
    setDeliveryInfo(null);
    setWhenMode('asap');
    setScheduleDayOffset(0);
  };

  const cashSelected =
    !payWithPoints &&
    (draft.paymentMethod === 'pay_later' ||
      draft.paymentMethod === 'cash' ||
      (draft.channel === 'delivery' && draft.paymentMethod !== 'card'));
  const cardSelected = !payWithPoints && draft.paymentMethod === 'card';
  const menuPath = `${shopBasePath(shopKey, locSlug)}/menu`;
  const accountPath = `${shopBasePath(shopKey, locSlug)}/account`.replace(/\/+/g, '/');
  const tipPresets = [5, 10, 15] as const;
  const activeTipPct = tipPresets.find(
    (pct) => subtotal > 0 && Math.abs(tip - roundTo005((subtotal * pct) / 100)) < 0.02
  );
  const payChoiceClass = (on: boolean) =>
    `flex min-h-[3.5rem] flex-1 items-center justify-center gap-2.5 rounded-xl border-2 px-3 py-3.5 text-base font-semibold transition ${
      on
        ? 'border-emerald-600 bg-emerald-100 text-emerald-950 shadow-sm ring-2 ring-emerald-500/30'
        : 'border-stone-200 bg-white text-stone-800 hover:border-stone-400'
    }`;
  const payDotClass = (on: boolean) =>
    `inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
      on ? 'border-emerald-700 bg-emerald-600' : 'border-stone-400 bg-white'
    }`;

  const clearTip = () => {
    setCustomTipOpen(false);
    patch({ tipAmount: 0 });
  };

  const renderTipPicker = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-stone-900">{t('shopTip')}</p>
        {tip > 0 ? (
          <button type="button" className="text-xs font-semibold text-stone-600" onClick={clearTip}>
            {t('shopRemoveTip')}
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {tipPresets.map((pct) => {
          const amt = roundTo005((subtotal * pct) / 100);
          const on = activeTipPct === pct && !customTipOpen;
          return (
            <button
              key={pct}
              type="button"
              className={`rounded-lg border px-1 py-2 text-center text-xs font-semibold ${
                on
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
              }`}
              onClick={() => {
                setCustomTipOpen(false);
                patch({ tipAmount: amt });
              }}
            >
              {pct}%
            </button>
          );
        })}
        <button
          type="button"
          className={`rounded-lg border px-1 py-2 text-center text-xs font-semibold ${
            customTipOpen
              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
              : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
          }`}
          onClick={() => setCustomTipOpen(true)}
        >
          {t('shopCustomAmount')}
        </button>
      </div>
      {customTipOpen ? (
        <input
          type="number"
          min="0"
          step="0.05"
          className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
          value={draft.tipAmount}
          onChange={(e) => patch({ tipAmount: roundTo005(Number(e.target.value) || 0) })}
        />
      ) : null}
    </div>
  );

  const placeOrderDisabled =
    submitting || !!merchant?.vacation?.active || merchant?.acceptingOrders === false;
  const placeOrderLabel =
    merchant?.acceptingOrders === false
      ? t('shopNotAcceptingOrders')
      : merchant?.vacation?.active
        ? t('shopVacationTitle')
        : submitting
          ? t('shopPlacingOrder')
          : pointsCoverFullOrder
            ? t('shopPlaceOrderPoints')
            : `${t('shopPlaceOrder')} — CHF ${total.toFixed(2)}`;

  const renderDiscountControls = () => (
    <>
      {draft.voucherCode && voucherDiscount > 0 ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-teal-800">
            {draft.voucherName || draft.voucherCode}: − CHF {voucherDiscount.toFixed(2)}
          </span>
          <button type="button" className="text-xs font-semibold text-stone-600" onClick={removeVoucher}>
            {t('shopRemoveVoucher')}
          </button>
        </div>
      ) : voucherInputOpen ? (
        <div className="flex gap-2">
          <input
            className="flex-1 border border-stone-300 px-3 py-2 text-sm uppercase"
            placeholder={t('shopEnterDiscountCode')}
            value={voucherInput}
            onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            className="px-3 py-2 text-sm font-semibold bg-stone-900 text-white disabled:opacity-40"
            disabled={applyingVoucher || !voucherInput.trim()}
            onClick={() => void applyVoucher()}
          >
            {applyingVoucher ? t('shopChecking') : t('shopApplyVoucher')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="w-full rounded-md border border-stone-200 py-2.5 text-sm font-medium text-rose-400"
          onClick={() => setVoucherInputOpen(true)}
        >
          {t('shopAddDiscount')}
        </button>
      )}
    </>
  );

  const explainAppliedOffer = (offer: ShopAppliedOffer, items = draft.items) => {
    const badge = String(offer.badgeLabel || offer.name || '');
    const parsed = parseBuyGetLabel(badge);
    if (parsed) {
      const best = bestBogoProduct(items, parsed.buy, parsed.get);
      if (best?.name && best.sets > 0) {
        return t('shopOfferExplainBogo', {
          buy: parsed.buy,
          get: parsed.get,
          product: best.name,
          sets: best.sets,
          free: best.free,
        });
      }
      if (best?.name) {
        return t('shopOfferExplainBogoOn', {
          buy: parsed.buy,
          get: parsed.get,
          product: best.name,
        });
      }
      return t('shopOfferExplainBogoGeneric', { buy: parsed.buy, get: parsed.get });
    }
    const name = String(offer.name || offer.badgeLabel || '').trim();
    if (offer.description && name) return `${name} — ${offer.description}`;
    if (name) return t('shopOfferExplainNamed', { name });
    return t('shopOffer');
  };

  const renderCartItems = () =>
    draft.items.length === 0 ? (
      <p className="text-sm text-stone-500">{t('shopNoItems')}</p>
    ) : (
    <ul className="text-sm space-y-4">
      {groupCartForDisplay(draft.items).map((block) => {
        if (block.kind === 'offer') {
          const paidQty = block.lines
            .filter((l) => l.price > 0)
            .reduce((s, l) => s + l.quantity, 0);
          const freeQty = block.lines
            .filter((l) => l.price === 0)
            .reduce((s, l) => s + l.quantity, 0);
          const bakedExplain = explainAppliedOffer(
            {
              name: block.offerName,
              badgeLabel: block.offerBadge,
            },
            block.lines
          );
          const bakedFallback =
            paidQty + freeQty > 0
              ? t('shopOfferExplainBaked', { paid: paidQty, free: freeQty })
              : '';
          return (
            <li
              key={block.offerInstanceId}
              className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="inline-block rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {block.offerBadge || t('shopOffer')}
                  </span>
                  <p className="mt-1 font-semibold text-sm">{block.offerName}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-amber-900/80">
                    {bakedExplain || bakedFallback}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-rose-600"
                  onClick={() => removeOfferBlock(block.offerInstanceId)}
                >
                  {t('shopRemove')}
                </button>
              </div>
              {block.lines.map((i) => (
                <div key={i.lineId || i.id} className="flex justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    {i.name}
                    {i.price === 0 ? ` · ${t('shopFree')}` : ''}
                  </span>
                  <span className="shrink-0">
                    {i.price === 0 ? t('shopFree') : `CHF ${(i.price * i.quantity).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </li>
          );
        }
        const i = block.item;
        const lineKey = i.lineId || i.id;
        return (
          <li key={lineKey} className="space-y-1.5">
            <div className="flex justify-between gap-3">
              <p className="font-semibold text-stone-900 min-w-0">
                {i.name}
                {i.loyaltyReward && (
                  <span className="ml-1 text-xs font-semibold text-teal-800">{t('shopFree')}</span>
                )}
              </p>
              <span className="shrink-0 tabular-nums">CHF {(i.price * i.quantity).toFixed(2)}</span>
            </div>
            {!!i.comboSelections?.length && (
              <p className="text-xs text-stone-500">
                {i.comboSelections.map((c) => `${c.slotName}: ${c.productName}`).join(' · ')}
              </p>
            )}
            {!!i.selectedExtras?.length && (
              <p className="text-xs text-stone-500">{i.selectedExtras.map((e) => e.name).join(', ')}</p>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-1 py-0.5">
                <button
                  type="button"
                  className="h-6 w-6 text-sm font-semibold"
                  onClick={() => setLineQty(lineKey, i.quantity - 1)}
                >
                  −
                </button>
                <span className="w-5 text-center font-semibold">{i.quantity}</span>
                <button
                  type="button"
                  className="h-6 w-6 text-sm font-semibold"
                  onClick={() => setLineQty(lineKey, i.quantity + 1)}
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Link to={menuPath} className="text-stone-500 hover:underline">
                  {t('shopEdit')}
                </Link>
                <button
                  type="button"
                  className="font-medium text-rose-600"
                  onClick={() => removeLine(lineKey)}
                >
                  {t('shopRemove')}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
    );

  const renderCartTotals = () => (
    <div className="text-sm space-y-1">
      <ShopCartThresholdSlot
        className="mb-2"
        channel={draft.channel}
        subtotal={subtotal}
        minOrder={minOrderThreshold}
        freeDeliveryFrom={freeDeliveryThreshold}
      />
      <div className="flex justify-between">
        <span className="text-stone-500">{t('shopSubtotal')}</span>
        <span>CHF {subtotal.toFixed(2)}</span>
      </div>
      {offerDiscount > 0 && (
        <div className="space-y-1.5 py-0.5">
          {(appliedOffers.length ? appliedOffers : [{ name: t('shopOffer'), discount: offerDiscount }]).map(
            (offer, idx) => {
              const amount = appliedOffers.length === 1 ? offerDiscount : Number(offer.discount) || 0;
              const shown = amount > 0 ? amount : offerDiscount;
              return (
                <div key={offer.offerId || `${offer.name || 'offer'}-${idx}`} className="space-y-0.5">
                  <div className="flex justify-between gap-3 text-amber-800">
                    <span className="font-medium min-w-0">
                      {offer.badgeLabel || offer.name || t('shopOffer')}
                    </span>
                    <span className="shrink-0 tabular-nums">- CHF {shown.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-amber-800/80 pr-16">
                    {explainAppliedOffer(offer)}
                  </p>
                </div>
              );
            }
          )}
        </div>
      )}
      {giftCardDiscount > 0 && (
        <div className="flex justify-between text-teal-800">
          <span>{t('giftCard')}</span>
          <span>- CHF {giftCardDiscount.toFixed(2)}</span>
        </div>
      )}
      {voucherDiscount > 0 && (
        <div className="flex justify-between text-teal-800">
          <span>{draft.voucherName || draft.voucherCode || t('shopVoucherDiscount')}</span>
          <span>- CHF {voucherDiscount.toFixed(2)}</span>
        </div>
      )}
      {pointsDiscount > 0 && (
        <div className="flex justify-between text-teal-800">
          <span>{t('shopPointsDiscount')}</span>
          <span>- CHF {pointsDiscount.toFixed(2)}</span>
        </div>
      )}
      {deliveryFee > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-500">{t('shopDelivery')}</span>
          <span>CHF {deliveryFee.toFixed(2)}</span>
        </div>
      )}
      {tax > 0 && taxRate > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-500">
            {t('shopTaxWithRate').replace('{rate}', String(taxRate))}
          </span>
          <span>CHF {tax.toFixed(2)}</span>
        </div>
      )}
      {tip > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-500">{t('shopTip')}</span>
          <span>CHF {tip.toFixed(2)}</span>
        </div>
      )}
      {cardFee > 0 && (
        <div className="flex justify-between">
          <span className="text-stone-500">{t('shopCardFee')}</span>
          <span>CHF {cardFee.toFixed(2)}</span>
        </div>
      )}
      {rounding !== 0 && (
        <div className="flex justify-between">
          <span className="text-stone-500">{t('shopRounding')}</span>
          <span>
            {rounding > 0 ? '+' : ''}CHF {rounding.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );

  const renderGrandTotal = () => (
    <div className="flex justify-between font-semibold text-base pt-1">
      <span>{t('shopTotal')}</span>
      <span>CHF {total.toFixed(2)}</span>
    </div>
  );

  return (
    <ShopThemeShell
      theme={cmsTheme}
      site={shopSite}
      pageTitle={merchant?.name}
      logoUrl={merchant?.shopLogoUrl}
      className="min-h-dvh"
      style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text)' }}
    >
    <div className="min-h-dvh">
      <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
      <ShopMinimalHeader
        basePath={shopBasePath(shopKey, locSlug)}
        merchantName={merchant?.name}
        logoUrl={merchant?.shopLogoUrl}
        shopKey={shopKey}
        loggedIn={!!customer}
      />

      <div className="shop-page-content py-8 pb-32 lg:pb-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{t('shopCheckoutTitle')}</h1>
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1.15fr)_24rem] lg:items-start lg:gap-8">
        <div className="max-w-2xl space-y-8 lg:max-w-none">
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-stone-900">
                {draft.channel === 'delivery'
                  ? t('shopDeliveryDetails')
                  : draft.channel === 'dine_in'
                    ? t('shopDineIn')
                    : t('shopPickupDetails')}
              </h2>
              <p className="text-sm font-medium text-stone-800">{merchant?.name}</p>
              {(merchant?.address || merchant?.city) && (
                <p className="text-sm text-stone-600">
                  {merchant?.address}
                  {merchant?.city ? `, ${merchant.city}` : ''}
                </p>
              )}
              <p className="text-sm text-stone-600">
                {channelLabel}{' '}
                {formatShopChannelEta(
                  merchant?.channels?.[draft.channel]?.etaMinutes || 30,
                  draft.channel,
                  t('shopMins')
                )}
                {whenMode === 'later' && draft.scheduledFor
                  ? ` · ${formatDateTime(localDateTimeToIso(draft.scheduledFor) || draft.scheduledFor)}`
                  : ''}
              </p>
            </section>

            {customer ? (
              <p className="text-sm text-teal-800 border border-teal-100 bg-teal-50 px-3 py-2 rounded-xl">
                {t('shopLoggedInAs')} {customer.name || customer.email}.{' '}
                <Link to={accountPath} className="underline font-medium">
                  {t('shopMyAccount')}
                </Link>
                {' · '}
                <button
                  type="button"
                  className="underline font-medium"
                  onClick={() => {
                    clearCustomerToken(shopKey);
                    setCustomer(null);
                    patch({ authMode: 'guest' });
                  }}
                >
                  {t('shopLogOut')}
                </button>
              </p>
            ) : (
              <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
                    aria-hidden
                  >
                    <Trophy className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </span>
                  <span>{t('shopCheckoutRewardsTitleShort')}</span>
                </h3>
                <ul className="mt-2 space-y-1">
                  {(
                    [
                      'shopCheckoutReward1Short',
                      'shopCheckoutReward2Short',
                      'shopCheckoutReward3Short',
                    ] as const
                  ).map((key) => (
                    <li key={key} className="flex items-start gap-2 text-xs text-stone-700">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--shop-accent,#e11d48)]"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>

                {!showLogin && !showRegister ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => {
                        setShowLogin(true);
                        setShowRegister(false);
                        setWantCreateAccount(false);
                        setPassword('');
                        setConfirmPassword('');
                        if (draft.customerEmail) setLoginEmail(draft.customerEmail);
                      }}
                    >
                      {t('shopLogIn')}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900"
                      onClick={() => {
                        setShowRegister(true);
                        setShowLogin(false);
                        setWantCreateAccount(false);
                        setLoginPassword('');
                        if (draft.customerEmail) setLoginEmail(draft.customerEmail);
                      }}
                    >
                      {t('shopCreateAccount')}
                    </button>
                  </div>
                ) : null}

                {showLogin ? (
                  <form onSubmit={onLogin} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold text-sm">{t('shopLogIn')}</h2>
                      <button
                        type="button"
                        className="text-xs text-stone-500 underline"
                        onClick={() => setShowLogin(false)}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                    <input
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      type="email"
                      placeholder={t('shopEmail')}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                    <input
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      type="password"
                      placeholder={t('shopPassword')}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-stone-900 py-2 text-sm font-semibold text-white"
                    >
                      {t('shopLogIn')}
                    </button>
                    <button
                      type="button"
                      className="w-full text-xs text-stone-600 underline"
                      onClick={() => {
                        setShowLogin(false);
                        setShowRegister(true);
                        setLoginPassword('');
                        if (draft.customerEmail && !loginEmail) setLoginEmail(draft.customerEmail);
                      }}
                    >
                      {t('shopDontHaveAccount')} {t('shopCreateAccount')}
                    </button>
                  </form>
                ) : null}

                {showRegister ? (
                  <form
                    onSubmit={onRegisterFromPerks}
                    className="mt-3 space-y-2 border-t border-stone-100 pt-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-semibold text-sm">{t('shopCreateAccount')}</h2>
                      <button
                        type="button"
                        className="text-xs text-stone-500 underline"
                        onClick={() => {
                          setShowRegister(false);
                          setPassword('');
                          setConfirmPassword('');
                        }}
                      >
                        {t('cancel')}
                      </button>
                    </div>
                    <input
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      type="email"
                      placeholder={t('shopEmail')}
                      value={loginEmail}
                      onChange={(e) => {
                        setLoginEmail(e.target.value);
                        patch({ customerEmail: e.target.value });
                      }}
                      required
                      autoComplete="email"
                    />
                    <input
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      type="password"
                      placeholder={t('shopPasswordMin6')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <input
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      type="password"
                      placeholder={t('shopConfirmPassword')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-stone-900 py-2 text-sm font-semibold text-white"
                    >
                      {t('shopCreateAccount')}
                    </button>
                    <button
                      type="button"
                      className="w-full text-xs text-stone-600 underline"
                      onClick={() => {
                        setShowRegister(false);
                        setShowLogin(true);
                        setPassword('');
                        setConfirmPassword('');
                      }}
                    >
                      {t('shopHaveAccount')} {t('shopLogIn')}
                    </button>
                  </form>
                ) : null}
              </div>
            )}
            </div>

            {showChannelPicker ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">{t('shopFulfillment')}</p>
                <div
                  className={`grid gap-2 ${
                    channelOptions.length >= 3
                      ? 'grid-cols-3'
                      : channelOptions.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1'
                  }`}
                >
                  {channelOptions.map((c) => {
                    const meta = merchant?.channels?.[c.id];
                    const on = draft.channel === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => patchChannel(c.id)}
                        className={`rounded-xl border px-2 sm:px-3 py-2.5 sm:py-3 text-center sm:text-left transition min-w-0 ${
                          on
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-400'
                        }`}
                      >
                        <span className="block text-xs sm:text-sm font-semibold truncate">{c.label}</span>
                        <span
                          className={`block text-[10px] sm:text-[11px] mt-0.5 truncate ${
                            on ? 'text-white/70' : 'text-stone-500'
                          }`}
                        >
                          {formatShopChannelEta(meta?.etaMinutes || 30, c.id, t('shopMins'))}
                          {meta && !meta.open ? ` · ${t('shopClosed')}` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

              {/* 2. When / schedule */}
              {!fulfillmentLocked ? (
              <div className="border-t border-stone-100 pt-4 space-y-3">
                <label className="block text-sm font-semibold">{t('shopWhen')}</label>
                {!channelOpen && (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 px-3 py-2">
                    {t('shopStoreClosedNow')}
                  </p>
                )}
                {merchant?.scheduledOrdersEnabled === false ? (
                  channelOpen ? (
                    <p className="text-sm text-stone-600">{t('shopAsap')}</p>
                  ) : null
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {channelOpen && (
                        <button
                          type="button"
                          className={`px-3 py-2 text-sm border ${
                            whenMode === 'asap' ? 'bg-stone-900 text-white' : 'bg-white'
                          }`}
                          onClick={() => {
                            setWhenMode('asap');
                            patch({ scheduledFor: '' });
                          }}
                        >
                          {t('shopAsap')}
                        </button>
                      )}
                      <button
                        type="button"
                        className={`px-3 py-2 text-sm border ${
                          whenMode === 'later' ? 'bg-stone-900 text-white' : 'bg-white'
                        }`}
                        onClick={() => {
                          setWhenMode('later');
                          setCustomScheduleDay(null);
                          setChooseScheduleDateOpen(false);
                          setShowAllScheduleSlots(false);
                          if (todayScheduleDay) setScheduleDayOffset(0);
                        }}
                      >
                        {t('shopScheduleLater')}
                      </button>
                    </div>

                    {whenMode === 'later' && (
                      <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                        {scheduleDays.length === 0 && !customScheduleDay ? (
                          <p className="text-sm text-red-600">{t('shopNoOpenHours')}</p>
                        ) : (
                          <>
                            {!customScheduleDay ? (
                              <div className="flex flex-wrap items-stretch gap-2">
                                {todayScheduleDay ? renderScheduleDayButton(todayScheduleDay) : null}
                                {tomorrowScheduleDay ? renderScheduleDayButton(tomorrowScheduleDay) : null}
                                {dayAfterScheduleDay ? renderScheduleDayButton(dayAfterScheduleDay) : null}
                                {!showMoreScheduleDays && extraScheduleDays.length > 0 ? (
                                  <button
                                    type="button"
                                    className="inline-flex min-w-[2.75rem] items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-2 text-lg font-semibold text-stone-700 hover:border-stone-900"
                                    aria-label={t('shopMoreDates')}
                                    title={t('shopMoreDates')}
                                    onClick={() => setShowMoreScheduleDays(true)}
                                  >
                                    +
                                  </button>
                                ) : null}
                                {showMoreScheduleDays
                                  ? extraScheduleDays.map((day) => renderScheduleDayButton(day))
                                  : null}
                                <button
                                  type="button"
                                  className={`rounded-full border px-3 py-1.5 text-sm ${
                                    chooseScheduleDateOpen || customScheduleDay
                                      ? 'border-stone-900 bg-stone-900 text-white'
                                      : 'border-stone-300 bg-white'
                                  }`}
                                  onClick={() => {
                                    if (chooseScheduleDateOpen || customScheduleDay) {
                                      setChooseScheduleDateOpen(false);
                                      setCustomScheduleDay(null);
                                      setScheduleCalendarDate('');
                                      return;
                                    }
                                    openScheduleCalendarPicker();
                                  }}
                                >
                                  {t('shopChooseDate')}
                                </button>
                              </div>
                            ) : null}
                            {chooseScheduleDateOpen ? (
                              <input
                                ref={scheduleCalendarRef}
                                type="date"
                                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                                min={scheduleCalendarMin}
                                max={scheduleCalendarMax}
                                value={scheduleCalendarDate}
                                onChange={(e) => onScheduleCalendarPick(e.target.value)}
                              />
                            ) : null}
                            {customScheduleDay ? (
                              <p className="text-sm font-medium text-stone-800">
                                {customScheduleDay.weekday} {customScheduleDay.dateLabel}
                              </p>
                            ) : null}
                            <div>
                              <p className="text-xs text-stone-500 mb-2">{t('shopTimeSlotsHint')}</p>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {visibleScheduleSlots.map((slot) => (
                                  <button
                                    key={slot.value}
                                    type="button"
                                    className={`px-2 py-2 text-sm border rounded-md font-medium ${
                                      draft.scheduledFor === slot.value
                                        ? 'bg-teal-700 text-white border-teal-700'
                                        : 'bg-white border-stone-300 hover:border-stone-900'
                                    }`}
                                    onClick={() => patch({ scheduledFor: slot.value })}
                                  >
                                    {slot.label}
                                  </button>
                                ))}
                              </div>
                              {hiddenScheduleSlotCount > 0 && !showAllScheduleSlots ? (
                                <button
                                  type="button"
                                  className="mt-2 text-sm font-medium text-stone-700 underline underline-offset-2"
                                  onClick={() => setShowAllScheduleSlots(true)}
                                >
                                  {t('shopMoreSlots').replace('{n}', String(hiddenScheduleSlotCount))}
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              ) : null}

                {draft.channel === 'delivery' && !fulfillmentLocked && (
                  <div className="space-y-3 border-t border-stone-100 pt-4">
                    {customer ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{t('shopSavedAddresses')}</p>
                        <div className="flex flex-wrap gap-2">
                          {savedAddresses.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => applySavedAddress(a)}
                              className={`rounded-full border px-3 py-1.5 text-left text-xs sm:text-sm max-w-full ${
                                selectedAddressId === a.id
                                  ? 'border-stone-900 bg-stone-900 text-white'
                                  : 'border-stone-200 bg-white text-stone-800'
                              }`}
                            >
                              <span className="font-semibold">{addressLabelText(a.label)}</span>
                              <span className="opacity-80"> · {a.address}</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAddressId(null);
                              setDeliveryInfo(null);
                            }}
                            className={`rounded-full border px-3 py-1.5 text-xs sm:text-sm ${
                              selectedAddressId == null
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-200 bg-white text-stone-800'
                            }`}
                          >
                            {t('shopNewAddress')}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <input
                      className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                      placeholder={t('shopStreetAddressRequired')}
                      value={draft.address}
                      onChange={(e) => {
                        setSelectedAddressId(null);
                        patch({ address: e.target.value, lat: undefined, lng: undefined });
                      }}
                    />
                    <ZipCityFields
                      shopKey={shopKey}
                      zipCode={draft.zipCode}
                      city={draft.city}
                      onZipChange={(zipCode) => {
                        setSelectedAddressId(null);
                        patch({ zipCode, lat: undefined, lng: undefined });
                      }}
                      onCityChange={(city) => {
                        setSelectedAddressId(null);
                        patch({ city, lat: undefined, lng: undefined });
                      }}
                      zipClassName="border border-stone-300 bg-white px-3 py-2 text-sm w-full rounded-md"
                      cityClassName="border border-stone-300 bg-white px-3 py-2 text-sm w-full rounded-md"
                    />
                    <button
                      type="button"
                      className="rounded-md border border-stone-900 bg-white px-4 py-2 text-sm font-semibold text-stone-900"
                      onClick={() => void checkDelivery()}
                      disabled={checkingZone}
                    >
                      {checkingZone ? t('shopChecking') : t('shopVerifyDeliveryZone')}
                    </button>
                    {effectiveDeliveryInfo?.deliverable && (
                      <p className={`text-sm ${effectiveDeliveryInfo.meetsMinOrder ? 'text-teal-800' : 'text-amber-800'}`}>
                        {effectiveDeliveryInfo.zone.name}: {t('shopFee')} CHF{' '}
                        {Number(effectiveDeliveryInfo.zone.deliveryFee).toFixed(2)}
                        {effectiveDeliveryInfo.zone.minOrderAmount > 0
                          ? ` · ${t('shopMin')} CHF ${Number(effectiveDeliveryInfo.zone.minOrderAmount).toFixed(2)}`
                          : ''}
                        {!effectiveDeliveryInfo.meetsMinOrder && effectiveDeliveryInfo.message
                          ? ` · ${effectiveDeliveryInfo.message}`
                          : ''}
                      </p>
                    )}

                    {customer && draft.address.trim() ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-stone-500">{t('shopSelectLabel')}</span>
                        {ADDRESS_LABELS.map((lab) => (
                          <button
                            key={lab}
                            type="button"
                            onClick={() => setSaveLabel(lab)}
                            className={`rounded-full border px-2.5 py-1 text-xs ${
                              saveLabel === lab
                                ? 'border-amber-700 bg-amber-700 text-white'
                                : 'border-stone-200 bg-white'
                            }`}
                          >
                            {addressLabelText(lab)}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="ml-auto border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          disabled={savingAddress || !draft.address.trim()}
                          onClick={() => void saveCurrentAddress()}
                        >
                          {savingAddress ? t('shopSavingAddress') : t('shopSaveAddress')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}


            {!customer ? (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[var(--shop-bg-muted,#f6f5f2)] px-3 text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {t('shopOrderAsGuest')}
                  </span>
                </div>
              </div>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-stone-900">{t('shopPersonalInfo')}</h2>
                <span className="text-xs text-rose-500">{t('shopAllFieldsRequired')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className={SHOP_LABEL_CLASS}>{t('shopFirstName')}</span>
                  <input
                    ref={firstNameRef}
                    className={`${SHOP_INPUT_CLASS} ${
                      fieldErrors.customerFirstName || fieldErrors.customerName
                        ? 'border-rose-500'
                        : ''
                    }`}
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (fieldErrors.customerFirstName || fieldErrors.customerName) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          customerFirstName: undefined,
                          customerName: undefined,
                        }));
                      }
                    }}
                    onInput={(e) => setFirstName(e.currentTarget.value)}
                    autoComplete="given-name"
                  />
                  {fieldErrors.customerFirstName ? (
                    <p className="text-sm text-rose-600">{fieldErrors.customerFirstName}</p>
                  ) : null}
                </label>
                <label className="space-y-1">
                  <span className={SHOP_LABEL_CLASS}>{t('shopLastName')}</span>
                  <input
                    ref={lastNameRef}
                    className={`${SHOP_INPUT_CLASS} ${
                      fieldErrors.customerLastName || fieldErrors.customerName
                        ? 'border-rose-500'
                        : ''
                    }`}
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (fieldErrors.customerLastName || fieldErrors.customerName) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          customerLastName: undefined,
                          customerName: undefined,
                        }));
                      }
                    }}
                    onInput={(e) => setLastName(e.currentTarget.value)}
                    autoComplete="family-name"
                  />
                  {fieldErrors.customerLastName ? (
                    <p className="text-sm text-rose-600">{fieldErrors.customerLastName}</p>
                  ) : null}
                </label>
              </div>
              {fieldErrors.customerName ? (
                <p className="text-sm text-rose-600">{fieldErrors.customerName}</p>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="space-y-1 min-w-0">
                  <span className={SHOP_LABEL_CLASS}>{t('shopEmail')}</span>
                  <input
                    className={`${SHOP_INPUT_CLASS} ${
                      fieldErrors.customerEmail ? 'border-rose-500' : ''
                    }`}
                    type="email"
                    value={draft.customerEmail}
                    onChange={(e) => {
                      patch({ customerEmail: e.target.value });
                      if (!showLogin) setLoginEmail(e.target.value);
                      if (fieldErrors.customerEmail) {
                        setFieldErrors((prev) => ({ ...prev, customerEmail: undefined }));
                      }
                    }}
                  />
                </label>
                <label className="space-y-1 min-w-0">
                  <span className={SHOP_LABEL_CLASS}>{t('shopPhone')}</span>
                  <ShopPhoneField
                    value={draft.customerPhone}
                    invalid={!!fieldErrors.customerPhone}
                    placeholder={t('shopPhone')}
                    localInputRef={phoneLocalRef}
                    onChange={(full) => {
                      patch({ customerPhone: full });
                      if (fieldErrors.customerPhone) {
                        setFieldErrors((prev) => ({ ...prev, customerPhone: undefined }));
                      }
                    }}
                  />
                </label>
              </div>
              {fieldErrors.customerEmail ? (
                <p className="text-sm text-rose-600">{fieldErrors.customerEmail}</p>
              ) : null}
              {fieldErrors.customerPhone ? (
                <p className="text-sm text-rose-600">{fieldErrors.customerPhone}</p>
              ) : null}
              {!customer && !showRegister ? (
                <div className="space-y-3 pt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm text-stone-800">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600"
                      checked={wantCreateAccount}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setWantCreateAccount(on);
                        setShowLogin(false);
                        setShowRegister(false);
                        if (!on) {
                          setPassword('');
                          setConfirmPassword('');
                        }
                      }}
                    />
                    <span>{t('shopCreateAccountFaster')}</span>
                  </label>
                  {wantCreateAccount ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="space-y-1 min-w-0">
                        <span className={SHOP_LABEL_CLASS}>{t('shopPassword')}</span>
                        <input
                          className={SHOP_INPUT_CLASS}
                          type="password"
                          placeholder={t('shopPasswordMin6')}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </label>
                      <label className="space-y-1 min-w-0">
                        <span className={SHOP_LABEL_CLASS}>{t('shopConfirmPassword')}</span>
                        <input
                          className={SHOP_INPUT_CLASS}
                          type="password"
                          placeholder={t('shopConfirmPassword')}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-stone-900">{t('shopOrderInstructions')}</h2>
              <textarea
                className={SHOP_INPUT_CLASS}
                rows={3}
                placeholder={t('shopOrderInstructionsPlaceholder')}
                value={draft.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </section>

              {giftCardsEnabled && (
                <div className="border border-stone-200 p-4 space-y-2">
                  <label className="block text-sm font-medium">{t('shopGiftCardPayAtCheckout')}</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border border-stone-300 px-3 py-2 text-sm font-mono"
                      placeholder={t('giftCardEcardPlaceholder')}
                      value={draft.giftCardCode || ''}
                      onChange={(e) => {
                        patch({ giftCardCode: e.target.value });
                        setGiftCardBalance(0);
                        setGiftCardLookupError(null);
                      }}
                    />
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border border-stone-300 bg-white shrink-0"
                      onClick={async () => {
                        const code = draft.giftCardCode?.trim();
                        if (!code || !shopKey) return;
                        setGiftCardLookupError(null);
                        try {
                          const res = await axios.get(
                            `/api/shop/${shopKey}/gift-cards/balance/${encodeURIComponent(code)}`
                          );
                          setGiftCardBalance(Number(res.data.balance) || 0);
                        } catch (err: any) {
                          setGiftCardBalance(0);
                          setGiftCardLookupError(
                            err?.response?.data?.error || t('giftCardNotFound')
                          );
                        }
                      }}
                    >
                      {t('giftCardLookup')}
                    </button>
                  </div>
                  {giftCardBalance > 0 && (
                    <p className="text-sm text-teal-800">
                      {t('shopGiftCardBalanceApplied').replace(
                        '{amount}',
                        giftCardDiscount.toFixed(2)
                      )}
                    </p>
                  )}
                  {giftCardLookupError && (
                    <p className="text-sm text-red-600">{giftCardLookupError}</p>
                  )}
                </div>
              )}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-stone-900">{t('shopPaymentDetails')}</h2>
                {loyaltyEnabled && maxCashPoints > 0 && (
                  <label
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer ${
                      payWithPoints
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payPrimary"
                      checked={payWithPoints}
                      onChange={() => {
                        setPayWithPoints(true);
                        patch({
                          pointsToRedeem: maxCashPoints,
                          paymentMethod: 'cash',
                        });
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t('shopPayWithPoints')}</div>
                      <p className="text-sm text-stone-600 mt-0.5">
                        {t('shopPayWithPointsHint')
                          .replace('{pts}', String(balanceAfterRewards))
                          .replace('{chf}', (maxCashPoints / rate).toFixed(2))}
                      </p>
                      {payWithPoints && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="range"
                            min={rate}
                            max={maxCashPoints}
                            step={rate}
                            value={Math.max(rate, pointsToRedeem)}
                            onChange={(e) =>
                              patch({
                                pointsToRedeem: Math.max(
                                  rate,
                                  Math.floor(Number(e.target.value) || 0)
                                ),
                              })
                            }
                            className="w-full"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span>
                              {t('shopPointsChip').replace('{n}', String(pointsToRedeem))}
                            </span>
                            <span className="font-semibold text-teal-900">
                              - CHF {pointsDiscount.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500">
                            {t('shopRedeemHint').replace('{n}', String(rate))}
                            {' · '}
                            {t('shopPointsCoverFoodFees')}
                          </p>
                          {total > 0.001 ? (
                            <div className="pt-2 border-t border-emerald-100 space-y-2">
                              <p className="text-xs font-medium text-stone-700">
                                {t('shopPayRemaining')
                                  .replace('{chf}', total.toFixed(2))}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className={payChoiceClass(
                                    draft.paymentMethod === 'cash' ||
                                      draft.paymentMethod === 'pay_later'
                                  )}
                                  onClick={() =>
                                    patch({
                                      paymentMethod:
                                        draft.channel === 'delivery' ? 'cash' : 'pay_later',
                                    })
                                  }
                                >
                                  <span
                                    className={payDotClass(
                                      draft.paymentMethod === 'cash' ||
                                        draft.paymentMethod === 'pay_later'
                                    )}
                                  />
                                  {draft.channel === 'delivery'
                                    ? t('shopCashOnDelivery')
                                    : t('shopPayLater')}
                                </button>
                                <button
                                  type="button"
                                  className={payChoiceClass(draft.paymentMethod === 'card')}
                                  onClick={() => patch({ paymentMethod: 'card' })}
                                >
                                  <span className={payDotClass(draft.paymentMethod === 'card')} />
                                  {t('shopCardAdyen')}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-teal-900 pt-1">
                              {t('shopPointsCoverAll')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </label>
                )}
              <div className="flex gap-3">
                <button
                  type="button"
                  className={payChoiceClass(cashSelected)}
                  onClick={() => {
                    setPayWithPoints(false);
                    patch({
                      paymentMethod: draft.channel === 'delivery' ? 'cash' : 'pay_later',
                      pointsToRedeem: 0,
                    });
                  }}
                >
                  <span className={payDotClass(cashSelected)} />
                  {t('shopCash')}
                </button>
                <button
                  type="button"
                  className={payChoiceClass(cardSelected)}
                  onClick={() => {
                    setPayWithPoints(false);
                    patch({ paymentMethod: 'card', pointsToRedeem: 0 });
                  }}
                >
                  <span className={payDotClass(cardSelected)} />
                  {t('shopPayOnline')}
                </button>
              </div>
              {cardSelected && customer ? (
                <p className="text-xs text-stone-500">{t('shopCardSaveHint')}</p>
              ) : null}
            </section>
            <section className="space-y-3 lg:hidden">
              {renderDiscountControls()}
              {renderTipPicker()}
              {renderGrandTotal()}
            </section>

        </div>

        <aside className="shop-checkout-desktop-cart mt-8 hidden lg:block lg:mt-0">
          <Link
            to={menuPath}
            className="mb-3 inline-flex w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            {t('shopAddMoreItems')}
          </Link>
          <div className="shop-checkout-desktop-cart__panel rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex shrink-0 items-center gap-2 text-base font-bold tracking-tight">
              <ShoppingBag className="h-5 w-5 text-emerald-600" strokeWidth={1.8} />
              {t('shopYourCart')}
            </h2>
            <div className="shop-checkout-desktop-cart__items pr-1">{renderCartItems()}</div>
            <div className="shop-checkout-desktop-cart__footer space-y-3 border-t border-stone-100 pt-3">
              {renderCartTotals()}
              {renderDiscountControls()}
              {renderTipPicker()}
              {renderGrandTotal()}
              <button
                type="button"
                className={`shop-checkout-sticky-bar__order w-full ${checkoutReady ? 'is-ready' : 'is-pending'}`}
                disabled={placeOrderDisabled}
                onClick={() => void submitCheckout()}
              >
                {placeOrderLabel}
              </button>
            </div>
          </div>
        </aside>
        </div>
      </div>

      <div className="shop-checkout-sticky-bar lg:hidden">
        <button
          type="button"
          className="shop-checkout-sticky-bar__cart"
          onClick={() => setCartPopupOpen(true)}
          aria-label={`${t('shopYourCart')} (${itemCount})`}
        >
          <ShoppingBag className="h-5 w-5" strokeWidth={1.9} />
          {itemCount > 0 ? (
            <span className="shop-checkout-sticky-bar__badge">
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={`shop-checkout-sticky-bar__order ${checkoutReady ? 'is-ready' : 'is-pending'}`}
          disabled={placeOrderDisabled}
          onClick={() => void submitCheckout()}
        >
          {placeOrderLabel}
        </button>
      </div>

      {cartPopupOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
          onClick={() => setCartPopupOpen(false)}
          role="presentation"
        >
          <div
            className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('shopYourCart')}
          >
            <div className="border-b border-stone-100 px-4 py-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                  <ShoppingBag className="h-5 w-5 text-emerald-600" strokeWidth={1.8} />
                  {t('shopYourCart')}
                </h2>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100"
                  onClick={() => setCartPopupOpen(false)}
                  aria-label={t('shopClose')}
                >
                  ×
                </button>
              </div>
              <Link
                to={menuPath}
                className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                onClick={() => setCartPopupOpen(false)}
              >
                {t('shopAddMoreItems')}
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">{renderCartItems()}</div>
            <div className="border-t border-stone-100 px-4 py-4 space-y-3">
              {renderCartTotals()}
              {renderDiscountControls()}
              {renderTipPicker()}
              {renderGrandTotal()}
            </div>
          </div>
        </div>
      ) : null}
      <ShopDeliveryAddressPopup
        open={deliveryAddressOpen}
        shopKey={shopKey}
        address={draft.address}
        zipCode={draft.zipCode}
        city={draft.city}
        subtotal={subtotal}
        merchantLat={merchant?.latitude}
        merchantLng={merchant?.longitude}
        onClose={() => {
          setDeliveryAddressOpen(false);
          if (channelBeforeDelivery) {
            setDraft((d) => ({ ...d, channel: channelBeforeDelivery! }));
            setChannelBeforeDelivery(null);
          }
        }}
        onConfirm={(payload) => {
          setDraft((d) => ({
            ...d,
            channel: 'delivery',
            address: payload.address,
            zipCode: payload.zipCode,
            city: payload.city,
            lat: payload.lat,
            lng: payload.lng,
            deliveryInfo: payload.deliveryInfo,
            fulfillmentConfirmed: true,
          }));
          setDeliveryInfo(payload.deliveryInfo);
          setDeliveryAddressOpen(false);
          setChannelBeforeDelivery(null);
          setWhenMode('asap');
          setScheduleDayOffset(0);
        }}
      />
      <ShopPaymentModal
        open={paymentModalOpen}
        shopKey={shopKey || ''}
        orderId={paymentOrderId}
        total={paymentTotal}
        session={paymentSession}
        demoMode={paymentDemoMode}
        demoError={paymentDemoError}
        onAbandon={() => {
          setPaymentModalOpen(false);
        }}
        onPaid={() => {
          setPaymentModalOpen(false);
          navigate(`${shopBasePath(shopKey, locSlug)}/order/${paymentOrderId}`);
        }}
        onRefreshSession={async () => {
          try {
            const res = await axios.post(`/api/shop/${shopKey}/orders/${paymentOrderId}/payment-session`, {
              ...shopCheckoutOriginPayload(shopBasePath(shopKey, locSlug)),
            }, shopCustomerAuthConfig(shopKey));
            if (res.data.alreadyPaid) {
              setPaymentModalOpen(false);
              navigate(`${shopBasePath(shopKey, locSlug)}/order/${paymentOrderId}`);
              return null;
            }
            const next = normalizeAdyenPaymentSession(res.data.paymentSession);
            if (next) {
              setPaymentSession(next);
              sessionStorage.setItem(`manupos_pay_${paymentOrderId}`, JSON.stringify(next));
            }
            return next;
          } catch {
            return null;
          }
        }}
      />
    </div>
    </ShopThemeShell>
  );
}
