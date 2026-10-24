import { isAccountingLicensed } from '@/lib/accounting-addon';
import { isCateringLicensed } from '@/lib/catering-addon';
import { isDeliveryPlatformsLicensed } from '@/lib/delivery-platform-addon';
import { isGiftCardsLicensed } from '@/lib/gift-card-addon';
import { isInventoryLicensed } from '@/lib/inventory-addon';
import { isKdsLicensed } from '@/lib/kds-addon';
import { isKioskLicensed } from '@/lib/kiosk-addon';
import { isOdsLicensed } from '@/lib/ods-addon';
import { isPhoneOrderingLicensed } from '@/lib/phone-ordering-addon';
import { isSignageLicensed } from '@/lib/signage-addon';
import { isStorekeeperLicensed } from '@/lib/storekeeper-addon';
import {
  shouldShowReservationsSettings,
} from '@/lib/pos-hub-visibility';
import type { EditionFeatureKey } from '@/lib/edition-features';

export type ExtraModuleId =
  | 'kiosk'
  | 'inventory'
  | 'storekeeper'
  | 'catering'
  | 'phone'
  | 'signage'
  | 'reservations'
  | 'como'
  | 'fiskaly'
  | 'giftCards'
  | 'kds'
  | 'ods'
  | 'accounting'
  | 'deliveryPlatforms'
  | 'guestCrm'
  | 'marketingAutomation';

export type MerchantAddonSettings = {
  id?: string;
  name?: string;
  email?: string;
  country?: string | null;
  businessCategory?: 'retail' | 'restaurant' | null;
  editionFeatures?: EditionFeatureKey[] | null;
  reservationsEnabled?: boolean;
  comoSettings?: { enabled?: boolean; configured?: boolean } | null;
  fiskalySettings?: { enabled?: boolean } | null;
  guestCrmAddonEnabled?: boolean;
  marketingAutomationAddonEnabled?: boolean;
  kioskAddonEnabled?: boolean;
  kioskEnabled?: boolean;
  inventoryAddonEnabled?: boolean;
  inventoryEnabled?: boolean;
  storekeeperAddonEnabled?: boolean;
  signageAddonEnabled?: boolean;
  signageEnabled?: boolean;
  cateringEnabled?: boolean;
  cateringAddonEnabled?: boolean;
  phoneOrderingAddonEnabled?: boolean;
  giftCardAddonEnabled?: boolean;
  kdsAddonEnabled?: boolean;
  kdsEnabled?: boolean;
  odsAddonEnabled?: boolean;
  odsEnabled?: boolean;
  bexioAddonEnabled?: boolean;
  odooAddonEnabled?: boolean;
  accountingAddonEnabled?: boolean;
  justEatAddonEnabled?: boolean;
  uberEatsAddonEnabled?: boolean;
  deliveryPlatformsAddonEnabled?: boolean;
  posCheckoutSettings?: { posMode?: 'restaurant' | 'retail' } | null;
};

export type ExtraModuleDefinition = {
  id: ExtraModuleId;
  titleKey: string;
  descriptionKey: string;
  isActive: (settings: MerchantAddonSettings, ctx: ExtraModuleContext) => boolean;
};

export type ExtraModuleContext = {
  isRetailMerchant: boolean;
};

export function isComoLicensed(settings: MerchantAddonSettings | null | undefined): boolean {
  if (!settings?.comoSettings) return false;
  return settings.comoSettings.enabled === true || settings.comoSettings.configured === true;
}

export function isFiskalyLicensed(settings: MerchantAddonSettings | null | undefined): boolean {
  return settings?.fiskalySettings?.enabled === true;
}

export function isGuestCrmLicensed(settings: MerchantAddonSettings | null | undefined): boolean {
  return settings?.guestCrmAddonEnabled === true;
}

export function isMarketingAutomationLicensed(
  settings: MerchantAddonSettings | null | undefined
): boolean {
  return settings?.marketingAutomationAddonEnabled === true;
}

