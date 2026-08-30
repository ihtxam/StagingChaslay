import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  emptyDraft,
  groupCartForDisplay,
  lineSignature,
  loadCart,
  loadCustomerToken,
  newCartLineId,
  newOfferInstanceId,
  removeOfferInstance,
  resolveShopKey,
  resolveShopLocationSlug,
  saveCart,
  shopBasePath,
  shopMenuApiPath,
  type ShopCartItem,
  type ShopChannel,
  type ShopCheckoutDraft,
  type ShopComboSelection,
  type ShopSelectedExtra,
} from '@/lib/shop-cart';
import { roundMoney2 } from '@/lib/money';
import { formatShopChannelEta } from '@/lib/shop-eta';
import { shopDocumentTitle } from '@/lib/brand';
import ShopProductModifiersModal, {
  productHasModifiers,
  type ShopModifierGroup,
  type ShopProductForModifiers,
} from '@/components/shop/ShopProductModifiersModal';
import ShopComboWizard, {
  productHasComboSlots,
  type ComboSlot,
  type ShopComboProduct,
} from '@/components/shop/ShopComboWizard';
import { CalendarDays, ChevronDown, Info, Plus, ShoppingBag, User } from 'lucide-react';
import { isLocale, useI18n } from '@/lib/i18n';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopNotAcceptingBanner from '@/components/shop/ShopNotAcceptingBanner';
import ShopChannelPrompt, { type ShopFulfillmentConfirmPayload } from '@/components/shop/ShopChannelPrompt';
import ShopInfoSheet from '@/components/shop/ShopInfoSheet';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import ShopOfferPicker, {
  type ShopOfferForPicker,
  type ShopOfferProduct,
} from '@/components/shop/ShopOfferPicker';
import { findNextOpen, type StoreHours } from '@/lib/shop-hours';
import { applyPercent, isPickableDeal, matchingPercentOffer } from '@/lib/shop-offers';
import {
  buildCategoryDeliveryPricingMap,
  resolveShopItemDeliveryMarkup,
} from '@/lib/shop-delivery-pricing';

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  categoryId?: string | null;
  productType?: string;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number }>;
  specifications?: Array<{
    id: string;
    name: string;
    price: number;
    saleStatus?: 'in_stock' | 'out_of_stock';
    isDefault?: boolean;
    sortOrder?: number;
  }>;
  modifierGroups?: ShopModifierGroup[];
  comboSlots?: ComboSlot[];
  loyaltyRewardPoints?: number | null;
}

type LoyaltyReward = {
  id: string;
  name: string;
  image?: string | null;
  price: number;
  loyaltyRewardPoints: number;
  unlocked: boolean;
};

interface Category {
  id: string;
  name: string;
  image?: string | null;
  isOffersCategory?: boolean;
  deliveryPricingEnabled?: boolean;
  extraDeliveryPrice?: number;
  items: Product[];
}

interface ChannelInfo {
  enabled: boolean;
  open: boolean;
  todayLabel: string;
  etaMinutes: number;
}

