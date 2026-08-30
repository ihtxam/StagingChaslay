import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarClock,
  Clock,
  CreditCard,
  Globe2,
  Languages,
  Mail,
  MapPin,
  Monitor,
  Package,
  Percent,
  Printer,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Truck,
  Users,
  UtensilsCrossed,
  ChefHat,
} from 'lucide-react';
import PosPostsSection from '@/components/settings/PosPostsSection';
import PrintCompanionVersionStatus from '@/components/settings/PrintCompanionVersionStatus';
import KdsSettingsPanel from '@/components/merchant/KdsSettingsPanel';
import OdsSettingsPanel from '@/components/merchant/OdsSettingsPanel';
import PrinterKitchenRoutingPicker from '@/components/merchant/PrinterKitchenRoutingPicker';
import api from '@/lib/api';
import {
  RECEIPT_LOGO_WIDTH_PX_MAX,
  buildPrinterTestEscPos,
  resizeImageFileForReceiptLogo,
  uint8ToBase64,
} from '@/lib/webpos-receipt';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { isSignageLicensed } from '@/lib/signage-addon';
import { isStorekeeperLicensed } from '@/lib/storekeeper-addon';
import { dashboardVersionLabel } from '@/lib/app-version';
import {
  findPrinterHealCandidates,
  formatScaleDeviceLabel,
  formatScalePortLabel,
  getPrintAgentHealth,
  isConfiguredPrinterMissing,
  isPrintAgentAvailable,
  isPrintAgentVersionOutdated,
  isUnsuitableRawPrinter,
  isUsbScaleAddress,
  listAgentPrinters,
  listScaleDevices,
  printViaAgent,
  reconcilePosPrinterProfiles,
  reconcileAndPrunePosPrinterProfiles,
  type AgentPrinter,
  type ScaleDevice,
} from '@/lib/print-agent';
import {
  fetchPrintBridgeManifest,
  fetchPrintAgentManifest,
  isAndroidDevice,
  printAgentDownloadUrl,
  printBridgeDownloadUrl,
  preferredPrintCompanion,
  type DownloadManifest,
} from '@/lib/print-agent-platform';
import { useI18n, type Locale } from '@/lib/i18n';
import { compressImageIfNeeded } from '@/lib/compress-image';
import {
  settingsDash,
  SettingsField,
  SettingsPageHeader,
  SettingsReportCard,
} from '@/components/settings/SettingsReportUi';
import SettingsBusinessTab from './settings/SettingsBusinessTab';
import SettingsTablesTab from './settings/SettingsTablesTab';
import SettingsHoursTab from './settings/SettingsHoursTab';
import SettingsReservationsTab from './settings/SettingsReservationsTab';
import SettingsDeliveryPlatformsTab from './settings/SettingsDeliveryPlatformsTab';
import Staff from './Staff';
import DeliveryTrackingPage from './DeliveryTracking';
import { useAuthStore } from '@/store/auth';
import { canAccessRoute } from '@/lib/permissions';
import { showPosScaleFeature, type EditionFeatureKey } from '@/lib/edition-features';
import { normalizeBusinessModule } from '@/lib/business-module';

interface SettingsData {
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  vatNumber?: string | null;
  vatRate?: string | null;
  taxTakeawayRate?: string | null;
  taxDineInRate?: string | null;
  taxDeliveryRate?: string | null;
  taxIncludedInPrice?: boolean;
  vatAfterDiscount?: boolean;
  slug?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  shopEnabled?: boolean;
  acceptingOrders?: boolean;
  acceptingReservations?: boolean;
  reservationsEnabled?: boolean;
  shopCustomDomainUrl?: string | null;
  floorPlanEnabled?: boolean;
  paxOrderingEnabled?: boolean;
  coursesEnabled?: boolean;
  shiftsEnabled?: boolean;
  maxPosPosts?: number;
  maxWaiterPosts?: number;
  inventoryAddonEnabled?: boolean;
  inventoryEnabled?: boolean;
  storekeeperAddonEnabled?: boolean;
  signageAddonEnabled?: boolean;
  signageEnabled?: boolean;
  signageScreenLimit?: number;
  inventoryWasteFactor?: number;
  inventoryAutoReorderEmailEnabled?: boolean;
  businessCategory?: 'retail' | 'restaurant' | null;
  editionFeatures?: EditionFeatureKey[] | null;
  inventoryExpiryAlertDays?: number;
  posColorTheme?: string;
  posCheckoutSettings?: {
    tipsEnabled?: boolean;
    tipPresetsPercent?: number[];
    allowCustomTip?: boolean;
    discountsEnabled?: boolean;
    discountPresets?: Array<{ id: string; name: string; percent: number }>;
    roundingStep?: number;
    quickCashEnabled?: boolean;
    quickCashDenominations?: number[];
    splitBillsEnabled?: boolean;
    maxSplitParts?: number;
    courseSendMode?: 'fire_per_course' | 'send_all_once';
    cartSide?: 'left' | 'right';
    postSuccessTarget?: 'register' | 'tables';
    posMode?: 'restaurant' | 'retail';
    tablesEnabled?: boolean;
    retailTakeawayEnabled?: boolean;
    retailDeliveryEnabled?: boolean;
    retailDineInEnabled?: boolean;
    requireTableForDineIn?: boolean;
    actionButtonSize?: 'sm' | 'md' | 'lg';
  } | null;
  shopPathUrl?: string | null;
  shopSubdomainUrl?: string | null;
  panelLanguage?: string | null;
  shopLanguage?: string | null;
  cartLayout?: 'hidden_slide' | 'sticky_right' | string | null;
  subscriptionPlan?: string | null;
  status?: string | null;
  onlineCardFeeFixed?: string | null;
  onlineCardFeePercent?: string | null;
  webposExpressEnabled?: boolean;
  webposCashEnabled?: boolean;
  webposCardEnabled?: boolean;
  webposGiftCardEnabled?: boolean;
  webposInvoiceEnabled?: boolean;
  bankIban?: string | null;
  bankQrIban?: string | null;
  bankName?: string | null;
  bankAccountHolder?: string | null;
  webposTerminalEnabled?: boolean;
  adyenLiveEnvironment?: boolean;
  adyenUseLegacyEndpoint?: boolean;
  emailSmtpSettings?: {
    enabled?: boolean;
    host?: string | null;
    port?: number | null;
    secure?: boolean;
    user?: string | null;
    passwordSet?: boolean;
    fromEmail?: string | null;
    fromName?: string | null;
  } | null;
  emailBrevoSettings?: {
    enabled?: boolean;
    apiKeySet?: boolean;
    apiKeyMasked?: string;
    fromEmail?: string | null;
    fromName?: string | null;
    dailyLimit?: number | null;
    monthlyLimit?: number | null;
    dailySent?: number;
    dailyPeriod?: string | null;
    monthlySent?: number;
    monthlyPeriod?: string | null;
  } | null;
  emailDeliveryMode?: 'platform' | 'own';
  marketingSettings?: {
    reorderReminderEnabled?: boolean;
    reorderReminderDays?: number;
    reorderReminderSubject?: string | null;
    reorderReminderBody?: string | null;
  } | null;
  vacationSettings?: {
    enabled?: boolean;
    manualActive?: boolean;
    popupImageUrl?: string | null;
    popupTitle?: { en?: string | null; fr?: string | null; de?: string | null } | string | null;
    message?: { en?: string | null; fr?: string | null; de?: string | null } | string | null;
    periods?: Array<{
      id: string;
      startDate: string;
      startTime?: string | null;
      endDate: string;
      endTime?: string | null;
      title?: { en?: string | null; fr?: string | null; de?: string | null } | string | null;
    }>;
  } | null;
  shopLogoUrl?: string | null;
  posPrintSettings?: {
    receiptHeader?: string;
    receiptFooter?: string;
    kitchenTicketHeader?: string;
    kitchenTicketFooter?: string;
    kitchenItemTextScale?: 1 | 2 | 3;
    kitchenHeaderTextScale?: 1 | 2 | 3;
    kitchenBoldText?: boolean;
    receiptShowVatTable?: boolean;
    receiptShowStaffLine?: boolean;
    receiptShowQrCode?: boolean;
    receiptDeliveryDirectionsQr?: boolean;
    adyenReceiptDigitalOnly?: boolean;
    paperWidthMm?: 58 | 80;
    receiptLanguage?: 'en' | 'fr' | 'de' | 'panel';
    receiptLogoUrl?: string | null;
    receiptLogoWidthPx?: number;
    autoPrintReceipt?: boolean;
    autoPrintKitchen?: boolean;
    autoPrintReservations?: boolean;
    autoPrintOnlineOrdersOnArrival?: boolean;
    waiterTillBellEnabled?: boolean;
    kitchenPrintRetryEnabled?: boolean;
    kitchenPrintRetryAttempts?: number;
    kitchenPrintRetryIntervalSec?: number;
    bluetoothPrinterSlowMode?: boolean;
    scaleComPort?: string | null;
    scaleDeviceName?: string | null;
    scaleDeviceId?: string | null;
    scaleUsbAddress?: string | null;
    scaleEnabled?: boolean;
    labelWidthMm?: 40 | 58;
    labelHeightMm?: 20 | 25 | 30 | 40;
    labelShowStoreName?: boolean;
    labelShowProductName?: boolean;
    labelShowBarcodeNumber?: boolean;
    labelShowPrice?: boolean;
    labelShowSku?: boolean;
    printers?: Array<{
      id: string;
      name: string;
      portName?: string | null;
      matchHint?: string | null;
      enabled?: boolean;
      paperWidthMm?: 58 | 80;
      printReceipts?: boolean;
      printKitchenTickets?: boolean;
      printEndOfDayReports?: boolean;
      printLabels?: boolean;
      printAllProducts?: boolean;
      linkedCategoryIds?: string[];
      linkedProductIds?: string[];
    }>;
  } | null;
}

interface AdyenCreds {
  merchantAccount?: string | null;
  clientId?: string | null;
  apiKeyMasked?: string | null;
  apiKeySet?: boolean;
}

interface TerminalRow {
  id: string;
  terminalId: string;
  terminalName: string;
  serialNumber?: string | null;
  status: string;
}

type TabId =
  | 'business'
  | 'taxes'
  | 'tables'
  | 'shop'
  | 'delivery'
  | 'delivery-map'
  | 'hours'
  | 'reservations'
  | 'pos'
  | 'payments'
  | 'receipt'
  | 'kds'
  | 'ods'
  | 'email'
  | 'language'
  | 'users';

const SETTINGS_TAB_IDS: TabId[] = [
  'business',
  'taxes',
  'tables',
  'shop',
  'delivery',
  'delivery-map',
  'hours',
  'reservations',
  'pos',
  'payments',
  'receipt',
  'kds',
  'ods',
  'email',
  'language',
  'users',
];

function parseSettingsTabFromSearch(search: string): TabId {
  try {
    const params = new URLSearchParams(search);
    const q = params.get('tab');
    if (q === 'locations') return 'business';
    if (q && SETTINGS_TAB_IDS.includes(q as TabId)) return q as TabId;
    if (q === 'payments') return 'payments';
    if (q === 'tables') return 'tables';
    const section = params.get('section');
    if (section === 'settings' || section === 'layout' || section === 'qr') return 'tables';
    if (q === 'taxes') return 'taxes';
    if (q === 'pos' || q === 'operations') return 'pos';
    if (q === 'shop') return 'shop';
    if (q === 'delivery') return 'delivery';
    if (q === 'hours') return 'hours';
    if (q === 'reservations') return 'reservations';
    if (q === 'business') return 'business';
  } catch {
    /* ignore */
  }
  return 'business';
}

type SettingsSearchEntry = {
  id: string;
  tab: TabId;
  keywords: string[];
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <SettingsField label={label} hint={hint}>
      {children}
    </SettingsField>
  );
}

function Section({
  title,
  description,
  children,
  id,
  highlight,
  dimmed,
  icon: Icon = SlidersHorizontal,
  accent = settingsDash.accent,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
  highlight?: boolean;
  dimmed?: boolean;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <div className={`transition-opacity ${dimmed ? 'pointer-events-none opacity-40' : ''}`}>
      <SettingsReportCard
        id={id}
        icon={Icon}
        accent={accent}
        title={title}
        description={description}
        highlight={highlight}
      >
        {children}
      </SettingsReportCard>
    </div>
  );
}

function SettingsSaveBar({
  saving,
  label,
  disabled,
}: {
  saving: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-3">
      <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={disabled ?? saving}>
        <Save className="h-4 w-4" aria-hidden />
        {saving ? t('saving') : label || t('save')}
      </button>
    </div>
  );
}

type LocalizedMap = { en?: string | null; fr?: string | null; de?: string | null };

function asLocalized(raw: LocalizedMap | string | null | undefined): LocalizedMap {
  if (raw == null) return { en: '', fr: '', de: '' };
  if (typeof raw === 'string') return { en: raw, fr: raw, de: raw };
  return {
    en: raw.en || '',
    fr: raw.fr || '',
    de: raw.de || '',
  };
}

function LocalizedFields({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: LocalizedMap | string | null | undefined;
  onChange: (next: LocalizedMap) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const loc = asLocalized(value);
  const setLang = (lang: keyof LocalizedMap, v: string) => onChange({ ...loc, [lang]: v });
  const InputTag = multiline ? 'textarea' : 'input';
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-[var(--text)]">{label}</span>
      {(['en', 'fr', 'de'] as const).map((lang) => (
        <label key={lang} className="block space-y-1">
          <span className="text-[11px] muted uppercase tracking-wide">{lang}</span>
          <InputTag
            className={`input ${multiline ? 'min-h-[3.5rem]' : ''}`}
            value={loc[lang] || ''}
            onChange={(e) => setLang(lang, e.target.value)}
            placeholder={placeholder}
          />
        </label>
      ))}
    </div>
  );
}

