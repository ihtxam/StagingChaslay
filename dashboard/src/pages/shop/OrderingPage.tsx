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
  SHOP_CART_EVENT,
  type ShopCartItem,
  type ShopChannel,
  type ShopCheckoutDraft,
  type ShopComboSelection,
  type ShopSelectedExtra,
} from '@/lib/shop-cart';
import { withDeliveryMinOrderStatus } from '@/lib/shop-delivery';
import { roundMoney2 } from '@/lib/money';
import { formatShopChannelEta } from '@/lib/shop-eta';
import { shopDocumentTitle } from '@/lib/brand';
import { localizedShopCopy } from '@/lib/shop-site-settings';
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
import { Bike, Info, LayoutGrid, Plus, Rows3, Search, ShoppingBag, X } from 'lucide-react';
import { isLocale, useI18n } from '@/lib/i18n';
import ShopMobileNavMenu from '@/components/shop/ShopMobileNavMenu';
import ShopStorefrontFooter from '@/components/shop/ShopStorefrontFooter';
import ShopTopShell from '@/components/shop/ShopTopShell';
import ShopFloatingActions from '@/components/shop/ShopFloatingActions';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopNotAcceptingBanner from '@/components/shop/ShopNotAcceptingBanner';
import ShopClosedBanner from '@/components/shop/ShopClosedBanner';
import ShopChannelPrompt, { type ShopFulfillmentConfirmPayload } from '@/components/shop/ShopChannelPrompt';
import ShopInfoSheet from '@/components/shop/ShopInfoSheet';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import ShopCartThresholdSlot from '@/components/shop/ShopCartThresholdSlot';
import ShopCartSimilarProducts from '@/components/shop/ShopCartSimilarProducts';
import ShopProductDetailModal from '@/components/shop/ShopProductDetailModal';
import ShopHorizontalScroll from '@/components/shop/ShopHorizontalScroll';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import ChaslayStorefrontNavbar from '@/chaslay-pagebuilder/ChaslayStorefrontNavbar';
import ShopOfferPicker, {
  type ShopOfferForPicker,
  type ShopOfferProduct,
} from '@/components/shop/ShopOfferPicker';
import {
  currentChannelClose,
  findNextOpen,
  formatNextOpenLabel,
  isShopHoursSoonWindow,
  type StoreHours,
} from '@/lib/shop-hours';
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
  similarProductIds?: string[];
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

type ShopProductView = 'list' | 'grid' | 'grid5';

function shopProductViewKey(shopKey: string) {
  return `shop_product_view:${shopKey}`;
}