export const EXTRA_MODULE_DEFINITIONS: ExtraModuleDefinition[] = [
  {
    id: 'kiosk',
    titleKey: 'extraModuleKioskTitle',
    descriptionKey: 'extraModuleKioskDesc',
    isActive: (s) => isKioskLicensed(s),
  },
  {
    id: 'inventory',
    titleKey: 'extraModuleInventoryTitle',
    descriptionKey: 'extraModuleInventoryDesc',
    isActive: (s) => isInventoryLicensed(s),
  },
  {
    id: 'storekeeper',
    titleKey: 'extraModuleStorekeeperTitle',
    descriptionKey: 'extraModuleStorekeeperDesc',
    isActive: (s) => isStorekeeperLicensed(s),
  },
  {
    id: 'catering',
    titleKey: 'extraModuleCateringTitle',
    descriptionKey: 'extraModuleCateringDesc',
    isActive: (s) => isCateringLicensed(s),
  },
  {
    id: 'phone',
    titleKey: 'extraModulePhoneTitle',
    descriptionKey: 'extraModulePhoneDesc',
    isActive: (s) => isPhoneOrderingLicensed(s),
  },
  {
    id: 'signage',
    titleKey: 'extraModuleSignageTitle',
    descriptionKey: 'extraModuleSignageDesc',
    isActive: (s) => isSignageLicensed(s),
  },
  {
    id: 'reservations',
    titleKey: 'extraModuleReservationsTitle',
    descriptionKey: 'extraModuleReservationsDesc',
    isActive: (s, ctx) =>
      shouldShowReservationsSettings({
        isRetail: ctx.isRetailMerchant,
        reservationsEnabled: s.reservationsEnabled,
        editionFeatures: s.editionFeatures,
      }),
  },
  {
    id: 'kds',
    titleKey: 'extraModuleKdsTitle',
    descriptionKey: 'extraModuleKdsDesc',
    isActive: (s) => isKdsLicensed(s),
  },
  {
    id: 'ods',
    titleKey: 'extraModuleOdsTitle',
    descriptionKey: 'extraModuleOdsDesc',
    isActive: (s) => isOdsLicensed(s),
  },
  {
    id: 'giftCards',
    titleKey: 'extraModuleGiftCardsTitle',
    descriptionKey: 'extraModuleGiftCardsDesc',
    isActive: (s) => isGiftCardsLicensed(s),
  },
  {
    id: 'como',
    titleKey: 'extraModuleComoTitle',
    descriptionKey: 'extraModuleComoDesc',
    isActive: (s) => isComoLicensed(s),
  },
  {
    id: 'fiskaly',
    titleKey: 'extraModuleFiskalyTitle',
    descriptionKey: 'extraModuleFiskalyDesc',
    isActive: (s) => isFiskalyLicensed(s),
  },
  {
    id: 'accounting',
    titleKey: 'extraModuleAccountingTitle',
    descriptionKey: 'extraModuleAccountingDesc',
    isActive: (s) => isAccountingLicensed(s),
  },
  {
    id: 'deliveryPlatforms',
    titleKey: 'extraModuleDeliveryPlatformsTitle',
    descriptionKey: 'extraModuleDeliveryPlatformsDesc',
    isActive: (s) => isDeliveryPlatformsLicensed(s),
  },
  {
    id: 'guestCrm',
    titleKey: 'extraModuleGuestCrmTitle',
    descriptionKey: 'extraModuleGuestCrmDesc',
    isActive: (s) => isGuestCrmLicensed(s),
  },
  {
    id: 'marketingAutomation',
    titleKey: 'extraModuleMarketingTitle',
    descriptionKey: 'extraModuleMarketingDesc',
    isActive: (s) => isMarketingAutomationLicensed(s),
  },
];

export function listInactiveExtraModules(
  settings: MerchantAddonSettings | null | undefined,
  ctx: ExtraModuleContext
): ExtraModuleDefinition[] {
  if (!settings) return [];
  return EXTRA_MODULE_DEFINITIONS.filter((def) => !def.isActive(settings, ctx));
}

/** Settings sidebar tabs that are paid add-ons — hide when not licensed. */
export function isLicensedSettingsAddonTab(
  tabId: string,
  settings: MerchantAddonSettings | null | undefined,
  ctx: ExtraModuleContext
): boolean {
  if (!settings) return false;
  switch (tabId) {
    case 'kiosk':
      return isKioskLicensed(settings);
    case 'signage':
      return isSignageLicensed(settings);
    case 'phone':
      return isPhoneOrderingLicensed(settings);
    case 'accounting':
      return isAccountingLicensed(settings);
    case 'kds':
      return isKdsLicensed(settings);
    case 'ods':
      return isOdsLicensed(settings);
    case 'como':
      return isComoLicensed(settings);
    case 'fiscal':
      return isFiskalyLicensed(settings);
    default:
      return true;
  }
}