export default function Settings() {
  const { t, setLocale, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const jwtIsOwner = user?.role === 'merchant' && user?.isOwner !== false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [adyen, setAdyen] = useState<AdyenCreds>({});
  const [merchantAccount, setMerchantAccount] = useState('');
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [cardFeeFixed, setCardFeeFixed] = useState('0');
  const [cardFeePercent, setCardFeePercent] = useState('0');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [brevoUsage, setBrevoUsage] = useState<{
    dailySent?: number;
    dailyLimit?: number | null;
    dailyRemaining?: number | null;
    monthlySent?: number;
    monthlyLimit?: number | null;
    monthlyRemaining?: number | null;
    dailyPeriod?: string | null;
    monthlyPeriod?: string | null;
    account?: {
      email?: string;
      planCredits?: number | null;
      planCreditsType?: string | null;
      planType?: string | null;
      error?: string;
    } | null;
  } | null>(null);
  const [platformEmailUsage, setPlatformEmailUsage] = useState<{
    today?: number;
    thisMonth?: number;
    period?: { day?: string; month?: string };
  } | null>(null);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [terminalName, setTerminalName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAdyen, setSavingAdyen] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [savingWebposPay, setSavingWebposPay] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [printAgentOk, setPrintAgentOk] = useState(false);
  const [printAgentHealthChecked, setPrintAgentHealthChecked] = useState(false);
  const [printAgentOutdated, setPrintAgentOutdated] = useState(false);
  const [installedPrintCompanionVersion, setInstalledPrintCompanionVersion] = useState<string | null>(null);
  const [printBridgeManifest, setPrintBridgeManifest] = useState<DownloadManifest | null>(null);
  const [printAgentManifest, setPrintAgentManifest] = useState<DownloadManifest | null>(null);
  const [agentPrinters, setAgentPrinters] = useState<AgentPrinter[]>([]);
  const [refreshingPrinters, setRefreshingPrinters] = useState(false);
  const [testingPrinterId, setTestingPrinterId] = useState<string | null>(null);
  const [scalePorts, setScalePorts] = useState<ScaleDevice[]>([]);
  const [scanningScalePorts, setScanningScalePorts] = useState(false);
  const [scalePortsScanned, setScalePortsScanned] = useState(false);
  const [scaleScanError, setScaleScanError] = useState('');
  const [productCategories, setProductCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [catalogProducts, setCatalogProducts] = useState<
    Array<{ id: string; name: string; categoryId?: string | null }>
  >([]);
  const [savingTerminal, setSavingTerminal] = useState(false);
  const vacationImageInputRef = useRef<HTMLInputElement>(null);
  const [settingsQuery, setSettingsQuery] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(() => parseSettingsTabFromSearch(window.location.search));

  const tabs = useMemo(
    () =>
      [
        { id: 'business' as const, label: t('settingsBusiness'), navLabel: t('settingsNavBusiness'), icon: Building2 },
        { id: 'taxes' as const, label: t('settingsTaxes'), navLabel: t('settingsNavTaxes'), icon: Percent },
        { id: 'tables' as const, label: t('settingsTables'), navLabel: t('settingsNavTables'), icon: UtensilsCrossed },
        { id: 'shop' as const, label: t('shop'), navLabel: t('settingsNavShop'), icon: Globe2 },
        { id: 'delivery' as const, label: t('settingsDeliveryPlatforms'), navLabel: t('settingsNavDelivery'), icon: Truck },
        { id: 'delivery-map' as const, label: t('deliveryMapNav'), navLabel: t('settingsNavDeliveryMap'), icon: MapPin },
        { id: 'hours' as const, label: t('settingsHours'), navLabel: t('settingsNavHours'), icon: Clock },
        { id: 'reservations' as const, label: t('settingsReservations'), navLabel: t('settingsNavReservations'), icon: CalendarClock },
        { id: 'pos' as const, label: t('settingsPos'), navLabel: t('settingsNavPos'), icon: Monitor },
        { id: 'payments' as const, label: t('settingsPayments'), navLabel: t('settingsNavPayments'), icon: CreditCard },
        { id: 'receipt' as const, label: t('settingsReceipt'), navLabel: t('settingsNavReceipt'), icon: Printer },
        { id: 'kds' as const, label: t('kdsSettingsTitle'), navLabel: t('settingsNavKds'), icon: ChefHat },
        { id: 'ods' as const, label: t('odsSettingsTitle'), navLabel: t('settingsNavOds'), icon: Monitor },
        { id: 'email' as const, label: t('settingsEmail'), navLabel: t('settingsNavEmail'), icon: Mail },
        { id: 'users' as const, label: t('staffPageTitle'), navLabel: t('settingsNavStaff'), icon: Users },
        { id: 'language' as const, label: t('language'), navLabel: t('settingsNavLanguage'), icon: Languages },
      ] as const,
    [t]
  );

  const canOpenSettingsTab = useCallback(
    (tabId: TabId) => {
      if (tabId === 'users') {
        return canAccessRoute('/merchant/users', user?.permissions, jwtIsOwner);
      }
      if (tabId === 'delivery-map') {
        return canAccessRoute('/merchant/delivery', user?.permissions, jwtIsOwner);
      }
      return canAccessRoute('/merchant/settings', user?.permissions, jwtIsOwner);
    },
    [jwtIsOwner, user?.permissions]
  );

  const visibleTabs = useMemo(
    () => tabs.filter((item) => canOpenSettingsTab(item.id)),
    [canOpenSettingsTab, tabs]
  );

  const selectTab = useCallback(
    (nextTab: TabId) => {
      if (!canOpenSettingsTab(nextTab)) return;
      setTab(nextTab);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (nextTab === 'business') params.delete('tab');
          else params.set('tab', nextTab);
          return params;
        },
        { replace: true }
      );
    },
    [canOpenSettingsTab, setSearchParams]
  );

  useEffect(() => {
    const fromUrl = parseSettingsTabFromSearch(searchParams.toString());
    if (!canOpenSettingsTab(fromUrl)) return;
    setTab((current) => (current === fromUrl ? current : fromUrl));
  }, [canOpenSettingsTab, searchParams]);

  const searchIndex = useMemo<SettingsSearchEntry[]>(
    () => [
      {
        id: 'pos-mode',
        tab: 'pos',
        keywords: [
          'pos mode',
          'retail',
          'restaurant',
          'barcode',
          'mode',
          'magasin',
          'einzelhandel',
          'gastronomie',
          'tables',
          'fast food',
          'fast-food',
          'counter',
          t('posMode'),
          t('posModeRetail'),
          t('posModeRestaurant'),
          t('posTablesEnabled'),
        ],
      },
      {
        id: 'pos-layout',
        tab: 'pos',
        keywords: [
          'cart',
          'cart side',
          'cart position',
          'left',
          'right',
          'layout',
          'panier',
          'position panier',
          'gauche',
          'droite',
          'warenkorb',
          'position',
          'links',
          'rechts',
          'post success',
          'after payment',
          'navigate',
          'après paiement',
          'nach zahlung',
          'theme',
          'color',
          'couleur',
          'farbe',
          'teal',
          'violet',
          t('posCartSide'),
          t('posCartSideLeft'),
          t('posCartSideRight'),
          t('webPosPostSuccessNav'),
          t('posColorTheme'),
          t('posLayoutSettings'),
        ],
      },
      {
        id: 'pos-courses',
        tab: 'pos',
        keywords: [
          'courses',
          'course',
          'cours',
          'gänge',
          'gange',
          'gang',
          'fire',
          'kitchen',
          'send mode',
          t('coursesEnabled'),
          t('courseSendMode'),
        ],
      },
      {
        id: 'pos-checkout',
        tab: 'pos',
        keywords: [
          'tips',
          'pourboire',
          'trinkgeld',
          'discount',
          'remise',
          'rabatt',
          'quick cash',
          'split',
          'checkout',
          t('posCheckoutSettings'),
          t('tipsEnabled'),
          t('discountsEnabled'),
          t('quickCashEnabled'),
          t('splitBillsEnabled'),
        ],
      },
      {
        id: 'pos-payments',
        tab: 'pos',
        keywords: [
          'express',
          'express checkout',
          'cash',
          'card',
          'terminal',
          'paiement',
          'zahlung',
          t('webposExpress'),
          t('webposPaymentMethods'),
          t('webposCash'),
          t('webposCard'),
          t('webposTerminal'),
        ],
      },
      {
        id: 'pos-shifts',
        tab: 'pos',
        keywords: [
          'shift',
          'shifts',
          'caisse',
          'kasse',
          'float',
          'operations',
          'opérations',
          t('settingsOperations'),
          t('shiftsEnabled'),
          t('webPosShiftMenu'),
        ],
      },
      {
        id: 'tables-floor',
        tab: 'tables',
        keywords: ['tables', 'floor', 'plan', 'pax', t('floorPlanEnabled'), t('paxOrderingEnabled')],
      },
      {
        id: 'tables-management',
        tab: 'tables',
        keywords: [
          'table',
          'tables',
          'section',
          'layout',
          'qr',
          t('navTableManagement'),
          t('tableNavSettings'),
          t('tableNavLayout'),
          t('tableNavQr'),
        ],
      },
      {
        id: 'payments-adyen',
        tab: 'payments',
        keywords: ['adyen', 'swisspayout', 'terminal', t('adyenCredentials')],
      },
      {
        id: 'business-profile',
        tab: 'business',
        keywords: ['business', 'name', 'address', 'vat', t('businessSettings')],
      },
      {
        id: 'taxes-rates',
        tab: 'taxes',
        keywords: ['tax', 'vat', 'tva', 'mwst', t('taxRates')],
      },
      {
        id: 'shop-online',
        tab: 'shop',
        keywords: [
          'shop',
          'online',
          'domain',
          'subdomain',
          'photo',
          'photos',
          'image',
          'images',
          'product photo',
          'menu photo',
          t('shop'),
          t('shopShowProductPhotos'),
          t('shopMenuPhotos'),
        ],
      },
      {
        id: 'delivery-platforms',
        tab: 'delivery',
        keywords: [
          'just eat',
          'uber eats',
          'delivery',
          'aggregator',
          'webhook',
          t('settingsDeliveryPlatforms'),
          t('deliveryPlatformJustEat'),
          t('deliveryPlatformUberEats'),
        ],
      },
      {
        id: 'hours-schedule',
        tab: 'hours',
        keywords: ['hours', 'opening', 'pickup', 'delivery', 'dine', 'schedule', t('settingsHours')],
      },
      {
        id: 'reservations-config',
        tab: 'reservations',
        keywords: ['reservations', 'booking', 'slots', t('settingsReservations'), t('reservationsEnable')],
      },
      {
        id: 'receipt-print',
        tab: 'receipt',
        keywords: ['receipt', 'printer', 'kitchen', 'ticket', t('settingsReceipt')],
      },
      {
        id: 'barcode-labels',
        tab: 'receipt',
        keywords: ['barcode', 'label', 'code128', t('barcodeLabelsTitle')],
      },
      {
        id: 'inventory-addon',
        tab: 'pos',
        keywords: ['inventory', 'stock', 'recipe', 'supplier', t('invTitle')],
      },
      {
        id: 'storekeeper-addon',
        tab: 'pos',
        keywords: ['storekeeper', 'barcode', 'scan', 'intake', t('storekeeperTitle')],
      },
      {
        id: 'signage-addon',
        tab: 'pos',
        keywords: ['signage', 'tv', 'menu board', 'screens', t('signageTitle')],
      },
      {
        id: 'email-smtp',
        tab: 'email',
        keywords: [
          'email',
          'smtp',
          'brevo',
          'sendinblue',
          'api',
          'marketing',
          'newsletter',
          t('settingsEmail'),
          t('settingsBrevo'),
        ],
      },
      {
        id: 'email-brevo',
        tab: 'email',
        keywords: ['brevo', 'sendinblue', 'api key', 'newsletter', t('settingsBrevo')],
      },
      {
        id: 'language-panel',
        tab: 'language',
        keywords: ['language', 'langue', 'sprache', t('language')],
      },
    ],
    [t]
  );

  const normalizedQuery = settingsQuery.trim().toLowerCase();
  const matchedSearch = useMemo(() => {
    if (!normalizedQuery) return [] as SettingsSearchEntry[];
    return searchIndex.filter((entry) =>
      entry.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))
    );
  }, [normalizedQuery, searchIndex]);

  const matchedIds = useMemo(() => new Set(matchedSearch.map((m) => m.id)), [matchedSearch]);
  const matchedTabs = useMemo(() => new Set(matchedSearch.map((m) => m.tab)), [matchedSearch]);

  useEffect(() => {
    if (!normalizedQuery) {
      setHighlightId(null);
      return;
    }
    const matches = searchIndex.filter((entry) =>
      entry.keywords.some((kw) => kw.toLowerCase().includes(normalizedQuery))
    );
    if (matches.length === 0) {
      setHighlightId(null);
      return;
    }
    const best = matches[0];
    selectTab(best.tab);
    setHighlightId(best.id);
    const timer = window.setTimeout(() => {
      document.getElementById(best.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
    // Jump only when the query text changes — not on every match-list identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedQuery]);

  const isSectionVisible = (id: string) => !normalizedQuery || matchedIds.has(id);
  const isSectionHighlight = (id: string) => highlightId === id;

  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    setHighlightId(hash);
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loading, tab]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const [settingsRes, terminalsRes, categoriesRes, productsRes] = await Promise.all([
          api.get('/merchant/settings'),
          api.get('/terminals').catch(() => ({ data: { adyen: {}, terminals: [] } })),
          api.get('/merchant/categories').catch(() => ({ data: { categories: [] } })),
          api.get('/merchant/products', { params: { limit: 5000 } }).catch(() => ({ data: { products: [] } })),
        ]);
        const s = settingsRes.data?.settings;
        if (!s) {
          throw new Error('Settings response missing data');
        }
        setSettings({
          ...s,
          name: s.name || '',
          email: s.email || '',
        });
        setProductCategories(
          (categoriesRes.data?.categories || []).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          }))
        );
        setCatalogProducts(
          (productsRes.data?.products || []).map(
            (p: { id: string; name: string; categoryId?: string | null }) => ({
              id: p.id,
              name: p.name,
              categoryId: p.categoryId ?? null,
            })
          )
        );
        setCardFeeFixed(String(s?.onlineCardFeeFixed ?? '0'));
        setCardFeePercent(String(s?.onlineCardFeePercent ?? '0'));
        const a = terminalsRes.data.adyen || {};
        setAdyen(a);
        setMerchantAccount(a.merchantAccount || '');
        setClientId(a.clientId || '');
        setTerminals(terminalsRes.data.terminals || []);
        try {
          const usageRes = await api.get('/merchant/marketing/brevo-usage');
          setBrevoUsage(usageRes.data.usage || null);
        } catch {
          setBrevoUsage(null);
        }
        try {
          const platformUsageRes = await api.get('/merchant/marketing/platform-email-usage');
          setPlatformEmailUsage(platformUsageRes.data.usage || null);
        } catch {
          setPlatformEmailUsage(null);
        }

        const stored = localStorage.getItem('manupos_panel_lang');
        if (
          (!stored || !['en', 'fr', 'de'].includes(stored)) &&
          s?.panelLanguage &&
          ['en', 'fr', 'de'].includes(s.panelLanguage)
        ) {
          setLocale(s.panelLanguage as Locale);
        } else if (stored && ['en', 'fr', 'de'].includes(stored)) {
          setSettings((prev) => (prev ? { ...prev, panelLanguage: stored } : prev));
        }
        setLoadError(null);
        return;
      } catch (error: unknown) {
        lastError = error;
        const status = (error as { response?: { status?: number } })?.response?.status;
        const retryable =
          attempt === 0 && (status == null || status >= 500 || status === 429 || status === 408);
        if (retryable) {
          await new Promise((resolve) => window.setTimeout(resolve, 600));
          continue;
        }
        break;
      }
    }

    const err = lastError as { response?: { data?: { error?: string } }; message?: string };
    const msg = err.response?.data?.error || err.message || t('settingsLoadFailed');
    setSettings(null);
    setLoadError(msg);
    toast.error(msg);
  }, [setLocale, t]);

  useEffect(() => {
    void loadSettings().finally(() => setLoading(false));
  }, [loadSettings]);

  useEffect(() => {
    void Promise.all([fetchPrintBridgeManifest(), fetchPrintAgentManifest()]).then(
      ([bridge, agent]) => {
        setPrintBridgeManifest(bridge);
        setPrintAgentManifest(agent);
      }
    );
  }, []);

  const refreshPrintAgentPrinters = useCallback(async () => {
    setRefreshingPrinters(true);
    try {
      const health = await getPrintAgentHealth(isAndroidDevice() ? 2 : 0);
      setPrintAgentOk(health.ok);
      setPrintAgentHealthChecked(true);
      const serverVersion = isAndroidDevice()
        ? printBridgeManifest?.version
        : printAgentManifest?.version;
      setInstalledPrintCompanionVersion(health.ok && health.version ? String(health.version) : null);
      setPrintAgentOutdated(health.ok && isPrintAgentVersionOutdated(health.version, serverVersion));
      if (!health.ok) {
        setInstalledPrintCompanionVersion(null);
        setAgentPrinters([]);
        return;
      }
      const list = await listAgentPrinters();
      setAgentPrinters(list);
      setSettings((prev) => {
        if (!prev?.posPrintSettings?.printers?.length) return prev;
        const { profiles, changed } = reconcileAndPrunePosPrinterProfiles(
          prev.posPrintSettings.printers,
          list
        );
        if (!changed) return prev;
        const nextSettings = {
          ...prev,
          posPrintSettings: { ...prev.posPrintSettings, printers: profiles },
        };
        void api
          .put('/merchant/settings', { posPrintSettings: nextSettings.posPrintSettings })
          .catch(() => undefined);
        return nextSettings;
      });
    } catch {
      setPrintAgentOk(false);
      setPrintAgentOutdated(false);
      setInstalledPrintCompanionVersion(null);
      setAgentPrinters([]);
    } finally {
      setRefreshingPrinters(false);
    }
  }, [printAgentManifest?.version, printBridgeManifest?.version]);

  const testPrinterProfile = useCallback(
    async (profile: { id: string; name: string }) => {
      const name = String(profile.name || '').trim();
      if (!name) {
        toast.error(t('testPrinterNeedName'));
        return;
      }
      const health = await getPrintAgentHealth().catch(() => ({ ok: false }));
      if (!health.ok && !printAgentOk) {
        toast.error(t('testPrinterNeedAgent'));
        return;
      }
      setTestingPrinterId(profile.id);
      try {
        const escpos = buildPrinterTestEscPos({
          merchantName: settings?.name,
          printerName: name,
        });
        await printViaAgent({
          printerName: name,
          dataBase64: uint8ToBase64(escpos),
          text: `TEST PRINT\n${settings?.name || ''}\n${name}\n`,
        });
        toast.success(t('testPrinterOk').replace('{name}', name));
      } catch (error: unknown) {
        const msg =
          error && typeof error === 'object' && 'message' in error
            ? String((error as { message?: string }).message || '')
            : '';
        toast.error(msg || t('testPrinterFailed'));
      } finally {
        setTestingPrinterId(null);
      }
    },
    [printAgentOk, settings?.name, t]
  );

  const refreshScalePorts = useCallback(async () => {
    setScanningScalePorts(true);
    setScaleScanError('');
    try {
      const ok = await isPrintAgentAvailable();
      if (!ok) {
        setScalePorts([]);
        setScalePortsScanned(false);
        setScaleScanError('');
        return;
      }
      const { devices, ports } = await listScaleDevices();
      const listed = devices.length
        ? devices
        : ports.map((port) => ({ port, name: port, caption: port }));
      setScalePorts(listed);
      setScalePortsScanned(true);
    } catch (e: any) {
      setScalePorts([]);
      setScalePortsScanned(true);
      setScaleScanError(e?.message || t('settingsScaleScanFailed'));
    } finally {
      setScanningScalePorts(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab !== 'receipt') return;
    void refreshPrintAgentPrinters();
    void refreshScalePorts();
  }, [tab, printAgentManifest?.version, printBridgeManifest?.version, refreshPrintAgentPrinters, refreshScalePorts]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const response = await api.put('/merchant/settings', {
        name: settings.name,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        city: settings.city,
        country: settings.country,
        vatNumber: settings.vatNumber,
        vatRate: settings.vatRate ? Number(settings.vatRate) : undefined,
        taxTakeawayRate:
          settings.taxTakeawayRate != null ? Number(settings.taxTakeawayRate) : undefined,
        taxDineInRate: settings.taxDineInRate != null ? Number(settings.taxDineInRate) : undefined,
        taxDeliveryRate:
          settings.taxDeliveryRate != null ? Number(settings.taxDeliveryRate) : undefined,
        taxIncludedInPrice: !!settings.taxIncludedInPrice,
        vatAfterDiscount: settings.vatAfterDiscount !== false,
        slug: settings.slug || undefined,
        subdomain: settings.subdomain || undefined,
        customDomain: settings.customDomain?.trim() || null,
        shopEnabled: !!settings.shopEnabled,
        acceptingOrders: settings.acceptingOrders !== false,
        acceptingReservations: settings.acceptingReservations !== false,
        cartLayout: settings.cartLayout || 'hidden_slide',
        menuShowProductImages: settings.menuShowProductImages !== false,
        menuShowCategoryBanners: settings.menuShowCategoryBanners !== false,
        floorPlanEnabled: !!settings.floorPlanEnabled,
        paxOrderingEnabled: !!settings.paxOrderingEnabled,
        coursesEnabled: !!settings.coursesEnabled,
        shiftsEnabled: !!settings.shiftsEnabled,
        posColorTheme: settings.posColorTheme || 'teal',
        posCheckoutSettings: settings.posCheckoutSettings || undefined,
        webposExpressEnabled: settings.webposExpressEnabled !== false,
        webposCashEnabled: settings.webposCashEnabled !== false,
        webposCardEnabled: settings.webposCardEnabled !== false,
        webposTerminalEnabled: settings.webposTerminalEnabled !== false,
        webposGiftCardEnabled: settings.webposGiftCardEnabled === true,
        webposInvoiceEnabled: settings.webposInvoiceEnabled !== false,
        bankIban: settings.bankIban || null,
        bankQrIban: settings.bankQrIban || null,
        bankName: settings.bankName || null,
        bankAccountHolder: settings.bankAccountHolder || null,
        panelLanguage: settings.panelLanguage || locale,
        emailSmtpSettings: {
          enabled: !!settings.emailSmtpSettings?.enabled,
          host: settings.emailSmtpSettings?.host || '',
          port: Number(settings.emailSmtpSettings?.port) || 587,
          secure: !!settings.emailSmtpSettings?.secure,
          user: settings.emailSmtpSettings?.user || '',
          password: smtpPassword || undefined,
          fromEmail: settings.emailSmtpSettings?.fromEmail || '',
          fromName: settings.emailSmtpSettings?.fromName || '',
        },
        emailBrevoSettings: {
          enabled: !!settings.emailBrevoSettings?.enabled,
          apiKey: brevoApiKey || undefined,
          fromEmail: settings.emailBrevoSettings?.fromEmail || '',
          fromName: settings.name || '',
          dailyLimit: settings.emailBrevoSettings?.dailyLimit ?? null,
          monthlyLimit: settings.emailBrevoSettings?.monthlyLimit ?? null,
        },
        emailDeliveryMode: settings.emailDeliveryMode === 'own' ? 'own' : 'platform',
        marketingSettings: {
          reorderReminderEnabled: !!settings.marketingSettings?.reorderReminderEnabled,
          reorderReminderDays: Number(settings.marketingSettings?.reorderReminderDays) || 5,
          reorderReminderSubject: settings.marketingSettings?.reorderReminderSubject || '',
          reorderReminderBody: settings.marketingSettings?.reorderReminderBody || '',
        },
        vacationSettings: settings.vacationSettings || {
          enabled: false,
          popupImageUrl: null,
          popupTitle: null,
          message: null,
          periods: [],
        },
      });
      const next = response.data.merchant || response.data.settings || settings;
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      // Re-fetch so shiftsEnabled and other flags reflect DB truth after save.
      try {
        const refreshed = await api.get('/merchant/settings');
        if (refreshed.data?.settings) {
          setSettings(refreshed.data.settings);
          if (refreshed.data.settings.panelLanguage) {
            setLocale(refreshed.data.settings.panelLanguage as Locale);
          }
        }
      } catch {
        if (next.panelLanguage) setLocale(next.panelLanguage as Locale);
      }
      setSmtpPassword('');
      setBrevoApiKey('');
      try {
        const usageRes = await api.get('/merchant/marketing/brevo-usage');
        setBrevoUsage(usageRes.data.usage || null);
      } catch {
        /* ignore */
      }
      toast.success(t('settingsSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveAdyen = async (e: FormEvent) => {
    e.preventDefault();
    setSavingAdyen(true);
    try {
      const response = await api.put('/terminals/adyen-credentials', {
        adyenMerchantAccount: merchantAccount,
        adyenApiKey: apiKey || undefined,
        adyenClientId: clientId,
      });
      setAdyen(response.data.adyen || {});
      setApiKey('');
      toast.success(t('adyenSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save Swisspayout credentials');
    } finally {
      setSavingAdyen(false);
    }
  };

  const saveCardFees = async (e: FormEvent) => {
    e.preventDefault();
    setSavingFee(true);
    try {
      const response = await api.put('/merchant/settings', {
        onlineCardFeeFixed: Number(cardFeeFixed) || 0,
        onlineCardFeePercent: Number(cardFeePercent) || 0,
      });
      const next = response.data.merchant || response.data.settings || {};
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      setCardFeeFixed(String(next.onlineCardFeeFixed ?? cardFeeFixed));
      setCardFeePercent(String(next.onlineCardFeePercent ?? cardFeePercent));
      toast.success(t('cardFeesSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedSaveCardFees'));
    } finally {
      setSavingFee(false);
    }
  };

  const saveWebposPayments = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingWebposPay(true);
    try {
      const response = await api.put('/merchant/settings', {
        webposExpressEnabled: settings.webposExpressEnabled !== false,
        webposCashEnabled: settings.webposCashEnabled !== false,
        webposCardEnabled: settings.webposCardEnabled !== false,
        webposTerminalEnabled: settings.webposTerminalEnabled !== false,
        webposGiftCardEnabled: settings.webposGiftCardEnabled === true,
        webposInvoiceEnabled: settings.webposInvoiceEnabled !== false,
        bankIban: settings.bankIban || null,
        bankQrIban: settings.bankQrIban || null,
        bankName: settings.bankName || null,
        bankAccountHolder: settings.bankAccountHolder || null,
        adyenLiveEnvironment: !!settings.adyenLiveEnvironment,
        adyenUseLegacyEndpoint: !!settings.adyenUseLegacyEndpoint,
      });
      const next = response.data.merchant || response.data.settings || {};
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      toast.success(t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save POS payment settings');
    } finally {
      setSavingWebposPay(false);
    }
  };

  const buildPosPrintSettingsPayload = useCallback(
    (ps: NonNullable<SettingsData['posPrintSettings']>) => {
      const printers = (ps.printers || []).map((p) => ({
        ...p,
        linkedCategoryIds: Array.isArray(p.linkedCategoryIds)
          ? p.linkedCategoryIds.filter(Boolean)
          : [],
        linkedProductIds: Array.isArray(p.linkedProductIds) ? p.linkedProductIds.filter(Boolean) : [],
      }));
      return {
        receiptHeader: ps.receiptHeader || '',
        receiptFooter: ps.receiptFooter || '',
        kitchenTicketHeader: ps.kitchenTicketHeader || '',
        kitchenTicketFooter: ps.kitchenTicketFooter || '',
        kitchenItemTextScale: ps.kitchenItemTextScale === 2 || ps.kitchenItemTextScale === 3 ? ps.kitchenItemTextScale : 1,
        kitchenHeaderTextScale:
          ps.kitchenHeaderTextScale === 2 || ps.kitchenHeaderTextScale === 3
            ? ps.kitchenHeaderTextScale
            : 1,
        kitchenBoldText: ps.kitchenBoldText === true,
        receiptShowVatTable: ps.receiptShowVatTable !== false,
        receiptShowStaffLine: ps.receiptShowStaffLine !== false,
        receiptShowQrCode: ps.receiptShowQrCode !== false,
        receiptDeliveryDirectionsQr: ps.receiptDeliveryDirectionsQr !== false,
        adyenReceiptDigitalOnly: ps.adyenReceiptDigitalOnly === true,
        paperWidthMm: ps.paperWidthMm === 58 ? 58 : 80,
        receiptLanguage: ps.receiptLanguage || 'panel',
        receiptLogoUrl: ps.receiptLogoUrl || null,
        receiptLogoWidthPx: Math.min(
          200,
          Math.max(48, Number(ps.receiptLogoWidthPx) || 200)
        ),
        autoPrintReceipt: ps.autoPrintReceipt !== false,
        autoPrintKitchen: ps.autoPrintKitchen !== false,
        autoPrintReservations: ps.autoPrintReservations !== false,
        autoPrintOnlineOrdersOnArrival: ps.autoPrintOnlineOrdersOnArrival === true,
        waiterTillBellEnabled: ps.waiterTillBellEnabled !== false,
        kitchenPrintRetryEnabled: ps.kitchenPrintRetryEnabled !== false,
        kitchenPrintRetryAttempts: Math.min(20, Math.max(1, Number(ps.kitchenPrintRetryAttempts) || 5)),
        kitchenPrintRetryIntervalSec: Math.min(
          60,
          Math.max(2, Number(ps.kitchenPrintRetryIntervalSec) || 5)
        ),
        bluetoothPrinterSlowMode: ps.bluetoothPrinterSlowMode === true,
        scaleComPort: ps.scaleComPort?.trim() || null,
        scaleDeviceName: ps.scaleDeviceName?.trim() || null,
        scaleDeviceId: ps.scaleDeviceId?.trim() || null,
        scaleUsbAddress: ps.scaleUsbAddress?.trim() || null,
        scaleEnabled:
          !!ps.scaleComPort?.trim() ||
          !!ps.scaleDeviceName?.trim() ||
          !!ps.scaleUsbAddress?.trim() ||
          ps.scaleEnabled === true,
        printers,
        labelWidthMm: ps.labelWidthMm === 58 ? 58 : 40,
        labelHeightMm:
          ps.labelHeightMm === 25 || ps.labelHeightMm === 30 || ps.labelHeightMm === 40
            ? ps.labelHeightMm
            : 20,
        labelShowStoreName: ps.labelShowStoreName !== false,
        labelShowProductName: ps.labelShowProductName !== false,
        labelShowBarcodeNumber: ps.labelShowBarcodeNumber !== false,
        labelShowPrice: ps.labelShowPrice === true,
        labelShowSku: ps.labelShowSku === true,
      };
    },
    []
  );

  const persistPosPrintSettings = useCallback(
    async (snapshot: SettingsData, successMessage = t('saved')) => {
      const ps = snapshot.posPrintSettings || {};
      const response = await api.put('/merchant/settings', {
        posPrintSettings: buildPosPrintSettingsPayload(ps),
      });
      const next = response.data.merchant || response.data.settings || {};
      setSettings((prev) => (prev ? { ...prev, ...next } : prev));
      toast.success(successMessage);
    },
    [buildPosPrintSettingsPayload, t]
  );

  const selectScalePortAndSave = async (device: ScaleDevice | string) => {
    if (!settings) return;
    const row: ScaleDevice = typeof device === 'string' ? { port: device, name: device } : device;
    const usbAddress = String(row.usbAddress || (isUsbScaleAddress(row.port) ? row.port : '')).trim();
    if (usbAddress) {
      const deviceName = String(row.name || row.caption || '').trim();
      const nextSettings: SettingsData = {
        ...settings,
        posPrintSettings: {
          ...(settings.posPrintSettings || {}),
          scaleUsbAddress: usbAddress,
          scaleDeviceName: deviceName || null,
          scaleEnabled: true,
        },
      };
      setSettings(nextSettings);
      setSavingReceipt(true);
      try {
        await persistPosPrintSettings(nextSettings, t('settingsScaleSaved'));
      } catch (error: any) {
        toast.error(error.response?.data?.error || t('failedSaveReceipt'));
      } finally {
        setSavingReceipt(false);
      }
      return;
    }
    const label = formatScalePortLabel(row.port);
    if (!label) return;
    const deviceName = String(row.name || row.caption || '')
      .replace(/\s*\(COM\d+\)\s*$/i, '')
      .trim();
    const nextSettings: SettingsData = {
      ...settings,
      posPrintSettings: {
        ...(settings.posPrintSettings || {}),
        scaleComPort: label,
        scaleDeviceName: deviceName || null,
        scaleDeviceId: row.pnpDeviceId?.trim() || null,
        scaleEnabled: true,
      },
    };
    setSettings(nextSettings);
    setSavingReceipt(true);
    try {
      await persistPosPrintSettings(nextSettings, t('settingsScaleSaved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedSaveReceipt'));
    } finally {
      setSavingReceipt(false);
    }
  };

  const saveReceiptPrint = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSavingReceipt(true);
    try {
      await persistPosPrintSettings(settings);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedSaveReceipt'));
    } finally {
      setSavingReceipt(false);
    }
  };

  const addTerminal = async (e: FormEvent) => {
    e.preventDefault();
    if (!terminalId.trim()) {
      toast.error(t('terminalIdRequired'));
      return;
    }
    setSavingTerminal(true);
    try {
      await api.post('/terminals', {
        terminalId: terminalId.trim(),
        terminalName: terminalName.trim() || terminalId.trim(),
        serialNumber: terminalId.trim(),
      });
      toast.success(t('terminalAdded'));
      setTerminalId('');
      setTerminalName('');
      const res = await api.get('/terminals');
      setTerminals(res.data.terminals || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedAddTerminal'));
    } finally {
      setSavingTerminal(false);
    }
  };

  const removeTerminal = async (id: string) => {
    try {
      await api.delete(`/terminals/${id}`);
      setTerminals((prev) => prev.filter((t) => t.id !== id));
      toast.success(t('terminalRemoved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('failedRemoveTerminal'));
    }
  };

  const settingsOptionalTab = tab === 'users' || tab === 'delivery-map';

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((item) => item.id === tab)) {
      selectTab(visibleTabs[0].id);
    }
  }, [selectTab, tab, visibleTabs]);

  if (loading && !settingsOptionalTab) {
    return <div className="text-center py-12 muted text-sm">{t('loading')}</div>;
  }
  if (!settings && !settingsOptionalTab) {
    return (
      <div className="card space-y-3 text-center py-8">
        <p>{t('settingsLoadFailed')}</p>
        {loadError && loadError !== t('settingsLoadFailed') ? (
          <p className="text-sm muted">{loadError}</p>
        ) : null}
        <button
          type="button"
          className="btn-primary mx-auto"
          onClick={() => {
            setLoading(true);
            void loadSettings().finally(() => setLoading(false));
          }}
        >
          {t('settingsLoadRetry')}
        </button>
      </div>
    );
  }

  const showScaleSettings =
    !!settings &&
    showPosScaleFeature(
      settings.editionFeatures,
      normalizeBusinessModule(settings.businessCategory)
    );
  const posRetailMode =
    settings?.businessCategory === 'retail' ||
    (!settings?.businessCategory &&
      (settings?.posCheckoutSettings?.posMode || 'restaurant') === 'retail');

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 sm:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{t('settings')}</h1>
          <p className="page-sub">
            {t('settingsFor')}{' '}
            <span className="font-medium text-[var(--text)]">
              {settings?.name || user?.name || '—'}
            </span>
          </p>
        </div>
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="input pl-9"
            type="search"
            value={settingsQuery}
            onChange={(e) => setSettingsQuery(e.target.value)}
            placeholder={t('settingsSearchPlaceholder')}
            aria-label={t('settingsSearch')}
          />
        </label>
      </div>
      {normalizedQuery ? (
        <p className="text-xs muted">
          {matchedSearch.length
            ? t('settingsSearchMatches').replace('{count}', String(matchedSearch.length))
            : t('settingsSearchNoMatches')}
        </p>
      ) : null}

      <div className="card !p-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row min-h-[60vh]">
          <aside className="shrink-0 border-b border-[var(--border)] lg:w-56 lg:border-b-0 lg:border-r">
            <nav
              className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3 md:grid-cols-4 lg:flex lg:flex-col lg:gap-0.5 lg:overflow-visible max-h-[min(42vh,320px)] overflow-y-auto overscroll-y-contain lg:max-h-none [-webkit-overflow-scrolling:touch]"
              aria-label={t('settings')}
            >
              {visibleTabs.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                const searchHit = normalizedQuery ? matchedTabs.has(item.id) : false;
                const searchMiss = normalizedQuery ? !searchHit : false;
                const navText = item.navLabel ?? item.label;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      selectTab(item.id);
                      if (normalizedQuery) {
                        const first = matchedSearch.find((m) => m.tab === item.id);
                        if (first) setHighlightId(first.id);
                      }
                    }}
                    aria-label={item.label}
                    title={item.label}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors lg:w-full lg:py-2 ${
                      active
                        ? 'bg-[var(--bg-muted)] text-[var(--text)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]'
                    } ${searchHit ? 'ring-1 ring-[var(--ring)]' : ''} ${searchMiss ? 'opacity-45' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate lg:whitespace-normal">
                      <span className="lg:hidden">{navText}</span>
                      <span className="hidden lg:inline">{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 p-4 sm:p-5 pb-24 sm:pb-5">
          {tab === 'business' && (
            <SettingsBusinessTab
              settings={settings}
              setSettings={(next) => setSettings(next)}
              onSave={onSave}
              saving={saving}
              vacationImageInputRef={vacationImageInputRef}
              highlightId={highlightId}
            />
          )}


          {tab === 'taxes' && (
            <form onSubmit={onSave} className="space-y-5">
              <SettingsPageHeader
                title={t('settingsTaxes')}
                subtitle={t('taxRatesHint')}
                action={
                  <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                    <Save className="h-4 w-4" aria-hidden />
                    {saving ? t('saving') : t('save')}
                  </button>
                }
              />
              <Section icon={Percent} accent={settingsDash.warning} title={t('taxRates')} description={t('taxRatesHint')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={`${t('defaultVatRate')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.vatRate || ''}
                      onChange={(e) => setSettings({ ...settings, vatRate: e.target.value })}
                    />
                  </Field>
                  <Field label={`${t('takeaway')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.taxTakeawayRate ?? settings.vatRate ?? ''}
                      onChange={(e) => setSettings({ ...settings, taxTakeawayRate: e.target.value })}
                    />
                  </Field>
                  <Field label={`${t('dineIn')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.taxDineInRate ?? settings.vatRate ?? ''}
                      onChange={(e) => setSettings({ ...settings, taxDineInRate: e.target.value })}
                    />
                  </Field>
                  <Field label={`${t('delivery')} (%)`}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={settings.taxDeliveryRate ?? settings.vatRate ?? ''}
                      onChange={(e) => setSettings({ ...settings, taxDeliveryRate: e.target.value })}
                    />
                  </Field>
                </div>
              </Section>
              <Section icon={Percent} accent={settingsDash.info} title={t('taxPriceMode')} description={t('taxPriceModeHint')}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                      !settings.taxIncludedInPrice
                        ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="taxPriceMode"
                      className="mt-0.5"
                      checked={!settings.taxIncludedInPrice}
                      onChange={() => setSettings({ ...settings, taxIncludedInPrice: false })}
                    />
                    <span>
                      <span className="font-medium block">{t('taxExcludedInPrice')}</span>
                      <span className="text-xs muted">{t('taxExcludedInPriceHint')}</span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                      settings.taxIncludedInPrice
                        ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                        : 'border-[var(--border)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="taxPriceMode"
                      className="mt-0.5"
                      checked={!!settings.taxIncludedInPrice}
                      onChange={() => setSettings({ ...settings, taxIncludedInPrice: true })}
                    />
                    <span>
                      <span className="font-medium block">{t('taxIncludedInPrice')}</span>
                      <span className="text-xs muted">{t('taxIncludedInPriceHint')}</span>
                    </span>
                  </label>
                </div>
              </Section>
              {!settings.taxIncludedInPrice ? (
                <Section
                  icon={Percent}
                  accent={settingsDash.info}
                  title={t('vatDiscountOrder')}
                  description={t('vatDiscountOrderHint')}
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                        settings.vatAfterDiscount !== false
                          ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="vatDiscountOrder"
                        className="mt-0.5"
                        checked={settings.vatAfterDiscount !== false}
                        onChange={() => setSettings({ ...settings, vatAfterDiscount: true })}
                      />
                      <span>
                        <span className="font-medium block">{t('vatAfterDiscount')}</span>
                        <span className="text-xs muted">{t('vatAfterDiscountHint')}</span>
                      </span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                        settings.vatAfterDiscount === false
                          ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="vatDiscountOrder"
                        className="mt-0.5"
                        checked={settings.vatAfterDiscount === false}
                        onChange={() => setSettings({ ...settings, vatAfterDiscount: false })}
                      />
                      <span>
                        <span className="font-medium block">{t('vatBeforeDiscount')}</span>
                        <span className="text-xs muted">{t('vatBeforeDiscountHint')}</span>
                      </span>
                    </label>
                  </div>
                </Section>
              ) : null}
              <SettingsSaveBar saving={saving} />
            </form>
          )}

          {tab === 'shop' && (
            <form onSubmit={onSave} className="space-y-5">
              <SettingsPageHeader
                title={t('shop')}
                subtitle={t('shopSettingsHint')}
                action={
                  <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                    <Save className="h-4 w-4" aria-hidden />
                    {saving ? t('saving') : t('save')}
                  </button>
                }
              />
              <Section icon={Globe2} accent={settingsDash.info} title={t('shop')} description={t('shopSettingsHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.shopEnabled}
                    onChange={(e) => setSettings({ ...settings, shopEnabled: e.target.checked })}
                  />
                  <span>
                    <span className="font-medium block">{t('enableOnlineShop')}</span>
                    <span className="text-xs muted">{t('enableOnlineShopHint')}</span>
                  </span>
                </label>

                <div className="rounded-md border border-[var(--border)] p-3 space-y-2">
                  <p className="text-sm font-medium">{t('acceptingMenuTitle')}</p>
                  <p className="text-xs muted">{t('acceptingMenuHint')}</p>
                  <label className="flex items-start gap-2.5 text-sm py-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.acceptingOrders !== false}
                      onChange={(e) =>
                        setSettings({ ...settings, acceptingOrders: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">{t('acceptingOrders')}</span>
                      <span className="text-[11px] muted">{t('acceptingOrdersHint')}</span>
                    </span>
                  </label>
                  <label
                    className={`flex items-start gap-2.5 text-sm py-1 ${
                      !settings.reservationsEnabled ? 'opacity-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.acceptingReservations !== false}
                      disabled={!settings.reservationsEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, acceptingReservations: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">{t('acceptingReservations')}</span>
                      <span className="text-[11px] muted">
                        {settings.reservationsEnabled
                          ? t('acceptingReservationsHint')
                          : t('acceptingReservationsDisabled')}
                      </span>
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t('shopSlug')}
                    hint={settings.shopPathUrl || t('shopSlugHint')}
                  >
                    <input
                      className="input"
                      value={settings.slug || ''}
                      onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                      placeholder="my-cafe"
                    />
                  </Field>
                  <Field label={t('cmsCustomDomain')} hint={settings.shopCustomDomainUrl || undefined}>
                    <p className="text-xs muted mb-1.5">{t('cmsDnsGoCreate')}</p>
                    <table className="w-full max-w-md text-xs border border-[var(--border)]">
                      <tbody>
                        <tr className="border-b border-[var(--border)]">
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium w-24">
                            {t('cmsDnsType')}
                          </th>
                          <td className="px-2 py-1.5 font-mono">CNAME</td>
                        </tr>
                        <tr className="border-b border-[var(--border)]">
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                            {t('cmsDnsHost')}
                          </th>
                          <td className="px-2 py-1.5 font-mono">www</td>
                        </tr>
                        <tr>
                          <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">
                            {t('cmsDnsPointsTo')}
                          </th>
                          <td className="px-2 py-1.5 font-mono">shop.rebornsense.com</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="text-xs muted mt-1.5 mb-1.5">{t('cmsDnsThenEnter')}</p>
                    <input
                      className="input"
                      value={settings.customDomain || ''}
                      onChange={(e) => setSettings({ ...settings, customDomain: e.target.value })}
                      placeholder="www.mycafe.ch"
                    />
                  </Field>
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-2">
                  <p className="text-sm font-medium">{t('shopHoursNavTitle')}</p>
                  <p className="text-xs muted">{t('shopHoursNavHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Link to="/merchant/settings?tab=hours" className="btn-secondary text-sm">
                      {t('shopHoursNavOpening')}
                    </Link>
                    <Link to="/merchant/settings?tab=reservations" className="btn-secondary text-sm">
                      {t('shopHoursNavReservations')}
                    </Link>
                    <Link to="/merchant/settings?tab=business#business-vacation" className="btn-secondary text-sm">
                      {t('shopHoursNavVacation')}
                    </Link>
                  </div>
                  <p className="text-xs muted">{t('shopHoursNavPos')}</p>
                </div>

                <Field label={t('shopCartLayout')} hint={t('shopCartLayoutHint')}>
                  <select
                    className="input max-w-md"
                    value={settings.cartLayout || 'hidden_slide'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        cartLayout: e.target.value as 'hidden_slide' | 'sticky_right',
                      })
                    }
                  >
                    <option value="hidden_slide">{t('shopCartLayoutHiddenSlide')}</option>
                    <option value="sticky_right">{t('shopCartLayoutStickyRight')}</option>
                  </select>
                </Field>

                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-2">
                  <p className="text-sm font-medium">{t('shopMenuPhotos')}</p>
                  <label className="flex items-start gap-2.5 text-sm py-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.menuShowProductImages !== false}
                      onChange={(e) =>
                        setSettings({ ...settings, menuShowProductImages: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium block">{t('shopShowProductPhotos')}</span>
                      <span className="text-[11px] muted">{t('shopShowProductPhotosHint')}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 text-sm py-1">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.menuShowCategoryBanners !== false}
                      onChange={(e) =>
                        setSettings({ ...settings, menuShowCategoryBanners: e.target.checked })
                      }
                    />
                    <span className="font-medium">{t('shopShowCategoryBanners')}</span>
                  </label>
                </div>

                <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3 space-y-2">
                  <p className="text-sm font-medium">{t('shopOnlineShopMore')}</p>
                  <Link to="/merchant/online-shop" className="btn-secondary text-sm inline-flex">
                    {t('shopOnlineShopMoreLink')}
                  </Link>
                </div>
              </Section>
              <SettingsSaveBar saving={saving} />
            </form>
          )}

          {tab === 'delivery' && <SettingsDeliveryPlatformsTab />}

          {tab === 'delivery-map' && (
            <div className="space-y-5">
              <SettingsPageHeader title={t('deliveryMapNav')} subtitle={t('deliveryMapHint')} />
              <DeliveryTrackingPage embedded />
            </div>
          )}

          {tab === 'users' && (
            <div className="space-y-5">
              <SettingsPageHeader title={t('staffPageTitle')} subtitle={t('staffPageHint')} />
              <Staff embedded />
            </div>
          )}

          {tab === 'hours' && <SettingsHoursTab />}

          {tab === 'reservations' && <SettingsReservationsTab />}

          {tab === 'tables' && (
            <SettingsTablesTab
              settings={settings}
              setSettings={(next) => setSettings({ ...settings, ...next })}
              onSave={onSave}
              saving={saving}
              highlightId={highlightId}
              normalizedQuery={normalizedQuery}
              isSectionVisible={isSectionVisible}
              isSectionHighlight={isSectionHighlight}
              onGoToPosTab={(query, sectionId) => {
                setSettingsQuery(query);
                selectTab('pos');
                setHighlightId(sectionId);
              }}
            />
          )}

          {tab === 'pos' && (
            <form onSubmit={onSave} className="space-y-5">
              <SettingsPageHeader
                title={t('settingsPos')}
                subtitle={t('posLayoutSettingsHint')}
                action={
                  <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                    <Save className="h-4 w-4" aria-hidden />
                    {saving ? t('saving') : t('save')}
                  </button>
                }
              />
              <Section
                id="pos-mode"
                icon={Monitor}
                accent={settingsDash.accent}
                title={t('settingsTablesFeatures')}
                description={t('posTablesEnabledHint')}
                highlight={isSectionHighlight('pos-mode')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-mode') : false}
              >
                {settings.businessCategory ? (
                  <p className="text-sm">
                    {t('businessModuleLocked', {
                      module:
                        settings.businessCategory === 'retail'
                          ? t('businessModuleRetail')
                          : t('businessModuleRestaurant'),
                    })}
                  </p>
                ) : null}
                {posRetailMode ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['retailDineInEnabled', t('posRetailDineIn'), t('posRetailDineInHint')] as const,
                        ['retailTakeawayEnabled', t('posRetailTakeaway'), ''] as const,
                        ['retailDeliveryEnabled', t('posRetailDelivery'), ''] as const,
                      ] as const
                    ).map(([key, label, hint]) => (
                      <label
                        key={key}
                        className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={settings.posCheckoutSettings?.[key] === true}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              posCheckoutSettings: {
                                ...(settings.posCheckoutSettings || {}),
                                [key]: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>
                          <span className="font-medium block">{label}</span>
                          {hint ? <span className="text-xs muted">{hint}</span> : null}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.posCheckoutSettings?.tablesEnabled !== false}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setSettings({
                          ...settings,
                          posCheckoutSettings: {
                            ...(settings.posCheckoutSettings || {}),
                            tablesEnabled: on,
                            postSuccessTarget: on
                              ? settings.posCheckoutSettings?.postSuccessTarget || 'register'
                              : 'register',
                          },
                        });
                      }}
                    />
                    <span>
                      <span className="font-medium block">{t('posTablesEnabled')}</span>
                      <span className="text-xs muted">{t('posTablesEnabledHint')}</span>
                    </span>
                  </label>
                )}
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={
                      settings.posCheckoutSettings?.requireTableForDineIn === undefined
                        ? !posRetailMode
                        : settings.posCheckoutSettings.requireTableForDineIn !== false
                    }
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posCheckoutSettings: {
                          ...(settings.posCheckoutSettings || {}),
                          requireTableForDineIn: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('posRequireTableForDineIn')}</span>
                    <span className="text-xs muted">{t('posRequireTableForDineInHint')}</span>
                  </span>
                </label>
              </Section>

              <Section
                id="pos-layout"
                icon={Monitor}
                accent={settingsDash.info}
                title={t('posLayoutSettings')}
                description={t('posLayoutSettingsHint')}
                highlight={isSectionHighlight('pos-layout')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-layout') : false}
              >
                <Field label={t('posCartSide')} hint={t('posCartSideHint')}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['right', t('posCartSideRight')],
                        ['left', t('posCartSideLeft')],
                      ] as const
                    ).map(([side, label]) => {
                      const active = (settings.posCheckoutSettings?.cartSide || 'right') === side;
                      return (
                        <label
                          key={side}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                            active
                              ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cartSide"
                            className="mt-0.5"
                            checked={active}
                            onChange={() =>
                              setSettings({
                                ...settings,
                                posCheckoutSettings: {
                                  ...(settings.posCheckoutSettings || {}),
                                  cartSide: side,
                                },
                              })
                            }
                          />
                          <span className="font-medium">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <Field label={t('posActionButtonSize')} hint={t('posActionButtonSizeHint')}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        ['sm', t('posActionButtonSmall')],
                        ['md', t('posActionButtonMedium')],
                        ['lg', t('posActionButtonBig')],
                      ] as const
                    ).map(([size, label]) => {
                      const active =
                        (settings.posCheckoutSettings?.actionButtonSize || 'md') === size;
                      return (
                        <label
                          key={size}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm ${
                            active
                              ? 'border-[var(--text)] bg-[var(--bg-muted)]'
                              : 'border-[var(--border)]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="actionButtonSize"
                            className="mt-0.5"
                            checked={active}
                            onChange={() =>
                              setSettings({
                                ...settings,
                                posCheckoutSettings: {
                                  ...(settings.posCheckoutSettings || {}),
                                  actionButtonSize: size,
                                },
                              })
                            }
                          />
                          <span className="font-medium">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <div id="pos-post-success">
                  <Field label={t('webPosPostSuccessNav')} hint={t('posPostSuccessHint')}>
                    <select
                      className="input max-w-md"
                      value={
                        settings.posCheckoutSettings?.tablesEnabled === false
                          ? 'register'
                          : settings.posCheckoutSettings?.postSuccessTarget || 'register'
                      }
                      disabled={
                        posRetailMode || settings.posCheckoutSettings?.tablesEnabled === false
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posCheckoutSettings: {
                            ...(settings.posCheckoutSettings || {}),
                            postSuccessTarget: e.target.value as 'register' | 'tables',
                          },
                        })
                      }
                    >
                      <option value="register">{t('webPosTabRegister')}</option>
                      {settings.posCheckoutSettings?.tablesEnabled !== false && !posRetailMode ? (
                        <option value="tables">{t('webPosTabTables')}</option>
                      ) : null}
                    </select>
                  </Field>
                </div>
                <div id="pos-theme">
                  <Field label={t('posColorTheme')} hint={t('posColorThemeHint')}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {(
                        [
                          ['teal', t('posThemeTeal'), 'bg-teal-600'],
                          ['green', t('posThemeGreen'), 'bg-green-600'],
                          ['blue', t('posThemeBlue'), 'bg-blue-600'],
                          ['violet', t('posThemeViolet'), 'bg-violet-600'],
                          ['mono', t('posThemeMono'), 'bg-neutral-900'],
                        ] as const
                      ).map(([id, label, swatch]) => {
                        const active = (settings.posColorTheme || 'teal') === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSettings({ ...settings, posColorTheme: id })}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm ${
                              active
                                ? 'border-stone-900 ring-2 ring-stone-900/20'
                                : 'border-[var(--border)] hover:bg-[var(--bg-muted)]'
                            }`}
                          >
                            <span className={`h-4 w-4 shrink-0 rounded-full ${swatch}`} />
                            <span className="font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </Section>

              <Section
                id="pos-shifts"
                icon={Monitor}
                accent={settingsDash.warning}
                title={t('settingsOperations')}
                description={t('shiftsEnabledHint')}
                highlight={isSectionHighlight('pos-shifts')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-shifts') : false}
              >
                <div
                  className={`rounded-lg border-2 px-4 py-4 ${
                    settings.shiftsEnabled
                      ? 'border-teal-600 bg-teal-50'
                      : 'border-[var(--border)] bg-[var(--bg-muted)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text)]">{t('shiftsEnabled')}</p>
                      <p className="mt-1 text-xs muted">{t('shiftsEnabledHint')}</p>
                      <p className="mt-2 text-xs muted">{t('shiftsLateNightHint')}</p>
                      <p className="mt-2 text-[11px] text-stone-500">{t('shiftsMigrateHint')}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!settings.shiftsEnabled}
                      aria-label={t('shiftsEnabled')}
                      onClick={() =>
                        setSettings({ ...settings, shiftsEnabled: !settings.shiftsEnabled })
                      }
                      className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${
                        settings.shiftsEnabled ? 'bg-teal-600' : 'bg-stone-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          settings.shiftsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  {settings.shiftsEnabled ? (
                    <p className="mt-3 text-xs font-medium text-teal-800">{t('webPosShiftOpenHint')}</p>
                  ) : (
                    <p className="mt-3 text-xs font-medium text-stone-700">{t('shiftsDisabledEodHint')}</p>
                  )}
                </div>
                <a href="/merchant/pos" className="btn-secondary mt-3 inline-flex">
                  {t('openWebPos')}
                </a>
                <a href="/merchant/waiter" className="btn-secondary mt-3 ml-2 inline-flex">
                  {t('waiterAppTitle')}
                </a>
              </Section>

              <Section
                id="pos-posts"
                icon={Monitor}
                accent={settingsDash.accent}
                title={t('posPostsTitle')}
                description={t('posPostsAgencyHint')}
                highlight={isSectionHighlight('pos-posts')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-posts') : false}
              >
                <PosPostsSection
                  readOnly
                  hint={t('posPostsAgencyHint')}
                  maxPosPosts={Math.max(0, Number(settings.maxPosPosts) || 0)}
                  maxWaiterPosts={Math.max(0, Number(settings.maxWaiterPosts) || 0)}
                />
              </Section>

              <Section
                id="inventory-addon"
                icon={Package}
                accent={settingsDash.accent}
                title={t('invTitle')}
                description={t('invSettingsHint')}
                highlight={isSectionHighlight('inventory-addon')}
                dimmed={normalizedQuery ? !isSectionVisible('inventory-addon') : false}
              >
                <p className="text-sm">
                  {isInventoryLicensed(settings) ? t('invAddonOn') : t('invAddonOff')}
                </p>
                <p className="text-xs muted mt-1">{t('invAddonReadOnly')}</p>
                <SettingsField label={t('invWasteFactor')} hint={t('invWasteFactorHint')}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    disabled={!isInventoryLicensed(settings)}
                    value={Math.round((Number(settings.inventoryWasteFactor) || 0.2) * 100)}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventoryWasteFactor: Math.min(50, Math.max(0, Number(e.target.value) || 0)) / 100,
                      })
                    }
                  />
                </SettingsField>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    disabled={!isInventoryLicensed(settings)}
                    checked={!!settings.inventoryAutoReorderEmailEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventoryAutoReorderEmailEnabled: e.target.checked,
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('invAutoReorderMaster')}</span>
                    <span className="text-xs muted">{t('invAutoReorderMasterHint')}</span>
                  </span>
                </label>
                <SettingsField label={t('invExpiryAlertDays')} hint={t('invExpiryAlertDaysHint')}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    disabled={!isInventoryLicensed(settings)}
                    value={Number(settings.inventoryExpiryAlertDays) || 30}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inventoryExpiryAlertDays: Math.min(365, Math.max(1, Number(e.target.value) || 30)),
                      })
                    }
                  />
                </SettingsField>
                {isInventoryLicensed(settings) && (
                  <Link to="/merchant/inventory/cookbook" className="btn-secondary mt-3 inline-flex">
                    {t('invNavCookbook')}
                  </Link>
                )}
                <button
                  type="button"
                  className="btn-primary mt-3"
                  disabled={!isInventoryLicensed(settings) || saving}
                  onClick={async () => {
                    try {
                      await api.put('/merchant/settings', {
                        inventoryWasteFactor: Number(settings.inventoryWasteFactor) || 0.2,
                        inventoryAutoReorderEmailEnabled: !!settings.inventoryAutoReorderEmailEnabled,
                        inventoryExpiryAlertDays: Number(settings.inventoryExpiryAlertDays) || 30,
                      });
                      toast.success(t('saved'));
                    } catch (error: any) {
                      toast.error(error.response?.data?.error || t('saveFailed'));
                    }
                  }}
                >
                  {t('save')}
                </button>
              </Section>

              <Section
                id="storekeeper-addon"
                icon={Package}
                accent={settingsDash.accent}
                title={t('storekeeperTitle')}
                description={t('storekeeperAddonReadOnly')}
                highlight={isSectionHighlight('storekeeper-addon')}
                dimmed={normalizedQuery ? !isSectionVisible('storekeeper-addon') : false}
              >
                <p className="text-sm">
                  {isStorekeeperLicensed(settings) ? t('storekeeperAddonOn') : t('storekeeperAddonOff')}
                </p>
                <p className="text-xs muted mt-1">{t('storekeeperAddonReadOnly')}</p>
                {isStorekeeperLicensed(settings) ? (
                  <Link to="/merchant/storekeeper" className="btn-secondary mt-3 inline-flex">
                    {t('storekeeperOpenApp')}
                  </Link>
                ) : null}
              </Section>

              <Section
                id="signage-addon"
                icon={Monitor}
                accent={settingsDash.accent}
                title={t('signageTitle')}
                description={t('signageAddonReadOnly')}
                highlight={isSectionHighlight('signage-addon')}
                dimmed={normalizedQuery ? !isSectionVisible('signage-addon') : false}
              >
                <p className="text-sm">
                  {isSignageLicensed(settings) ? t('signageAddonOn') : t('signageAddonOff')}
                </p>
                <p className="text-xs muted mt-1">{t('signageAddonReadOnly')}</p>
                {isSignageLicensed(settings) ? (
                  <Link to="/merchant/signage" className="btn-secondary mt-3 inline-flex">
                    {t('signageNav')}
                  </Link>
                ) : null}
              </Section>

              <Section
                id="pos-courses"
                icon={Monitor}
                accent={settingsDash.success}
                title={t('coursesEnabled')}
                description={t('coursesEnabledHint')}
                highlight={isSectionHighlight('pos-courses')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-courses') : false}
              >
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.coursesEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        coursesEnabled: e.target.checked,
                        floorPlanEnabled: e.target.checked ? true : settings.floorPlanEnabled,
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('coursesEnabled')}</span>
                    <span className="text-xs muted">{t('coursesEnabledHint')}</span>
                  </span>
                </label>
                {settings.coursesEnabled ? (
                  <Field label={t('courseSendMode')} hint={t('courseSendModeHint')}>
                    <select
                      className="input"
                      value={settings.posCheckoutSettings?.courseSendMode || 'fire_per_course'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posCheckoutSettings: {
                            ...(settings.posCheckoutSettings || {}),
                            courseSendMode: e.target.value as 'fire_per_course' | 'send_all_once',
                          },
                        })
                      }
                    >
                      <option value="fire_per_course">{t('courseSendModeFirePerCourse')}</option>
                      <option value="send_all_once">{t('courseSendModeSendAllOnce')}</option>
                    </select>
                  </Field>
                ) : null}
              </Section>

              <Section
                id="pos-checkout"
                icon={CreditCard}
                accent={settingsDash.accent}
                title={t('posCheckoutSettings')}
                description={t('posCheckoutHint')}
                highlight={isSectionHighlight('pos-checkout')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-checkout') : false}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['tipsEnabled', 'tipsEnabled'],
                      ['allowCustomTip', 'allowCustomTip'],
                      ['discountsEnabled', 'discountsEnabled'],
                      ['quickCashEnabled', 'quickCashEnabled'],
                      ['splitBillsEnabled', 'splitBillsEnabled'],
                    ] as const
                  ).map(([key, labelKey]) => (
                    <label
                      key={key}
                      className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={settings.posCheckoutSettings?.[key] !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            posCheckoutSettings: {
                              ...(settings.posCheckoutSettings || {}),
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      <span className="font-medium">{t(labelKey)}</span>
                    </label>
                  ))}
                </div>
                <Field label={t('quickCashDenominations')} hint={t('quickCashDenominationsHint')}>
                  <input
                    className="input"
                    value={(settings.posCheckoutSettings?.quickCashDenominations || [10, 20, 50, 100]).join(
                      ', '
                    )}
                    onChange={(e) => {
                      const dens = e.target.value
                        .split(/[,;\s]+/)
                        .map((x) => Number(x))
                        .filter((n) => Number.isFinite(n) && n > 0);
                      setSettings({
                        ...settings,
                        posCheckoutSettings: {
                          ...(settings.posCheckoutSettings || {}),
                          quickCashDenominations: dens.length ? dens : [10, 20, 50, 100],
                        },
                      });
                    }}
                  />
                </Field>
              </Section>

              <Section
                id="pos-payments"
                icon={CreditCard}
                accent={settingsDash.info}
                title={t('webposPaymentMethods')}
                description={t('webposPaymentMethodsHint')}
                highlight={isSectionHighlight('pos-payments')}
                dimmed={normalizedQuery ? !isSectionVisible('pos-payments') : false}
              >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      ['webposExpressEnabled', t('webposExpress'), false] as const,
                      ['webposCashEnabled', t('webposCash'), false] as const,
                      ['webposCardEnabled', t('webposCard'), false] as const,
                      ['webposTerminalEnabled', t('webposTerminal'), false] as const,
                      ['webposGiftCardEnabled', t('webposGiftCard'), true] as const,
                      ['webposInvoiceEnabled', t('webposInvoice'), false] as const,
                    ] as const
                  ).map(([key, label, optIn]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="rounded"
                        checked={
                          optIn ? settings?.[key] === true : settings?.[key] !== false
                        }
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, [key]: e.target.checked } : prev
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Section>

              <SettingsSaveBar saving={saving} />
            </form>
          )}

          {tab === 'payments' && (
            <div className="space-y-5">
              <SettingsPageHeader title={t('settingsPayments')} subtitle={t('adyenSettingsHint')} />
              <form onSubmit={saveAdyen} className="space-y-5">
                <Section
                  id="payments-adyen"
                  icon={CreditCard}
                  accent={settingsDash.accent}
                  title={t('adyenCredentials')}
                  description={t('adyenSettingsHint')}
                  highlight={isSectionHighlight('payments-adyen')}
                  dimmed={normalizedQuery ? !isSectionVisible('payments-adyen') : false}
                >
                  <p className="text-sm text-[var(--text-muted)]">
                    {t('swisspayoutNoAccount')}{' '}
                    <a
                      href="https://swisspayout.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[var(--text)] underline underline-offset-2"
                    >
                      {t('swisspayoutCreateAccount')}
                    </a>
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('merchantAccount')}>
                      <input
                        className="input"
                        value={merchantAccount}
                        onChange={(e) => setMerchantAccount(e.target.value)}
                        placeholder="Reborn_COM"
                      />
                    </Field>
                    <Field label={t('clientId')}>
                      <input
                        className="input"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field
                        label={t('apiKey')}
                        hint={
                          adyen.apiKeySet
                            ? `${t('currentKey')}: ${adyen.apiKeyMasked || '••••'}`
                            : t('apiKeyHint')
                        }
                      >
                        <input
                          className="input"
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder={adyen.apiKeySet ? adyen.apiKeyMasked || '••••' : 'AQE...'}
                          autoComplete="new-password"
                        />
                      </Field>
                    </div>
                  </div>
                </Section>
                <SettingsSaveBar saving={savingAdyen} />
              </form>

              <form onSubmit={saveCardFees} className="space-y-5">
                <Section icon={CreditCard} accent={settingsDash.warning} title={t('onlineCardFees')} description={t('onlineCardFeesHint')}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('cardFeeFixed')} hint={t('cardFeeFixedHint')}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.05"
                        value={cardFeeFixed}
                        onChange={(e) => setCardFeeFixed(e.target.value)}
                      />
                    </Field>
                    <Field label={t('cardFeePercent')} hint={t('cardFeePercentHint')}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={cardFeePercent}
                        onChange={(e) => setCardFeePercent(e.target.value)}
                      />
                    </Field>
                  </div>
                </Section>
                <SettingsSaveBar saving={savingFee} />
              </form>

              <form onSubmit={saveWebposPayments} className="space-y-5">
                <Section icon={CreditCard} accent={settingsDash.info} title={t('adyenTerminalEnv')}>
                  <p className="text-xs muted">
                    {t('webposPaymentMethodsMovedHint')}{' '}
                    <button
                      type="button"
                      className="font-medium text-[var(--text)] underline underline-offset-2"
                      onClick={() => {
                        setSettingsQuery('express');
                        selectTab('pos');
                        setHighlightId('pos-payments');
                      }}
                    >
                      {t('settingsPos')}
                    </button>
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={!!settings?.adyenLiveEnvironment}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, adyenLiveEnvironment: e.target.checked } : prev
                        )
                      }
                    />
                    {t('adyenLiveMode')}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={!!settings?.adyenUseLegacyEndpoint}
                      onChange={(e) =>
                        setSettings((prev) =>
                          prev ? { ...prev, adyenUseLegacyEndpoint: e.target.checked } : prev
                        )
                      }
                    />
                    {t('adyenLegacyEndpoint')}
                  </label>
                </Section>
                <SettingsSaveBar saving={savingWebposPay} />
              </form>

              <form onSubmit={saveWebposPayments} className="space-y-5">
                <Section
                  id="payments-invoice-bank"
                  icon={Building2}
                  accent={settingsDash.info}
                  title={t('invoiceBankDetails')}
                  description={t('invoiceBankDetailsHint')}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label={t('invoiceAccountHolder')}>
                      <input
                        className="input"
                        value={settings?.bankAccountHolder || ''}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, bankAccountHolder: e.target.value } : prev
                          )
                        }
                      />
                    </Field>
                    <Field label={t('invoiceBankName')}>
                      <input
                        className="input"
                        value={settings?.bankName || ''}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, bankName: e.target.value } : prev
                          )
                        }
                      />
                    </Field>
                    <Field label={t('invoiceIban')}>
                      <input
                        className="input font-mono uppercase"
                        value={settings?.bankIban || ''}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, bankIban: e.target.value.toUpperCase() } : prev
                          )
                        }
                        placeholder="CH93 0076 2011 6238 5295 7"
                      />
                    </Field>
                    <Field label={t('invoiceQrIban')} hint={t('invoiceQrIbanHint')}>
                      <input
                        className="input font-mono uppercase"
                        value={settings?.bankQrIban || ''}
                        onChange={(e) =>
                          setSettings((prev) =>
                            prev ? { ...prev, bankQrIban: e.target.value.toUpperCase() } : prev
                          )
                        }
                        placeholder="CH44 3199 9123 0008 8901 2"
                      />
                    </Field>
                  </div>
                </Section>
                <SettingsSaveBar saving={savingWebposPay} />
              </form>

              <Section icon={CreditCard} accent={settingsDash.success} title={t('paymentTerminals')} description={t('paymentTerminalsHint')}>
                  <form onSubmit={addTerminal} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <Field label={`${t('terminalId')} *`} hint={t('terminalIdHint')}>
                      <input
                        className="input"
                        value={terminalId}
                        onChange={(e) => setTerminalId(e.target.value)}
                        placeholder="S1F2-000158213131044"
                        required
                      />
                    </Field>
                    <Field label={t('terminalName')} hint={t('terminalNameHint')}>
                      <input
                        className="input"
                        value={terminalName}
                        onChange={(e) => setTerminalName(e.target.value)}
                        placeholder={t('terminalNamePlaceholder')}
                      />
                    </Field>
                    <div className="flex items-end">
                      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={savingTerminal}>
                        {savingTerminal ? t('saving') : t('addTerminal')}
                      </button>
                    </div>
                  </form>

                  <div className="table-scroll rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm min-w-[480px]">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left muted">
                          <th className="px-3 py-2 font-medium">{t('terminalName')}</th>
                          <th className="px-3 py-2 font-medium">{t('terminalId')}</th>
                          <th className="px-3 py-2 font-medium">{t('status')}</th>
                          <th className="px-3 py-2 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {terminals.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-3 py-6 muted">
                              {t('noTerminals')}
                            </td>
                          </tr>
                        )}
                        {terminals.map((term) => (
                          <tr key={term.id} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-3 py-2.5 font-medium">{term.terminalName}</td>
                            <td className="px-3 py-2.5 font-mono text-xs">{term.terminalId}</td>
                            <td className="px-3 py-2.5 capitalize">{term.status}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                className="text-xs font-semibold text-red-600 hover:underline"
                                onClick={() => void removeTerminal(term.id)}
                              >
                                {t('delete')}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
            </div>
          )}

          {tab === 'email' && (
            <form onSubmit={onSave} className="space-y-5">
              <SettingsPageHeader
                title={t('settingsEmail')}
                subtitle={
                  settings.emailDeliveryMode === 'own'
                    ? t('settingsSmtpHint')
                    : t('emailDeliveryPlatformHint')
                }
                action={
                  <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                    <Save className="h-4 w-4" aria-hidden />
                    {saving ? t('saving') : t('save')}
                  </button>
                }
              />
              <Section icon={Mail} accent={settingsDash.accent} title={t('emailDeliveryMode')}>
                <div className="space-y-3">
                  <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="emailDeliveryMode"
                      className="mt-0.5"
                      checked={settings.emailDeliveryMode !== 'own'}
                      onChange={() =>
                        setSettings({ ...settings, emailDeliveryMode: 'platform' })
                      }
                    />
                    <span>
                      <span className="font-medium block">{t('emailDeliveryPlatform')}</span>
                      <span className="text-xs muted">{t('emailDeliveryPlatformHint')}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="emailDeliveryMode"
                      className="mt-0.5"
                      checked={settings.emailDeliveryMode === 'own'}
                      onChange={() => setSettings({ ...settings, emailDeliveryMode: 'own' })}
                    />
                    <span>
                      <span className="font-medium block">{t('emailDeliveryOwn')}</span>
                      <span className="text-xs muted">{t('emailDeliveryOwnHint')}</span>
                    </span>
                  </label>
                </div>
                {settings.emailDeliveryMode !== 'own' ? (
                  <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
                    <p className="font-medium">{t('platformEmailUsageTitle')}</p>
                    <p className="mt-1 muted">
                      {t('platformEmailUsageToday')}: {platformEmailUsage?.today ?? 0}
                      {platformEmailUsage?.period?.day ? ` · ${platformEmailUsage.period.day}` : ''}
                    </p>
                    <p className="muted">
                      {t('platformEmailUsageMonth')}: {platformEmailUsage?.thisMonth ?? 0}
                      {platformEmailUsage?.period?.month ? ` · ${platformEmailUsage.period.month}` : ''}
                    </p>
                  </div>
                ) : null}
              </Section>
              {settings.emailDeliveryMode === 'own' ? (
              <>
              <div
                id="email-smtp"
                className={
                  isSectionHighlight('email-smtp')
                    ? 'rounded-xl ring-2 ring-teal-500/40'
                    : undefined
                }
              >
              <Section icon={Mail} accent={settingsDash.accent} title={t('settingsSmtp')} description={t('settingsSmtpHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.emailSmtpSettings?.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtpSettings: {
                          ...(settings.emailSmtpSettings || {}),
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('smtpEnabled')}</span>
                    <span className="text-xs muted">{t('smtpEnabledHint')}</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label={t('smtpHost')}>
                    <input
                      className="input"
                      value={settings.emailSmtpSettings?.host || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            host: e.target.value,
                          },
                        })
                      }
                      placeholder="smtp.example.com"
                    />
                  </Field>
                  <Field label={t('smtpPort')}>
                    <input
                      className="input"
                      type="number"
                      value={settings.emailSmtpSettings?.port ?? 587}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            port: Number(e.target.value) || 587,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={t('smtpUser')}>
                    <input
                      className="input"
                      value={settings.emailSmtpSettings?.user || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            user: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field
                    label={t('smtpPassword')}
                    hint={
                      settings.emailSmtpSettings?.passwordSet
                        ? t('smtpPasswordSetHint')
                        : undefined
                    }
                  >
                    <input
                      className="input"
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={settings.emailSmtpSettings?.passwordSet ? '••••••••' : ''}
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label={t('smtpFromEmail')}>
                    <input
                      className="input"
                      type="email"
                      value={settings.emailSmtpSettings?.fromEmail || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            fromEmail: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={t('smtpFromName')}>
                    <input
                      className="input"
                      value={settings.emailSmtpSettings?.fromName || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailSmtpSettings: {
                            ...(settings.emailSmtpSettings || {}),
                            fromName: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!settings.emailSmtpSettings?.secure}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailSmtpSettings: {
                          ...(settings.emailSmtpSettings || {}),
                          secure: e.target.checked,
                        },
                      })
                    }
                  />
                  {t('smtpSecure')}
                </label>
                <div className="flex flex-wrap gap-2 items-end">
                  <Field label={t('smtpTestTo')}>
                    <input
                      className="input"
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder={settings.email || 'you@example.com'}
                    />
                  </Field>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={testingEmail}
                    onClick={async () => {
                      setTestingEmail(true);
                      try {
                        await api.put('/merchant/settings', {
                          emailSmtpSettings: {
                            enabled: !!settings.emailSmtpSettings?.enabled,
                            host: settings.emailSmtpSettings?.host || '',
                            port: Number(settings.emailSmtpSettings?.port) || 587,
                            secure: !!settings.emailSmtpSettings?.secure,
                            user: settings.emailSmtpSettings?.user || '',
                            password: smtpPassword || undefined,
                            fromEmail: settings.emailSmtpSettings?.fromEmail || '',
                            fromName: settings.emailSmtpSettings?.fromName || '',
                          },
                        });
                        await api.post('/merchant/marketing/test-email', {
                          to: testEmailTo || settings.email,
                        });
                        toast.success(t('smtpTestSent'));
                        setSmtpPassword('');
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('smtpTestFailed'));
                      } finally {
                        setTestingEmail(false);
                      }
                    }}
                  >
                    {testingEmail ? t('saving') : t('smtpSendTest')}
                  </button>
                </div>
              </Section>
              </div>

              <div
                id="email-brevo"
                className={
                  isSectionHighlight('email-brevo')
                    ? 'rounded-xl ring-2 ring-teal-500/40'
                    : undefined
                }
              >
              <Section icon={Mail} accent={settingsDash.info} title={t('settingsBrevo')} description={t('settingsBrevoHint')}>
                <p className="text-xs muted -mt-1">{t('settingsBrevoPriorityHint')}</p>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.emailBrevoSettings?.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        emailBrevoSettings: {
                          ...(settings.emailBrevoSettings || {}),
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('brevoEnabled')}</span>
                    <span className="text-xs muted">{t('brevoEnabledHint')}</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field
                    label={t('brevoApiKey')}
                    hint={
                      settings.emailBrevoSettings?.apiKeySet
                        ? `${t('brevoApiKeySetHint')} ${settings.emailBrevoSettings.apiKeyMasked || ''}`
                        : t('brevoApiKeyCreateHint')
                    }
                  >
                    <input
                      className="input"
                      type="password"
                      value={brevoApiKey}
                      onChange={(e) => setBrevoApiKey(e.target.value)}
                      placeholder={
                        settings.emailBrevoSettings?.apiKeySet ? '••••••••' : 'xkeysib-…'
                      }
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field label={t('smtpFromEmail')}>
                    <input
                      className="input"
                      type="email"
                      value={settings.emailBrevoSettings?.fromEmail || ''}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          emailBrevoSettings: {
                            ...(settings.emailBrevoSettings || {}),
                            fromEmail: e.target.value,
                          },
                        })
                      }
                      placeholder="noreply@yourshop.ch"
                    />
                  </Field>
                  <Field label={t('smtpFromName')} hint={t('brevoSenderNameHint')}>
                    <input
                      className="input bg-[var(--bg-muted)]"
                      value={settings.name || ''}
                      readOnly
                      aria-readonly
                    />
                  </Field>
                  <Field label={t('brevoDailyLimit')} hint={t('brevoLimitHint')}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={settings.emailBrevoSettings?.dailyLimit ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setSettings({
                          ...settings,
                          emailBrevoSettings: {
                            ...(settings.emailBrevoSettings || {}),
                            dailyLimit: raw === '' ? null : Number(raw) || null,
                          },
                        });
                      }}
                      placeholder="e.g. 300"
                    />
                  </Field>
                  <Field label={t('brevoMonthlyLimit')} hint={t('brevoLimitHint')}>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={settings.emailBrevoSettings?.monthlyLimit ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setSettings({
                          ...settings,
                          emailBrevoSettings: {
                            ...(settings.emailBrevoSettings || {}),
                            monthlyLimit: raw === '' ? null : Number(raw) || null,
                          },
                        });
                      }}
                      placeholder="e.g. 5000"
                    />
                  </Field>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{t('brevoUsageTitle')}</p>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={async () => {
                        try {
                          const usageRes = await api.get('/merchant/marketing/brevo-usage');
                          setBrevoUsage(usageRes.data.usage || null);
                          toast.success(t('brevoUsageRefreshed'));
                        } catch (error: any) {
                          toast.error(error.response?.data?.error || t('brevoUsageFailed'));
                        }
                      }}
                    >
                      {t('brevoRefreshUsage')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
                    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide muted">
                        {t('brevoToday')}
                        {brevoUsage?.dailyPeriod ? ` · ${brevoUsage.dailyPeriod}` : ''}
                      </p>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {brevoUsage?.dailySent ?? settings.emailBrevoSettings?.dailySent ?? 0}
                        {brevoUsage?.dailyLimit != null ||
                        settings.emailBrevoSettings?.dailyLimit != null
                          ? ` / ${
                              brevoUsage?.dailyLimit ??
                              settings.emailBrevoSettings?.dailyLimit
                            }`
                          : ` · ${t('brevoNoLocalLimit')}`}
                      </p>
                    </div>
                    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide muted">
                        {t('brevoThisMonth')}
                        {brevoUsage?.monthlyPeriod ? ` · ${brevoUsage.monthlyPeriod}` : ''}
                      </p>
                      <p className="mt-0.5 font-semibold tabular-nums">
                        {brevoUsage?.monthlySent ??
                          settings.emailBrevoSettings?.monthlySent ??
                          0}
                        {brevoUsage?.monthlyLimit != null ||
                        settings.emailBrevoSettings?.monthlyLimit != null
                          ? ` / ${
                              brevoUsage?.monthlyLimit ??
                              settings.emailBrevoSettings?.monthlyLimit
                            }`
                          : ` · ${t('brevoNoLocalLimit')}`}
                      </p>
                    </div>
                  </div>
                  {brevoUsage?.account?.planCredits != null ? (
                    <p className="text-xs muted">
                      {t('brevoAccountCredits')}:{' '}
                      <span className="font-medium text-[var(--text)]">
                        {brevoUsage.account.planCredits}
                      </span>
                      {brevoUsage.account.planType
                        ? ` (${brevoUsage.account.planType})`
                        : ''}
                    </p>
                  ) : null}
                  {brevoUsage?.account?.error ? (
                    <p className="text-xs text-amber-800">{brevoUsage.account.error}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 items-end">
                  <Field label={t('smtpTestTo')}>
                    <input
                      className="input"
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder={settings.email || 'you@example.com'}
                    />
                  </Field>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={testingEmail}
                    onClick={async () => {
                      if (settings.emailSmtpSettings?.enabled) {
                        toast.error(t('brevoTestSmtpBlocks'));
                        return;
                      }
                      setTestingEmail(true);
                      try {
                        await api.put('/merchant/settings', {
                          emailBrevoSettings: {
                            enabled: true,
                            apiKey: brevoApiKey || undefined,
                            fromEmail: settings.emailBrevoSettings?.fromEmail || '',
                            fromName: settings.name || '',
                            dailyLimit: settings.emailBrevoSettings?.dailyLimit ?? null,
                            monthlyLimit: settings.emailBrevoSettings?.monthlyLimit ?? null,
                          },
                        });
                        await api.post('/merchant/marketing/test-email', {
                          to: testEmailTo || settings.email,
                        });
                        toast.success(t('smtpTestSent'));
                        setBrevoApiKey('');
                        const usageRes = await api.get('/merchant/marketing/brevo-usage');
                        setBrevoUsage(usageRes.data.usage || null);
                        const refreshed = await api.get('/merchant/settings');
                        if (refreshed.data?.settings) setSettings(refreshed.data.settings);
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('smtpTestFailed'));
                      } finally {
                        setTestingEmail(false);
                      }
                    }}
                  >
                    {testingEmail ? t('saving') : t('brevoSendTest')}
                  </button>
                </div>
              </Section>
              </div>
              </>
              ) : null}

              <Section icon={Mail} accent={settingsDash.warning} title={t('reorderReminder')} description={t('reorderReminderHint')}>
                <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={!!settings.marketingSettings?.reorderReminderEnabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium block">{t('reorderReminderEnable')}</span>
                    <span className="text-xs muted">{t('reorderReminderEnableHint')}</span>
                  </span>
                </label>
                <Field label={t('reorderReminderDays')}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={90}
                    value={settings.marketingSettings?.reorderReminderDays ?? 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderDays: Number(e.target.value) || 5,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('reorderReminderSubject')}>
                  <input
                    className="input"
                    value={settings.marketingSettings?.reorderReminderSubject || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderSubject: e.target.value,
                        },
                      })
                    }
                    placeholder="We miss you - order again from {{businessName}}"
                  />
                </Field>
                <Field label={t('reorderReminderBody')} hint={t('newsletterPlaceholders')}>
                  <textarea
                    className="input min-h-[10rem] font-mono text-xs"
                    value={settings.marketingSettings?.reorderReminderBody || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        marketingSettings: {
                          ...(settings.marketingSettings || {}),
                          reorderReminderBody: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </Section>

              <SettingsSaveBar saving={saving} />
            </form>
          )}

          {tab === 'receipt' && (
            <form className="space-y-5" onSubmit={saveReceiptPrint}>
              <SettingsPageHeader
                title={t('settingsReceipt')}
                subtitle={t('settingsReceiptHint')}
                action={
                  <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={savingReceipt}>
                    <Save className="h-4 w-4" aria-hidden />
                    {savingReceipt ? t('saving') : t('save')}
                  </button>
                }
              />
              <Section icon={Printer} accent={settingsDash.accent} title={t('settingsReceipt')} description={t('settingsReceiptHint')}>
                <Field label={t('receiptLanguage')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.receiptLanguage || 'panel'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          receiptLanguage: e.target.value as 'en' | 'fr' | 'de' | 'panel',
                        },
                      })
                    }
                  >
                    <option value="panel">{t('receiptLangPanel')}</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </Field>
                <Field label={t('receiptPaperWidth')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.paperWidthMm === 58 ? 58 : 80}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          paperWidthMm: Number(e.target.value) === 58 ? 58 : 80,
                        },
                      })
                    }
                  >
                    <option value={80}>80mm</option>
                    <option value={58}>58mm</option>
                  </select>
                </Field>
                {showScaleSettings ? (
                  <>
                <Field label={t('settingsScaleTitle')} hint={t('settingsScaleHint')}>
                  <div className="space-y-3">
                    {settings.posPrintSettings?.scaleComPort ||
                    settings.posPrintSettings?.scaleDeviceName ||
                    settings.posPrintSettings?.scaleUsbAddress ? (
                      <p className="text-sm m-0 text-emerald-700">
                        {t('settingsScaleSelected')}:{' '}
                        <span className="font-medium">
                          {settings.posPrintSettings.scaleUsbAddress
                            ? formatScaleDeviceLabel({
                                port: settings.posPrintSettings.scaleUsbAddress,
                                name: settings.posPrintSettings.scaleDeviceName || undefined,
                                usbAddress: settings.posPrintSettings.scaleUsbAddress,
                              })
                            : settings.posPrintSettings.scaleDeviceName
                              ? `${settings.posPrintSettings.scaleDeviceName}${
                                  settings.posPrintSettings.scaleComPort
                                    ? ` · ${formatScalePortLabel(settings.posPrintSettings.scaleComPort)}`
                                    : ''
                                }`
                              : formatScalePortLabel(settings.posPrintSettings.scaleComPort || '')}
                        </span>
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="btn-secondary inline-flex items-center gap-2 text-sm"
                        onClick={() => void refreshScalePorts()}
                        disabled={scanningScalePorts || !printAgentOk}
                      >
                        <RefreshCw size={14} className={scanningScalePorts ? 'animate-spin' : ''} />
                        {scanningScalePorts ? t('settingsScaleScanning') : t('settingsScaleScan')}
                      </button>
                      {!printAgentOk ? (
                        <p className="text-sm m-0 text-[var(--text-muted)]">{t('webPosAgentOffline')}</p>
                      ) : null}
                    </div>
                    {scaleScanError ? (
                      <p className="text-sm m-0 text-red-600">{scaleScanError}</p>
                    ) : null}
                    {scalePorts.length > 0 ? (
                      <ul className="m-0 list-none space-y-1.5 p-0">
                        {scalePorts.map((device) => {
                          const selected =
                            formatScalePortLabel(settings.posPrintSettings?.scaleComPort || '') ===
                              formatScalePortLabel(device.port) ||
                            (!!settings.posPrintSettings?.scaleDeviceId &&
                              settings.posPrintSettings.scaleDeviceId === device.pnpDeviceId) ||
                            (!!settings.posPrintSettings?.scaleUsbAddress &&
                              settings.posPrintSettings.scaleUsbAddress ===
                                (device.usbAddress || device.port));
                          return (
                            <li key={`${device.port}-${device.pnpDeviceId || device.name || ''}`}>
                              <button
                                type="button"
                                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                                  selected
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                                    : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-emerald-300 hover:bg-emerald-50/50'
                                }`}
                                onClick={() => void selectScalePortAndSave(device)}
                                disabled={savingReceipt}
                              >
                                <span className="font-medium">{formatScaleDeviceLabel(device)}</span>
                                {device.manufacturer ? (
                                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                                    {device.manufacturer}
                                  </span>
                                ) : null}
                                {selected ? ` · ${t('settingsScaleSelected')}` : ''}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : scalePortsScanned && printAgentOk && !scanningScalePorts ? (
                      <p className="text-sm m-0 text-[var(--text-muted)]">{t('settingsScaleNoPorts')}</p>
                    ) : null}
                  </div>
                </Field>
                <Field
                  label="Scale USB address (Bridge Reborn)"
                  hint="Stable USB address from Bridge Reborn or Android Settings → Printers & Scale. Synced on menu sync."
                >
                  <input
                    className="input font-mono text-sm"
                    value={settings.posPrintSettings?.scaleUsbAddress || ''}
                    placeholder="usb:1234:5678"
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          scaleUsbAddress: e.target.value.trim() || null,
                          scaleEnabled:
                            !!e.target.value.trim() || !!settings.posPrintSettings?.scaleComPort,
                        },
                      })
                    }
                  />
                </Field>
                  </>
                ) : null}
                <Field label={t('receiptLogoUpload')} hint={t('receiptLogoUploadHint')}>
                  <div className="space-y-2">
                    {(settings.posPrintSettings?.receiptLogoUrl || settings.shopLogoUrl) && (
                      <img
                        src={settings.posPrintSettings?.receiptLogoUrl || settings.shopLogoUrl || ''}
                        alt=""
                        className="object-contain rounded border border-[var(--border)] bg-white p-1"
                        style={{
                          maxWidth: Math.min(
                            200,
                            settings.posPrintSettings?.receiptLogoWidthPx ?? 200
                          ),
                          maxHeight: 80,
                        }}
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="btn-secondary cursor-pointer inline-flex">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                              const resized = await resizeImageFileForReceiptLogo(
                                file,
                                RECEIPT_LOGO_WIDTH_PX_MAX
                              );
                              const fd = new FormData();
                              fd.append('file', resized);
                              const res = await api.post('/merchant/media', fd, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                              });
                              const url = res.data.url as string;
                              setSettings({
                                ...settings,
                                posPrintSettings: {
                                  ...(settings.posPrintSettings || {}),
                                  receiptLogoUrl: url,
                                },
                              });
                              toast.success(t('saved'));
                            } catch (err: any) {
                              toast.error(err.response?.data?.error || t('uploadFailed'));
                            }
                          }}
                        />
                        {t('receiptLogoUpload')}
                      </label>
                      {settings.posPrintSettings?.receiptLogoUrl && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              posPrintSettings: {
                                ...(settings.posPrintSettings || {}),
                                receiptLogoUrl: null,
                              },
                            })
                          }
                        >
                          {t('receiptLogoRemove')}
                        </button>
                      )}
                    </div>
                    <input
                      className="input"
                      value={settings.posPrintSettings?.receiptLogoUrl || ''}
                      placeholder={settings.shopLogoUrl || t('receiptLogoUrl')}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posPrintSettings: {
                            ...(settings.posPrintSettings || {}),
                            receiptLogoUrl: e.target.value || null,
                          },
                        })
                      }
                    />
                  </div>
                </Field>
                <Field label={t('receiptLogoWidth')} hint={t('receiptLogoWidthHint')}>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={48}
                      max={200}
                      className="input w-28"
                      value={settings.posPrintSettings?.receiptLogoWidthPx ?? 200}
                      onChange={(e) => {
                        const n = Math.min(
                          200,
                          Math.max(48, Number(e.target.value) || 200)
                        );
                        setSettings({
                          ...settings,
                          posPrintSettings: {
                            ...(settings.posPrintSettings || {}),
                            receiptLogoWidthPx: n,
                          },
                        });
                      }}
                    />
                    <span className="text-sm text-[var(--muted-fg)]">px</span>
                  </div>
                </Field>
                <Field label={t('receiptHeader')}>
                  <textarea
                    className="input min-h-[5rem]"
                    value={settings.posPrintSettings?.receiptHeader || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          receiptHeader: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('receiptFooter')}>
                  <textarea
                    className="input min-h-[4rem]"
                    value={settings.posPrintSettings?.receiptFooter || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          receiptFooter: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('kitchenTicketHeader')}>
                  <textarea
                    className="input min-h-[3rem]"
                    value={settings.posPrintSettings?.kitchenTicketHeader || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenTicketHeader: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('kitchenTicketFooter')}>
                  <textarea
                    className="input min-h-[3rem]"
                    value={settings.posPrintSettings?.kitchenTicketFooter || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenTicketFooter: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t('kitchenItemTextScale')} hint={t('kitchenTextScaleHint')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.kitchenItemTextScale ?? 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenItemTextScale: Number(e.target.value) as 1 | 2 | 3,
                        },
                      })
                    }
                  >
                    <option value={1}>{t('kitchenScaleNormal')}</option>
                    <option value={2}>{t('kitchenScaleLarge')}</option>
                    <option value={3}>{t('kitchenScaleXLarge')}</option>
                  </select>
                </Field>
                <Field label={t('kitchenHeaderTextScale')}>
                  <select
                    className="input"
                    value={settings.posPrintSettings?.kitchenHeaderTextScale ?? 1}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenHeaderTextScale: Number(e.target.value) as 1 | 2 | 3,
                        },
                      })
                    }
                  >
                    <option value={1}>{t('kitchenScaleNormal')}</option>
                    <option value={2}>{t('kitchenScaleLarge')}</option>
                    <option value={3}>{t('kitchenScaleXLarge')}</option>
                  </select>
                </Field>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.posPrintSettings?.kitchenBoldText === true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          kitchenBoldText: e.target.checked,
                        },
                      })
                    }
                  />
                  {t('kitchenBoldText')}
                </label>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(
                    [
                      ['receiptShowVatTable', t('receiptShowVat')],
                      ['receiptShowStaffLine', t('receiptShowStaff')],
                      ['receiptShowQrCode', t('receiptShowQr')],
                      ['receiptDeliveryDirectionsQr', t('receiptDeliveryDirectionsQr')],
                      ['autoPrintReceipt', t('autoPrintReceipt')],
                      ['autoPrintKitchen', t('autoPrintKitchen')],
                      ['autoPrintReservations', t('autoPrintReservations')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.posPrintSettings?.[key] !== false}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            posPrintSettings: {
                              ...(settings.posPrintSettings || {}),
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-3 space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={settings.posPrintSettings?.kitchenPrintRetryEnabled !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posPrintSettings: {
                            ...(settings.posPrintSettings || {}),
                            kitchenPrintRetryEnabled: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">{t('kitchenPrintRetryEnabled')}</span>
                      <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                        {t('kitchenPrintRetryEnabledHint')}
                      </span>
                    </span>
                  </label>
                  {settings.posPrintSettings?.kitchenPrintRetryEnabled !== false ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">{t('kitchenPrintRetryAttempts')}</span>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          className="input w-full"
                          value={settings.posPrintSettings?.kitchenPrintRetryAttempts ?? 5}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              posPrintSettings: {
                                ...(settings.posPrintSettings || {}),
                                kitchenPrintRetryAttempts: Number(e.target.value) || 5,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">{t('kitchenPrintRetryIntervalSec')}</span>
                        <input
                          type="number"
                          min={2}
                          max={60}
                          className="input w-full"
                          value={settings.posPrintSettings?.kitchenPrintRetryIntervalSec ?? 5}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              posPrintSettings: {
                                ...(settings.posPrintSettings || {}),
                                kitchenPrintRetryIntervalSec: Number(e.target.value) || 5,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={settings.posPrintSettings?.waiterTillBellEnabled !== false}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          waiterTillBellEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{t('waiterTillBellEnabled')}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {t('waiterTillBellEnabledHint')}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={settings.posPrintSettings?.autoPrintOnlineOrdersOnArrival === true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          autoPrintOnlineOrdersOnArrival: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{t('autoPrintOnlineOrdersOnArrival')}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {t('autoPrintOnlineOrdersOnArrivalHint')}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={settings.posPrintSettings?.adyenReceiptDigitalOnly === true}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        posPrintSettings: {
                          ...(settings.posPrintSettings || {}),
                          adyenReceiptDigitalOnly: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium">{t('adyenReceiptDigitalOnly')}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {t('adyenReceiptDigitalOnlyHint')}
                    </span>
                  </span>
                </label>
              </Section>

              <Section
                icon={Printer}
                accent={settingsDash.info}
                title={isAndroidDevice() ? t('downloadPrintBridge') : t('printAgentDownload')}
                description={isAndroidDevice() ? t('printBridgeDownloadHint') : t('printAgentDownloadHint')}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {preferredPrintCompanion() !== 'android-bridge' ? (
                      <a
                        className="btn-primary inline-flex"
                        href={printAgentDownloadUrl()}
                        download="reborn-print-agent-setup.exe"
                      >
                        {t('downloadPrintAgent')}
                      </a>
                    ) : null}
                    {preferredPrintCompanion() !== 'windows-agent' ? (
                      printBridgeManifest?.available === false ? (
                        <p className="text-sm text-amber-800 max-w-xl m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          {printBridgeManifest.message ||
                            'Bridge Reborn APK is not published on this server yet. Contact support or try again after the next platform update.'}
                        </p>
                      ) : (
                        <a
                          className={`inline-flex ${preferredPrintCompanion() === 'android-bridge' ? 'btn-primary' : 'btn-secondary'}`}
                          href={printBridgeDownloadUrl()}
                          download="reborn-print-bridge.apk"
                        >
                          {t('downloadPrintBridge')}
                        </a>
                      )
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {preferredPrintCompanion() !== 'android-bridge' ? (
                      <PrintCompanionVersionStatus
                        kind="windows-agent"
                        installedVersion={installedPrintCompanionVersion}
                        serverVersion={printAgentManifest?.version}
                        downloadUrl={printAgentDownloadUrl()}
                      />
                    ) : null}
                    {preferredPrintCompanion() !== 'windows-agent' &&
                    printBridgeManifest?.available !== false ? (
                      <PrintCompanionVersionStatus
                        kind="android-bridge"
                        installedVersion={installedPrintCompanionVersion}
                        serverVersion={printBridgeManifest?.version}
                        downloadUrl={printBridgeDownloadUrl()}
                        onAndroid={isAndroidDevice()}
                        agentChecked={printAgentHealthChecked}
                      />
                    ) : null}
                  </div>
                  <p className="text-sm text-[var(--muted)] max-w-xl m-0">
                    {isAndroidDevice() ? t('printBridgeInstallSteps') : t('printAgentInstallSteps')}
                  </p>
                </div>
              </Section>

              <Section icon={Printer} accent={settingsDash.success} title={t('printerProfiles')} description={t('printerProfilesHint')}>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                    onClick={() => void refreshPrintAgentPrinters()}
                    disabled={refreshingPrinters}
                  >
                    <RefreshCw size={14} className={refreshingPrinters ? 'animate-spin' : ''} />
                    {t('webPosRefreshPrinters')}
                  </button>
                  <p
                    className={`text-sm m-0 ${
                      !printAgentOk
                        ? 'text-[var(--text-muted)]'
                        : printAgentOutdated ||
                            (settings.posPrintSettings?.printers || []).some(
                              (p) =>
                                isConfiguredPrinterMissing(p.name, agentPrinters, {
                                  agentOk: printAgentOk,
                                  printersReady: agentPrinters.length > 0,
                                })
                            )
                          ? 'text-amber-800'
                          : 'text-emerald-700'
                    }`}
                  >
                    {!printAgentOk
                      ? t('webPosAgentOffline')
                      : (settings.posPrintSettings?.printers || []).some((p) =>
                            isConfiguredPrinterMissing(p.name, agentPrinters, {
                              agentOk: printAgentOk,
                              printersReady: agentPrinters.length > 0,
                            })
                          )
                        ? t('webPosPrinterDisconnectedShort')
                        : printAgentOutdated
                          ? t('webPosPrintAgentOutdatedHint')
                          : t('webPosAgentOnline')}
                  </p>
                </div>
                {(settings.posPrintSettings?.printers || []).map((p, idx) => {
                  const savedNameMissing = isConfiguredPrinterMissing(p.name, agentPrinters, {
                    agentOk: printAgentOk,
                    printersReady: agentPrinters.length > 0,
                  });
                  const healCandidates = savedNameMissing
                    ? findPrinterHealCandidates(p.name, agentPrinters)
                    : [];
                  const useDropdown = printAgentOk && agentPrinters.length > 0;
                  return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-[var(--border)] p-3 space-y-2"
                  >
                    <Field
                      label={t('printerName')}
                      hint={useDropdown ? undefined : t('settingsPrinterManualEntry')}
                    >
                      {useDropdown ? (
                        <select
                          className="input"
                          value={savedNameMissing ? '' : p.name}
                          onChange={(e) => {
                            const printers = [...(settings.posPrintSettings?.printers || [])];
                            const picked = agentPrinters.find((ap) => ap.name === e.target.value);
                            printers[idx] = {
                              ...p,
                              name: e.target.value,
                              portName: picked?.portName || null,
                              matchHint: picked?.matchHint || picked?.driverName || null,
                            };
                            setSettings({
                              ...settings,
                              posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                            });
                          }}
                        >
                          <option value="">{t('webPosDefaultPrinter')}</option>
                          {agentPrinters.map((ap) => {
                            const bad = isUnsuitableRawPrinter(ap.name);
                            return (
                              <option key={ap.name} value={ap.name}>
                                {ap.name}
                                {ap.portName ? ` · ${ap.portName}` : ''}
                                {ap.isDefault ? t('webPosDefaultSuffix') : ''}
                                {bad ? t('webPosPrinterNotThermal') : ''}
                              </option>
                            );
                          })}
                        </select>
                      ) : (
                        <input
                          className="input"
                          value={p.name}
                          onChange={(e) => {
                            const printers = [...(settings.posPrintSettings?.printers || [])];
                            printers[idx] = { ...p, name: e.target.value };
                            setSettings({
                              ...settings,
                              posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                            });
                          }}
                          placeholder={t('printerName')}
                        />
                      )}
                    </Field>
                    {p.name && isUnsuitableRawPrinter(p.name) ? (
                      <p className="text-xs leading-snug text-amber-700">{t('webPosUnsuitablePrinter')}</p>
                    ) : null}
                    {savedNameMissing ? (
                      <div className="space-y-1.5">
                        <p className="text-xs leading-snug text-amber-800 m-0">
                          {t('webPosPrinterDisconnectedShort')}
                        </p>
                        <p className="text-xs leading-snug text-amber-800 m-0">
                          {t('webPosPrinterRenamedHint')}
                        </p>
                        {healCandidates.map((ap) => (
                          <button
                            key={ap.name}
                            type="button"
                            className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                            onClick={() => {
                              const printers = [...(settings.posPrintSettings?.printers || [])];
                              printers[idx] = {
                                ...p,
                                name: ap.name,
                                portName: ap.portName || null,
                                matchHint: ap.matchHint || ap.driverName || null,
                              };
                              setSettings({
                                ...settings,
                                posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                              });
                            }}
                          >
                            {t('webPosUsePrinter').replace('{name}', ap.name)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {(
                        [
                          ['printReceipts', t('printRoleReceipts')],
                          ['printKitchenTickets', t('printRoleKitchen')],
                          ['printEndOfDayReports', t('printRoleEod')],
                          ['printLabels', t('printRoleLabels')],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={!!p[key]}
                            onChange={(e) => {
                              const printers = [...(settings.posPrintSettings?.printers || [])];
                              printers[idx] = { ...p, [key]: e.target.checked };
                              setSettings({
                                ...settings,
                                posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                              });
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {p.printKitchenTickets ? (
                      <div className="space-y-2 rounded-lg border border-dashed border-[var(--border)] p-3">
                        <PrinterKitchenRoutingPicker
                          profile={p}
                          categories={productCategories}
                          products={catalogProducts}
                          onChange={(next) => {
                            const printers = [...(settings.posPrintSettings?.printers || [])];
                            printers[idx] = { ...p, ...next };
                            setSettings({
                              ...settings,
                              posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                            });
                          }}
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className="btn-secondary inline-flex items-center gap-2 text-sm"
                        disabled={!p.name?.trim() || testingPrinterId === p.id}
                        onClick={() => void testPrinterProfile(p)}
                      >
                        <Printer size={14} />
                        {testingPrinterId === p.id ? t('loading') : t('testPrinter')}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => {
                          const printers = (settings.posPrintSettings?.printers || []).filter(
                            (_, i) => i !== idx
                          );
                          setSettings({
                            ...settings,
                            posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                          });
                        }}
                      >
                        {t('delete')}
                      </button>
                    </div>
                  </div>
                  );
                })}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const printers = [
                      ...(settings.posPrintSettings?.printers || []),
                      {
                        id: `p-${Date.now()}`,
                        name: '',
                        enabled: true,
                        paperWidthMm: 80 as const,
                        printReceipts: false,
                        printKitchenTickets: true,
                        printEndOfDayReports: false,
                        printLabels: false,
                        printAllProducts: true,
                      },
                    ];
                    setSettings({
                      ...settings,
                      posPrintSettings: { ...(settings.posPrintSettings || {}), printers },
                    });
                  }}
                >
                  {t('addPrinterProfile')}
                </button>
              </Section>

              {settings.businessCategory !== 'restaurant' ? (
              <Section
                id="barcode-labels"
                icon={Printer}
                accent={settingsDash.accent}
                title={t('barcodeLabelsTitle')}
                description={t('barcodeLabelsHint')}
                highlight={isSectionHighlight('barcode-labels')}
                dimmed={normalizedQuery ? !isSectionVisible('barcode-labels') : false}
              >
                <div className="grid grid-cols-2 gap-3">
                  <SettingsField label={t('barcodeLabelWidth')}>
                    <select
                      className="input"
                      value={settings.posPrintSettings?.labelWidthMm === 58 ? 58 : 40}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posPrintSettings: {
                            ...(settings.posPrintSettings || {}),
                            labelWidthMm: Number(e.target.value) === 58 ? 58 : 40,
                          },
                        })
                      }
                    >
                      <option value={40}>40 mm</option>
                      <option value={58}>58 mm</option>
                    </select>
                  </SettingsField>
                  <SettingsField label={t('barcodeLabelHeight')}>
                    <select
                      className="input"
                      value={settings.posPrintSettings?.labelHeightMm || 20}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          posPrintSettings: {
                            ...(settings.posPrintSettings || {}),
                            labelHeightMm: Number(e.target.value) as 20 | 25 | 30 | 40,
                          },
                        })
                      }
                    >
                      <option value={20}>20 mm</option>
                      <option value={25}>25 mm</option>
                      <option value={30}>30 mm</option>
                      <option value={40}>40 mm</option>
                    </select>
                  </SettingsField>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {(
                    [
                      ['labelShowStoreName', t('barcodeShowStore')],
                      ['labelShowProductName', t('barcodeShowName')],
                      ['labelShowBarcodeNumber', t('barcodeShowNumber')],
                      ['labelShowPrice', t('barcodeShowPrice')],
                      ['labelShowSku', t('barcodeShowSku')],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={
                          key === 'labelShowPrice' || key === 'labelShowSku'
                            ? settings.posPrintSettings?.[key] === true
                            : settings.posPrintSettings?.[key] !== false
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            posPrintSettings: {
                              ...(settings.posPrintSettings || {}),
                              [key]: e.target.checked,
                            },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Section>
              ) : null}

              <SettingsSaveBar saving={savingReceipt} />
            </form>
          )}

          {tab === 'kds' && (
            <div className="space-y-5">
              <SettingsPageHeader title={t('kdsSettingsTitle')} subtitle={t('kdsSettingsHint')} />
              <KdsSettingsPanel />
            </div>
          )}

          {tab === 'ods' && (
            <div className="space-y-5">
              <SettingsPageHeader title={t('odsSettingsTitle')} subtitle={t('odsSettingsHint')} />
              <OdsSettingsPanel />
            </div>
          )}

          {tab === 'language' && (
            <div className="space-y-5">
              <SettingsPageHeader title={t('language')} subtitle={t('languageSettingsHint')} />
              <Section icon={Languages} accent={settingsDash.accent} title={t('language')} description={t('languageSettingsHint')}>
                <Field label={t('panelLanguage')} hint={t('panelLanguageHint')}>
                  <select
                    className="input"
                    value={settings.panelLanguage || locale}
                    onChange={async (e) => {
                      const lang = e.target.value as Locale;
                      setSettings({ ...settings, panelLanguage: lang });
                      setLocale(lang);
                      try {
                        await api.put('/merchant/settings', { panelLanguage: lang });
                        toast.success(t('languageSaved'));
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('failedSaveLanguage'));
                      }
                    }}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </Field>
                <Field label={t('shopLanguage')} hint={t('shopLanguageHint')}>
                  <select
                    className="input"
                    value={settings.shopLanguage || settings.panelLanguage || 'en'}
                    onChange={async (e) => {
                      const lang = e.target.value as Locale;
                      setSettings({ ...settings, shopLanguage: lang });
                      try {
                        await api.put('/merchant/settings', { shopLanguage: lang });
                        toast.success(t('languageSaved'));
                      } catch (error: any) {
                        toast.error(error.response?.data?.error || t('failedSaveLanguage'));
                      }
                    }}
                  >
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </Field>
              </Section>
            </div>
          )}

          </div>
        </div>
      </div>
      <p className="text-center text-xs text-[var(--text-muted)]">{dashboardVersionLabel}</p>
    </div>
  );
}