export default function OrderingPage() {
  const { t, setLocale, locale } = useI18n();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug: string; locationSlug?: string }>();
  const [searchParams] = useSearchParams();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const locSlug = resolveShopLocationSlug({ locationSlug });
  const basePath = useMemo(() => shopBasePath(shopKey, locSlug), [shopKey, locSlug]);
  const { theme: cmsTheme, site: shopSite } = useShopCmsTheme(shopKey);
  const navigate = useNavigate();

  const [merchant, setMerchant] = useState<any>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [shopOffers, setShopOffers] = useState<ShopOfferForPicker[]>([]);
  const [draft, setDraft] = useState<ShopCheckoutDraft>(emptyDraft());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [hasCmsNav, setHasCmsNav] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartSlideOpen, setCartSlideOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const prevItemCountRef = useRef<number | null>(null);
  const categoryScrollLock = useRef(false);
  const addParamConsumedRef = useRef(false);
  const [promptInitialChannel, setPromptInitialChannel] = useState<ShopChannel>('takeaway');
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [pendingProduct, setPendingProduct] = useState<ShopProductForModifiers | null>(null);
  const [pendingDetail, setPendingDetail] = useState<Product | null>(null);
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
  const [channelPromptOpen, setChannelPromptOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<any[]>([]);
  const [productView, setProductView] = useState<ShopProductView>('list');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [menuSearchOpen, setMenuSearchOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const menuSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shopKey) return;
    try {
      const stored = localStorage.getItem(shopProductViewKey(shopKey));
      if (stored === 'grid' || stored === 'grid5' || stored === 'list') setProductView(stored);
    } catch {
      /* ignore */
    }
  }, [shopKey]);

  useEffect(() => {
    if (!shopKey) return;
    try {
      localStorage.setItem(shopProductViewKey(shopKey), productView);
    } catch {
      /* ignore */
    }
  }, [shopKey, productView]);
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
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

        try {
          if (data.deliveryMode !== 'zipcode') {
            const z = await axios.get(`/api/shop/${shopKey}/delivery-zones`);
            const raw = z.data?.data ?? z.data?.zones ?? z.data;
            setDeliveryZones(Array.isArray(raw) ? raw : []);
          } else {
            setDeliveryZones([]);
          }
        } catch {
          setDeliveryZones([]);
        }

        const loyaltyData = loyaltyRes.data || {};
        setLoyaltyRewards(loyaltyData.rewards || []);
        if (token && loyaltyData.balance != null) {
          setLoyaltyBalance(Number(loyaltyData.balance) || 0);
        } else {
          setLoyaltyBalance(0);
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
    if (localizedShopCopy(shopSite?.metaTitle, locale)) return;
    if (merchant?.name) document.title = shopDocumentTitle(merchant.name);
  }, [merchant?.name, shopSite?.metaTitle, locale]);

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

  useEffect(() => {
    const prev = prevItemCountRef.current;
    if (prev === null) {
      prevItemCountRef.current = itemCount;
      return;
    }
    if (itemCount > prev) {
      setCartBump(true);
      if (prev === 0 && itemCount > 0) setCartSlideOpen(true);
      const timer = window.setTimeout(() => setCartBump(false), 400);
      prevItemCountRef.current = itemCount;
      return () => window.clearTimeout(timer);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount]);

  const patch = (p: Partial<ShopCheckoutDraft>) => setDraft((d) => ({ ...d, ...p }));

  const freeDeliveryThreshold = useMemo(() => {
    if (channel !== 'delivery') return 0;
    const fromDraft = Number(draft.deliveryInfo?.zone?.freeDeliveryMinOrder || 0);
    if (fromDraft > 0) return fromDraft;
    const mins = deliveryZones
      .map((z) => Number(z.freeDeliveryMinOrder || 0))
      .filter((n) => n > 0);
    return mins.length ? Math.min(...mins) : 0;
  }, [channel, draft.deliveryInfo, deliveryZones]);

  const effectiveDeliveryInfo = useMemo(
    () => withDeliveryMinOrderStatus(draft.deliveryInfo || deliveryInfo, cartTotal),
    [draft.deliveryInfo, deliveryInfo, cartTotal]
  );

  const minOrderThreshold = useMemo(() => {
    if (channel !== 'delivery') return 0;
    const fromInfo = Number(effectiveDeliveryInfo?.zone?.minOrderAmount || 0);
    if (fromInfo > 0) return fromInfo;
    const mins = deliveryZones
      .map((z) => Number(z.minOrderAmount || 0))
      .filter((n) => n > 0);
    return mins.length ? Math.min(...mins) : 0;
  }, [channel, effectiveDeliveryInfo, deliveryZones]);

  const popularProducts = useMemo(() => {
    const list: Product[] = [];
    for (const cat of menu) {
      for (const p of cat.items || []) {
        if (list.length >= 8) break;
        list.push(p);
      }
      if (list.length >= 8) break;
    }
    return list;
  }, [menu]);

  /** Hide backend "Offers" catalog bucket — promos live in the shopOffers shelf. */
  const visibleMenuCategories = useMemo(
    () => menu.filter((cat) => !cat.isOffersCategory && (cat.items?.length ?? 0) > 0),
    [menu]
  );

  const menuSearchResults = useMemo(() => {
    const q = menuSearchQuery.trim().toLowerCase();
    if (!q) return null;
    const results: Array<{ product: Product; categoryId: string }> = [];
    for (const cat of visibleMenuCategories) {
      for (const product of cat.items || []) {
        const haystack = `${product.name} ${product.description || ''}`.toLowerCase();
        if (haystack.includes(q)) {
          results.push({ product, categoryId: cat.id });
        }
      }
    }
    return results;
  }, [menuSearchQuery, visibleMenuCategories]);

  const openMenuSearch = () => {
    setMenuSearchOpen(true);
    window.setTimeout(() => menuSearchInputRef.current?.focus(), 0);
  };

  const closeMenuSearch = () => {
    setMenuSearchOpen(false);
    setMenuSearchQuery('');
  };

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

  const cartSimilarProducts = useMemo(() => {
    const cartIds = new Set(cart.map((item) => item.id));
    const orderedIds: string[] = [];
    for (const item of cart) {
      const product = findMenuProduct(item.id);
      for (const sid of product?.similarProductIds || []) {
        if (cartIds.has(sid) || orderedIds.includes(sid)) continue;
        orderedIds.push(sid);
      }
    }
    return orderedIds
      .map((id) => findMenuProduct(id))
      .filter((p): p is Product => !!p)
      .slice(0, 12)
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: catalogUnitPrice(p.price, p.categoryId ?? null),
        image: p.image,
      }));
  }, [cart, menu, channel, categoryPricingEnabled, deliveryMenuMarkup, categoryDeliveryMap]);

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
    setPendingDetail(product);
  };

  useEffect(() => {
    if (!menu.length || addParamConsumedRef.current) return;
    const addId = searchParams.get('add');
    if (!addId) return;
    const product = findMenuProduct(addId);
    if (!product) return;
    addParamConsumedRef.current = true;
    handleProductClick(product);
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    const qs = next.toString();
    navigate({ pathname: `${basePath}/menu`, search: qs ? `?${qs}` : '' }, { replace: true });
  }, [menu, searchParams, basePath, navigate]);

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

  const minOrderNotMet =
    channel === 'delivery' &&
    minOrderThreshold > 0 &&
    cartTotal + 0.001 < minOrderThreshold;

  const checkoutDisabled =
    !cart.length ||
    !!merchant?.vacation?.active ||
    merchant?.acceptingOrders === false ||
    (!channelMeta?.open && merchant?.scheduledOrdersEnabled === false) ||
    minOrderNotMet;

  const checkoutBlockedMessage = useMemo(() => {
    if (!cart.length) return '';
    if (merchant?.vacation?.active) return t('shopVacationOrdersBlocked');
    if (merchant?.acceptingOrders === false) return t('shopNotAcceptingOrders');
    if (!channelMeta?.open && merchant?.scheduledOrdersEnabled === false) {
      return t('shopStoreClosedNow');
    }
    if (minOrderNotMet) {
      return effectiveDeliveryInfo?.message || t('shopMinOrderNotMet');
    }
    return '';
  }, [
    cart.length,
    merchant?.vacation?.active,
    merchant?.acceptingOrders,
    merchant?.scheduledOrdersEnabled,
    channelMeta?.open,
    minOrderNotMet,
    effectiveDeliveryInfo?.message,
    t,
  ]);

  const goCheckout = () => {
    if (!cart.length) return;
    if (minOrderNotMet) {
      setError(effectiveDeliveryInfo?.message || t('shopMinOrderNotMet'));
      return;
    }
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

  const allowScheduledOrders = merchant?.scheduledOrdersEnabled !== false;

  const openLabels = useMemo(
    () => ({
      opensAt: t('shopOpensAt'),
      opensTomorrow: t('shopOpensTomorrow'),
      opensWeekday: t('shopOpensWeekday'),
    }),
    [t]
  );

  const pickupOpen = !!(channels.takeaway?.open || channels.dine_in?.open);
  const deliveryOpen = !!channels.delivery?.open;
  const shopClosedNow = !!merchant && !pickupOpen && !deliveryOpen;

  const nextPickupOpen = useMemo(() => {
    if (!merchant || pickupOpen) return null;
    return (
      findNextOpen(merchant.storeHours as StoreHours, 'takeaway', new Date(nowTick)) ||
      findNextOpen(merchant.storeHours as StoreHours, 'dine_in', new Date(nowTick))
    );
  }, [merchant, pickupOpen, nowTick]);

  const nextDeliveryOpen = useMemo(() => {
    if (!merchant || deliveryOpen || !channels.delivery?.enabled) return null;
    return findNextOpen(merchant.storeHours as StoreHours, 'delivery', new Date(nowTick));
  }, [merchant, deliveryOpen, channels.delivery?.enabled, nowTick]);

  const formatChannelStatus = (
    open: boolean,
    close: { minutes: number; labelHm: string } | null,
    nextOpen: { at: Date; labelHm: string; dayOffset: number } | null,
    closedFallback: string
  ) => {
    if (open) {
      if (close && isShopHoursSoonWindow(close.minutes)) {
        return `${t('shopOpenNow')} · ${t('shopClosingSoon').replace('{n}', String(Math.max(1, close.minutes)))}`;
      }
      if (close) {
        return `${t('shopOpenNow')} · ${t('shopClosesAt').replace('{time}', close.labelHm)}`;
      }
      return t('shopOpenNow');
    }
    if (nextOpen && nextOpen.dayOffset === 0) {
      const mins = Math.max(1, Math.round((nextOpen.at.getTime() - nowTick) / 60_000));
      if (isShopHoursSoonWindow(mins)) {
        const opening = t('shopOpeningIn').replace('{n}', String(mins));
        return allowScheduledOrders ? `${opening} · ${t('shopPreOrderAvailable')}` : opening;
      }
    }
    const opens = formatNextOpenLabel(nextOpen, locale, openLabels);
    if (opens) {
      return allowScheduledOrders ? `${opens} · ${t('shopPreOrderAvailable')}` : opens;
    }
    return closedFallback;
  };

  const pickupClose = useMemo(() => {
    if (!merchant || !pickupOpen) return null;
    const storeHours = merchant.storeHours as StoreHours;
    const at = new Date(nowTick);
    const candidates = (['takeaway', 'dine_in'] as const)
      .filter((id) => channels[id]?.open)
      .map((id) => currentChannelClose(storeHours, id, at))
      .filter((n): n is { minutes: number; labelHm: string } => n != null);
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (a.minutes <= b.minutes ? a : b));
  }, [merchant, pickupOpen, channels.takeaway?.open, channels.dine_in?.open, nowTick]);

  const deliveryClose = useMemo(() => {
    if (!merchant || !deliveryOpen) return null;
    return currentChannelClose(merchant.storeHours as StoreHours, 'delivery', new Date(nowTick));
  }, [merchant, deliveryOpen, nowTick]);

  const pickupStatusText = useMemo(
    () => formatChannelStatus(pickupOpen, pickupClose, nextPickupOpen, t('shopStoreClosed')),
    [
      pickupOpen,
      pickupClose,
      nextPickupOpen,
      locale,
      openLabels,
      allowScheduledOrders,
      t,
      nowTick,
    ]
  );

  const deliveryStatusText = useMemo(() => {
    if (!channels.delivery?.enabled) return null;
    return formatChannelStatus(
      deliveryOpen,
      deliveryClose,
      nextDeliveryOpen,
      t('shopDeliveryClosed')
    );
  }, [
    channels.delivery?.enabled,
    deliveryOpen,
    deliveryClose,
    nextDeliveryOpen,
    locale,
    openLabels,
    allowScheduledOrders,
    t,
    nowTick,
  ]);

  useEffect(() => {
    if (!visibleMenuCategories.length || menuSearchOpen || menuSearchQuery.trim()) return;

    const getHeaderOffset = () =>
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--shop-header-height') || '56'
      ) +
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--shop-category-bar-height') ||
          '52'
      ) +
      12;

    const syncCategoryFromScroll = () => {
      if (categoryScrollLock.current) return;
      const offset = getHeaderOffset();
      const menuStart = document.getElementById('shop-menu-start');
      if (menuStart && menuStart.getBoundingClientRect().top > offset) {
        setSelectedCategory('all');
        return;
      }

      let activeId = 'all';
      for (const cat of visibleMenuCategories) {
        const el = document.getElementById(`shop-cat-${cat.id}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset + 4) {
          activeId = cat.id;
        }
      }
      setSelectedCategory(activeId);
    };

    syncCategoryFromScroll();
    window.addEventListener('scroll', syncCategoryFromScroll, { passive: true });
    window.addEventListener('resize', syncCategoryFromScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', syncCategoryFromScroll);
      window.removeEventListener('resize', syncCategoryFromScroll);
    };
  }, [visibleMenuCategories, menuSearchOpen, menuSearchQuery]);

  useEffect(() => {
    if (categoryScrollLock.current) return;
    const container = document.querySelector('.shop-category-scroll');
    if (!container) return;
    const active = container.querySelector('[data-active-category="true"]');
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedCategory]);

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

  const openSideCart = () => setCartSlideOpen(true);

  const CartIconButton = ({ className = '' }: { className?: string }) => (
    <button
      type="button"
      className={`shop-floating-cart hidden md:inline-flex ${className}`}
      onClick={openSideCart}
      aria-label={`${t('shopBasketCount')} (${itemCount})`}
      title={`${t('shopBasketCount')} (${itemCount})`}
    >
      <ShoppingBag className="h-5 w-5" strokeWidth={1.9} />
      {itemCount > 0 ? (
        <span
          className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-stone-900 ${
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
  const loyaltyEnabled = !!merchant?.loyalty?.enabled;
  const unlockedRewards = loyaltyRewards.filter((r) => r.unlocked);
  const accountPath = `${shopBasePath(shopKey, locSlug)}/account`;
  const giftCardsPath = `${shopBasePath(shopKey, locSlug)}/gift-cards`;
  const vacationActive = !!merchant?.vacation?.active;
  const ordersPaused = merchant?.acceptingOrders === false;
  const showReservations = !!merchant?.reservationsEnabled;
  const showGiftCards = !!merchant?.giftCards?.enabled;

  const scrollToCategory = (id: string) => {
    categoryScrollLock.current = true;
    setSelectedCategory(id);
    const el = document.getElementById(id === 'all' ? 'shop-menu-start' : `shop-cat-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      categoryScrollLock.current = false;
    }, 900);
  };

  const productGridClass =
    productView === 'grid5'
      ? 'grid grid-cols-2 gap-3 md:grid-cols-3 min-[1080px]:grid-cols-5'
      : productView === 'grid'
        ? 'grid grid-cols-2 gap-3 md:grid-cols-3 min-[1080px]:grid-cols-4'
        : 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3';

  const renderMenuProduct = (product: Product, categoryId: string) => {
    const catalog = catalogUnitPrice(product.price, product.categoryId ?? categoryId);
    const pctMatch = matchingPercentOffer(
      shopOffers,
      { id: product.id, categoryId: product.categoryId ?? categoryId },
      channel
    );
    const sale = pctMatch ? applyPercent(catalog, pctMatch.percent) : null;
    return (
      <ProductCard
        key={product.id}
        product={product}
        layout={productView === 'list' ? 'list' : 'grid'}
        showImage={showProductImages && !!product.image}
        price={catalog}
        salePrice={sale}
        offerBadge={
          pctMatch ? pctMatch.offer.badgeLabel || `${pctMatch.percent}% off` : null
        }
        onAdd={() => handleProductClick(product)}
        rewardPts={
          product.loyaltyRewardPoints != null && Number(product.loyaltyRewardPoints) >= 1
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
  };

  const Basket = ({
    className = 'max-h-[calc(100dvh-6rem)] min-h-[12rem] border border-stone-200',
    hideHeader = false,
  }: {
    className?: string;
    hideHeader?: boolean;
  }) => (
    <aside className={`bg-white flex flex-col ${className}`}>
      {!hideHeader ? (
        <div className="px-5 py-4 border-b border-stone-200">
          <h2 className="text-xl font-bold tracking-tight">{t('shopBasket')}</h2>
          <p className="text-sm text-stone-500 mt-1">
            {channelButtons.find((c) => c.id === channel)?.label} ·{' '}
            {formatShopChannelEta(channelMeta?.etaMinutes || 30, channel, t('shopMins'))}
          </p>
        </div>
      ) : null}

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
                  {showProductImages && item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-full object-cover bg-stone-100"
                    />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-full bg-stone-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-900">{item.name}</div>
                    {item.loyaltyReward && (
                      <span className="text-xs font-semibold text-teal-800">{t('shopFree')}</span>
                    )}
                    {item.offerBadge ? (
                      <span className="ml-2 text-[10px] font-bold uppercase text-amber-700">
                        {item.offerBadge.toLowerCase() === 'free'
                          ? t('shopFree')
                          : item.offerBadge}
                      </span>
                    ) : null}
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
                    <div className="text-stone-600 mt-1 tabular-nums">
                      {item.loyaltyReward
                        ? t('shopPtsBadge').replace('{n}', String(item.rewardPointsCost || 0))
                        : item.catalogPrice != null && item.catalogPrice > item.price ? (
                            <span>
                              <span className="line-through text-stone-400 mr-1">
                                CHF {item.catalogPrice.toFixed(2)}
                              </span>
                              <span className="text-amber-800 font-semibold">
                                {item.price === 0 ? t('shopFree') : `CHF ${item.price.toFixed(2)}`}
                              </span>
                            </span>
                          ) : (
                            `CHF ${(item.price * item.quantity).toFixed(2)}`
                          )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border border-stone-300 text-stone-700"
                        onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-sm font-bold text-white"
                        onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-[var(--shop-accent,#e11d48)]"
                      onClick={() => updateQuantity(item.lineId, 0)}
                    >
                      {t('shopRemove')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {cart.length > 0 ? (
          <ShopCartSimilarProducts
            products={cartSimilarProducts}
            showImages={showProductImages}
            onAdd={(p) => {
              const product = findMenuProduct(p.id);
              if (product) handleProductClick(product);
            }}
          />
        ) : null}
      </div>

      <div className="border-t border-stone-200 px-5 py-4 space-y-3">
        <ShopCartThresholdSlot
          channel={channel}
          subtotal={cartTotal}
          minOrder={minOrderThreshold}
          freeDeliveryFrom={freeDeliveryThreshold}
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {checkoutBlockedMessage ? (
          <p className="text-sm font-medium text-rose-600">{checkoutBlockedMessage}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-stone-700 underline underline-offset-2"
            onClick={() => setCartSlideOpen(false)}
          >
            {t('shopContinueShopping')}
          </button>
          <button
            type="button"
            disabled={checkoutDisabled}
            onClick={goCheckout}
            className="rounded-xl bg-[var(--shop-accent,#e11d48)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('shopGoCheckout')} · CHF {cartTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <ShopThemeShell theme={cmsTheme} site={shopSite} pageTitle={merchant?.name} logoUrl={merchant?.shopLogoUrl} className="min-h-screen" style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text)' }}>
    <div className="min-h-screen">
      <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
      <ShopTopShell>
        <ChaslayStorefrontNavbar
          key={`nav-${locale}`}
          shopKey={shopKey}
          basePath={shopBasePath(shopKey, locSlug)}
          locale={locale === 'fr' || locale === 'de' ? locale : 'en'}
          defaultLanguage={String(merchant?.language || 'en').toLowerCase().slice(0, 2)}
          onPresence={setHasCmsNav}
        />
        {hasCmsNav ? null : (
          <header className="relative border-b border-stone-200 bg-white">
            <div className="shop-page-content flex h-14 items-center justify-between gap-2 shop-navbar-mobile-row">
              <Link
                to={shopBasePath(shopKey, locSlug) || '/'}
                className="shop-navbar-logo-row flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:max-w-[40%]"
                aria-label={merchant?.name || t('shopBackToMenu')}
              >
                {merchant?.shopLogoUrl ? (
                  <img
                    src={merchant.shopLogoUrl}
                    alt=""
                    className="shop-navbar-logo-image h-9 w-auto max-w-[4.5rem] shrink-0 object-contain"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-stone-900 text-xs font-bold text-white">
                    {(merchant?.name || 'M').slice(0, 2).toUpperCase()}
                  </div>
                )}
                {merchant?.name ? (
                  <span className="shop-navbar-store-name min-w-0 truncate text-sm font-bold tracking-tight">
                    {merchant.name}
                  </span>
                ) : null}
              </Link>
              <nav className="hidden sm:flex min-w-0 items-center gap-4 text-sm font-medium text-stone-800">
                <Link to={shopBasePath(shopKey, locSlug) || '/'}>{t('shopHome')}</Link>
                <Link to={`${shopBasePath(shopKey, locSlug)}/menu`.replace(/\/+/g, '/')}>{t('shopMenu')}</Link>
                <Link to={`${shopBasePath(shopKey, locSlug) || ''}#contact`}>{t('shopContact')}</Link>
              </nav>
              <ShopMobileNavMenu
                accountPath={accountPath}
                links={[
                  { label: t('shopHome'), to: shopBasePath(shopKey, locSlug) || '/' },
                  { label: t('shopMenu'), to: `${shopBasePath(shopKey, locSlug)}/menu`.replace(/\/+/g, '/') },
                  { label: t('shopContact'), to: `${shopBasePath(shopKey, locSlug) || ''}#contact` },
                  ...(showGiftCards
                    ? [{ label: t('shopGiftCardTitle'), to: giftCardsPath }]
                    : []),
                  { label: t('shopStoreInfo'), onClick: () => setInfoOpen(true) },
                ]}
              />
            </div>
          </header>
        )}
      </ShopTopShell>
      <ShopFloatingActions basePath={shopBasePath(shopKey, locSlug)} showReservations={showReservations} />

      {shopClosedNow ? <ShopClosedBanner canPreorder={allowScheduledOrders} /> : null}
      {ordersPaused && !shopClosedNow ? (
        <div className="shop-page-content pt-4">
          <ShopNotAcceptingBanner kind="orders" phone={merchant?.phone} />
        </div>
      ) : null}

      <section className="shop-full-bleed">
        <div className="relative">
          <div className="h-40 overflow-hidden bg-stone-200 sm:h-52 md:h-64">
            {merchant?.shopBannerUrl ? (
              <img src={merchant.shopBannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-stone-200 to-stone-300" />
            )}
          </div>
          <div className="shop-page-content relative -mt-12 pb-3 sm:-mt-16">
            <div className="rounded-2xl border border-stone-100 bg-white px-4 py-4 shadow-md sm:px-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    {merchant?.shopLogoUrl ? (
                      <img
                        src={merchant.shopLogoUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-contain"
                      />
                    ) : null}
                    <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">
                      {merchant?.name}
                    </h1>
                    <button
                      type="button"
                      onClick={() => setInfoOpen(true)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-500 hover:bg-stone-50"
                      aria-label={t('shopStoreInfo')}
                      title={t('shopStoreInfo')}
                    >
                      <Info className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        pickupOpen ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pickupOpen ? 'bg-emerald-500' : 'bg-amber-400'
                        }`}
                      />
                      {pickupStatusText}
                    </span>
                    {deliveryStatusText ? (
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          deliveryOpen ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        <Bike className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                        {deliveryStatusText}
                      </span>
                    ) : null}
                  </p>
                  {(merchant?.address || merchant?.city) && (
                    <p className="mt-1 text-[13px] text-stone-600">
                      {merchant?.address}
                      {merchant?.city ? `, ${merchant.city}` : ''}
                    </p>
                  )}
                </div>
                <Link
                  to={`${shopBasePath(shopKey, locSlug)}#gallery`}
                  className="shrink-0 rounded-full border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  {t('shopGallery')}
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {channelButtons.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectChannel(c.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      channel === c.id
                        ? 'bg-[var(--shop-accent,#e11d48)] text-white'
                        : 'border border-stone-200 bg-white text-stone-700'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                {channelSelectMode === 'checkout' && channelButtons.length > 1 ? (
                  <p className="w-full text-[12px] text-stone-500">{t('shopChannelAtCheckoutHint')}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="shop-sticky-category-bar">
        <div className="shop-sticky-category-bar__inner">
          <div className="shop-category-scroll flex min-w-0 flex-1 items-center gap-1.5">
            {menuSearchOpen ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <button
                  type="button"
                  onClick={closeMenuSearch}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700"
                  aria-label={t('cancel')}
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
                <input
                  ref={menuSearchInputRef}
                  type="search"
                  enterKeyHint="search"
                  value={menuSearchQuery}
                  onChange={(e) => setMenuSearchQuery(e.target.value)}
                  placeholder={t('shopSearchMenu')}
                  className="shop-category-search-input min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-stone-400"
                />
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openMenuSearch}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 hover:border-stone-400"
                  aria-label={t('shopSearchMenu')}
                  title={t('shopSearchMenu')}
                >
                  <Search className="h-4 w-4" strokeWidth={2} />
                </button>
                {visibleMenuCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    data-active-category={selectedCategory === cat.id ? 'true' : undefined}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                      selectedCategory === cat.id
                        ? 'bg-[var(--shop-accent,#e11d48)] text-white'
                        : 'bg-white text-stone-700 border border-stone-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </>
            )}
          </div>
          {visibleMenuCategories.length > 0 ? (
            <div className="shop-product-view-toggle shrink-0" role="group" aria-label={t('shopProductViewLabel')}>
              <button
                type="button"
                className={productView === 'list' ? 'is-active' : ''}
                onClick={() => setProductView('list')}
                aria-label={t('shopProductViewList')}
                title={t('shopProductViewList')}
              >
                <Rows3 className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                className={`relative ${productView === 'grid' || productView === 'grid5' ? 'is-active' : ''}`}
                onClick={() => setProductView((prev) => (prev === 'grid' ? 'grid5' : 'grid'))}
                aria-label={productView === 'grid5' ? t('shopGridFiveCols') : t('shopGridFourCols')}
                title={productView === 'grid5' ? t('shopGridFiveCols') : t('shopGridFourCols')}
              >
                <LayoutGrid className="h-4 w-4" strokeWidth={2} />
                {productView === 'grid' || productView === 'grid5' ? (
                  <span className="absolute bottom-0 right-0.5 text-[8px] font-bold leading-none">
                    {productView === 'grid5' ? '5' : '4'}
                  </span>
                ) : null}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={`shop-page-content py-6 ${itemCount > 0 ? 'pb-40 md:pb-6' : ''}`}>
        {!menuSearchQuery.trim() && popularProducts.length > 0 ? (
          <div className="mb-8 space-y-3">
            <h2 className="text-lg font-bold tracking-tight text-stone-900">{t('shopMostPopular')}</h2>
            <ShopHorizontalScroll autoSlide>
              {popularProducts.map((product) => {
                const catalog = catalogUnitPrice(product.price, product.categoryId ?? null);
                return (
                  <div key={`pop-${product.id}`} className="min-w-[280px] max-w-[320px] shrink-0 snap-start">
                    <ProductCard
                      product={product}
                      layout="list"
                      showImage={showProductImages && !!product.image}
                      price={catalog}
                      onAdd={() => handleProductClick(product)}
                      rewardPts={null}
                      unlocked={false}
                      onAddFree={() => undefined}
                      t={t}
                    />
                  </div>
                );
              })}
            </ShopHorizontalScroll>
          </div>
        ) : null}

        {!menuSearchQuery.trim() && shopOffers.length > 0 ? (
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

        <div id="shop-menu-start" className="shop-menu-start-anchor" aria-hidden="true" />

        <div className="space-y-8">
          {menuSearchResults ? (
            <section className="shop-menu-section">
              <h2 className="mb-3 text-lg font-bold tracking-tight text-stone-900">
                {t('shopSearchResults')}
              </h2>
              {menuSearchResults.length === 0 ? (
                <p className="py-12 text-center text-stone-500">{t('shopSearchNoResults')}</p>
              ) : (
                <div className={productGridClass}>
                  {menuSearchResults.map(({ product, categoryId }) =>
                    renderMenuProduct(product, categoryId)
                  )}
                </div>
              )}
            </section>
          ) : menuSearchOpen ? (
            <p className="py-12 text-center text-sm text-stone-500">{t('shopSearchMenuHint')}</p>
          ) : (
            <>
          {visibleMenuCategories.map((cat) => {
            const items = cat.items || [];
            return (
              <section key={cat.id} id={`shop-cat-${cat.id}`} className="shop-menu-section">
                <h2 className="mb-3 text-lg font-bold tracking-tight text-stone-900">{cat.name}</h2>
                {showCategoryBanners && cat.image ? (
                  <img
                    src={cat.image}
                    alt=""
                    className="mb-3 w-full aspect-[21/9] object-cover rounded-xl bg-stone-100"
                  />
                ) : null}
                <div className={productGridClass}>
                  {items.map((product) => renderMenuProduct(product, cat.id))}
                </div>
              </section>
            );
          })}
          {visibleMenuCategories.length === 0 ? (
            <p className="text-stone-500 py-12 text-center">{t('shopNoProducts')}</p>
          ) : null}
            </>
          )}
        </div>
      </div>

      {itemCount > 0 ? <CartIconButton /> : null}

      {itemCount > 0 ? (
        <div className="shop-mobile-cart-stack md:hidden">
          <div className="shop-mobile-cart-stack__progress">
            <ShopCartThresholdSlot
              channel={channel}
              subtotal={cartTotal}
              minOrder={minOrderThreshold}
              freeDeliveryFrom={freeDeliveryThreshold}
            />
          </div>
          {checkoutBlockedMessage ? (
            <p className="shop-mobile-cart-stack__closed-msg">{checkoutBlockedMessage}</p>
          ) : null}
          <div className="shop-mobile-cart-bar">
            <button
              type="button"
              className="shop-mobile-cart-bar__icon"
              onClick={openSideCart}
              aria-label={`${t('shopBasketCount')} (${itemCount})`}
            >
              <ShoppingBag className="h-5 w-5" strokeWidth={1.9} />
              <span className="shop-mobile-cart-bar__badge">{itemCount > 99 ? '99+' : itemCount}</span>
            </button>
            <button
              type="button"
              disabled={checkoutDisabled}
              onClick={goCheckout}
              className="shop-mobile-cart-bar__cta"
            >
              {t('shopGoCheckout')} · CHF {cartTotal.toFixed(2)}
            </button>
          </div>
        </div>
      ) : null}

      {cartSlideOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setCartSlideOpen(false)}
          role="presentation"
        >
          <div
            className="absolute right-0 top-0 bottom-0 flex h-full w-full max-w-md flex-col bg-white shop-slide-in-right shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('shopBasket')}
          >
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <h2 className="text-lg font-bold">{t('shopYourCart')}</h2>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-stone-100"
                  onClick={() => setCartSlideOpen(false)}
                  aria-label={t('shopClose')}
                >
                  ×
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <Basket className="h-full min-h-0 border-0" hideHeader />
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDetail && (
        <ShopProductDetailModal
          product={pendingDetail}
          displayPrice={catalogUnitPrice(pendingDetail.price, pendingDetail.categoryId ?? null)}
          showImage={showProductImages && !!pendingDetail.image}
          onClose={() => setPendingDetail(null)}
          onAdd={(qty) => {
            for (let i = 0; i < qty; i++) addConfiguredItem(pendingDetail);
          }}
        />
      )}

      {pendingProduct && (
        <ShopProductModifiersModal
          product={{
            ...pendingProduct,
            price: catalogUnitPrice(pendingProduct.price, pendingProduct.categoryId ?? null),
          }}
          showProductImages={showProductImages}
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
          showImage={showProductImages}
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
        dismissible
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

      <ShopStorefrontFooter
        basePath={shopBasePath(shopKey, locSlug)}
        merchantName={merchant?.name}
        className="mt-10"
      />
    </div>
    </ShopThemeShell>
  );
}

function ProductCard({
  product,
  layout = 'list',
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
  layout?: ShopProductView;
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

  const hasPhoto = showImage && !!product.image;
  const isGrid = layout !== 'list';

  const imageBlock = hasPhoto ? (
    <div
      className={
        isGrid
          ? 'relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-stone-100'
          : 'relative h-24 w-28 shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:h-28 sm:w-32'
      }
    >
      <img
        src={product.image}
        alt=""
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
      />
      {offerBadge ? (
        <span className="absolute left-1 top-1 rounded-full bg-amber-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
          {offerBadge.toLowerCase() === 'free' ? t('shopFree') : offerBadge}
        </span>
      ) : null}
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
  ) : null;

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
      className={`group cursor-pointer overflow-hidden rounded-xl border border-stone-100 bg-white hover:border-stone-200 ${
        isGrid ? 'flex flex-col p-2' : 'flex gap-3 p-2'
      }`}
    >
      {imageBlock}
      <div className={`flex min-w-0 flex-1 flex-col text-left ${isGrid ? 'pt-1' : 'py-0.5'}`}>
        {!hasPhoto && offerBadge ? (
          <span className="mb-1 inline-flex w-fit rounded-full bg-amber-700 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
            {offerBadge.toLowerCase() === 'free' ? t('shopFree') : offerBadge}
          </span>
        ) : null}
        <p className="text-sm font-semibold leading-tight text-stone-900 line-clamp-2">{product.name}</p>
        {product.description ? (
          <p className="mt-0.5 text-xs text-stone-500 line-clamp-2">{product.description}</p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <p className="text-sm font-semibold text-stone-900">{priceNode}</p>
            {rewardPts != null ? (
              <p className="text-[10px] text-amber-800">{t('shopPtsBadge').replace('{n}', String(rewardPts))}</p>
            ) : null}
            {!hasPhoto && unlocked ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddFree();
                }}
                className="mt-1 rounded-full bg-teal-800 px-2 py-0.5 text-[9px] font-bold uppercase text-white"
              >
                {t('shopFree')}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--shop-accent,#e11d48)] text-white shadow-sm active:scale-95"
            aria-label={`${t('shopAdd')} ${product.name}`}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </article>
  );
}

