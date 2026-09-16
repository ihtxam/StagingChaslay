import crypto from "crypto";
import { getDb, schema } from "@/db";
import { repairCatalogText } from "@/lib/text-encoding";
import { resolveOrderItemName } from "@/lib/order-item-name";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { withLicenseSchemaRetry } from "@/lib/ensure-licenses-schema";
import { AuthService } from "./auth.service";
import { MerchantSettingsService } from "./merchant-settings.service";
import { receiptPublicUrl } from "@/lib/receipt-public-url";
import { normalizeComboSlots } from "@/lib/combo";
import { roundMoney2 } from "@/lib/money";
import { ModifierService } from "./modifier.service";
import { filterCatalogForChannel, isVisibleOnChannel } from "@/lib/catalog-visibility";
import {
  activationCodeLookupKeys,
  canRebindLicenseDevice,
  compactActivationCode,
} from "@/lib/license-activation-code";

export {
  compactActivationCode,
  formatShortActivationCode,
  normalizeActivationCode,
} from "@/lib/license-activation-code";

export function normalizeChaslayDeviceId(deviceId: string): string {
  if (!deviceId) return "";
  const clean = deviceId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
  }
  return deviceId.trim().toUpperCase();
}

export function deriveShortDeviceId(raw: string): string {
  const clean = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (clean.length === 8) return normalizeChaslayDeviceId(clean);
  const hash = crypto.createHash("sha256").update(clean).digest();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 8; i += 1) {
    body += chars[hash[i]! % chars.length];
  }
  return `${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

export function generateSyncApiKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function posDeviceIdsMatch(storedExternalId: string, incomingDeviceId: string): boolean {
  const normalized = normalizeChaslayDeviceId(incomingDeviceId);
  const short = deriveShortDeviceId(incomingDeviceId);
  const ext = String(storedExternalId || "").toUpperCase();
  const compact = normalized.replace(/-/g, "");
  return (
    ext.includes(compact) ||
    ext.endsWith(compact) ||
    deriveShortDeviceId(storedExternalId) === normalized ||
    deriveShortDeviceId(storedExternalId) === short ||
    normalizeChaslayDeviceId(storedExternalId) === normalized
  );
}

const LICENSE_ACTIVATE_COLUMNS = {
  id: schema.licenses.id,
  merchantId: schema.licenses.merchantId,
  deviceId: schema.licenses.deviceId,
  licenseKey: schema.licenses.licenseKey,
  licenseType: schema.licenses.licenseType,
  expiresAt: schema.licenses.expiresAt,
  status: schema.licenses.status,
};

const MERCHANT_LITE_COLUMNS = {
  id: schema.merchants.id,
  name: schema.merchants.name,
  slug: schema.merchants.slug,
  status: schema.merchants.status,
  subscriptionEndsAt: schema.merchants.subscriptionEndsAt,
};

const DEVICE_LITE_COLUMNS = {
  id: schema.devices.id,
  merchantId: schema.devices.merchantId,
  deviceId: schema.devices.deviceId,
  deviceName: schema.devices.deviceName,
  lastSync: schema.devices.lastSync,
  appVersion: schema.devices.appVersion,
};

type MerchantLite = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  subscriptionEndsAt: Date | null;
};

type DeviceLite = {
  id: string;
  merchantId: string;
  deviceId: string;
  deviceName: string;
  lastSync: Date | null;
  appVersion: string | null;
};

async function findMerchantLiteBySlug(slug: string): Promise<MerchantLite | null> {
  const db = getDb();
  const rows = await db
    .select(MERCHANT_LITE_COLUMNS)
    .from(schema.merchants)
    .where(eq(schema.merchants.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

async function findMerchantLiteById(merchantId: string): Promise<MerchantLite | null> {
  const db = getDb();
  const rows = await db
    .select(MERCHANT_LITE_COLUMNS)
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);
  return rows[0] ?? null;
}

async function findLicenseByActivationCode(rawCode: string, merchantId?: string) {
  return withLicenseSchemaRetry(async () => {
    const db = getDb();
    const compact = compactActivationCode(rawCode);
    if (!compact) return null;
    const keys = activationCodeLookupKeys(rawCode);
    const keyWhere =
      keys.length === 1
        ? eq(schema.licenses.licenseKey, keys[0]!)
        : inArray(schema.licenses.licenseKey, keys);
    const exactWhere = merchantId ? and(keyWhere, eq(schema.licenses.merchantId, merchantId)) : keyWhere;
    const exact = await db.select(LICENSE_ACTIVATE_COLUMNS).from(schema.licenses).where(exactWhere).limit(1);
    if (exact[0]) return exact[0];

    const compactSql = sql`regexp_replace(upper(${schema.licenses.licenseKey}), '[^A-Z0-9]', '', 'g') = ${compact}`;
    const fuzzyWhere = merchantId ? and(compactSql, eq(schema.licenses.merchantId, merchantId)) : compactSql;
    const fuzzy = await db.select(LICENSE_ACTIVATE_COLUMNS).from(schema.licenses).where(fuzzyWhere).limit(1);
    return fuzzy[0] ?? null;
  });
}

async function findDeviceLiteById(deviceUuid: string): Promise<DeviceLite | null> {
  const db = getDb();
  const rows = await db
    .select(DEVICE_LITE_COLUMNS)
    .from(schema.devices)
    .where(eq(schema.devices.id, deviceUuid))
    .limit(1);
  return rows[0] ?? null;
}

async function findDeviceForPosId(incomingDeviceId: string, merchantId?: string): Promise<DeviceLite | null> {
  const db = getDb();
  const normalized = normalizeChaslayDeviceId(incomingDeviceId);
  const exactWhere = merchantId
    ? and(eq(schema.devices.deviceId, normalized), eq(schema.devices.merchantId, merchantId))
    : eq(schema.devices.deviceId, normalized);
  const exact = await db.select(DEVICE_LITE_COLUMNS).from(schema.devices).where(exactWhere).limit(1);
  if (exact[0]) return exact[0];

  const scoped = merchantId
    ? await db.select(DEVICE_LITE_COLUMNS).from(schema.devices).where(eq(schema.devices.merchantId, merchantId))
    : await db.select(DEVICE_LITE_COLUMNS).from(schema.devices);
  return scoped.find((d) => posDeviceIdsMatch(d.deviceId, incomingDeviceId)) ?? null;
}

function planLabelForLicense(licenseType: string): string {
  return licenseType === "trial" ? "Trial license" : `${licenseType} license`;
}

function nextSubscriptionEnd(current: Date | null | undefined, licenseExpiresAt: Date): Date {
  if (!current || current < licenseExpiresAt) return licenseExpiresAt;
  return current;
}

export class ChaslayCompatService {
  static async lookupLicense(activationCode: string) {
    if (!compactActivationCode(activationCode)) return null;

    const license = await findLicenseByActivationCode(activationCode);
    if (!license) return null;

    const merchant = await findMerchantLiteById(license.merchantId);
    if (!merchant) return null;

    return {
      merchantName: merchant.name,
      customerName: merchant.name,
      tenantSlug: merchant.slug,
      planLabel: planLabelForLicense(license.licenseType),
      expiresAt: license.expiresAt.getTime(),
      status: license.status,
    };
  }

  static async activateLicense(input: {
    deviceId: string;
    activationCode: string;
    appVersion?: string;
    deviceModel?: string;
    tenantSlug?: string | null;
  }) {
    const db = getDb();
    const normalizedDeviceId = normalizeChaslayDeviceId(input.deviceId);
    if (!compactActivationCode(input.activationCode)) {
      throw new Error("Enter an activation code.");
    }

    // License keys are unique — do not scope by tenantSlug (wrong slug used to hide valid codes).
    const license = await findLicenseByActivationCode(input.activationCode);
    if (!license) {
      throw new Error(
        "Activation code not found. Hyphens and spaces are optional — check the code or ask admin for a new one."
      );
    }

    const merchant = await findMerchantLiteById(license.merchantId);
    if (!merchant) {
      throw new Error(
        "Activation code not found. Hyphens and spaces are optional — check the code or ask admin for a new one."
      );
    }

    if (input.tenantSlug) {
      const scoped = await findMerchantLiteBySlug(input.tenantSlug);
      if (scoped && scoped.id !== merchant.id) {
        throw new Error(
          `This activation code belongs to ${merchant.name}, not ${scoped.name}. Clear the store on this device and try again.`
        );
      }
    }

    const now = new Date();
    if (license.status !== "active") {
      throw new Error("This license is inactive. Ask admin to reissue a code.");
    }
    if (license.expiresAt <= now) {
      throw new Error("This license has expired. Ask your reseller for a renewal code.");
    }

    let device = license.deviceId ? await findDeviceLiteById(license.deviceId) : null;
    const matchesBound = !!(device && posDeviceIdsMatch(device.deviceId, normalizedDeviceId));
    if (device && !canRebindLicenseDevice(device, matchesBound)) {
      throw new Error(
        `This license is already active on another device (${device.deviceId}). Ask support for a code for this Device ID.`
      );
    }

    if (!device || !matchesBound) {
      const existing = await findDeviceForPosId(normalizedDeviceId, merchant.id);
      if (existing) {
        device = existing;
      } else if (device && canRebindLicenseDevice(device, false)) {
        await db
          .update(schema.devices)
          .set({
            deviceId: normalizedDeviceId,
            deviceName: input.deviceModel || device.deviceName || `Chaslay ${normalizedDeviceId}`,
            osVersion: input.deviceModel,
            appVersion: input.appVersion,
            lastSync: now,
            isActive: true,
          })
          .where(eq(schema.devices.id, device.id));
        device = {
          ...device,
          deviceId: normalizedDeviceId,
          lastSync: now,
          appVersion: input.appVersion || null,
        };
      } else {
        const inserted = await db
          .insert(schema.devices)
          .values({
            merchantId: merchant.id,
            deviceId: normalizedDeviceId,
            deviceName: input.deviceModel || `Chaslay ${normalizedDeviceId}`,
            deviceType: "tablet",
            osVersion: input.deviceModel,
            appVersion: input.appVersion,
            lastSync: now,
            isActive: true,
          })
          .returning({
            id: schema.devices.id,
            merchantId: schema.devices.merchantId,
            deviceId: schema.devices.deviceId,
            deviceName: schema.devices.deviceName,
            lastSync: schema.devices.lastSync,
            appVersion: schema.devices.appVersion,
          });
        device = inserted[0]!;
      }
      await db
        .update(schema.licenses)
        .set({ deviceId: device.id, updatedAt: now })
        .where(eq(schema.licenses.id, license.id));
    } else {
      await db
        .update(schema.devices)
        .set({
          appVersion: input.appVersion,
          osVersion: input.deviceModel,
          lastSync: now,
          isActive: true,
        })
        .where(eq(schema.devices.id, device.id));
    }

    await db
      .update(schema.merchants)
      .set({
        status: "active",
        subscriptionEndsAt: nextSubscriptionEnd(merchant.subscriptionEndsAt, license.expiresAt),
        updatedAt: now,
      })
      .where(eq(schema.merchants.id, merchant.id));

    return {
      status: "ACTIVE",
      expiresAt: license.expiresAt.getTime(),
      customerName: merchant.name,
      merchantName: merchant.name,
      planLabel: planLabelForLicense(license.licenseType),
      tenantSlug: merchant.slug,
      merchantId: merchant.id,
    };
  }

  /** Redeem a POS activation code for the logged-in merchant (WebPOS gate). Does not rebind tablets. */
  static async redeemLicenseForMerchant(merchantId: string, activationCode: string) {
    const license = await findLicenseByActivationCode(activationCode);
    if (!license) {
      throw new Error(
        "Activation code not found. Hyphens and spaces are optional — check the code or ask admin for a new one."
      );
    }
    if (license.merchantId !== merchantId) {
      throw new Error("This activation code belongs to a different store.");
    }
    const now = new Date();
    if (license.status !== "active") {
      throw new Error("This license is inactive. Ask admin to reissue a code.");
    }
    if (license.expiresAt <= now) {
      throw new Error("This license has expired. Ask your reseller for a renewal code.");
    }

    const merchant = await findMerchantLiteById(merchantId);
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const db = getDb();
    await db
      .update(schema.merchants)
      .set({
        status: "active",
        subscriptionEndsAt: nextSubscriptionEnd(merchant.subscriptionEndsAt, license.expiresAt),
        updatedAt: now,
      })
      .where(eq(schema.merchants.id, merchantId));

    const { WebPosEntitlementService } = await import("@/services/webpos-entitlement.service");
    const entitlement = await WebPosEntitlementService.getEntitlement(merchantId);
    return {
      success: true,
      status: "ACTIVE" as const,
      expiresAt: license.expiresAt.getTime(),
      customerName: merchant.name,
      planLabel: planLabelForLicense(license.licenseType),
      entitlement,
    };
  }

  static async validateLicense(input: {
    deviceId: string;
    appVersion?: string;
    tenantSlug?: string | null;
  }) {
    const db = getDb();

    const scopedMerchant = input.tenantSlug
      ? await findMerchantLiteBySlug(input.tenantSlug)
      : null;

    const device = await findDeviceForPosId(input.deviceId, scopedMerchant?.id);

    if (!device) {
      throw new Error("Device not licensed");
    }

    const merchant = await findMerchantLiteById(device.merchantId);
    const licenseRows = await withLicenseSchemaRetry(async () => {
      return db
        .select(LICENSE_ACTIVATE_COLUMNS)
        .from(schema.licenses)
        .where(and(eq(schema.licenses.deviceId, device.id), eq(schema.licenses.status, "active")));
    });
    const license = licenseRows.find((l) => l.expiresAt > new Date()) ?? licenseRows[0];
    if (!license || license.expiresAt <= new Date()) {
      throw new Error("License expired");
    }

    await db
      .update(schema.devices)
      .set({ appVersion: input.appVersion, lastSync: new Date() })
      .where(eq(schema.devices.id, device.id));

    return {
      status: "ACTIVE",
      expiresAt: license.expiresAt.getTime(),
      customerName: merchant?.name,
      merchantName: merchant?.name,
      planLabel: license.licenseType,
    };
  }

  static async posLogin(email: string, password: string, tenantSlug?: string | null) {
    void tenantSlug; // accepted for API compat; not used to reject login
    try {
      return await this.posLoginOwner(email, password);
    } catch (ownerError) {
      try {
        return await this.posLoginStaff(email, password);
      } catch {
        throw ownerError;
      }
    }
  }

  private static async ensureMerchantSyncKey(merchantId: string, existingKey?: string | null) {
    const db = getDb();
    let syncApiKey = existingKey?.trim() || "";
    if (!syncApiKey) {
      syncApiKey = generateSyncApiKey();
      await db
        .update(schema.merchants)
        .set({ syncApiKey })
        .where(eq(schema.merchants.id, merchantId));
    }
    return syncApiKey;
  }

  private static async posLoginOwner(email: string, password: string) {
    const db = getDb();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    // Match by email only (case-insensitive). A stale device tenantSlug must not
    // block a valid merchant login — slug is updated from the returned user.
    const merchants = await db
      .select()
      .from(schema.merchants)
      .where(sql`lower(${schema.merchants.email}) = ${normalizedEmail}`)
      .limit(1);
    const merchant = merchants[0];

    if (!merchant) {
      throw new Error("Invalid credentials");
    }

    const valid = await AuthService.comparePassword(password, merchant.passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    if (merchant.status !== "active" && merchant.status !== "trial") {
      throw new Error(`Account is ${merchant.status}`);
    }

    const syncApiKey = await this.ensureMerchantSyncKey(merchant.id, merchant.syncApiKey);

    // Same JWT the merchant dashboard uses, so Android can open Settings in a WebView.
    const dashboardToken = AuthService.generateToken({
      id: merchant.id,
      email: merchant.email,
      role: "merchant",
      merchantId: merchant.id,
      name: merchant.name,
      authEpoch: Number(merchant.authEpoch ?? 0),
    });
    const dashboardUser = {
      id: merchant.id,
      email: merchant.email,
      name: merchant.name,
      role: "merchant" as const,
      merchantId: merchant.id,
      isOwner: true,
      roleName: "Owner",
    };

    return {
      user: {
        id: merchant.id,
        email: merchant.email,
        name: merchant.name,
        role: "MERCHANT",
        roleName: "Owner",
        tenantSlug: merchant.slug,
      },
      merchantId: merchant.id,
      syncApiKey,
      dashboardToken,
      dashboardUser,
      dashboardUrl:
        process.env.MERCHANT_DASHBOARD_URL ||
        process.env.PUBLIC_APP_URL ||
        "https://app.rebornsense.com",
    };
  }

  private static async posLoginStaff(email: string, password: string) {
    const { StaffService } = await import("@/services/staff.service");
    const { toAndroidPermissions } = await import("@/lib/permissions");
    const { staff, role, permissions } = await StaffService.loginStaff(email, password);

    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, staff.merchantId),
    });
    if (!merchant) {
      throw new Error("Invalid credentials");
    }
    if (merchant.status !== "active" && merchant.status !== "trial") {
      throw new Error(`Account is ${merchant.status}`);
    }

    const syncApiKey = await this.ensureMerchantSyncKey(merchant.id, merchant.syncApiKey);
    const roleName = role?.name || "Staff";
    const androidPermissions = toAndroidPermissions(permissions);

    const dashboardToken = AuthService.generateToken({
      id: staff.id,
      email: staff.email || email,
      role: "staff",
      merchantId: staff.merchantId,
      staffId: staff.id,
      name: staff.name,
      roleName,
      permissions,
      authEpoch: Number(merchant.authEpoch ?? 0),
    });
    const dashboardUser = {
      id: staff.id,
      email: staff.email || email,
      name: staff.name,
      role: "staff" as const,
      merchantId: staff.merchantId,
      staffId: staff.id,
      isOwner: false,
      roleName,
      permissions,
    };

    return {
      user: {
        id: staff.id,
        email: staff.email || email,
        name: staff.name,
        role: roleName.toUpperCase().replace(/\s+/g, "_"),
        roleName,
        permissions: androidPermissions,
        tenantSlug: merchant.slug,
      },
      merchantId: merchant.id,
      syncApiKey,
      dashboardToken,
      dashboardUser,
      dashboardUrl:
        process.env.MERCHANT_DASHBOARD_URL ||
        process.env.PUBLIC_APP_URL ||
        "https://app.rebornsense.com",
    };
  }

  static async syncBootstrap(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });

    const allProducts = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
    });
    const activeProducts = allProducts.filter((p) => p.isActive !== false);
    const { products, categories: visibleCategories } = filterCatalogForChannel(
      activeProducts,
      categories,
      "pos"
    );

    const { FloorPlanService } = await import("@/services/floor-plan.service");
    const { ReservationService } = await import("@/services/reservation.service");
    const floorPlans = await FloorPlanService.list(merchantId);
    const reservedRows = await ReservationService.listForSync(merchantId);
    const reservedTableIds = [
      ...new Set(
        reservedRows
          .map((r) => r.tableId)
          .filter((id): id is string => !!id)
      ),
    ];

    const categoryClientById = new Map(
      visibleCategories.map((c) => [c.id, c.clientId || c.id] as const)
    );
    const productClientById = new Map(
      allProducts.map((p) => [p.id, p.clientId || p.id] as const)
    );
    const catalogById = new Map(allProducts.map((p) => [p.id, p] as const));
    const groupsByProduct = await ModifierService.getGroupsForProducts(
      merchantId,
      allProducts.map((p) => p.id)
    );
    const addressParts = [merchant.address, merchant.city, merchant.country].filter(Boolean);
    const { receiptPublicBaseUrl } = await import("@/lib/receipt-public-url");
    return {
      serverTime: Date.now(),
      tenant: {
        id: merchant.id,
        slug: merchant.slug,
        name: merchant.name,
        currency_symbol: "CHF",
      },
      business: {
        name: merchant.name,
        phone: merchant.phone || null,
        email: merchant.email,
        address: addressParts.join(", ") || null,
        vat_number: merchant.vatNumber || null,
        vat_rate: Number(merchant.vatRate || 0),
        tax_takeaway_rate: Number(merchant.taxTakeawayRate || merchant.vatRate || 0),
        tax_dine_in_rate: Number(merchant.taxDineInRate || merchant.vatRate || 0),
        tax_delivery_rate: Number(merchant.taxDeliveryRate || merchant.vatRate || 0),
        tax_included_in_price: merchant.taxIncludedInPrice === true,
        vat_after_discount: merchant.vatAfterDiscount !== false,
        default_language: merchant.panelLanguage || "en",
        store_hours: merchant.storeHours || {},
        receipt_base_url: receiptPublicBaseUrl(),
      },
      categories: visibleCategories.map((c) => this.mapCategory(c)),
      products: products.map((p) =>
        this.mapProduct(p, false, categoryClientById, productClientById, groupsByProduct, catalogById)
      ),
      paymentConfig: await this.getPaymentConfigPayload(merchantId),
      floor_plans: floorPlans.map((p) => ({
        id: p.id,
        name: p.name,
        canvas_width: p.canvasWidth,
        canvas_height: p.canvasHeight,
        sort_order: p.sortOrder,
        tables: (p.tables || []).map((t: {
          id: string;
          label: string;
          capacity?: number;
          shape?: string;
          posX?: number;
          posY?: number;
          width?: number;
          height?: number;
          rotation?: number;
          sortOrder?: number;
        }) => ({
          id: t.id,
          label: t.label,
          capacity: t.capacity ?? 4,
          shape: t.shape ?? "rect",
          pos_x: t.posX ?? 40,
          pos_y: t.posY ?? 40,
          width: t.width ?? 100,
          height: t.height ?? 80,
          rotation: t.rotation ?? 0,
          sort_order: t.sortOrder ?? 0,
        })),
      })),
      reserved_table_ids: reservedTableIds,
    };
  }

  static async getPaymentConfig(merchantId: string) {
    return {
      serverTime: Date.now(),
      ...(await this.getPaymentConfigPayload(merchantId)),
    };
  }

  private static async getPaymentConfigPayload(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const { merchantHasGiftCardsLicense } = await import("@/lib/gift-card-addon");
    const giftCardLicensed = await merchantHasGiftCardsLicense(merchantId).catch(() => false);

    const terminals = await db.query.paymentTerminals.findMany({
      where: eq(schema.paymentTerminals.merchantId, merchantId),
    });
    const active = terminals.filter((t) => t.status === "active");
    const defaultTerminal = active[0] || terminals[0];
    const terminalReady =
      !!merchant.adyenApiKey &&
      !!merchant.adyenMerchantAccount &&
      active.length > 0;
    const tapToPayReady =
      merchant.tapToPayEnabled === true &&
      !!merchant.adyenApiKey &&
      !!merchant.adyenMerchantAccount;

    const { normalizePosPrintSettings } = await import("@/lib/pos-print-settings");
    const { normalizePosCheckoutSettings } = await import("@/lib/pos-checkout-settings");
    const { receiptPublicBaseUrl } = await import("@/lib/receipt-public-url");
    const posPrintSettings = normalizePosPrintSettings(merchant.posPrintSettings);
    const posCheckoutSettings = normalizePosCheckoutSettings(merchant.posCheckoutSettings);

    return {
      adyen: {
        merchant_account: merchant.adyenMerchantAccount || null,
        api_key: merchant.adyenApiKey || null,
        client_id: merchant.adyenClientId || null,
      },
      default_terminal_id: defaultTerminal?.terminalId || null,
      terminals: terminals.map((t) => ({
        id: t.id,
        terminal_id: t.terminalId,
        terminal_name: t.terminalName,
        serial_number: t.serialNumber,
        status: t.status,
      })),
      terminal_ready: terminalReady,
      tap_to_pay_ready: tapToPayReady,
      tap_to_pay_enabled: merchant.tapToPayEnabled === true,
      methods: {
        // Express checkout bar under products — driven by posCheckoutSettings.
        express: posCheckoutSettings.expressCheckoutEnabled,
        cash: merchant.webposCashEnabled !== false,
        card: merchant.webposCardEnabled !== false,
        terminal: merchant.webposTerminalEnabled !== false && terminalReady,
        tap_to_pay: tapToPayReady,
        giftCard:
          giftCardLicensed &&
          merchant.webposGiftCardEnabled === true &&
          !!(merchant.giftCardSettings as { enabled?: boolean } | null)?.enabled,
        invoice: (merchant as { webposInvoiceEnabled?: boolean }).webposInvoiceEnabled !== false,
      },
      loyalty: (await import("@/services/shop-loyalty.service")).ShopLoyaltyService.programFromMerchant(
        merchant
      ),
      features: {
        courses_enabled: !!merchant.coursesEnabled,
        floor_plan_enabled: !!merchant.floorPlanEnabled,
        pax_ordering_enabled: !!merchant.paxOrderingEnabled,
        shifts_enabled: !!merchant.shiftsEnabled,
      },
      checkout: {
        ...posCheckoutSettings,
        vatIncludedInPrice: merchant.taxIncludedInPrice === true,
        vatAfterDiscount: merchant.vatAfterDiscount !== false,
      },
      receipt_base_url: receiptPublicBaseUrl(),
      scale: {
        enabled: posPrintSettings.scaleEnabled === true,
        com_port: posPrintSettings.scaleComPort || null,
        device_name: posPrintSettings.scaleDeviceName || null,
        device_id: posPrintSettings.scaleDeviceId || null,
        usb_address: posPrintSettings.scaleUsbAddress || null,
      },
      print: {
        adyen_receipt_digital_only: posPrintSettings.adyenReceiptDigitalOnly === true,
        receipt_delivery_directions_qr: posPrintSettings.receiptDeliveryDirectionsQr !== false,
        auto_print_kitchen: posPrintSettings.autoPrintKitchen !== false,
        waiter_till_bell_enabled: posPrintSettings.waiterTillBellEnabled !== false,
        kitchen_print_retry_enabled: posPrintSettings.kitchenPrintRetryEnabled !== false,
        kitchen_print_retry_attempts: posPrintSettings.kitchenPrintRetryAttempts ?? 5,
        kitchen_print_retry_interval_sec: posPrintSettings.kitchenPrintRetryIntervalSec ?? 5,
      },
    };
  }

  static async pushTerminalsFromDevice(
    merchantId: string,
    input: {
      terminals?: Array<{
        terminalId?: string;
        terminalName?: string;
        serialNumber?: string;
        status?: string;
      }>;
      defaultTerminalId?: string;
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
      adyenTerminalEnabled?: boolean;
      deviceLabel?: string;
    }
  ) {
    const db = getDb();
    const now = new Date();

    const adyenPatch: {
      adyenMerchantAccount?: string;
      adyenApiKey?: string;
      adyenClientId?: string;
    } = {};
    if (input.adyenMerchantAccount?.trim()) {
      adyenPatch.adyenMerchantAccount = input.adyenMerchantAccount.trim();
    }
    if (input.adyenApiKey?.trim()) {
      adyenPatch.adyenApiKey = input.adyenApiKey.trim();
    }
    if (input.adyenClientId?.trim()) {
      adyenPatch.adyenClientId = input.adyenClientId.trim();
    }
    if (Object.keys(adyenPatch).length > 0) {
      await MerchantSettingsService.updateMerchantSettings(merchantId, adyenPatch);
    }

    const rows = input.terminals?.length
      ? input.terminals
      : input.defaultTerminalId?.trim()
        ? [{ terminalId: input.defaultTerminalId.trim() }]
        : [];

    let upserted = 0;
    for (const row of rows) {
      const terminalId = String(row.terminalId || "").trim();
      if (!terminalId) continue;

      const terminalName =
        String(row.terminalName || input.deviceLabel || terminalId).trim() || terminalId;
      const serialNumber = String(row.serialNumber || terminalId).trim() || null;
      const status =
        input.adyenTerminalEnabled === false
          ? "inactive"
          : String(row.status || "active").trim() || "active";

      const existing = await db.query.paymentTerminals.findFirst({
        where: eq(schema.paymentTerminals.terminalId, terminalId),
      });

      if (existing) {
        if (existing.merchantId !== merchantId) {
          throw new Error(`Terminal ${terminalId} belongs to another merchant`);
        }
        await db
          .update(schema.paymentTerminals)
          .set({
            terminalName: existing.terminalName?.trim() ? existing.terminalName : terminalName,
            serialNumber: serialNumber || existing.serialNumber,
            status,
            lastHeartbeat: now,
          })
          .where(eq(schema.paymentTerminals.id, existing.id));
      } else {
        await db.insert(schema.paymentTerminals).values({
          merchantId,
          terminalId,
          terminalName,
          serialNumber,
          status,
          lastHeartbeat: now,
        });
      }
      upserted += 1;
    }

    return { ok: true, upserted, serverTime: Date.now() };
  }

  static async syncMenuChanges(merchantId: string, sinceMs: number) {
    const db = getDb();
    const sinceDate = sinceMs > 0 ? new Date(sinceMs) : new Date(0);

    const categories = await db.query.categories.findMany({
      where: and(eq(schema.categories.merchantId, merchantId), gt(schema.categories.updatedAt, sinceDate)),
    });

    const products = await db.query.products.findMany({
      where: and(eq(schema.products.merchantId, merchantId), gt(schema.products.updatedAt, sinceDate)),
    });

    // Full category map so product.category_id matches mapCategory ids (clientId || id).
    const allCategories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });
    const activeChangedProducts = products.filter((p) => p.isActive !== false);
    const { products: visibleProducts, categories: visibleChangedCategories } =
      filterCatalogForChannel(activeChangedProducts, categories, "pos");
    const categoryClientById = new Map(
      allCategories.map((c) => [c.id, c.clientId || c.id] as const)
    );
    const allProducts = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
    });
    const productClientById = new Map(
      allProducts.map((p) => [p.id, p.clientId || p.id] as const)
    );
    const catalogById = new Map(allProducts.map((p) => [p.id, p] as const));
    const groupsByProduct = await ModifierService.getGroupsForProducts(
      merchantId,
      allProducts.map((p) => p.id)
    );

    return {
      serverTime: Date.now(),
      categories: visibleChangedCategories.map((c) => this.mapCategory(c, true)),
      products: visibleProducts.map((p) =>
        this.mapProduct(p, true, categoryClientById, productClientById, groupsByProduct, catalogById)
      ),
    };
  }

  static async incomingOrders(merchantId: string, sinceMs: number) {
    const db = getDb();
    const sinceDate =
      sinceMs > 0 ? new Date(sinceMs) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const orders = await db.query.orders.findMany({
      where: and(
        eq(schema.orders.merchantId, merchantId),
        eq(schema.orders.orderType, "web_shop"),
        inArray(schema.orders.status, [
          "pending",
          "pending_approval",
          "accepted",
          "preparing",
          "ready",
        ]),
        gt(schema.orders.createdAt, sinceDate)
      ),
      with: { items: true },
      limit: 200,
    });

    return {
      serverTime: Date.now(),
      orders: orders.map((o) => ({
        id: o.id,
        order_number: o.orderNumber,
        source: "ONLINE",
        status: o.status?.toUpperCase(),
        service_type: (o.fulfillmentChannel || "takeaway").toUpperCase(),
        fulfillment_type: o.fulfillmentChannel === "delivery" ? "DELIVERY" : "PICKUP",
        customer_name: o.customerName,
        customer_phone: o.customerPhone,
        delivery_address: o.shippingAddress,
        pickup_time_ms: o.scheduledFor ? o.scheduledFor.getTime() : null,
        subtotal: parseFloat(String(o.subtotal)),
        tax_total: parseFloat(String(o.taxAmount)),
        total: parseFloat(String(o.total)),
        notes: o.notes,
        payload: {
          items: (o.items || []).map((i) => ({
            productName: resolveOrderItemName(i.productName),
            quantity: Number(i.quantity),
            unitPrice: parseFloat(String(i.unitPrice)),
            lineTotal: parseFloat(String(i.totalPrice)),
          })),
        },
        created_at: o.createdAt?.toISOString(),
      })),
    };
  }

  static async ackOrder(merchantId: string, orderId: string) {
    const db = getDb();
    await db
      .update(schema.orders)
      .set({ status: "accepted" })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.merchantId, merchantId)));
    return { ok: true };
  }

  static mapCategory(c: typeof schema.categories.$inferSelect, includeDeleted = false) {
    return {
      id: c.clientId || c.id,
      name: repairCatalogText(c.name),
      sort_order: c.sortOrder ?? 0,
      color_hex: c.color || null,
      online_visible: true,
      kiosk_visible: true,
      updated_at: c.updatedAt?.toISOString(),
      ...(includeDeleted && false ? { deleted_at: c.updatedAt?.toISOString() } : {}),
    };
  }

  static mapProduct(
    p: typeof schema.products.$inferSelect,
    includeDeleted = false,
    categoryClientById?: Map<string, string>,
    productClientById?: Map<string, string>,
    groupsByProduct?: Map<string, any[]>,
    catalogById?: Map<string, typeof schema.products.$inferSelect>
  ) {
    const categoryId = p.categoryId
      ? categoryClientById?.get(p.categoryId) || p.categoryId
      : null;
    const modifierGroups = groupsByProduct?.get(p.id) || [];
    const extras = Array.isArray(p.extras) ? p.extras : [];
    const comboItems = normalizeComboSlots(p.comboItems).map((slot) => ({
      id: slot.id,
      name: slot.name,
      minPick: slot.minPick,
      maxPick: slot.maxPick,
      options: slot.options.map((o) =>
        this.mapComboOption(o, productClientById, groupsByProduct, catalogById)
      ),
    }));
    const specifications = Array.isArray(p.specifications) ? p.specifications : [];
    const variants = specifications
      .filter((s: any) => s?.name?.trim() && (s.saleStatus || "in_stock") !== "out_of_stock")
      .map((s: any, i: number) => ({
        id: s.id || `spec-${i + 1}`,
        name: repairCatalogText(s.name || ""),
        price: roundMoney2(Number(s.price) || 0),
        is_default: !!s.isDefault,
        sort_order: Number(s.sortOrder) || i,
        sale_status: s.saleStatus || "in_stock",
      }));
    // stock defaults to 0 in DB — that means "not tracking inventory", not unavailable.
    // Use isActive for POS/menu availability; only hide when merchant deactivated the item.
    return {
      id: p.clientId || p.id,
      category_id: categoryId,
      name: repairCatalogText(p.name),
      description: p.description ? repairCatalogText(p.description) : p.description,
      price: parseFloat(String(p.price)),
      tax_rate: parseFloat(String(p.isTaxable ? 8.1 : 0)),
      sku: p.sku,
      barcode: p.barcode,
      image_url: p.imageUrl,
      sort_order: p.sortOrder ?? 0,
      in_stock: p.isActive !== false,
      is_open_price: !!p.isOpenPrice,
      sold_by_weight: !!p.soldByWeight,
      product_type: p.productType || "standard",
      allow_extras: !!p.allowExtras || modifierGroups.length > 0 || extras.length > 0,
      extras: extras.map((e) => ({
        id: e.id,
        name: repairCatalogText(e.name || ""),
        price: Number(e.price) || 0,
      })),
      modifier_groups: modifierGroups,
      combo_items: comboItems,
      specifications,
      variants,
      online_visible: p.isActive && isVisibleOnChannel(p.visibility, "pos"),
      kiosk_visible: p.isActive && isVisibleOnChannel(p.visibility, "pos"),
      updated_at: p.updatedAt?.toISOString(),
      ...(includeDeleted && !p.isActive ? { deleted_at: p.updatedAt?.toISOString() } : {}),
    };
  }

  private static mapComboOption(
    o: { productId: string; extraPrice: number },
    productClientById?: Map<string, string>,
    groupsByProduct?: Map<string, any[]>,
    catalogById?: Map<string, typeof schema.products.$inferSelect>
  ) {
    const mapped = productClientById?.get(o.productId) || o.productId;
    const source = catalogById?.get(o.productId);
    const childGroups = groupsByProduct?.get(o.productId) || [];
    const childExtras = Array.isArray(source?.extras) ? source.extras : [];
    return {
      productId: mapped,
      product_id: mapped,
      sourceProductId: o.productId,
      extraPrice: o.extraPrice,
      name: source?.name ? repairCatalogText(source.name) : undefined,
      image: source?.imageUrl || undefined,
      allow_extras: !!source?.allowExtras || childGroups.length > 0 || childExtras.length > 0,
      extras: childExtras.map((e) => ({
        id: e.id,
        name: repairCatalogText(e.name || ""),
        price: Number(e.price) || 0,
      })),
      modifier_groups: childGroups,
    };
  }

  static receiptPublicUrl(ref: string): string {
    return receiptPublicUrl(ref);
  }
}