export default function OrderingPage() {
  const { t, setLocale, locale } = useI18n();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug: string; locationSlug?: string }>();
  const [searchParams] = useSearchParams();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const locSlug = resolveShopLocationSlug({ locationSlug });
  const basePath = useMemo(() => shopBasePath(shopKey, locSlug), [shopKey, locSlug]);
  const cmsTheme = useShopCmsTheme(shopKey);
  const navigate = useNavigate();

  const [merchant, setMerchant] = useState<any>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [shopOffers, setShopOffers] = useState<ShopOfferForPicker[]>([]);
  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartSlideOpen, setCartSlideOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const prevItemCountRef = useRef(0);
  const hasAutoOpenedCartRef = useRef(false);
  const [promptInitialChannel, setPromptInitialChannel] = useState<ShopChannel>('takeaway');
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingCombo, setPendingCombo] = useState<ShopComboProduct | null>(null);
  const [pendingOffer, setPendingOffer] = useState<ShopOfferForPicker | null>(null);
  /** After picking a 2+1 deal, configure combo/modifier products one-by-one */
  const [offerConfigQueue, setOfferConfigQueue] = useState<
    Array<{
      productId: string;
      role: 'paid' | 'free';
      dealPrice: number;
      catalogPrice: number;
      offerId: string;
      offerBadge: string;
      offerInstanceId: string;
      offerName: string;
    }>
  >([]);
  const [offerConfigMeta, setOfferConfigMeta] = useState<{
    offerId: string;
    offerBadge: string;
    dealPrice: number;
    catalogPrice: number;
    role: 'paid' | 'free';
    offerInstanceId: string;
    offerName: string;
  } | null>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [loyaltyBalance, setLoyaltyBalance] = useState(0);
  const [loyaltyRewards, setLoyaltyRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyProgress, setLoyaltyProgress] = useState(0);
  const [nextRewardPts, setNextRewardPts] = useState<number | null>(null);
  const [channelPromptOpen, setChannelPromptOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  /** true = every category expanded; false = headers only */
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(true);
  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }

    const stored = loadCart(shopKey);
    if (stored) {
      setDraft(stored);
      if (stored.deliveryInfo) setDeliveryInfo(stored.deliveryInfo);
    }

    const load = async () => {
      try {
        const token = loadCustomerToken(shopKey);
        const [shopRes, menuRes, loyaltyRes] = await Promise.all([
          axios.get(`/api/shop/${shopKey}`),
          axios.get(shopMenuApiPath(shopKey, locSlug)),
          axios.get(`/api/shop/${shopKey}/loyalty`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
        ]);
        const data = shopRes.data.data;
        setMerchant(data);
        setMenu(menuRes.data.data || []);
        setShopOffers(menuRes.data.offers || []);
        setSelectedCategory('all');
        setAllCategoriesOpen(true);

        try {
          const z = await axios.get(`/api/shop/${shopKey}/delivery-zones`);
          const raw = z.data?.data ?? z.data?.zones ?? z.data;
          setDeliveryZones(Array.isArray(raw) ? raw : []);
        } catch {
          setDeliveryZones([]);
        }

        const loyaltyData = loyaltyRes.data || {};
        setLoyaltyRewards(loyaltyData.rewards || []);
        if (token && loyaltyData.balance != null) {
          setLoyaltyBalance(Number(loyaltyData.balance) || 0);
          setLoyaltyProgress(Number(loyaltyData.progressPercent) || 0);
          setNextRewardPts(
            loyaltyData.nextReward?.loyaltyRewardPoints != null
              ? Number(loyaltyData.nextReward.loyaltyRewardPoints)
              : null
          );
        } else {
          setLoyaltyBalance(0);
          setLoyaltyProgress(0);
          setNextRewardPts(null);
        }

        if (token) {
          try {
            const me = await axios.get(`/api/shop/${shopKey}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setCustomer(me.data.customer);
            if (me.data.customer?.loyaltyPoints != null) {
              setLoyaltyBalance(Number(me.data.customer.loyaltyPoints) || 0);
            }
          } catch {
            setCustomer(null);
          }
        } else {
          setCustomer(null);
        }

        if (isLocale(data.language)) {
          try {
            const stored = localStorage.getItem('manupos_shop_lang');
            if (!isLocale(stored)) setLocale(data.language);
          } catch {
            setLocale(data.language);
          }
        }
        const channels = data.channels || {};
        const preferred: ShopChannel[] = ['takeaway', 'delivery', 'dine_in'];
        const first = preferred.find((c) => channels[c]?.enabled);
        const mode = String(data.channelSelectMode || 'checkout');
        const resolvedChannel =
          stored?.channel && channels[stored.channel]?.enabled
            ? stored.channel
            : first || 'takeaway';
        const urlChannel = searchParams.get('channel') as ShopChannel | null;
        const urlTable = searchParams.get('table');
        const tableChannel =
          urlChannel === 'dine_in' && channels.dine_in?.enabled ? 'dine_in' : null;
        setDraft((d) => {
          const channel =
            tableChannel ||
            (d.channel && channels[d.channel]?.enabled ? d.channel : first || 'takeaway');
          const next = {
            ...d,
            channel,
            tableId: urlTable || d.tableId,
          };
          saveCart(shopKey, next);
          return next;
        });
        setError(null);
        // Popup at start when merchant asks for it and multiple channels exist
        const enabledCount = preferred.filter((c) => channels[c]?.enabled).length;
        if (mode === 'popup_start' && enabledCount > 1) {
          try {
            const key = `manupos_channel_prompted_${shopKey}`;
            if (!sessionStorage.getItem(key)) {
              setPromptInitialChannel(resolvedChannel);
              setChannelPromptOpen(true);
            }
          } catch {
            setChannelPromptOpen(true);
          }
        }
      } catch (e: any) {
        setError(e.response?.data?.error || t('shopFailedLoad'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [shopKey]);

  useEffect(() => {
    if (!shopKey || loading) return;
    saveCart(shopKey, draft);
  }, [draft, shopKey, loading]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (merchant?.name) document.title = shopDocumentTitle(merchant.name);
  }, [merchant?.name]);

  const channels: Record<ShopChannel, ChannelInfo> = merchant?.channels || {
    takeaway: { enabled: true, open: true, todayLabel: '', etaMinutes: 25 },
    dine_in: { enabled: true, open: true, todayLabel: '', etaMinutes: 25 },
    delivery: { enabled: true, open: true, todayLabel: '', etaMinutes: 45 },
  };

  const channel = draft.channel;
  const cart = draft.items;
  const categoryPricingEnabled = merchant?.categoryPricingEnabled === true;
  const deliveryMenuMarkup = useMemo(() => {
    const n = Number(merchant?.deliveryMenuMarkup ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [merchant]);
  const categoryDeliveryMap = useMemo(
    () =>
      buildCategoryDeliveryPricingMap(
        menu.map((c) => ({
          id: c.id,
          deliveryPricingEnabled: c.deliveryPricingEnabled,
          extraDeliveryPrice: c.extraDeliveryPrice,
        }))
      ),
    [menu]
  );
  const itemDeliveryMarkup = (categoryId?: string | null) =>
    resolveShopItemDeliveryMarkup(
      categoryPricingEnabled,
      channel,
      categoryId,
      deliveryMenuMarkup,
      categoryDeliveryMap
    );
  const catalogUnitPrice = (productPrice: number, categoryId?: string | null) =>
    roundMoney2(productPrice + itemDeliveryMarkup(categoryId));

  /** Keep cart line prices in sync when switching takeaway ↔ delivery (markup). */
  useEffect(() => {
    if (!merchant) return;
    setDraft((prev) => {
      let changed = false;
      const items = prev.items.map((item) => {
        if (item.loyaltyReward) return item;
        const markup = resolveShopItemDeliveryMarkup(
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
        const catalogUnit = roundMoney2(base + markup + extrasTotal);

        // Offer already baked (2+1 free / package / % off) - keep relative deal, refresh catalog
        if (item.offerId) {
          const wasFree = (item.catalogPrice != null && item.price === 0) || item.offerBadge?.toLowerCase().includes('free');
          if (wasFree || item.price === 0) {
            if (item.catalogPrice !== catalogUnit || item.price !== 0) {
              changed = true;
              return { ...item, basePrice: base, catalogPrice: catalogUnit, price: 0 };
            }
            return item;
          }
          // % off: re-apply from badge/catalog ratio if we know percent from matching offer
          const pctMatch = matchingPercentOffer(shopOffers, item, prev.channel);
          if (pctMatch && item.offerId === pctMatch.offer.id) {
            const nextPrice = applyPercent(catalogUnit, pctMatch.percent);
            if (nextPrice !== item.price || item.catalogPrice !== catalogUnit || item.basePrice !== base) {
              changed = true;
              return {
                ...item,
                basePrice: base,
                catalogPrice: catalogUnit,
                price: nextPrice,
              };
            }
            return item;
          }
          // Package paid share: keep same fraction of catalog if possible
          if (item.catalogPrice && item.catalogPrice > 0 && item.price > 0) {
            const ratio = item.price / item.catalogPrice;
            const nextPrice = roundMoney2(catalogUnit * ratio);
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
  }, [channel, deliveryMenuMarkup, merchant, shopOffers, categoryDeliveryMap, categoryPricingEnabled]);

  const cartTotal = roundMoney2(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const channelMeta = channels[channel];
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartLayout = merchant?.cartLayout === 'sticky_right' ? 'sticky_right' : 'hidden_slide';
  const stickyCart = cartLayout === 'sticky_right';

  useEffect(() => {
    const prev = prevItemCountRef.current;
    if (itemCount > prev) {
      setCartBump(true);
      const timer = window.setTimeout(() => setCartBump(false), 400);
      if (!stickyCart && itemCount > 0 && prev === 0 && !hasAutoOpenedCartRef.current) {
        setCartSlideOpen(true);
        hasAutoOpenedCartRef.current = true;
      }
      prevItemCountRef.current = itemCount;
      return () => window.clearTimeout(timer);
    }
    if (itemCount === 0) {
      hasAutoOpenedCartRef.current = false;
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount, stickyCart]);

  const directionsUrl =
    merchant?.latitude && merchant?.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${merchant.latitude},${merchant.longitude}`
      : merchant?.address
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${merchant.address} ${merchant.city || ''}`
          )}`
        : null;

  const patch = (p: Partial<ShopCheckoutDraft>) => setDraft((d) => ({ ...d, ...p }));

  const addConfiguredItem = (
    product: Product | ShopProductForModifiers | ShopComboProduct,
    extras: ShopSelectedExtra[] = [],
    unitPrice?: number,
    comboSelections: ShopComboSelection[] = [],
    asReward = false,
    offerMeta?: {
      offerId: string;
      offerBadge: string;
      /** Precomputed deal unit price (before extras); free lines use 0 */
      dealPrice?: number;
      catalogPrice?: number;
      offerInstanceId?: string;
      offerName?: string;
    }
  ) => {
    const rewardCost =
      'loyaltyRewardPoints' in product && product.loyaltyRewardPoints != null
        ? Number(product.loyaltyRewardPoints)
        : 0;
    if (asReward) {
      setDraft((prev) => {
        const existing = prev.items.find((item) => item.id === product.id && item.loyaltyReward);
        const items: ShopCartItem[] = existing
          ? prev.items.map((item) =>
              item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item
            )
          : [
              ...prev.items,
              {
                lineId: newCartLineId(),
                id: product.id,
                name: product.name,
                categoryId: 'categoryId' in product ? product.categoryId ?? null : null,
                price: 0,
                basePrice: 0,
                quantity: 1,
                description: product.description,
                image: product.image,
                loyaltyReward: true,
                rewardPointsCost: rewardCost,
              },
            ];
        return { ...prev, items };
      });
      return;
    }

    const extrasTotal = extras.reduce((s, e) => s + e.price, 0);
    const comboTotal = comboSelections.reduce(
      (s, c) => s + c.extraPrice + c.selectedExtras.reduce((x, e) => x + e.price, 0),
      0
    );
    // Always recompute from catalog base so delivery markup is applied (modal unitPrice is takeaway-based).
    const catalogUnit = roundMoney2(
      catalogUnitPrice(
        product.price,
        'categoryId' in product ? product.categoryId ?? null : null
      ) + extrasTotal + comboTotal
    );
    const pctMatch = !offerMeta
      ? matchingPercentOffer(
          shopOffers,
          {
            id: product.id,
            categoryId: 'categoryId' in product ? product.categoryId ?? null : null,
          },
          channel
        )
      : null;

    let price: number;
    let catalogPrice: number | undefined;
    let offerId: string | undefined;
    let offerBadge: string | undefined;
    let offerInstanceId: string | undefined;
    let offerName: string | undefined;

    if (offerMeta) {
      offerId = offerMeta.offerId;
      offerBadge = offerMeta.offerBadge;
      offerInstanceId = offerMeta.offerInstanceId;
      offerName = offerMeta.offerName;
      const dealBase =
        typeof offerMeta.dealPrice === 'number'
          ? offerMeta.dealPrice
          : catalogUnitPrice(
              product.price,
              'categoryId' in product ? product.categoryId ?? null : null
            );
      // Free deal lines stay 0; paid deal price + option surcharges
      price =
        dealBase <= 0
          ? 0
          : roundMoney2(dealBase + extrasTotal + comboTotal);
      catalogPrice = typeof offerMeta.catalogPrice === 'number' ? offerMeta.catalogPrice : catalogUnit;
      if (catalogPrice < price) catalogPrice = catalogUnit;
    } else if (pctMatch) {
      price = applyPercent(catalogUnit, pctMatch.percent);
      catalogPrice = catalogUnit;
      offerId = pctMatch.offer.id;
      offerBadge = pctMatch.offer.badgeLabel || `${pctMatch.percent}% off`;
    } else {
      price = catalogUnit;
    }

    const sig = lineSignature(extras, comboSelections);
    setDraft((prev) => {
      const existing =
        offerMeta
          ? null
          : prev.items.find(
              (item) =>
                item.id === product.id &&
                !item.loyaltyReward &&
                !item.offerId &&
                lineSignature(item.selectedExtras, item.comboSelections) === sig
            );
      const items: ShopCartItem[] = existing
        ? prev.items.map((item) =>
            item.lineId === existing.lineId ? { ...item, quantity: item.quantity + 1 } : item
          )
        : [
            ...prev.items,
            {
              lineId: newCartLineId(),
              id: product.id,
              name: product.name,
              categoryId: 'categoryId' in product ? product.categoryId ?? null : null,
              price,
              basePrice: product.price,
              quantity: 1,
              description: product.description,
              image: product.image,
              selectedExtras: extras,
              comboSelections,
              ...(offerId
                ? {
                    offerId,
                    catalogPrice: catalogPrice ?? catalogUnit,
                    offerBadge,
                    ...(offerInstanceId
                      ? { offerInstanceId, offerName: offerName || offerBadge }
                      : {}),
                  }
                : {}),
            },
          ];
      return { ...prev, items };
    });
  };

  const allMenuProducts = useMemo((): ShopOfferProduct[] => {
    const out: ShopOfferProduct[] = [];
    for (const cat of menu) {
      for (const p of cat.items || []) {
        out.push({
          id: p.id,
          name: p.name,
          price: p.price,
          image: p.image,
          categoryId: p.categoryId ?? cat.id,
          description: p.description,
          productType: p.productType,
          isCombo: productHasComboSlots(p),
        });
      }
    }
    return out;
  }, [menu]);

  const findMenuProduct = (id: string): Product | null => {
    for (const cat of menu) {
      const p = (cat.items || []).find((x) => x.id === id);
      if (p) return { ...p, categoryId: p.categoryId ?? cat.id };
    }
    return null;
  };

  const advanceOfferConfigQueue = (
    queue: typeof offerConfigQueue
  ) => {
    if (!queue.length) {
      setOfferConfigQueue([]);
      setOfferConfigMeta(null);
      setPendingCombo(null);
      setPendingProduct(null);
      return;
    }
    const [next, ...rest] = queue;
    const product = findMenuProduct(next.productId);
    if (!product) {
      advanceOfferConfigQueue(rest);
      return;
    }
    const meta = {
      offerId: next.offerId,
      offerBadge: next.role === 'free' ? 'free' : next.offerBadge,
      dealPrice: next.role === 'free' ? 0 : next.dealPrice,
      catalogPrice: next.catalogPrice,
      role: next.role,
      offerInstanceId: next.offerInstanceId,
      offerName: next.offerName,
    };
    setOfferConfigQueue(rest);
    setOfferConfigMeta(meta);
    if (productHasComboSlots(product)) {
      setPendingCombo(product as ShopComboProduct);
      return;
    }
    if (productHasModifiers(product)) {
      setPendingProduct(product);
      return;
    }
    addConfiguredItem(product, [], undefined, [], false, {
      offerId: meta.offerId,
      offerBadge: meta.offerBadge,
      dealPrice: meta.dealPrice,
      catalogPrice: meta.catalogPrice,
      offerInstanceId: meta.offerInstanceId,
      offerName: meta.offerName,
    });
    setOfferConfigMeta(null);
    advanceOfferConfigQueue(rest);
  };

  const addOfferDealToCart = (result: {
    offerId: string;
    offerBadge: string;
    offerName?: string;
    lines: Array<{
      product: ShopOfferProduct;
      role: 'paid' | 'free';
      price: number;
      catalogPrice: number;
    }>;
  }) => {
    const offerName = result.offerName || pendingOffer?.name || result.offerBadge || t('shopOffer');
    setPendingOffer(null);
    const instanceId = newOfferInstanceId();
    const queue = result.lines.map((line) => ({
      productId: line.product.id,
      role: line.role,
      dealPrice: line.price,
      catalogPrice: line.catalogPrice,
      offerId: result.offerId,
      offerBadge: result.offerBadge,
      offerInstanceId: instanceId,
      offerName,
    }));
    advanceOfferConfigQueue(queue);
  };

  const handleProductClick = (product: Product) => {
    if (productHasComboSlots(product)) {
      setPendingCombo(product as ShopComboProduct);
      return;
    }
    if (productHasModifiers(product)) {
      setPendingProduct(product);
      return;
    }
    addConfiguredItem(product);
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    setDraft((prev) => {
      const target = prev.items.find((item) => item.lineId === lineId);
      // Locked deal lines: only whole-offer remove (qty 0 on any line removes the deal)
      if (target?.offerInstanceId) {
        if (quantity <= 0) {
          return {
            ...prev,
            items: removeOfferInstance(prev.items, target.offerInstanceId),
          };
        }
        return prev;
      }
      return {
        ...prev,
        items:
          quantity <= 0
            ? prev.items.filter((item) => item.lineId !== lineId)
            : prev.items.map((item) => (item.lineId === lineId ? { ...item, quantity } : item)),
      };
    });
  };

  const removeOfferFromCart = (offerInstanceId: string) => {
    setDraft((prev) => ({
      ...prev,
      items: removeOfferInstance(prev.items, offerInstanceId),
    }));
  };

  const goCheckout = () => {
    if (!cart.length) return;
    if (merchant?.acceptingOrders === false) {
      setError(t('shopNotAcceptingOrders'));
      return;
    }
    if (merchant?.vacation?.active) {
      setError(t('shopVacationOrdersBlocked'));
      return;
    }
    const allowScheduled = merchant?.scheduledOrdersEnabled !== false;
    if (!channelMeta?.open && !allowScheduled) {
      setError(t('shopOrdersOnlyWhenOpen'));
      return;
    }
    // Closed now is OK when scheduled orders are enabled - checkout offers later slots.
    const next = {
      ...draft,
      scheduledFor: channelMeta?.open ? draft.scheduledFor : draft.scheduledFor || '',
    };
    if (!channelMeta?.open) {
      next.scheduledFor = '';
    }
    saveCart(shopKey, next);
    navigate(`${shopBasePath(shopKey, locSlug)}/checkout`);
  };

  const nextOpen = useMemo(() => {
    if (!merchant || channelMeta?.open) return null;
    return findNextOpen(merchant.storeHours as StoreHours, channel);
  }, [merchant, channelMeta?.open, channel]);

  const statusLine = useMemo(() => {
    if (channelMeta?.open) return t('shopOpenNow');
    if (nextOpen) {
      if (nextOpen.dayOffset === 0) {
        return t('shopOpensAt').replace('{time}', nextOpen.labelHm);
      }
      if (nextOpen.dayOffset === 1) {
        return t('shopOpensTomorrow').replace('{time}', nextOpen.labelHm);
      }
      return t('shopOpensLater').replace('{time}', nextOpen.labelHm);
    }
    return t('shopClosed');
  }, [channelMeta?.open, nextOpen, t]);

  const categoriesToRender = useMemo(() => {
    if (selectedCategory === 'all') return menu;
    return menu.filter((c) => c.id === selectedCategory);
  }, [menu, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('shopLoading')}
      </div>
    );
  }

  if (error && !merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-red-700 font-medium px-4 text-center">
        {error}
      </div>
    );
  }

  const allChannels: { id: ShopChannel; label: string }[] = [
    { id: 'takeaway', label: t('shopPickup') },
    { id: 'delivery', label: t('shopDelivery') },
    { id: 'dine_in', label: t('shopDineIn') },
  ];
  const channelButtons = allChannels.filter((c) => channels[c.id]?.enabled);
  const channelSelectMode = String(merchant?.channelSelectMode || 'checkout') as
    | 'checkout'
    | 'popup_start'
    | 'menu';
  const showMenuChannelButtons = channelSelectMode === 'menu' && channelButtons.length > 1;
  const channelLabel =
    channelButtons.find((c) => c.id === channel)?.label || t('shopPickup');
  const etaMin = channelMeta?.etaMinutes || 30;

  const openChannelPrompt = (prefill?: ShopChannel) => {
    if (channelButtons.length <= 1) return;
    setPromptInitialChannel(channel);
    if (prefill && channels[prefill]?.enabled && prefill !== channel) {
      patch({ channel: prefill });
    }
    setChannelPromptOpen(true);
  };

  const applyChannelSelection = (payload: ShopFulfillmentConfirmPayload) => {
    const next: Partial<ShopCheckoutDraft> = {
      channel: payload.channel,
      scheduledFor: payload.scheduledFor || '',
      fulfillmentConfirmed: true,
    };
    if (payload.channel === 'delivery') {
      if (payload.address) next.address = payload.address;
      if (payload.zipCode != null) next.zipCode = payload.zipCode;
      if (payload.city != null) next.city = payload.city;
      if (payload.lat != null) next.lat = payload.lat;
      if (payload.lng != null) next.lng = payload.lng;
      if (payload.deliveryInfo) {
        next.deliveryInfo = payload.deliveryInfo;
        setDeliveryInfo(payload.deliveryInfo);
      }
    } else {
      next.deliveryInfo = undefined;
      setDeliveryInfo(null);
    }
    patch(next);
    try {
      sessionStorage.setItem(`manupos_channel_prompted_${shopKey}`, '1');
    } catch {
      /* ignore */
    }
    setChannelPromptOpen(false);
    setError(null);
  };

  const confirmChannelPrompt = (payload: ShopFulfillmentConfirmPayload) => {
    applyChannelSelection(payload);
  };

  const selectChannel = (next: ShopChannel) => {
    setError(null);
    if (next === channel) return;
    openChannelPrompt(next);
  };

  const CartIconButton = ({ className = '' }: { className?: string }) => (
    <button
      type="button"
      className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center text-stone-700 hover:bg-stone-100 rounded-full ${className}`}
      onClick={() => setCartSlideOpen(true)}
      aria-label={`${t('shopBasketCount')} (${itemCount})`}
      title={`${t('shopBasketCount')} (${itemCount})`}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.75} />
      {itemCount > 0 ? (
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-stone-900 px-1 text-[10px] font-bold text-white ${
            cartBump ? 'shop-cart-bump' : ''
          }`}
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      ) : null}
    </button>
  );

  const showProductImages = merchant?.menuShowProductImages !== false;
  const showCategoryBanners = merchant?.menuShowCategoryBanners !== false;
  const allowScheduledOrders = merchant?.scheduledOrdersEnabled !== false;
  const toggleCategory = () => {
    setAllCategoriesOpen((prev) => !prev);
  };
  const loyaltyEnabled = !!merchant?.loyalty?.enabled;
  const unlockedRewards = loyaltyRewards.filter((r) => r.unlocked);
  const accountPath = `${shopBasePath(shopKey, locSlug)}/account`;
  const reservationsPath = `${shopBasePath(shopKey, locSlug)}/reservations`;
  const vacationActive = !!merchant?.vacation?.active;
  const ordersPaused = merchant?.acceptingOrders === false;
  const showReservations = !!merchant?.reservationsEnabled;

  const Basket = (
    <aside className="bg-white border border-stone-200 flex flex-col max-h-[calc(100dvh-6rem)] min-h-[12rem]">
      <div className="px-5 py-4 border-b border-stone-200">
        <h2 className="text-xl font-bold tracking-tight">{t('shopBasket')}</h2>
        <p className="text-sm text-stone-500 mt-1">
          {channelButtons.find((c) => c.id === channel)?.label} ·{' '}
          {formatShopChannelEta(channelMeta?.etaMinutes || 30, channel, t('shopMins'))}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cart.length === 0 ? (
          <p className="text-stone-500 text-sm py-8 text-center">{t('shopNoItems')}</p>
        ) : (
          <ul className="space-y-3">
            {groupCartForDisplay(cart).map((block) => {
              if (block.kind === 'offer') {
                return (
                  <li
                    key={block.offerInstanceId}
                    className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-block rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {(block.offerBadge || '').toLowerCase() === 'free'
                            ? t('shopFree')
                            : block.offerBadge || t('shopOffer')}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-stone-900">{block.offerName}</p>
                        <p className="text-[11px] text-stone-500">{t('shopDealLocked')}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-stone-600 underline"
                        onClick={() => removeOfferFromCart(block.offerInstanceId)}
                      >
                        {t('shopRemove')}
                      </button>
                    </div>
                    <ul className="space-y-1.5 border-t border-amber-100 pt-2">
                      {block.lines.map((item) => (
                        <li key={item.lineId} className="flex justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium text-stone-900">
                              {item.name}
                              {item.offerBadge?.toLowerCase() === 'free' || item.price === 0 ? (
                                <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-800">
                                  {t('shopFree')}
                                </span>
                              ) : null}
                            </p>
                            {!!item.comboSelections?.length && (
                              <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                                {item.comboSelections
                                  .map((c) =>
                                    c.selectedExtras?.length
                                      ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
                                      : c.productName
                                  )
                                  .join(' · ')}
                              </p>
                            )}
                            {!!item.selectedExtras?.length && (
                              <p className="text-xs text-stone-500 mt-0.5">
                                {item.selectedExtras.map((e) => e.name).join(', ')}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 tabular-nums text-stone-700">
                            {item.price === 0 ? t('shopFree') : `CHF ${item.price.toFixed(2)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between text-sm font-semibold tabular-nums pt-1 border-t border-amber-100">
                      <span>{t('shopDealTotal')}</span>
                      <span>
                        {block.catalogTotal > block.total + 0.001 ? (
                          <>
                            <span className="line-through text-stone-400 font-normal mr-1.5">
                              CHF {block.catalogTotal.toFixed(2)}
                            </span>
                            <span className="text-amber-900">CHF {block.total.toFixed(2)}</span>
                          </>
                        ) : (
                          `CHF ${block.total.toFixed(2)}`
                        )}
                      </span>
                    </div>
                  </li>
                );
              }

              const item = block.item;
              return (
                <li key={item.lineId} className="flex gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900">
                      {item.name}
                      {item.loyaltyReward && (
                        <span className="ml-2 text-xs font-semibold text-teal-800">{t('shopFree')}</span>
                      )}
                      {item.offerBadge ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-amber-700">
                          {item.offerBadge.toLowerCase() === 'free'
                            ? t('shopFree')
                            : item.offerBadge}
                        </span>
                      ) : null}
                    </div>
                    {!!item.comboSelections?.length && (
                      <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                        {item.comboSelections
                          .map((c) =>
                            c.selectedExtras?.length
                              ? `${c.productName} (${c.selectedExtras.map((e) => e.name).join(', ')})`
                              : c.productName
                          )
                          .join(' · ')}
                      </p>
                    )}
                    {!!item.selectedExtras?.length && (
                      <p className="text-xs text-stone-500 mt-0.5 leading-snug">
                        {item.selectedExtras.map((e) => e.name).join(', ')}
                      </p>
                    )}
                    <div className="text-stone-500">
                      {item.loyaltyReward
                        ? t('shopPtsBadge').replace('{n}', String(item.rewardPointsCost || 0))
                        : item.catalogPrice != null && item.catalogPrice > item.price ? (
                            <span className="tabular-nums">
                              <span className="line-through text-stone-400 mr-1">
                                CHF {item.catalogPrice.toFixed(2)}
                              </span>
                              <span className="text-amber-800 font-semibold">
                                {item.price === 0 ? t('shopFree') : `CHF ${item.price.toFixed(2)}`}
                              </span>
                            </span>
                          ) : (
                            `CHF ${item.price.toFixed(2)}`
                          )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="w-7 h-7 border border-stone-300"
                      onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      className="w-7 h-7 border border-stone-300"
                      onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-stone-200 px-5 py-4 space-y-3">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="button"
          disabled={
            !cart.length ||
            vacationActive ||
            ordersPaused ||
            (!channelMeta?.open && !allowScheduledOrders)
          }
          onClick={goCheckout}
          className="w-full bg-stone-900 text-white py-3 font-semibold disabled:opacity-40"
        >
          {ordersPaused
            ? t('shopNotAcceptingOrders')
            : vacationActive
            ? t('shopVacationTitle')
            : !channelMeta?.open && !allowScheduledOrders
              ? t('shopComeBackWhenOpen')
              : channelMeta?.open
                ? t('shopGoCheckout')
                : t('shopScheduleCheckout')}
        </button>
      </div>
    </aside>
  );

  return (
    <ShopThemeShell theme={cmsTheme} className="min-h-screen" style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text)' }}>
    <div className="min-h-screen">
      <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <Link
            to={shopBasePath(shopKey, locSlug) || '/'}
            className="flex items-center gap-2.5 min-w-0 shrink"
            aria-label={merchant?.name || t('shopBackToMenu')}
          >
            {merchant?.shopLogoUrl ? (
              <img src={merchant.shopLogoUrl} alt="" className="h-9 w-auto max-w-[7rem] object-contain" />
            ) : (
              <div className="h-9 w-9 bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {(merchant?.name || 'M').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="hidden sm:inline font-bold tracking-tight truncate">{merchant?.name}</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100 rounded-full"
              aria-label={t('shopStoreInfo')}
              title={t('shopStoreInfo')}
            >
              <Info className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <ShopLangSwitcher />
            {showReservations && (
              <Link
                to={reservationsPath}
                className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
                aria-label={t('shopReservations')}
                title={t('shopReservations')}
              >
                <CalendarDays className="h-5 w-5" strokeWidth={1.75} />
              </Link>
            )}
            <Link
              to={accountPath}
              className="inline-flex h-9 w-9 items-center justify-center text-stone-700 hover:bg-stone-100"
              aria-label={t('shopAccount')}
              title={t('shopAccount')}
            >
              <User className="h-5 w-5" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </header>

      {ordersPaused ? (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <ShopNotAcceptingBanner kind="orders" phone={merchant?.phone} />
        </div>
      ) : null}

      <section className="bg-white border-b border-stone-100">
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">{merchant?.name}</h1>
              {(merchant?.address || merchant?.city) && (
                <p className="mt-1 text-[13px] text-stone-600">
                  {merchant?.address}
                  {merchant?.city ? `, ${merchant.city}` : ''}
                  {directionsUrl ? (
                    <>
                      {' · '}
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-rose-600 hover:underline"
                      >
                        {t('shopGetDirections')}
                      </a>
                    </>
                  ) : null}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-300 text-stone-700"
              aria-label={t('shopStoreInfo')}
              title={t('shopStoreInfo')}
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Hero / store banner (no directions overlay) */}
          {merchant?.shopBannerUrl ? (
            <div className="relative overflow-hidden rounded-xl bg-stone-100 aspect-[16/7] sm:aspect-[21/8]">
              <img src={merchant.shopBannerUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <p className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-stone-600">
              {(merchant?.displayHours?.todayLabel || channelMeta?.todayLabel) || t('shopHoursNotSet')}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                channelMeta?.open ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
              }`}
            >
              {statusLine}
            </span>
          </p>

          <button
            type="button"
            onClick={openChannelPrompt}
            className="mx-auto flex w-full max-w-lg items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] sm:text-[13px] text-stone-700 hover:border-stone-300"
          >
            <span className="font-semibold text-stone-900">{channelLabel}</span>
            <span className="text-stone-300">|</span>
            <span className="truncate font-medium">{merchant?.name}</span>
            <span className="text-stone-300">|</span>
            <span className="tabular-nums whitespace-nowrap">
              {formatShopChannelEta(etaMin, channel, t('shopMins'))}
            </span>
            {channelButtons.length > 1 ? <ChevronDown className="h-3.5 w-3.5 text-stone-400 shrink-0" /> : null}
          </button>

          {showMenuChannelButtons ? (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {channelButtons.map((c) => {
                const meta = channels[c.id];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectChannel(c.id)}
                    className={`rounded-xl px-2 py-2.5 text-center border min-w-0 ${
                      channel === c.id
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-700 border-stone-200'
                    }`}
                  >
                    <span className="block text-xs sm:text-sm font-semibold truncate">{c.label}</span>
                    <span className="block text-[10px] sm:text-[11px] font-normal opacity-70 truncate">
                      {formatShopChannelEta(meta.etaMinutes, c.id, t('shopMins'))}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {channelSelectMode === 'checkout' && channelButtons.length > 1 ? (
            <p className="text-[12px] text-stone-500">{t('shopChannelAtCheckoutHint')}</p>
          ) : null}
        </div>
      </section>

      <div className="shop-sticky-category-bar">
        <div className="shop-sticky-category-bar__inner">
          <div className="flex items-center gap-2 min-w-0">
            <div className="shop-category-scroll flex gap-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setAllCategoriesOpen(true);
                }}
                className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                  selectedCategory === 'all'
                    ? 'bg-amber-700 text-white'
                    : 'bg-white text-stone-700 border border-stone-200'
                }`}
              >
                {t('shopAllCategories')}
              </button>
              {menu.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setAllCategoriesOpen(true);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                    selectedCategory === cat.id
                      ? 'bg-amber-700 text-white'
                      : 'bg-white text-stone-700 border border-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <CartIconButton className={stickyCart ? 'lg:hidden' : ''} />
          </div>
        </div>
      </div>

      <div
        className={`max-w-7xl mx-auto px-4 py-6 ${
          stickyCart ? 'grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start' : ''
        }`}
      >
        <div>
          {shopOffers.length > 0 ? (
            <div className="mb-5 space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">{t('shopOffers')}</h2>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {shopOffers.map((o) => {
                  const clickable = isPickableDeal(o.offerType);
                  const pct =
                    o.offerType === 'percent_category' || o.offerType === 'percent_order'
                      ? Number(o.rules?.percentOff) || 0
                      : 0;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        if (clickable) setPendingOffer(o);
                      }}
                      className={`min-w-[200px] max-w-[260px] shrink-0 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left ${
                        clickable ? 'hover:border-amber-500 active:scale-[0.99]' : ''
                      }`}
                    >
                      {o.badgeLabel ? (
                        <span className="inline-block rounded-full bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {o.badgeLabel}
                        </span>
                      ) : null}
                      <p className="mt-1.5 font-semibold text-stone-900 text-sm">{o.name}</p>
                      {o.description ? (
                        <p className="mt-0.5 text-xs text-stone-600 line-clamp-3">{o.description}</p>
                      ) : null}
                      {clickable ? (
                        <p className="mt-2 text-[11px] font-semibold text-amber-800">
                          Tap to pick products →
                        </p>
                      ) : pct > 0 ? (
                        <p className="mt-2 text-[11px] font-semibold text-amber-800">
                          {pct}% off applied in cart
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {loyaltyEnabled && unlockedRewards.length > 0 && (
            <div className="mb-5 space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
                {t('shopFreeRewards')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {unlockedRewards.map((r) => (
                  <div
                    key={r.id}
                    className="bg-white border border-teal-200 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.name}</p>
                      <p className="text-xs text-teal-800">
                        {t('shopPtsBadge').replace('{n}', String(r.loyaltyRewardPoints))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        addConfiguredItem(
                          {
                            id: r.id,
                            name: r.name,
                            price: r.price,
                            image: r.image || undefined,
                            loyaltyRewardPoints: r.loyaltyRewardPoints,
                          },
                          [],
                          0,
                          [],
                          true
                        )
                      }
                      className="shrink-0 text-xs font-semibold bg-teal-800 text-white px-3 py-2"
                    >
                      {t('shopAddFree')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {categoriesToRender.map((cat) => {
              const open = allCategoriesOpen;
              const items = cat.items || [];
              return (
                <section key={cat.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleCategory()}
                    className="flex w-full items-center justify-between gap-2 bg-stone-100 px-3 py-3 text-left"
                  >
                    <span className="text-sm font-bold uppercase tracking-wide text-stone-900">
                      {cat.name}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-stone-500 transition ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {open ? (
                    <div className="p-2 sm:p-3 space-y-3">
                      {showCategoryBanners && cat.image ? (
                        <img
                          src={cat.image}
                          alt=""
                          className="w-full aspect-[21/9] object-cover rounded-md bg-stone-100"
                        />
                      ) : null}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {items.map((product) => {
                          const catalog = catalogUnitPrice(product.price, product.categoryId ?? cat.id);
                          const pctMatch = matchingPercentOffer(
                            shopOffers,
                            { id: product.id, categoryId: product.categoryId ?? cat.id },
                            channel
                          );
                          const sale = pctMatch ? applyPercent(catalog, pctMatch.percent) : null;
                          return (
                            <ProductCard
                              key={product.id}
                              product={product}
                              showImage={showProductImages && !!product.image}
                              price={catalog}
                              salePrice={sale}
                              offerBadge={
                                pctMatch
                                  ? pctMatch.offer.badgeLabel || `${pctMatch.percent}% off`
                                  : null
                              }
                              onAdd={() => handleProductClick(product)}
                              rewardPts={
                                product.loyaltyRewardPoints != null &&
                                Number(product.loyaltyRewardPoints) >= 1
                                  ? Number(product.loyaltyRewardPoints)
                                  : null
                              }
                              unlocked={
                                !!(
                                  product.loyaltyRewardPoints != null &&
                                  customer &&
                                  loyaltyBalance >= Number(product.loyaltyRewardPoints)
                                )
                              }
                              onAddFree={() => addConfiguredItem(product, [], 0, [], true)}
                              t={t}
                            />
                          );
                        })}
                      </div>
                      {items.length === 0 ? (
                        <p className="text-sm text-stone-500 py-6 text-center">{t('shopNoProducts')}</p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              );
            })}
            {categoriesToRender.length === 0 ? (
              <p className="text-stone-500 py-12 text-center">{t('shopNoProducts')}</p>
            ) : null}
          </div>
        </div>

        {stickyCart ? (
          <div className="shop-sticky-cart-panel hidden lg:block self-start max-h-[calc(100dvh-6.5rem)]">
            <div className="max-h-[calc(100dvh-6.5rem)] overflow-y-auto overscroll-y-contain">{Basket}</div>
          </div>
        ) : null}
      </div>

      {cartSlideOpen && (
        <div
          className={`fixed inset-0 z-50 bg-black/40 ${stickyCart ? 'lg:hidden' : ''}`}
          onClick={() => setCartSlideOpen(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shop-slide-in-right shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full flex flex-col">
              <div className="flex justify-end p-3 border-b border-stone-100">
                <button
                  type="button"
                  className="text-sm font-semibold"
                  onClick={() => setCartSlideOpen(false)}
                >
                  {t('shopClose')}
                </button>
              </div>
              <div className="flex-1 min-h-0">{Basket}</div>
            </div>
          </div>
        </div>
      )}

      {pendingProduct && (
        <ShopProductModifiersModal
          product={{
            ...pendingProduct,
            price: catalogUnitPrice(pendingProduct.price, pendingProduct.categoryId ?? null),
          }}
          onClose={() => {
            setPendingProduct(null);
            if (offerConfigMeta) {
              setOfferConfigQueue([]);
              setOfferConfigMeta(null);
            }
          }}
          onConfirm={(extras) => {
            const meta = offerConfigMeta;
            addConfiguredItem(
              pendingProduct,
              extras,
              undefined,
              [],
              false,
              meta
                ? {
                    offerId: meta.offerId,
                    offerBadge: meta.offerBadge,
                    dealPrice: meta.dealPrice,
                    catalogPrice: meta.catalogPrice,
                    offerInstanceId: meta.offerInstanceId,
                    offerName: meta.offerName,
                  }
                : undefined
            );
            setPendingProduct(null);
            setOfferConfigMeta(null);
            if (meta) advanceOfferConfigQueue(offerConfigQueue);
          }}
        />
      )}

      {pendingCombo && (
        <ShopComboWizard
          product={{
            ...pendingCombo,
            price: catalogUnitPrice(pendingCombo.price, pendingCombo.categoryId ?? null),
          }}
          onClose={() => {
            setPendingCombo(null);
            if (offerConfigMeta) {
              setOfferConfigQueue([]);
              setOfferConfigMeta(null);
              setError(
                t('shopComboCancelledNeedsChoices').replace('{name}', pendingCombo.name)
              );
            }
          }}
          onConfirm={({ comboSelections, selectedExtras }) => {
            const meta = offerConfigMeta;
            addConfiguredItem(
              pendingCombo,
              selectedExtras,
              undefined,
              comboSelections,
              false,
              meta
                ? {
                    offerId: meta.offerId,
                    offerBadge: meta.offerBadge,
                    dealPrice: meta.dealPrice,
                    catalogPrice: meta.catalogPrice,
                    offerInstanceId: meta.offerInstanceId,
                    offerName: meta.offerName,
                  }
                : undefined
            );
            setPendingCombo(null);
            setOfferConfigMeta(null);
            if (meta) advanceOfferConfigQueue(offerConfigQueue);
          }}
        />
      )}

      {pendingOffer && (
        <ShopOfferPicker
          offer={pendingOffer}
          products={allMenuProducts}
          priceOf={(p) => catalogUnitPrice(p.price, p.categoryId ?? null)}
          onClose={() => setPendingOffer(null)}
          onConfirm={addOfferDealToCart}
        />
      )}

      {pendingOffer && (
        <ShopOfferPicker
          offer={pendingOffer}
          products={allMenuProducts}
          priceOf={(p) => catalogUnitPrice(p.price)}
          onClose={() => setPendingOffer(null)}
          onConfirm={addOfferDealToCart}
        />
      )}

      <ShopChannelPrompt
        open={channelPromptOpen}
        title={t('shopChooseHow')}
        subtitle={
          channelSelectMode === 'popup_start'
            ? t('shopChooseHowHint')
            : t('shopChangeChannelHint')
        }
        options={channelButtons.map((c) => ({
          id: c.id,
          label: c.label,
          etaMinutes: channels[c.id]?.etaMinutes || 30,
          open: !!channels[c.id]?.open,
          todayLabel: channels[c.id]?.todayLabel,
        }))}
        selected={channel}
        confirmLabel={t('shopContinue')}
        dismissible={channelSelectMode !== 'popup_start'}
        withSchedule={allowScheduledOrders}
        storeHours={merchant?.storeHours}
        scheduledFor={draft.scheduledFor || null}
        shopKey={shopKey}
        address={draft.address}
        zipCode={draft.zipCode}
        city={draft.city}
        subtotal={cartTotal}
        merchantLat={merchant?.latitude}
        merchantLng={merchant?.longitude}
        minPreOrderDelayMinutes={Number(merchant?.minPreOrderDelayMinutes) || undefined}
        onSelect={(id) => {
          patch({ channel: id });
          setError(null);
        }}
        onConfirm={confirmChannelPrompt}
        onClose={() => {
          setChannelPromptOpen(false);
          patch({ channel: promptInitialChannel });
        }}
      />

      <ShopInfoSheet
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        merchant={merchant}
        zones={deliveryZones}
      />
    </div>
    </ShopThemeShell>
  );
}

function ProductCard({
  product,
  showImage,
  price,
  salePrice,
  offerBadge,
  onAdd,
  rewardPts,
  unlocked,
  onAddFree,
  t,
}: {
  product: Product;
  showImage: boolean;
  price: number;
  salePrice?: number | null;
  offerBadge?: string | null;
  onAdd: () => void;
  rewardPts: number | null;
  unlocked: boolean;
  onAddFree: () => void;
  t: (k: string) => string;
}) {
  const priceNode =
    salePrice != null && salePrice < price ? (
      <span className="tabular-nums">
        <span className="line-through text-stone-400 mr-1">CHF {price.toFixed(2)}</span>
        <span className="text-amber-800 font-semibold">CHF {salePrice.toFixed(2)}</span>
      </span>
    ) : (
      <span className="tabular-nums">CHF {price.toFixed(2)}</span>
    );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onAdd}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAdd();
        }
      }}
      className="group flex flex-col rounded-md border border-stone-100 bg-white p-1.5 hover:border-stone-200 cursor-pointer"
    >
      <div className="relative mb-1.5 aspect-[4/3] overflow-hidden rounded bg-stone-100">
        {showImage && product.image ? (
          <img
            src={product.image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-light text-stone-300">
            {(product.name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        {offerBadge ? (
          <span className="absolute left-1 top-1 rounded-full bg-amber-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            {offerBadge.toLowerCase() === 'free' ? t('shopFree') : offerBadge}
          </span>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700 text-white shadow-sm active:scale-95"
          aria-label={`${t('shopAdd')} ${product.name}`}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
        {unlocked ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddFree();
            }}
            className="absolute left-1 bottom-1 rounded-full bg-teal-800 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white"
          >
            {t('shopFree')}
          </button>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 px-0.5 text-left">
        <p className="text-[11px] font-semibold leading-tight text-stone-900 line-clamp-2">
          {product.name}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-stone-700">{priceNode}</p>
        {rewardPts != null ? (
          <p className="text-[10px] text-amber-800">{t('shopPtsBadge').replace('{n}', String(rewardPts))}</p>
        ) : null}
      </div>
    </article>
  );
}
