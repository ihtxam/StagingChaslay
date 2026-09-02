import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  integer,
  serial,
  json,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { PosPrintSettings } from "../lib/pos-print-settings";
import type { TableQrSettings } from "../lib/table-qr-settings";
import type { KioskSettings } from "../lib/kiosk-settings";

// ============================================================================
// SUPERADMIN & AUTHENTICATION
// ============================================================================

export const superadmins = pgTable(
  "superadmins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).default("superadmin").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    /** Can be assigned support tickets (technical issues). */
    handlesSupport: boolean("handles_support").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("superadmins_email_idx").on(table.email),
  })
);

// ============================================================================
// RESELLERS (AGENCIES) — normal tenants between superadmin and merchants
// ============================================================================

export const resellers = pgTable(
  "resellers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active | suspended
    /**
     * Device-license seat pool granted by Superadmin.
     * Reseller issues seats to their own merchants from this quota.
     */
    licenseSeats: integer("license_seats").default(0).notNull(),
    /** Optional branding JSON for future white-label */
    branding: json("branding").$type<Record<string, unknown> | null>(),
    createdBySuperadminId: uuid("created_by_superadmin_id").references(() => superadmins.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("resellers_email_idx").on(table.email),
    statusIdx: index("resellers_status_idx").on(table.status),
  })
);

// ============================================================================
// EDITIONS (POS feature packs / versions)
// ============================================================================

export const editions = pgTable(
  "editions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** platform = superadmin templates; reseller = agency-owned */
    ownerType: varchar("owner_type", { length: 20 }).default("platform").notNull(),
    /** null when ownerType=platform; reseller id when ownerType=reseller */
    ownerId: uuid("owner_id"),
    name: varchar("name", { length: 150 }).notNull(),
    note: text("note"),
    /** retail | restaurant | both */
    businessCategory: varchar("business_category", { length: 20 }).default("both").notNull(),
    /** EditionFeatureKey[] */
    features: json("features").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("editions_owner_idx").on(table.ownerType, table.ownerId),
    nameIdx: index("editions_name_idx").on(table.name),
  })
);

// ============================================================================
// MERCHANTS (TENANTS)
// ============================================================================

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    businessLicense: varchar("business_license", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }),
    vatNumber: varchar("vat_number", { length: 50 }),
    vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).default("0"),
    // Channel-specific tax rates (%). Fall back to vatRate when null/0 unused.
    taxTakeawayRate: decimal("tax_takeaway_rate", { precision: 5, scale: 2 }).default("0"),
    taxDineInRate: decimal("tax_dine_in_rate", { precision: 5, scale: 2 }).default("0"),
    taxDeliveryRate: decimal("tax_delivery_rate", { precision: 5, scale: 2 }).default("0"),
    /** When true, menu prices are gross (TVA included); when false, tax is added on top at checkout. */
    taxIncludedInPrice: boolean("tax_included_in_price").default(false).notNull(),
    /**
     * Tax-exclusive only: when true, order discounts reduce the VAT base; when false, VAT stays on
     * pre-discount net and the discount reduces the payable total (online shop legacy behavior).
     */
    vatAfterDiscount: boolean("vat_after_discount").default(true).notNull(),
    // Online shop: path slug + optional DNS subdomain (e.g. demo → demo.domain)
    slug: varchar("slug", { length: 100 }),
    subdomain: varchar("subdomain", { length: 63 }),
    /** Custom apex/domain for CMS website (e.g. cafe.ch) — DNS CNAME to platform */
    customDomain: varchar("custom_domain", { length: 255 }),
    shopEnabled: boolean("shop_enabled").default(false).notNull(),
    /**
     * Soft close for online ordering (shop stays browsable).
     * When false, visitors see “not accepting orders… please call us”.
     */
    acceptingOrders: boolean("accepting_orders").default(true).notNull(),
    /**
     * Soft close for online reservations (module can stay enabled).
     * When false, visitors see “not accepting reservations… please call us”.
     */
    acceptingReservations: boolean("accepting_reservations").default(true).notNull(),
    /** When true, shop root serves published CMS homepage instead of menu */
    cmsHomepageEnabled: boolean("cms_homepage_enabled").default(false).notNull(),
    // Online ordering channels
    pickupEnabled: boolean("pickup_enabled").default(true).notNull(),
    dineInEnabled: boolean("dine_in_enabled").default(true).notNull(),
    deliveryEnabled: boolean("delivery_enabled").default(true).notNull(),
    /**
     * Where customers choose pickup / delivery / dine-in:
     * checkout | popup_start | menu
     */
    channelSelectMode: varchar("channel_select_mode", { length: 20 }).default("checkout").notNull(),
    /** Show product photos on the public menu */
    menuShowProductImages: boolean("menu_show_product_images").default(true).notNull(),
    /** Show category banner images on the public menu */
    menuShowCategoryBanners: boolean("menu_show_category_banners").default(true).notNull(),
    /**
     * Online shop cart layout:
     * hidden_slide (default) | sticky_right
     */
    cartLayout: varchar("cart_layout", { length: 20 }).default("hidden_slide").notNull(),
    /**
     * Allow customers to schedule / program orders for later.
     * When false, orders can only be placed during opening hours (ASAP only).
     */
    scheduledOrdersEnabled: boolean("scheduled_orders_enabled").default(true).notNull(),
    // Per-channel weekly hours (+ optional display for homepage banner):
    // { takeaway: { mon: [{ open, close }] }, delivery, dine_in, display }
    storeHours: json("store_hours").$type<Record<string, Record<string, Array<{ open: string; close: string }>>>>().default({}),
    shopLogoUrl: varchar("shop_logo_url", { length: 500 }),
    shopBannerUrl: varchar("shop_banner_url", { length: 500 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    pickupEtaMinutes: integer("pickup_eta_minutes").default(25),
    deliveryEtaMinutes: integer("delivery_eta_minutes").default(45),
    /** Minimum lead time (minutes) before a customer can schedule a pre-order */
    minPreOrderDelayMinutes: integer("min_pre_order_delay_minutes").default(30),
    /**
     * Fixed CHF amount added to each menu item base price for delivery orders
     * (e.g. 2 → delivery item prices = takeaway + 2.00).
     */
    deliveryMenuMarkup: decimal("delivery_menu_markup", { precision: 10, scale: 2 }).default("0"),
    /**
     * When true, delivery item pricing uses per-category extra_delivery_price
     * instead of the flat delivery_menu_markup.
     */
    categoryPricingEnabled: boolean("category_pricing_enabled").default(false).notNull(),
    /** Driver pay: hourly | per_order | both */
    deliveryDriverPayMode: varchar("delivery_driver_pay_mode", { length: 20 })
      .default("both")
      .notNull(),
    deliveryDriverHourlyRate: decimal("delivery_driver_hourly_rate", { precision: 10, scale: 2 }).default(
      "0"
    ),
    deliveryPerOrderFee: decimal("delivery_per_order_fee", { precision: 10, scale: 2 }).default("0"),
    // Adyen credentials (merchant-level; shared by online shop + payment terminals)
    adyenMerchantAccount: varchar("adyen_merchant_account", { length: 255 }),
    adyenApiKey: text("adyen_api_key"),
    adyenClientId: varchar("adyen_client_id", { length: 255 }),
    /** Adyen Standard webhook HMAC key (merchant Customer Area) */
    adyenHmacKey: text("adyen_hmac_key"),
    /** Enable NFC Tap to Pay (Adyen SoftPOS) for WebPOS + Android when credentials are set */
    tapToPayEnabled: boolean("tap_to_pay_enabled").default(false).notNull(),
    /** Adyen Terminal API: test vs live environment */
    adyenLiveEnvironment: boolean("adyen_live_environment").default(false).notNull(),
    /** Adyen cloud device region: EU | US | AU | APSE */
    adyenLiveRegion: varchar("adyen_live_region", { length: 10 }).default("EU").notNull(),
    /** Use legacy Terminal API sync URL instead of Cloud Device API */
    adyenUseLegacyEndpoint: boolean("adyen_use_legacy_endpoint").default(false).notNull(),
    /** @deprecated Use posCheckoutSettings.expressCheckoutEnabled. Kept in sync for older clients. */
    webposExpressEnabled: boolean("webpos_express_enabled").default(true).notNull(),
    webposCashEnabled: boolean("webpos_cash_enabled").default(true).notNull(),
    webposCardEnabled: boolean("webpos_card_enabled").default(true).notNull(),
    webposTerminalEnabled: boolean("webpos_terminal_enabled").default(true).notNull(),
    /** Allow Gift Card as a WebPOS tender (requires gift card settings enabled) */
    webposGiftCardEnabled: boolean("webpos_gift_card_enabled").default(false).notNull(),
    /** Allow Invoice as a WebPOS / Android checkout tender */
    webposInvoiceEnabled: boolean("webpos_invoice_enabled").default(true).notNull(),
    /** Bank details printed on A4 invoices + Swiss QR-bill */
    bankIban: varchar("bank_iban", { length: 34 }),
    bankQrIban: varchar("bank_qr_iban", { length: 34 }),
    bankName: varchar("bank_name", { length: 255 }),
    bankAccountHolder: varchar("bank_account_holder", { length: 255 }),
    /** Per-merchant invoice number sequence (INV-YYYY-NNNNN) */
    invoiceSequence: integer("invoice_sequence").default(0).notNull(),
    /**
     * Gift card / stored-value settings:
     * { enabled, presetDenominations, minAmount, maxAmount, reloadEnabled, customAmountEnabled }
     */
    giftCardSettings: json("gift_card_settings").$type<Record<string, unknown> | null>(),
    /** Fixed CHF surcharge added to online card checkouts */
    onlineCardFeeFixed: decimal("online_card_fee_fixed", { precision: 10, scale: 2 }).default("0"),
    /** Percent surcharge on (subtotal+tax+delivery+tip) for online card checkouts */
    onlineCardFeePercent: decimal("online_card_fee_percent", { precision: 6, scale: 3 }).default("0"),
    // Online shop fidelity / loyalty program (customer account points)
    loyaltyEnabled: boolean("loyalty_enabled").default(false).notNull(),
    /** Points earned per 1.00 CHF of paid food subtotal (default 1) */
    loyaltyEarnPointsPerChf: decimal("loyalty_earn_points_per_chf", { precision: 8, scale: 3 }).default("1"),
    /** Points required to redeem 1.00 CHF discount (default 100) */
    loyaltyRedeemPointsPerChf: integer("loyalty_redeem_points_per_chf").default(100).notNull(),
    /** Earn lots expire after this many days (default 30) */
    loyaltyPointsExpiryDays: integer("loyalty_points_expiry_days").default(30).notNull(),
    panelLanguage: varchar("panel_language", { length: 10 }).default("en").notNull(), // en | fr | de
    /** Default language for online shop + CMS homepage (null = fall back to panelLanguage) */
    shopLanguage: varchar("shop_language", { length: 10 }), // en | fr | de
    /** Reborn/FoodTruck Android POS sync key (X-Api-Key header) */
    syncApiKey: varchar("sync_api_key", { length: 64 }),
    // Restaurant floor / PAX
    floorPlanEnabled: boolean("floor_plan_enabled").default(false).notNull(),
    // When true: order & bill per person (Person 1…) at a table; kitchen tickets split by seat
    paxOrderingEnabled: boolean("pax_ordering_enabled").default(false).notNull(),
    /**
     * Dine-in course firing (starter/main/…). Off by default — many venues only need
     * send-to-kitchen / kitchen message without multi-course workflow.
     */
    coursesEnabled: boolean("courses_enabled").default(false).notNull(),
    /**
     * When true, WebPOS requires an open cash shift before selling.
     * Staff declare opening float and reconcile cash on close.
     */
    shiftsEnabled: boolean("shifts_enabled").default(false).notNull(),
    /**
     * Max concurrent main POS stations (WebPOS + Android register). 0 = unlimited.
     */
    maxPosPosts: integer("max_pos_posts").default(0).notNull(),
    /**
     * Max concurrent waiter stations (waiter web + Android waiter). 0 = unlimited.
     */
    maxWaiterPosts: integer("max_waiter_posts").default(0).notNull(),
    /** Max staff accounts (merchant panel users). 0 = unlimited. */
    maxStaff: integer("max_staff").default(0).notNull(),
    /** Max shop/branch locations. 0 = unlimited; default 1 when unset on plan. */
    maxLocations: integer("max_locations").default(1).notNull(),
    /**
     * Paid restaurant inventory + recipes addon. Superadmin/reseller only (like POS seats).
     */
    inventoryAddonEnabled: boolean("inventory_addon_enabled").default(false).notNull(),
    /**
     * Paid Reborn Screens (digital menu boards). Superadmin/reseller only — TVs do not consume POS seats.
     */
    signageAddonEnabled: boolean("signage_addon_enabled").default(false).notNull(),
    /** Max TV screens when the signage addon is on. Default 2. */
    signageScreenLimit: integer("signage_screen_limit").default(2).notNull(),
    /** Paid kitchen display (KDS) addon. Superadmin/reseller only. */
    kdsAddonEnabled: boolean("kds_addon_enabled").default(false).notNull(),
    /** Paid order display system (ODS) addon. Superadmin/reseller only. */
    odsAddonEnabled: boolean("ods_addon_enabled").default(false).notNull(),
    /** Paid self-order kiosk addon. Superadmin/reseller only. */
    kioskAddonEnabled: boolean("kiosk_addon_enabled").default(false).notNull(),
    /**
     * Self-order kiosk configuration:
     * { accessToken, promoSlides, enabledLanguages, terminalId, tableMode, ... }
     */
    kioskSettings: json("kiosk_settings").$type<KioskSettings | null>(),
    /** Paid Just Eat / JET Connect order integration addon. */
    justEatAddonEnabled: boolean("just_eat_addon_enabled").default(false).notNull(),
    /** Paid Uber Eats order integration addon. */
    uberEatsAddonEnabled: boolean("uber_eats_addon_enabled").default(false).notNull(),
    /** Paid mobile storekeeper intake app (barcode scan, receive stock). */
    storekeeperAddonEnabled: boolean("storekeeper_addon_enabled").default(false).notNull(),
    /**
     * Extra yield / waste factor applied to recipe usage on sale (0–0.50). Default 20%.
     */
    inventoryWasteFactor: decimal("inventory_waste_factor", { precision: 5, scale: 4 })
      .default("0.20")
      .notNull(),
    /** Master switch: email preferred supplier when an item hits par / reorder point. */
    inventoryAutoReorderEmailEnabled: boolean("inventory_auto_reorder_email_enabled")
      .default(false)
      .notNull(),
    /** Days before expiry to alert store admin (default 30 ≈ one month). */
    inventoryExpiryAlertDays: integer("inventory_expiry_alert_days").default(30).notNull(),
    /** WebPOS / counter accent theme: teal | green | blue | violet */
    posColorTheme: varchar("pos_color_theme", { length: 20 }).default("teal").notNull(),
    /** Online / phone restaurant table reservations */
    reservationsEnabled: boolean("reservations_enabled").default(false).notNull(),
    /**
     * Reservation module settings:
     * {
     *   dineInHoursMode: 'same_as_takeaway' | 'custom',
     *   slotIntervalMinutes, seatingDurationMinutes, bufferMinutes,
     *   minPartySize, maxPartySize, minHoursBefore, maxDaysAhead,
     *   autoAccept, sendConfirmationEmail, sendStatusEmails,
     *   maxCoversPerSlot, policiesText
     * }
     */
    reservationSettings: json("reservation_settings").$type<ReservationSettings | null>(),
    /**
     * Holiday / vacation mode (programmable in advance):
     * {
     *   manualActive?: boolean,
     *   popupImageUrl?: string | null,
     *   message?: string | null,
     *   periods?: Array<{ id, startDate, endDate, title? }>  // YYYY-MM-DD inclusive (Europe/Zurich)
     * }
     */
    vacationSettings: json("vacation_settings").$type<VacationSettings | null>(),
    /**
     * Merchant SMTP for newsletters / marketing (optional; falls back to platform Brevo).
     * { enabled, host, port, secure, user, password, fromEmail, fromName }
     */
    emailSmtpSettings: json("email_smtp_settings").$type<MerchantSmtpSettings | null>(),
    /** Per-merchant Brevo API key + from + usage counters */
    emailBrevoSettings: json("email_brevo_settings").$type<MerchantBrevoSettings | null>(),
    /**
     * Email delivery: platform = Superadmin Brevo; own = merchant SMTP/Brevo.
     * Default platform for new merchants; existing merchants with own SMTP/Brevo stay on own.
     */
    emailDeliveryMode: varchar("email_delivery_mode", { length: 20 })
      .default("platform")
      .notNull(),
    /**
     * Marketing automation:
     * { reorderReminderEnabled, reorderReminderDays, reorderReminderSubject, reorderReminderBody }
     */
    marketingSettings: json("marketing_settings").$type<MarketingSettings | null>(),
    /**
     * Overview / EOD report email delivery:
     * { language, sendEveryDay, sendEveryMonth, emails, lastSentDailyDate, lastSentMonthlyKey }
     */
    reportEmailSettings: json("report_email_settings").$type<ReportEmailSettings | null>(),
    /**
     * POS / WebPOS receipt + kitchen + printer profiles:
     * { receiptHeader, receiptFooter, kitchenTicketHeader/Footer, paperWidthMm,
     *   receiptLanguage, receiptShowVatTable/StaffLine/QrCode, receiptLogoUrl,
     *   autoPrintReceipt, autoPrintKitchen, printers: PosPrinterProfile[] }
     */
    posPrintSettings: json("pos_print_settings").$type<PosPrintSettings | null>(),
    /**
     * Table QR stand defaults for dashboard downloads:
     * { headerText, subtitleText, layoutTemplate: vertical | horizontal | curved }
     */
    tableQrSettings: json("table_qr_settings").$type<TableQrSettings | null>(),
    /**
     * Shared WebPOS / Android checkout behaviour:
     * tips, discount presets, rounding, quick-cash denominations, split bills.
     */
    posCheckoutSettings: json("pos_checkout_settings").$type<Record<string, unknown> | null>(),
    /**
     * Just Eat / Uber Eats credentials + toggles:
     * { justEat: { enabled, testMode, storeId, apiKey, webhookSecret, autoAccept }, uberEats: { ... } }
     */
    deliveryPlatformSettings: json("delivery_platform_settings").$type<Record<string, unknown> | null>(),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, suspended, trial, expired
    /** Incremented to invalidate all merchant/staff JWTs and force re-login. */
    authEpoch: integer("auth_epoch").default(0).notNull(),
    subscriptionPlan: varchar("subscription_plan", { length: 50 }).default("free"), // free, starter, professional, enterprise
    trialEndsAt: timestamp("trial_ends_at"),
    subscriptionEndsAt: timestamp("subscription_ends_at"),
    /** Active billing interval for auto-renewal */
    subscriptionBillingCycle: varchar("subscription_billing_cycle", { length: 20 }),
    /** Adyen Checkout recurringDetailReference for platform subscription renewals */
    adyenRecurringDetailReference: varchar("adyen_recurring_detail_reference", { length: 255 }),
    /** Owning reseller/agency (null = legacy unassigned) */
    resellerId: uuid("reseller_id").references(() => resellers.id, { onDelete: "set null" }),
    /** Assigned POS edition / feature pack (null = legacy full access) */
    editionId: uuid("edition_id").references(() => editions.id, { onDelete: "set null" }),
    /** Locked vertical: retail shop vs restaurant / food service. */
    businessCategory: varchar("business_category", { length: 20 }),
    /** Reseller/agency billing flag — paid plan assigned by superadmin or owning reseller */
    planBillingPaid: boolean("plan_billing_paid").default(true).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    /** Set when merchant chooses a password (invite accepted or admin set one) */
    passwordSetAt: timestamp("password_set_at"),
    /** SHA-256 of one-time invite / password-setup token */
    inviteTokenHash: varchar("invite_token_hash", { length: 64 }),
    inviteTokenExpiresAt: timestamp("invite_token_expires_at"),
    inviteSentAt: timestamp("invite_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("merchants_email_idx").on(table.email),
    statusIdx: index("merchants_status_idx").on(table.status),
    slugIdx: uniqueIndex("merchants_slug_idx").on(table.slug),
    subdomainIdx: uniqueIndex("merchants_subdomain_idx").on(table.subdomain),
    customDomainIdx: uniqueIndex("merchants_custom_domain_idx").on(table.customDomain),
    syncApiKeyIdx: uniqueIndex("merchants_sync_api_key_idx").on(table.syncApiKey),
    inviteTokenIdx: index("merchants_invite_token_hash_idx").on(table.inviteTokenHash),
    resellerIdx: index("merchants_reseller_idx").on(table.resellerId),
    editionIdx: index("merchants_edition_idx").on(table.editionId),
  })
);

// ============================================================================
// MERCHANT STAFF & ROLES (panel + POS / WebPOS)
// ============================================================================

export const merchantRoles = pgTable(
  "merchant_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    /** Comma-separated permission keys (see backend/src/lib/permissions.ts) */
    permissions: text("permissions").notNull().default(""),
    isSystem: boolean("is_system").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantNameIdx: uniqueIndex("merchant_roles_merchant_name_idx").on(table.merchantId, table.name),
    merchantIdIdx: index("merchant_roles_merchant_id_idx").on(table.merchantId),
  })
);

export const merchantStaff = pgTable(
  "merchant_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => merchantRoles.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    pinHash: varchar("pin_hash", { length: 255 }),
    /** Plain PIN digits for merchant admin display (POS quick-login codes). */
    pinDisplay: varchar("pin_display", { length: 8 }),
    passwordHash: varchar("password_hash", { length: 255 }),
    /** Can sign in to merchant backend panel (email + password) */
    canAccessPanel: boolean("can_access_panel").default(false).notNull(),
    /** After email login: panel (backend), pos (register), or auto (from permissions). */
    loginHome: varchar("login_home", { length: 20 }).default("auto").notNull(),
    /** Adyen POI terminal id preferred by this staff member on WebPOS/waiter. */
    preferredTerminalId: varchar("preferred_terminal_id", { length: 255 }),
    /** Optional override for delivery driver hourly wage (CHF/h). */
    deliveryHourlyRateOverride: decimal("delivery_hourly_rate_override", { precision: 10, scale: 2 }),
    /** Optional override for per-delivery fee (CHF). */
    deliveryPerOrderFeeOverride: decimal("delivery_per_order_fee_override", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("merchant_staff_merchant_id_idx").on(table.merchantId),
    merchantEmailIdx: uniqueIndex("merchant_staff_merchant_email_idx").on(table.merchantId, table.email),
  })
);

// ============================================================================
// LOCATIONS (multi-branch under one merchant account)
// ============================================================================

export type LocationSettings = Record<string, unknown> | null;

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    /** retail | restaurant */
    businessCategory: varchar("business_category", { length: 20 }).default("restaurant").notNull(),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    country: varchar("country", { length: 100 }),
    timezone: varchar("timezone", { length: 64 }).default("Europe/Zurich"),
    isDefault: boolean("is_default").default(false).notNull(),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    settings: json("settings").$type<LocationSettings>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("locations_merchant_id_idx").on(table.merchantId),
    merchantSlugIdx: uniqueIndex("locations_merchant_slug_idx").on(table.merchantId, table.slug),
    merchantDefaultIdx: index("locations_merchant_default_idx").on(table.merchantId, table.isDefault),
  })
);

/** Staff ↔ location scope. Empty rows = all locations (owner/manager default). */
export const merchantStaffLocations = pgTable(
  "merchant_staff_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => merchantStaff.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    staffLocationIdx: uniqueIndex("merchant_staff_locations_staff_location_idx").on(
      table.staffId,
      table.locationId
    ),
    merchantStaffIdx: index("merchant_staff_locations_merchant_staff_idx").on(
      table.merchantId,
      table.staffId
    ),
  })
);

/** HQ master catalog snapshot (OrderPin-style push to locations). */
export const hqCatalogVersions = pgTable(
  "hq_catalog_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    name: varchar("name", { length: 255 }).default("HQ Menu").notNull(),
    payloadJson: json("payload_json").$type<Record<string, unknown>>().default({}).notNull(),
    createdByStaffId: uuid("created_by_staff_id").references(() => merchantStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("hq_catalog_versions_merchant_idx").on(table.merchantId, table.createdAt),
  })
);

export const locationCatalogLinks = pgTable(
  "location_catalog_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    hqProductId: uuid("hq_product_id").notNull(),
    localProductId: uuid("local_product_id").references(() => products.id, { onDelete: "set null" }),
    syncStatus: varchar("sync_status", { length: 30 }).default("synced").notNull(),
    overridesJson: json("overrides_json").$type<Record<string, unknown>>().default({}).notNull(),
    fromHqVersionId: uuid("from_hq_version_id").references(() => hqCatalogVersions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    locHqProductIdx: uniqueIndex("location_catalog_links_loc_hq_product_idx").on(
      table.locationId,
      table.hqProductId
    ),
    merchantLocationIdx: index("location_catalog_links_merchant_location_idx").on(
      table.merchantId,
      table.locationId
    ),
  })
);

/** Per-location product price/visibility overrides. */
export const locationProductOverrides = pgTable(
  "location_product_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    priceOverride: decimal("price_override", { precision: 10, scale: 2 }),
    visibility: json("visibility").$type<{ channels: string[] } | null>(),
    isAvailable: boolean("is_available"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    locProductIdx: uniqueIndex("location_product_overrides_loc_product_idx").on(
      table.locationId,
      table.productId
    ),
  })
);

export const pricingBulkJobs = pgTable(
  "pricing_bulk_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationIds: json("location_ids").$type<string[]>().default([]).notNull(),
    categoryIds: json("category_ids").$type<string[]>().default([]).notNull(),
    productIds: json("product_ids").$type<string[]>().default([]).notNull(),
    operation: varchar("operation", { length: 20 }).notNull(),
    valueType: varchar("value_type", { length: 20 }).notNull(),
    value: decimal("value", { precision: 12, scale: 4 }).notNull(),
    roundTo: decimal("round_to", { precision: 6, scale: 4 }),
    affectedCount: integer("affected_count").default(0).notNull(),
    createdByStaffId: uuid("created_by_staff_id").references(() => merchantStaff.id, {
      onDelete: "set null",
    }),
    createdByName: varchar("created_by_name", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("pricing_bulk_jobs_merchant_idx").on(table.merchantId, table.createdAt),
  })
);

/** HQ time-based menus — breakfast/lunch windows per location + channel. */
export const hqMenus = pgTable(
  "hq_menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    channels: json("channels").$type<string[]>().default(["pos", "shop", "qr_table"]).notNull(),
    daysOfWeek: json("days_of_week").$type<number[]>().default([0, 1, 2, 3, 4, 5, 6]).notNull(),
    timeStart: varchar("time_start", { length: 5 }).default("00:00").notNull(),
    timeEnd: varchar("time_end", { length: 5 }).default("23:59").notNull(),
    locationIds: json("location_ids").$type<string[]>().default([]).notNull(),
    hqVersionId: uuid("hq_version_id").references(() => hqCatalogVersions.id, {
      onDelete: "set null",
    }),
    productIds: json("product_ids").$type<string[]>().default([]).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("hq_menus_merchant_idx").on(table.merchantId, table.sortOrder),
  })
);

// ============================================================================
// SUBSCRIPTION PLANS (platform SaaS tiers)
// ============================================================================

export type PackageIncludedAddons = {
  inventory?: boolean;
  signage?: boolean;
  kds?: boolean;
  ods?: boolean;
  kiosk?: boolean;
  signageScreenLimit?: number;
};

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** platform = superadmin; reseller = agency-owned package */
    ownerType: varchar("owner_type", { length: 20 }).default("platform").notNull(),
    ownerId: uuid("owner_id"),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),
    description: text("description"),
    priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
    priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    /** Linked POS version — features applied on subscribe */
    editionId: uuid("edition_id").references(() => editions.id, { onDelete: "set null" }),
    maxDevices: integer("max_devices").notNull().default(1),
    maxProducts: integer("max_products"),
    /** Max concurrent main POS stations. 0 = unlimited. */
    maxPosPosts: integer("max_pos_posts").default(0).notNull(),
    /** Max concurrent waiter stations. 0 = unlimited. */
    maxWaiterPosts: integer("max_waiter_posts").default(0).notNull(),
    /** Max staff accounts. 0 = unlimited. */
    maxStaff: integer("max_staff").default(0).notNull(),
    /** Max shop/branch locations. 0 = unlimited. */
    maxLocations: integer("max_locations").default(1).notNull(),
    /** Addons bundled in this package */
    includedAddons: json("included_addons").$type<PackageIncludedAddons>().default({}),
    features: json("features").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    /** Visible for merchants to purchase in their panel */
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    trialDays: integer("trial_days").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("subscription_plans_slug_idx").on(table.slug),
    activeIdx: index("subscription_plans_active_idx").on(table.isActive),
    ownerIdx: index("subscription_plans_owner_idx").on(table.ownerType, table.ownerId),
    editionIdx: index("subscription_plans_edition_idx").on(table.editionId),
  })
);

/** Purchasable add-ons (inventory, signage, extra POS posts, etc.) */
export const subscriptionAddons = pgTable(
  "subscription_addons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: varchar("owner_type", { length: 20 }).default("platform").notNull(),
    ownerId: uuid("owner_id"),
    slug: varchar("slug", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    /** inventory | signage | kds | ods | extra_pos_post | extra_waiter_post | extra_staff | extra_location */
    addonKey: varchar("addon_key", { length: 40 }).notNull(),
    priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
    priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    /** Quantity bump for limit-style addons (e.g. +1 POS post, +2 signage screens) */
    quantity: integer("quantity").default(1).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugOwnerIdx: uniqueIndex("subscription_addons_slug_owner_idx").on(
      table.slug,
      table.ownerType,
      table.ownerId
    ),
    activeIdx: index("subscription_addons_active_idx").on(table.isActive),
    ownerIdx: index("subscription_addons_owner_idx").on(table.ownerType, table.ownerId),
  })
);

/** Active merchant add-on subscriptions */
export const merchantAddonSubscriptions = pgTable(
  "merchant_addon_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => subscriptionAddons.id, { onDelete: "restrict" }),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("merchant_addon_subscriptions_merchant_idx").on(table.merchantId),
    addonIdx: index("merchant_addon_subscriptions_addon_idx").on(table.addonId),
    statusIdx: index("merchant_addon_subscriptions_status_idx").on(table.status),
  })
);

/** Add-on payment records (Adyen checkout) */
export const subscriptionAddonPayments = pgTable(
  "subscription_addon_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    addonId: uuid("addon_id")
      .notNull()
      .references(() => subscriptionAddons.id, { onDelete: "restrict" }),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    adyenSessionId: varchar("adyen_session_id", { length: 255 }),
    adyenPspReference: varchar("adyen_psp_reference", { length: 255 }),
    adyenRecurringDetailReference: varchar("adyen_recurring_detail_reference", { length: 255 }),
    isRecurring: boolean("is_recurring").default(false).notNull(),
    adyenResultCode: varchar("adyen_result_code", { length: 50 }),
    paidAt: timestamp("paid_at"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("subscription_addon_payments_merchant_id_idx").on(table.merchantId),
    addonIdIdx: index("subscription_addon_payments_addon_id_idx").on(table.addonId),
    statusIdx: index("subscription_addon_payments_status_idx").on(table.status),
    sessionIdx: index("subscription_addon_payments_session_idx").on(table.adyenSessionId),
  })
);

/** Platform-wide key/value settings (e.g. platform Swisspayout credentials) */
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** One-time password reset tokens for superadmin / reseller / merchant / staff. */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    accountId: uuid("account_id").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    emailIdx: index("password_reset_tokens_email_idx").on(table.email),
    expiresIdx: index("password_reset_tokens_expires_idx").on(table.expiresAt),
  })
);

/** Merchant subscription purchases paid to the platform Adyen account */
export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(), // monthly | yearly
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    status: varchar("status", { length: 30 }).notNull().default("pending"), // pending | paid | failed | cancelled
    adyenSessionId: varchar("adyen_session_id", { length: 255 }),
    adyenPspReference: varchar("adyen_psp_reference", { length: 255 }),
    adyenRecurringDetailReference: varchar("adyen_recurring_detail_reference", { length: 255 }),
    isRecurring: boolean("is_recurring").default(false).notNull(),
    adyenResultCode: varchar("adyen_result_code", { length: 50 }),
    paidAt: timestamp("paid_at"),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("subscription_payments_merchant_id_idx").on(table.merchantId),
    planIdIdx: index("subscription_payments_plan_id_idx").on(table.planId),
    statusIdx: index("subscription_payments_status_idx").on(table.status),
    sessionIdx: index("subscription_payments_session_idx").on(table.adyenSessionId),
  })
);

// ============================================================================
// DEVICES
// ============================================================================

export const devices = pgTable(
  "devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 255 }).notNull().unique(), // POS-{MERCHANT_ID}-{UUID}-{TIMESTAMP}
    deviceName: varchar("device_name", { length: 255 }).notNull(),
    deviceType: varchar("device_type", { length: 50 }).notNull(), // mobile, tablet, terminal
    osVersion: varchar("os_version", { length: 50 }),
    appVersion: varchar("app_version", { length: 50 }),
    lastSync: timestamp("last_sync"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("devices_merchant_id_idx").on(table.merchantId),
    deviceIdIdx: uniqueIndex("devices_device_id_idx").on(table.deviceId),
  })
);

// ============================================================================
// LICENSING SYSTEM
// ============================================================================

export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "cascade" }),
    licenseKey: varchar("license_key", { length: 255 }).notNull().unique(), // M123ABC-D456EFG-7K9M2P-2025
    licenseType: varchar("license_type", { length: 50 }).notNull(), // trial, yearly, custom
    trialDays: integer("trial_days").default(7),
    startsAt: timestamp("starts_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    renewalNotifiedAt: timestamp("renewal_notified_at"),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, expired, suspended
    /** When set, this seat was issued from a reseller's license pool */
    issuedByResellerId: uuid("issued_by_reseller_id").references(() => resellers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("licenses_merchant_id_idx").on(table.merchantId),
    deviceIdIdx: index("licenses_device_id_idx").on(table.deviceId),
    licenseKeyIdx: uniqueIndex("licenses_license_key_idx").on(table.licenseKey),
    statusIdx: index("licenses_status_idx").on(table.status),
    expiresAtIdx: index("licenses_expires_at_idx").on(table.expiresAt),
    issuedByResellerIdx: index("licenses_issued_by_reseller_idx").on(table.issuedByResellerId),
  })
);

// ============================================================================
// LICENSE TRANSACTIONS
// ============================================================================

export const licenseTransactions = pgTable(
  "license_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // purchase, renewal, upgrade
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    paymentStatus: varchar("payment_status", { length: 50 }).notNull(), // pending, completed, failed
    paymentMethod: varchar("payment_method", { length: 50 }), // card, bank_transfer
    paymentId: varchar("payment_id", { length: 255 }),
    invoiceNumber: varchar("invoice_number", { length: 255 }).unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("license_transactions_merchant_id_idx").on(table.merchantId),
    paymentStatusIdx: index("license_transactions_payment_status_idx").on(table.paymentStatus),
  })
);

// ============================================================================
// VAT SETTINGS
// ============================================================================

export const vatSettings = pgTable(
  "vat_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    country: varchar("country", { length: 100 }).notNull(),
    vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull(),
    taxId: varchar("tax_id", { length: 255 }),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("vat_settings_merchant_id_idx").on(table.merchantId),
  })
);

// ============================================================================
// PRODUCTS & CATEGORIES
// ============================================================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }), // hex color
    imageUrl: varchar("image_url", { length: 500 }),
    /** Special shelf for promotional / offer products */
    isOffersCategory: boolean("is_offers_category").default(false).notNull(),
    /** Per-channel visibility: { channels: ['pos','shop','qr_table','delivery','kiosk'] } */
    visibility: json("visibility")
      .$type<{ channels: string[] }>()
      .default({ channels: ["pos", "shop", "qr_table", "delivery", "kiosk"] })
      .notNull(),
    /** When category_pricing_enabled on merchant, apply extra_delivery_price on delivery orders */
    deliveryPricingEnabled: boolean("delivery_pricing_enabled").default(false).notNull(),
    extraDeliveryPrice: decimal("extra_delivery_price", { precision: 10, scale: 2 }).default("0"),
    sortOrder: integer("sort_order").default(0).notNull(),
    clientId: varchar("client_id", { length: 64 }), // offline sync id from POS device
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("categories_merchant_id_idx").on(table.merchantId),
    clientIdIdx: index("categories_client_id_idx").on(table.clientId),
  })
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 255 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    cost: decimal("cost", { precision: 10, scale: 2 }),
    stock: integer("stock").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(5),
    isTaxable: boolean("is_taxable").default(true).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 500 }),
    // Offline-first retail POS extensions
    productType: varchar("product_type", { length: 50 }).default("standard").notNull(), // standard | open_price | weighed | combo | modifier
    isOpenPrice: boolean("is_open_price").default(false).notNull(),
    soldByWeight: boolean("sold_by_weight").default(false).notNull(),
    weightUnit: varchar("weight_unit", { length: 10 }).default("kg"), // kg | g | lb
    // [{ minQty: 10, price: 2.5 }, ...]
    bulkPricing: json("bulk_pricing").$type<Array<{ minQty: number; price: number }>>().default([]),
    // [{ id, name, price }] legacy flat extras (kept for POS sync; prefer modifier groups)
    extras: json("extras").$type<Array<{ id: string; name: string; price: number }>>().default([]),
    // Combo slots: [{ id, name, minPick, maxPick, options: [{ productId, extraPrice? }] }]
    // Legacy fixed components also supported: [{ productId, quantity, name? }]
    comboItems: json("combo_items")
      .$type<
        Array<{
          id?: string;
          name?: string;
          minPick?: number;
          maxPick?: number;
          options?: Array<{ productId: string; extraPrice?: number }>;
          productId?: string;
          quantity?: number;
        }>
      >()
      .default([]),
    // [{ id, name, price, saleStatus, isDefault, sortOrder }] size/spec variants
    specifications: json("specifications")
      .$type<
        Array<{
          id: string;
          name: string;
          price: number;
          saleStatus?: "in_stock" | "out_of_stock";
          isDefault?: boolean;
          sortOrder?: number;
        }>
      >()
      .default([]),
    buttonColor: varchar("button_color", { length: 20 }), // POS button color hex
    allowExtras: boolean("allow_extras").default(false).notNull(),
    /** If set (>0), customer can claim this product free by spending this many loyalty points */
    loyaltyRewardPoints: integer("loyalty_reward_points"),
    /** Portions this recipe produces. Sale consumes line qty / yield (default 1). */
    recipeYield: decimal("recipe_yield", { precision: 12, scale: 4 }).default("1").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    clientId: varchar("client_id", { length: 64 }), // offline sync id from POS device
    isActive: boolean("is_active").default(true).notNull(),
    /** Per-channel visibility: { channels: ['pos','shop','qr_table','delivery','kiosk'] } */
    visibility: json("visibility")
      .$type<{ channels: string[] }>()
      .default({ channels: ["pos", "shop", "qr_table", "delivery", "kiosk"] })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("products_merchant_id_idx").on(table.merchantId),
    barcodeIdx: index("products_barcode_idx").on(table.barcode),
    barcodeUniqueIdx: uniqueIndex("products_merchant_barcode_uidx")
      .on(table.merchantId, table.barcode)
      .where(sql`${table.barcode} IS NOT NULL`),
    clientIdIdx: index("products_client_id_idx").on(table.clientId),
    typeIdx: index("products_type_idx").on(table.productType),
    sortOrderIdx: index("products_sort_order_idx").on(table.merchantId, table.sortOrder),
  })
);

// ============================================================================
// MODIFIER GROUPS (extras / add-ons)
// ============================================================================

export const modifierGroups = pgTable(
  "modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    // free | fixed | toppings_by_size
    pricingType: varchar("pricing_type", { length: 40 }).default("fixed").notNull(),
    // optional | required
    selectionType: varchar("selection_type", { length: 40 }).default("optional").notNull(),
    minSelectable: integer("min_selectable").default(0).notNull(),
    maxSelectable: integer("max_selectable").default(1).notNull(),
    defaultCollapsed: boolean("default_collapsed").default(false).notNull(),
    allowMultipleSameItem: boolean("allow_multiple_same_item").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("modifier_groups_merchant_id_idx").on(table.merchantId),
  })
);

export const modifierOptions = pgTable(
  "modifier_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).default("0").notNull(),
    // in_stock | out_of_stock
    saleStatus: varchar("sale_status", { length: 40 }).default("in_stock").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    /** Optional ingredient consumed when this extra is selected on a paid sale. */
    inventoryItemId: uuid("inventory_item_id"),
    inventoryQty: decimal("inventory_qty", { precision: 14, scale: 4 }).default("0").notNull(),
    imageUrl: varchar("image_url", { length: 2048 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupIdIdx: index("modifier_options_group_id_idx").on(table.groupId),
    inventoryItemIdx: index("modifier_options_inventory_item_idx").on(table.inventoryItemId),
  })
);

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("product_modifier_groups_product_id_idx").on(table.productId),
    groupIdIdx: index("product_modifier_groups_group_id_idx").on(table.groupId),
    uniqueLink: uniqueIndex("product_modifier_groups_unique").on(table.productId, table.groupId),
  })
);

// ============================================================================
// CUSTOMERS
// ============================================================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    passwordHash: varchar("password_hash", { length: 255 }), // null = guest-only profile
    defaultAddress: text("default_address"),
    defaultZip: varchar("default_zip", { length: 20 }),
    defaultCity: varchar("default_city", { length: 100 }),
    loyaltyPoints: integer("loyalty_points").default(0),
    totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
    /** Opt-in for newsletters / marketing (default true when email known from orders) */
    marketingOptIn: boolean("marketing_opt_in").default(true).notNull(),
    /** Denormalized last paid/completed web or POS order time */
    lastOrderAt: timestamp("last_order_at"),
    /** Last automatic reorder-reminder email sent */
    lastReorderReminderAt: timestamp("last_reorder_reminder_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("customers_merchant_id_idx").on(table.merchantId),
    emailIdx: index("customers_email_idx").on(table.email),
    lastOrderIdx: index("customers_last_order_idx").on(table.merchantId, table.lastOrderAt),
  })
);

/** Saved delivery addresses for logged-in shop customers (Home, Office, …). */
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** home | office | other | free-text label */
    label: varchar("label", { length: 40 }).notNull().default("home"),
    address: text("address").notNull(),
    zipCode: varchar("zip_code", { length: 20 }),
    city: varchar("city", { length: 100 }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("customer_addresses_customer_idx").on(table.customerId),
    merchantCustomerIdx: index("customer_addresses_merchant_customer_idx").on(
      table.merchantId,
      table.customerId
    ),
  })
);

// ============================================================================
// ORDERS
// ============================================================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** Branch where the sale occurred (nullable for legacy rows). */
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    orderNumber: varchar("order_number", { length: 50 }).notNull().unique(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    orderType: varchar("order_type", { length: 50 }).notNull(), // pos, web_shop
    /** online_shop | justeat | ubereats — ordering channel (POS filter / labels) */
    orderSource: varchar("order_source", { length: 50 }),
    /** Aggregator external id for dedupe + status sync */
    externalOrderId: varchar("external_order_id", { length: 255 }),
    // takeaway | dine_in | delivery — drives channel tax rate
    fulfillmentChannel: varchar("fulfillment_channel", { length: 50 }).default("takeaway"),
    // web_shop lifecycle: pending_approval → accepted|preparing → ready → out_for_delivery? → completed | cancelled
    // legacy: pending (treated as pending_approval), completed, cancelled
    status: varchar("status", { length: 50 }).default("pending").notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0"),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
    tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0"),
    /** Cash rounding adjustment applied at checkout (can be negative) */
    roundingAmount: decimal("rounding_amount", { precision: 10, scale: 2 }).default("0"),
    amountTendered: decimal("amount_tendered", { precision: 10, scale: 2 }),
    changeDue: decimal("change_due", { precision: 10, scale: 2 }),
    /** Staff who completed the POS / WebPOS sale */
    staffName: varchar("staff_name", { length: 255 }),
    /** Stable staff id for own-sales EOD / reports (nullable for legacy rows) */
    staffId: uuid("staff_id").references(() => merchantStaff.id, { onDelete: "set null" }),
    /** Online card surcharge charged to the customer */
    cardFee: decimal("card_fee", { precision: 10, scale: 2 }).default("0"),
    /** CHF discount applied from redeeming loyalty points as money */
    pointsDiscount: decimal("points_discount", { precision: 10, scale: 2 }).default("0"),
    pointsEarned: integer("points_earned").default(0),
    pointsRedeemed: integer("points_redeemed").default(0),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }), // cash, card, terminal, loyalty, online, invoice
    paymentStatus: varchar("payment_status", { length: 50 }), // pending, awaiting_payment, completed, failed
    invoiceNumber: varchar("invoice_number", { length: 50 }),
    invoiceIssuedAt: timestamp("invoice_issued_at"),
    invoiceDueAt: timestamp("invoice_due_at"),
    adyenReference: varchar("adyen_reference", { length: 255 }),
    /** Original Adyen POI transaction timestamp (required for terminal card refunds) */
    adyenPoiTransactionTs: timestamp("adyen_poi_transaction_ts"),
    /** Serialized Adyen Terminal API CustomerReceipt JSON */
    adyenCustomerReceiptJson: text("adyen_customer_receipt_json"),
    /** Serialized Adyen Terminal API CashierReceipt JSON */
    adyenCashierReceiptJson: text("adyen_cashier_receipt_json"),
    notes: text("notes"),
    shippingAddress: text("shipping_address"),
    /** Geocoded destination for delivery map (shop checkout / assign). */
    deliveryLatitude: decimal("delivery_latitude", { precision: 10, scale: 7 }),
    deliveryLongitude: decimal("delivery_longitude", { precision: 10, scale: 7 }),
    /** Delivery driver assigned from the panel (distinct from staffId = cashier). */
    assignedDeliveryStaffId: uuid("assigned_delivery_staff_id").references(() => merchantStaff.id, {
      onDelete: "set null",
    }),
    /** Public token for guest order tracking (no login). */
    deliveryTrackingToken: varchar("delivery_tracking_token", { length: 64 }),
    deliveryZoneId: uuid("delivery_zone_id"),
    scheduledFor: timestamp("scheduled_for"), // null = ASAP
    customerName: varchar("customer_name", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 40 }),
    customerEmail: varchar("customer_email", { length: 255 }),
    // Dine-in table service
    tableId: uuid("table_id"),
    tableLabel: varchar("table_label", { length: 50 }),
    tableSessionId: uuid("table_session_id"),
    guestCount: integer("guest_count"), // PAX / covers for this check
    // Split billing: equal /N or per-seat payments
    billSplits: json("bill_splits")
      .$type<
        Array<{
          id: string;
          label: string; // "Person 1" | "Split 1/4" | "All"
          seatNumber?: number | null;
          amount: number;
          paymentMethod?: string;
          paymentStatus: string;
          paidAt?: string | null;
        }>
      >()
      .default([]),
    /** Links split-bill sibling orders (Android masterOrderId / WebPOS split checkout) */
    masterOrderId: varchar("master_order_id", { length: 64 }),
    /** 1-based split check number within a masterOrderId group */
    splitCheckNumber: integer("split_check_number"),
    clientId: varchar("client_id", { length: 64 }), // offline POS transaction id
    deviceId: varchar("device_id", { length: 255 }),
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    /** Merchant-estimated ready / pickup time (live-adjustable from Order Center) */
    estimatedReadyAt: timestamp("estimated_ready_at"),
    /** Kitchen + receipt auto-print jobs completed for this order */
    printCount: integer("print_count").default(0),
    cancelReason: text("cancel_reason"),
    cancelledAt: timestamp("cancelled_at"),
    refundAmount: decimal("refund_amount", { precision: 10, scale: 2 }).default("0"),
    refundedAt: timestamp("refunded_at"),
    /** Last refund reason (preset English or custom message) */
    refundReason: text("refund_reason"),
    /** Cumulative goodwill / unreferenced compensation (not tied to original payment cap). */
    goodwillAmount: decimal("goodwill_amount", { precision: 10, scale: 2 }).default("0"),
    /** Split tenders: [{ method, amount }] for mixed payments (gift + cash, etc.). */
    paymentBreakdown: json("payment_breakdown").$type<
      Array<{ method: string; amount: number }> | null
    >(),
  },
  (table) => ({
    merchantIdIdx: index("orders_merchant_id_idx").on(table.merchantId),
    locationIdIdx: index("orders_location_id_idx").on(table.locationId),
    orderNumberIdx: uniqueIndex("orders_order_number_idx").on(table.orderNumber),
    statusIdx: index("orders_status_idx").on(table.status),
    createdAtIdx: index("orders_created_at_idx").on(table.createdAt),
    clientIdIdx: index("orders_client_id_idx").on(table.clientId),
    tableIdIdx: index("orders_table_id_idx").on(table.tableId),
    tableSessionIdIdx: index("orders_table_session_id_idx").on(table.tableSessionId),
    masterOrderIdIdx: index("orders_master_order_id_idx").on(table.masterOrderId),
    orderSourceIdx: index("orders_merchant_order_source_idx").on(table.merchantId, table.orderSource),
    externalOrderIdx: index("orders_merchant_external_order_idx").on(
      table.merchantId,
      table.orderSource,
      table.externalOrderId
    ),
  })
);

// ============================================================================
// WEBPOS / POS HELD ORDERS (on-hold carts)
// ============================================================================

export const heldOrders = pgTable(
  "held_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }),
    status: varchar("status", { length: 40 }).default("held").notNull(), // held | sent_to_kitchen
    channel: varchar("channel", { length: 50 }).default("takeaway"),
    cartJson: json("cart_json").$type<unknown>().notNull(),
    notes: text("notes"),
    staffId: uuid("staff_id"),
    staffName: varchar("staff_name", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("held_orders_merchant_id_idx").on(table.merchantId),
    statusIdx: index("held_orders_status_idx").on(table.merchantId, table.status),
  })
);

// ============================================================================
// POS SESSION REGISTRY (concurrent station limits)
// ============================================================================

export const posSessions = pgTable(
  "pos_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
    /** main = register till; waiter = floor order entry */
    sessionKind: varchar("session_kind", { length: 20 }).default("main").notNull(),
    /** webpos | waiter_web | android */
    platform: varchar("platform", { length: 30 }).notNull(),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    deviceLabel: varchar("device_label", { length: 255 }),
    staffId: uuid("staff_id"),
    staffName: varchar("staff_name", { length: 255 }),
    /** Main till only: local Print Agent reachable on last heartbeat */
    printAgentOnline: boolean("print_agent_online"),
    lastHeartbeat: timestamp("last_heartbeat").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("pos_sessions_merchant_id_idx").on(table.merchantId),
    deviceIdx: index("pos_sessions_merchant_device_idx").on(
      table.merchantId,
      table.deviceId,
      table.sessionKind
    ),
    activeIdx: index("pos_sessions_active_idx").on(
      table.merchantId,
      table.sessionKind,
      table.lastHeartbeat
    ),
  })
);

/** Latest GPS ping per delivery driver (upserted on each location post). */
export const deliveryDriverLocations = pgTable(
  "delivery_driver_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => merchantStaff.id, { onDelete: "cascade" }),
    latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
    accuracyM: decimal("accuracy_m", { precision: 10, scale: 2 }),
    heading: decimal("heading", { precision: 6, scale: 2 }),
    speedMps: decimal("speed_mps", { precision: 8, scale: 3 }),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantStaffUnique: uniqueIndex("delivery_driver_locations_merchant_staff_uidx").on(
      table.merchantId,
      table.staffId
    ),
    merchantRecordedIdx: index("delivery_driver_locations_merchant_recorded_idx").on(
      table.merchantId,
      table.recordedAt
    ),
  })
);

/** Driver clock-in windows for hourly wage (started when GPS tracking starts). */
export const deliveryDriverShifts = pgTable(
  "delivery_driver_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => merchantStaff.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantStaffIdx: index("delivery_driver_shifts_merchant_staff_idx").on(
      table.merchantId,
      table.staffId,
      table.startedAt
    ),
  })
);

// ============================================================================
// KITCHEN DISPLAY (browser KDS)
// ============================================================================

export const kdsStations = pgTable(
  "kds_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    token: varchar("token", { length: 128 }).notNull(),
    /** Short numeric code for /kds/{code} URLs (like TV signage) */
    shortCode: varchar("short_code", { length: 8 }),
    orderTypes: json("order_types").$type<string[]>().default([]).notNull(),
    categoryIds: json("category_ids").$type<string[]>().default([]).notNull(),
    productIds: json("product_ids").$type<string[]>().default([]).notNull(),
    /** Display theme: dark | light | teal */
    theme: varchar("theme", { length: 32 }).default("dark").notNull(),
    /** Ticket layout: grid | rows | slider */
    layoutMode: varchar("layout_mode", { length: 16 }).default("grid").notNull(),
    /** Grid columns when layoutMode=grid (1–6) */
    gridColumns: integer("grid_columns").default(3).notNull(),
    /** Play alert when a pending ticket exceeds this many minutes */
    overdueMinutes: integer("overdue_minutes").default(20).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("kds_stations_merchant_id_idx").on(table.merchantId),
    tokenIdx: index("kds_stations_token_idx").on(table.token),
    shortCodeIdx: uniqueIndex("kds_stations_short_code_uidx").on(table.shortCode),
  })
);

export const KDS_THEMES = ["dark", "light", "teal"] as const;
export type KdsTheme = (typeof KDS_THEMES)[number];

export const KDS_LAYOUT_MODES = ["grid", "rows", "slider"] as const;
export type KdsLayoutMode = (typeof KDS_LAYOUT_MODES)[number];

export const kdsTickets = pgTable(
  "kds_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    ticketKey: varchar("ticket_key", { length: 255 }).notNull(),
    orderNumber: varchar("order_number", { length: 64 }),
    tableLabel: varchar("table_label", { length: 120 }),
    tabNumber: varchar("tab_number", { length: 64 }),
    channel: varchar("channel", { length: 50 }),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("kds_tickets_merchant_id_idx").on(table.merchantId),
    ticketKeyIdx: index("kds_tickets_merchant_ticket_key_idx").on(table.merchantId, table.ticketKey),
  })
);

export const kdsTicketItems = pgTable(
  "kds_ticket_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => kdsTickets.id, { onDelete: "cascade" }),
    lineId: varchar("line_id", { length: 128 }).notNull(),
    productId: uuid("product_id"),
    categoryId: uuid("category_id"),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
    lineNote: text("line_note"),
    courseNumber: integer("course_number"),
    modifiersJson: json("modifiers_json").$type<Record<string, unknown>>().default({}),
    status: varchar("status", { length: 30 }).default("pending").notNull(),
    readyAt: timestamp("ready_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index("kds_ticket_items_ticket_id_idx").on(table.ticketId),
    lineIdx: index("kds_ticket_items_line_id_idx").on(table.ticketId, table.lineId),
  })
);

export const ODS_THEMES = ["light", "teal", "dark"] as const;
export type OdsTheme = (typeof ODS_THEMES)[number];

export const odsDisplays = pgTable(
  "ods_displays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    token: varchar("token", { length: 128 }).notNull(),
    /** Short numeric code for /ods/{code} URLs (like TV signage) */
    shortCode: varchar("short_code", { length: 8 }),
    /** Customer board color theme */
    theme: varchar("theme", { length: 32 }).default("light").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("ods_displays_merchant_id_idx").on(table.merchantId),
    tokenIdx: uniqueIndex("ods_displays_token_uidx").on(table.token),
    shortCodeIdx: uniqueIndex("ods_displays_short_code_uidx").on(table.shortCode),
  })
);

export const odsOrders = pgTable(
  "ods_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderNumber: varchar("order_number", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).default("preparing").notNull(),
    readyAt: timestamp("ready_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("ods_orders_merchant_id_idx").on(table.merchantId),
    merchantOrderIdx: uniqueIndex("ods_orders_merchant_order_uidx").on(
      table.merchantId,
      table.orderNumber
    ),
  })
);

/** Staff-dismissed pickup numbers — survives clear-all and blocks live merge re-appearance. */
export const odsDismissedOrders = pgTable(
  "ods_dismissed_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderNumber: varchar("order_number", { length: 64 }).notNull(),
    dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("ods_dismissed_merchant_id_idx").on(table.merchantId),
    merchantOrderIdx: uniqueIndex("ods_dismissed_merchant_order_uidx").on(
      table.merchantId,
      table.orderNumber
    ),
  })
);

export const SIGNAGE_TEMPLATES = [
  "dark_pizza",
  "kebab_green",
  "cafe_cream",
  "portrait_poster",
  "lunch_special",
] as const;
export type SignageTemplate = (typeof SIGNAGE_TEMPLATES)[number];

export const SIGNAGE_ORIENTATIONS = ["landscape", "portrait"] as const;
export type SignageOrientation = (typeof SIGNAGE_ORIENTATIONS)[number];

export const SIGNAGE_SLIDE_TYPES = ["menu", "image", "image_text"] as const;
export type SignageSlideType = (typeof SIGNAGE_SLIDE_TYPES)[number];

/** One day/time window inside a multi-window playlist schedule (Europe/Zurich). */
export type SignageScheduleWindow = {
  label?: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
};

/** Playlist schedule: always on, selected weekdays, daypart, or multiple windows. */
export type SignageSchedule = {
  type: "always" | "weekdays" | "daypart" | "windows";
  weekdays?: number[];
  daypart?: "lunch" | "dinner";
  startTime?: string;
  endTime?: string;
  windows?: SignageScheduleWindow[];
};

export const signagePlaylists = pgTable(
  "signage_playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    template: varchar("template", { length: 40 }).default("dark_pizza").notNull(),
    schedule: json("schedule").$type<SignageSchedule>().default({ type: "always" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("signage_playlists_merchant_id_idx").on(table.merchantId),
  })
);

export const signageScreens = pgTable(
  "signage_screens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    token: varchar("token", { length: 128 }).notNull(),
    /** Short public code for TV URL (4–6 digits), e.g. /tv/48291 */
    shortCode: varchar("short_code", { length: 8 }),
    orientation: varchar("orientation", { length: 20 }).default("landscape").notNull(),
    template: varchar("template", { length: 40 }).default("dark_pizza").notNull(),
    /** Physical screen diagonal in inches (preview sizing) */
    screenSizeIn: integer("screen_size_in").default(32).notNull(),
    playlistId: uuid("playlist_id").references(() => signagePlaylists.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("signage_screens_merchant_id_idx").on(table.merchantId),
    tokenIdx: uniqueIndex("signage_screens_token_uidx").on(table.token),
    shortCodeIdx: uniqueIndex("signage_screens_short_code_uidx").on(table.shortCode),
  })
);

export const signageSlides = pgTable(
  "signage_slides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => signagePlaylists.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).default("menu").notNull(),
    durationSec: integer("duration_sec").default(10).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    categoryIds: json("category_ids").$type<string[]>().default([]).notNull(),
    headline: varchar("headline", { length: 255 }),
    body: text("body"),
    imageUrl: varchar("image_url", { length: 500 }),
    showPrices: boolean("show_prices").default(true).notNull(),
    showPhotos: boolean("show_photos").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    playlistIdx: index("signage_slides_playlist_id_idx").on(table.playlistId),
  })
);

// ============================================================================
// ORDER ITEMS
// ============================================================================

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: varchar("product_name", { length: 255 }),
    quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(), // supports weighed qty
    unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
    taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
    weightKg: decimal("weight_kg", { precision: 12, scale: 3 }),
    selectedExtras: json("selected_extras").$type<Array<{ id: string; name: string; price: number }>>().default([]),
    // Combo meal picks: [{ slotId, slotName, productId, productName, extraPrice, selectedExtras }]
    comboSelections: json("combo_selections")
      .$type<
        Array<{
          slotId: string;
          slotName: string;
          productId: string;
          productName: string;
          extraPrice: number;
          selectedExtras?: Array<{ id: string; name: string; price: number }>;
        }>
      >()
      .default([]),
    isOpenPrice: boolean("is_open_price").default(false).notNull(),
    // 1-based seat / person index when pax ordering is on (kitchen: "Person 1")
    seatNumber: integer("seat_number"),
    /** Cumulative quantity refunded on this line (partial item refunds). */
    refundedQuantity: decimal("refunded_quantity", { precision: 12, scale: 3 }).default("0"),
  },
  (table) => ({
    orderIdIdx: index("order_items_order_id_idx").on(table.orderId),
  })
);

// ============================================================================
// ORDER REFUNDS (partial + full history per ticket)
// ============================================================================

export const orderRefunds = pgTable(
  "order_refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** referenced = capped by order total; goodwill = unreferenced compensation */
    kind: varchar("kind", { length: 20 }).default("referenced").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    reason: text("reason"),
    staffId: uuid("staff_id"),
    staffName: varchar("staff_name", { length: 255 }),
    /** [{ orderItemId, productName, quantity }] when item-level refund */
    itemsJson: json("items_json").$type<
      Array<{ orderItemId: string; productName?: string; quantity: number }> | null
    >(),
    /** Gift-first refund allocation { giftCard, cash, terminal, other } */
    allocationJson: json("allocation_json").$type<{
      giftCard?: number;
      cash?: number;
      terminal?: number;
      other?: number;
    } | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("order_refunds_merchant_id_idx").on(table.merchantId),
    orderIdx: index("order_refunds_order_id_idx").on(table.orderId),
    createdIdx: index("order_refunds_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// FLOOR PLANS & DINING TABLES
// ============================================================================

export const floorPlans = pgTable(
  "floor_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    canvasWidth: integer("canvas_width").default(1000).notNull(),
    canvasHeight: integer("canvas_height").default(700).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    /** Walls, doors, bar counters — [{ id, elementType, posX, posY, width, height, rotation }] */
    elementsJson: json("elements_json").$type<
      Array<{
        id: string;
        elementType: string;
        posX: number;
        posY: number;
        width: number;
        height: number;
        rotation?: number;
      }> | null
    >(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("floor_plans_merchant_id_idx").on(table.merchantId),
  })
);

export const diningTables = pgTable(
  "dining_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    floorPlanId: uuid("floor_plan_id")
      .notNull()
      .references(() => floorPlans.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 50 }).notNull(), // T1, Bar-2, …
    capacity: integer("capacity").default(2).notNull(), // max PAX
    shape: varchar("shape", { length: 20 }).default("rect").notNull(), // rect | round
    posX: integer("pos_x").default(40).notNull(),
    posY: integer("pos_y").default(40).notNull(),
    width: integer("width").default(100).notNull(),
    height: integer("height").default(80).notNull(),
    rotation: integer("rotation").default(0).notNull(),
    // available | occupied | reserved | dirty
    status: varchar("status", { length: 30 }).default("available").notNull(),
    currentOrderId: uuid("current_order_id"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("dining_tables_merchant_id_idx").on(table.merchantId),
    floorPlanIdIdx: index("dining_tables_floor_plan_id_idx").on(table.floorPlanId),
  })
);

/** Optional static / temporary QR payloads per table (default QR uses table UUID). */
export const tableQrCodes = pgTable(
  "table_qr_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => diningTables.id, { onDelete: "cascade" }),
    /** static | temporary */
    codeType: varchar("code_type", { length: 20 }).notNull().default("static"),
    /** QR payload string (CHASLAY:T:… or shop URL) */
    code: varchar("code", { length: 512 }).notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("table_qr_codes_merchant_id_idx").on(table.merchantId),
    tableIdIdx: index("table_qr_codes_table_id_idx").on(table.tableId),
  })
);

/** Dine-in QR ordering session — one open session per table at a time. */
export const tableSessions = pgTable(
  "table_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    tableId: uuid("table_id")
      .notNull()
      .references(() => diningTables.id, { onDelete: "cascade" }),
    sessionToken: varchar("session_token", { length: 64 }).notNull(),
    /** open | closed | paid */
    status: varchar("status", { length: 30 }).notNull().default("open"),
    guestCount: integer("guest_count"),
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => ({
    merchantIdIdx: index("table_sessions_merchant_id_idx").on(table.merchantId),
    tableIdIdx: index("table_sessions_table_id_idx").on(table.tableId),
    tokenUnique: uniqueIndex("table_sessions_token_uidx").on(table.sessionToken),
    merchantTableOpenIdx: index("table_sessions_merchant_table_status_idx").on(
      table.merchantId,
      table.tableId,
      table.status
    ),
  })
);

// ============================================================================
// RESTAURANT RESERVATIONS
// ============================================================================

export type ReservationSettings = {
  /** Use takeaway weekly hours for booking slots, or custom dine_in hours */
  dineInHoursMode?: "same_as_takeaway" | "custom";
  /** Minutes between bookable start times (15 / 30 / 60) */
  slotIntervalMinutes?: number;
  /** Expected seating length used for overlap / capacity */
  seatingDurationMinutes?: number;
  /** Extra gap after a reservation before the next can start on shared capacity */
  bufferMinutes?: number;
  minPartySize?: number;
  maxPartySize?: number;
  /** Guest must book at least this many hours before the slot */
  minHoursBefore?: number;
  /** How far ahead guests can book (days) */
  maxDaysAhead?: number;
  /** If true, new web bookings become confirmed immediately */
  autoAccept?: boolean;
  /** Print a till ticket for reservations (default true). */
  autoPrintReservations?: boolean;
  sendConfirmationEmail?: boolean;
  sendStatusEmails?: boolean;
  /** Soft capacity per slot (covers). Null/0 = sum of table seats or unlimited */
  maxCoversPerSlot?: number | null;
  policiesText?: string | null;
  /** Email reminder before the reservation (hours ahead) */
  reminderEnabled?: boolean;
  reminderHoursBefore?: number;
  sendReminderEmail?: boolean;
  /**
   * Off-peak / happy-hour discounts shown on bookable slots.
   * scheduleMode: specific_days = only daysOfWeek; whole_week = every day.
   * Empty timeStart/timeEnd = all open hours that day.
   */
  slotDiscounts?: Array<{
    id: string;
    name: string;
    percentOff: number;
    scheduleMode?: "specific_days" | "whole_week";
    daysOfWeek?: string[]; // mon..sun
    timeStart?: string | null; // HH:mm
    timeEnd?: string | null;
    enabled?: boolean;
  }>;
  /** Email merchant account on new / updated reservations (default true) */
  notifyAdminEmail?: boolean;
  /** Daily 10:00 Europe/Zurich summary of today's bookings (default true) */
  dailySummaryEnabled?: boolean;
  /** Last YYYY-MM-DD (Zurich) a daily summary was sent */
  lastDailySummaryDate?: string | null;
};

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "seated"
  | "completed"
  | "cancelled"
  | "rejected"
  | "no_show";

/** Programmable holiday / vacation closure for the online shop */
export type LocalizedText = {
  en?: string | null;
  fr?: string | null;
  de?: string | null;
};

export type VacationPeriod = {
  id: string;
  /** Inclusive start date YYYY-MM-DD (Europe/Zurich calendar) */
  startDate: string;
  /** Start time HH:mm (Europe/Zurich), default 00:00 */
  startTime?: string | null;
  /** Inclusive end date YYYY-MM-DD */
  endDate: string;
  /** End time HH:mm (Europe/Zurich), default 23:59 */
  endTime?: string | null;
  /** Period label — deprecated, ignored in UI (title & message on settings are enough) */
  title?: LocalizedText | string | null;
};

export type VacationSettings = {
  /**
   * Master switch. When false, scheduled periods do not activate vacation mode.
   * Legacy `manualActive` is treated as enabled when `enabled` is absent.
   */
  enabled?: boolean;
  /** @deprecated Prefer `enabled` — kept for older saved settings */
  manualActive?: boolean;
  /** Popup image shown on homepage & shop while on vacation */
  popupImageUrl?: string | null;
  /** Editable popup title — multilingual */
  popupTitle?: LocalizedText | string | null;
  /** Optional visitor-facing message — multilingual */
  message?: LocalizedText | string | null;
  periods?: VacationPeriod[];
};

export type EmailDeliveryMode = "platform" | "own";

/** Known email categories for platform usage reporting. */
export type EmailSendType =
  | "general"
  | "newsletter"
  | "reorder_reminder"
  | "reservation_confirmation"
  | "reservation_status"
  | "reservation_admin"
  | "reservation_daily"
  | "shop_order"
  | "receipt"
  | "gift_card"
  | "inventory_reorder"
  | "report_eod"
  | "password_reset"
  | "merchant_invite"
  | "platform_shop_order"
  | "marketing_test"
  | "invoice"
  | "alert";

export type MerchantSmtpSettings = {
  enabled?: boolean;
  host?: string | null;
  port?: number | null;
  secure?: boolean;
  user?: string | null;
  /** Stored as plain text for SMTP AUTH — protect DB access */
  password?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
};

/** Per-merchant Brevo (Sendinblue) Transactional API settings + local usage counters. */
export type MerchantBrevoSettings = {
  enabled?: boolean;
  /** Brevo v3 API key (xkeysib-…) */
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  /** Soft daily cap (0 / omit = no local daily block). */
  dailyLimit?: number | null;
  /** Soft monthly cap (0 / omit = no local monthly block). */
  monthlyLimit?: number | null;
  /** Emails sent today via this merchant Brevo key (local counter). */
  dailySent?: number;
  /** YYYY-MM-DD (Europe/Zurich) for dailySent. */
  dailyPeriod?: string | null;
  /** Emails sent this month via this merchant Brevo key. */
  monthlySent?: number;
  /** YYYY-MM for monthlySent. */
  monthlyPeriod?: string | null;
};

export type MarketingSettings = {
  reorderReminderEnabled?: boolean;
  /** Days after last order before sending reminder (default 5) */
  reorderReminderDays?: number;
  reorderReminderSubject?: string | null;
  /** Plain text / simple HTML body. Placeholders: {{name}} {{shopUrl}} {{businessName}} */
  reorderReminderBody?: string | null;
};

export type ReportEmailSettings = {
  /** Report email language: en | fr | de */
  language?: "en" | "fr" | "de";
  /** Auto-send yesterday's overview at end of each day */
  sendEveryDay?: boolean;
  /** Auto-send previous calendar month on the 1st */
  sendEveryMonth?: boolean;
  /** Recipient list */
  emails?: string[];
  /** YYYY-MM-DD of last successful daily send (Zurich) */
  lastSentDailyDate?: string | null;
  /** YYYY-MM of last successful monthly send */
  lastSentMonthlyKey?: string | null;
};

export const reservations = pgTable(
  "reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    guestName: varchar("guest_name", { length: 200 }).notNull(),
    guestEmail: varchar("guest_email", { length: 255 }),
    guestPhone: varchar("guest_phone", { length: 50 }).notNull(),
    partySize: integer("party_size").notNull().default(2),
    reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    tableId: uuid("table_id").references(() => diningTables.id, { onDelete: "set null" }),
    tableLabel: varchar("table_label", { length: 50 }),
    /** Slot promotion captured at booking time (e.g. 20) */
    discountPercent: integer("discount_percent"),
    discountLabel: varchar("discount_label", { length: 80 }),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    source: varchar("source", { length: 30 }).notNull().default("web"), // web | phone | pos | dashboard
    confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    seatedAt: timestamp("seated_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    merchantReservedIdx: index("reservations_merchant_reserved_idx").on(
      table.merchantId,
      table.reservedAt
    ),
    merchantStatusIdx: index("reservations_merchant_status_idx").on(table.merchantId, table.status),
    merchantCodeUq: uniqueIndex("reservations_merchant_code_uq").on(table.merchantId, table.code),
  })
);

// ============================================================================
// CHASLAY ANDROID FLOOR SYNC (waiter ↔ main POS coordination)
// ============================================================================

export const chaslayFloorDevices = pgTable(
  "chaslay_floor_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 255 }).notNull(),
    deviceName: varchar("device_name", { length: 255 }),
    role: varchar("role", { length: 30 }).default("STANDARD").notNull(), // MAIN_POS | WAITER | STANDARD
    lanHost: varchar("lan_host", { length: 255 }),
    appVersion: varchar("app_version", { length: 50 }),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantDeviceIdx: uniqueIndex("chaslay_floor_devices_merchant_device_idx").on(
      table.merchantId,
      table.deviceId
    ),
  })
);

export const chaslayFloorTableOrders = pgTable(
  "chaslay_floor_table_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    localOrderId: varchar("local_order_id", { length: 255 }).notNull(),
    tableId: integer("table_id").default(0).notNull(),
    tableName: varchar("table_name", { length: 255 }).default("").notNull(),
    status: varchar("status", { length: 50 }).default("OPEN").notNull(),
    serviceType: varchar("service_type", { length: 50 }).default("DINE_IN").notNull(),
    userId: integer("user_id").default(0).notNull(),
    userName: varchar("user_name", { length: 255 }).default("").notNull(),
    cartJson: json("cart_json").$type<Record<string, unknown>>().default({}),
    sourceDeviceId: varchar("source_device_id", { length: 255 }).default("").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantLocalOrderIdx: uniqueIndex("chaslay_floor_orders_merchant_local_idx").on(
      table.merchantId,
      table.localOrderId
    ),
    merchantUpdatedIdx: index("chaslay_floor_orders_merchant_updated_idx").on(
      table.merchantId,
      table.updatedAt
    ),
  })
);

export const chaslayFloorPrintJobs = pgTable(
  "chaslay_floor_print_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    jobType: varchar("job_type", { length: 30 }).notNull(), // KITCHEN | RECEIPT
    status: varchar("status", { length: 30 }).default("PENDING").notNull(), // PENDING | PROCESSING | DONE | FAILED
    payload: json("payload").$type<Record<string, unknown>>().default({}),
    sourceDeviceId: varchar("source_device_id", { length: 255 }).default("").notNull(),
    targetRole: varchar("target_role", { length: 30 }).default("MAIN_POS").notNull(),
    orderId: varchar("order_id", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({
    merchantStatusIdx: index("chaslay_floor_print_jobs_merchant_status_idx").on(
      table.merchantId,
      table.status,
      table.createdAt
    ),
  })
);

// ============================================================================
// PAYMENT TERMINALS (ADYEN)
// ============================================================================

export const paymentTerminals = pgTable(
  "payment_terminals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    terminalId: varchar("terminal_id", { length: 255 }).notNull().unique(), // Swisspayout / Adyen terminal ID
    terminalName: varchar("terminal_name", { length: 255 }).notNull(),
    serialNumber: varchar("serial_number", { length: 255 }),
    // Optional per-terminal Swisspayout overrides (falls back to merchant credentials)
    adyenMerchantAccount: varchar("adyen_merchant_account", { length: 255 }),
    adyenApiKey: text("adyen_api_key"),
    adyenClientId: varchar("adyen_client_id", { length: 255 }),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, inactive, error
    lastHeartbeat: timestamp("last_heartbeat"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("payment_terminals_merchant_id_idx").on(table.merchantId),
    terminalIdIdx: uniqueIndex("payment_terminals_terminal_id_idx").on(table.terminalId),
  })
);

// ============================================================================
// RFID CARD READERS (gift / loyalty)
// ============================================================================

export const rfidReaders = pgTable(
  "rfid_readers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    readerUid: varchar("reader_uid", { length: 255 }).notNull(), // hardware / HID identifier
    connectionType: varchar("connection_type", { length: 50 }).default("hid").notNull(), // hid | usb | ble
    status: varchar("status", { length: 50 }).default("active").notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("rfid_readers_merchant_id_idx").on(table.merchantId),
    readerUidIdx: uniqueIndex("rfid_readers_reader_uid_idx").on(table.readerUid),
  })
);

// ============================================================================
// DELIVERY ZONES (drawn polygons on map)
// ============================================================================

export type DeliveryPolygon = Array<[number, number]>; // [lng, lat] ring (closed or open)

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    // GeoJSON-style ring: [[lng, lat], ...]
    polygon: json("polygon").$type<DeliveryPolygon>().notNull().default([]),
    // Optional ZIP fallback list
    zipCodes: json("zip_codes").$type<string[]>().default([]),
    minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0").notNull(),
    estimatedMinutes: integer("estimated_minutes").default(45),
    color: varchar("color", { length: 20 }).default("#0d9488"),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("delivery_zones_merchant_id_idx").on(table.merchantId),
  })
);

// ============================================================================
// PAYMENT TRANSACTIONS
// ============================================================================

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    terminalId: uuid("terminal_id").references(() => paymentTerminals.id, { onDelete: "set null" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    paymentMethod: varchar("payment_method", { length: 50 }).notNull(), // card, cash, terminal
    adyenReference: varchar("adyen_reference", { length: 255 }),
    adyenPoiTransactionTs: timestamp("adyen_poi_transaction_ts"),
    status: varchar("status", { length: 50 }).notNull(), // pending, authorized, captured, failed, refunded
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    merchantIdIdx: index("payment_transactions_merchant_id_idx").on(table.merchantId),
    orderIdIdx: index("payment_transactions_order_id_idx").on(table.orderId),
    statusIdx: index("payment_transactions_status_idx").on(table.status),
  })
);

// ============================================================================
// LOYALTY CARDS (RFID)
// ============================================================================

export const loyaltyCards = pgTable(
  "loyalty_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardNumber: varchar("card_number", { length: 255 }).notNull().unique(), // RFID card ID
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    cardType: varchar("card_type", { length: 50 }).notNull(), // loyalty, gift_card
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0"),
    pointsBalance: integer("points_balance").default(0),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, suspended, expired
    suspendedReason: text("suspended_reason"),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("loyalty_cards_merchant_id_idx").on(table.merchantId),
    cardNumberIdx: uniqueIndex("loyalty_cards_card_number_idx").on(table.cardNumber),
    statusIdx: index("loyalty_cards_status_idx").on(table.status),
  })
);

// ============================================================================
// LOYALTY TRANSACTIONS
// ============================================================================

export const loyaltyTransactions = pgTable(
  "loyalty_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => loyaltyCards.id, { onDelete: "cascade" }),
    transactionType: varchar("transaction_type", { length: 50 }).notNull(), // purchase, reload, redemption, points_earned
    amount: decimal("amount", { precision: 10, scale: 2 }),
    points: integer("points"),
    balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }),
    description: text("description"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("loyalty_transactions_merchant_id_idx").on(table.merchantId),
    cardIdIdx: index("loyalty_transactions_card_id_idx").on(table.cardId),
  })
);

// ============================================================================
// GIFT CARDS (physical RFID / future e-card) — stored value + optional membership
// One physical card can hold prepaid CHF balance AND optional customer membership/points.
// ============================================================================

export const giftCards = pgTable(
  "gift_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** RFID UID for physical cards, or generated code for e-cards */
    cardNumber: varchar("card_number", { length: 255 }).notNull(),
    /** physical | e_card */
    cardMediaType: varchar("card_media_type", { length: 20 }).default("physical").notNull(),
    /** Stored-value / gift balance in CHF */
    balance: decimal("balance", { precision: 10, scale: 2 }).default("0").notNull(),
    status: varchar("status", { length: 50 }).default("active").notNull(), // active, suspended, expired
    suspendedReason: text("suspended_reason"),
    /** Optional membership: linked customer for points / visits */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    membershipEnabled: boolean("membership_enabled").default(false).notNull(),
    /** Active membership tier id from merchant gift_card_settings.membershipPlans */
    membershipPlanId: varchar("membership_plan_id", { length: 64 }),
    /** Stamp-card progress (resets when reward earned) */
    stampCount: integer("stamp_count").default(0).notNull(),
    pointsBalance: integer("points_balance").default(0).notNull(),
    holderName: varchar("holder_name", { length: 255 }),
    holderEmail: varchar("holder_email", { length: 255 }),
    holderPhone: varchar("holder_phone", { length: 40 }),
    /** Phase-2 e-card: delivery email / QR payload (stub fields) */
    ecardEmail: varchar("ecard_email", { length: 255 }),
    ecardCode: varchar("ecard_code", { length: 64 }),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("gift_cards_merchant_id_idx").on(table.merchantId),
    cardNumberIdx: uniqueIndex("gift_cards_merchant_card_number_idx").on(
      table.merchantId,
      table.cardNumber
    ),
    ecardCodeIdx: uniqueIndex("gift_cards_ecard_code_idx").on(table.ecardCode),
    statusIdx: index("gift_cards_status_idx").on(table.status),
    customerIdIdx: index("gift_cards_customer_id_idx").on(table.customerId),
  })
);

export const giftCardPurchases = pgTable(
  "gift_card_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    senderName: varchar("sender_name", { length: 255 }),
    senderEmail: varchar("sender_email", { length: 255 }),
    message: text("message"),
    paymentMethod: varchar("payment_method", { length: 20 }).default("card").notNull(),
    paymentStatus: varchar("payment_status", { length: 30 }).default("awaiting_payment").notNull(),
    adyenReference: varchar("adyen_reference", { length: 255 }),
    cardId: uuid("card_id").references(() => giftCards.id, { onDelete: "set null" }),
    fulfilledAt: timestamp("fulfilled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("gift_card_purchases_merchant_id_idx").on(table.merchantId),
    paymentStatusIdx: index("gift_card_purchases_payment_status_idx").on(table.paymentStatus),
  })
);

export const giftCardTransactions = pgTable(
  "gift_card_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => giftCards.id, { onDelete: "cascade" }),
    /** sell | reload | redeem | adjust | membership_issue | points_earn | points_redeem */
    transactionType: varchar("transaction_type", { length: 50 }).notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }),
    balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }),
    points: integer("points"),
    pointsAfter: integer("points_after"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("gift_card_transactions_merchant_id_idx").on(table.merchantId),
    cardIdIdx: index("gift_card_transactions_card_id_idx").on(table.cardId),
    orderIdIdx: index("gift_card_transactions_order_id_idx").on(table.orderId),
  })
);

// ============================================================================
// SHOP LOYALTY POINT LOTS (FIFO expiry for customer accounts)
// ============================================================================

export const loyaltyPointLots = pgTable(
  "loyalty_point_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    pointsGranted: integer("points_granted").notNull(),
    pointsRemaining: integer("points_remaining").notNull(),
    earnedAt: timestamp("earned_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    source: varchar("source", { length: 40 }).default("earn").notNull(), // earn | adjustment | bonus
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("loyalty_point_lots_customer_idx").on(table.customerId),
    merchantIdx: index("loyalty_point_lots_merchant_idx").on(table.merchantId),
    expiresIdx: index("loyalty_point_lots_expires_idx").on(table.expiresAt),
  })
);

export const loyaltyPointEvents = pgTable(
  "loyalty_point_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 40 }).notNull(), // earn | redeem_cash | redeem_product | expire | adjust
    points: integer("points").notNull(),
    meta: json("meta").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdx: index("loyalty_point_events_customer_idx").on(table.customerId),
    merchantIdx: index("loyalty_point_events_merchant_idx").on(table.merchantId),
  })
);

// ============================================================================
// OFFERS / PROMOTIONS (online shop + dine-in)
// ============================================================================

export type OfferType =
  | "percent_category"
  | "percent_order"
  | "fixed_off"
  | "bogo"
  | "pay_n_get_m"
  | "nth_item_percent"
  | "combo_deal"
  | "package_deal";

export type OfferRules = {
  percentOff?: number;
  fixedOff?: number;
  buyQty?: number;
  getQty?: number;
  getDiscountPercent?: number;
  payQty?: number;
  receiveQty?: number;
  /** Which unit in a repeat cycle gets the discount (default 2 = every 2nd item). */
  nthItem?: number;
  /** When true, BOGO / pay-N / nth-item deals apply per product, not across mixed SKUs. */
  sameProductOnly?: boolean;
  minOrderAmount?: number;
  /** @deprecated use package_deal buy/get lists */
  comboProductIds?: string[];
  comboPercentOff?: number;
  comboFixedOff?: number;
  /**
   * Package deal: choose `buyQty` from `buyProductIds`, get `getQty` from
   * `getProductIds` free (or included), for a single `packagePrice`.
   */
  buyProductIds?: string[];
  getProductIds?: string[];
  packagePrice?: number;
};

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    offerType: varchar("offer_type", { length: 40 }).notNull(),
    rules: json("rules").$type<OfferRules>().default({}).notNull(),
    channels: json("channels").$type<string[]>().default([]).notNull(),
    categoryIds: json("category_ids").$type<string[]>().default([]).notNull(),
    productIds: json("product_ids").$type<string[]>().default([]).notNull(),
    scheduleMode: varchar("schedule_mode", { length: 20 }).default("always").notNull(),
    daysOfWeek: json("days_of_week").$type<string[]>().default([]).notNull(),
    timeStart: varchar("time_start", { length: 5 }),
    timeEnd: varchar("time_end", { length: 5 }),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    featured: boolean("featured").default(true).notNull(),
    badgeLabel: varchar("badge_label", { length: 40 }),
    priority: integer("priority").default(0).notNull(),
    stackable: boolean("stackable").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("offers_merchant_id_idx").on(table.merchantId),
    activeIdx: index("offers_merchant_active_idx").on(table.merchantId, table.isActive),
  })
);

// ============================================================================
// VOUCHERS (discount codes for online shop)
// ============================================================================

export type VoucherUsageType = "single_use" | "multi_use" | "customer";
export type VoucherDiscountType = "percent" | "fixed";

export const vouchers = pgTable(
  "vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }),
    usageType: varchar("usage_type", { length: 20 }).notNull().default("multi_use"),
    /** Max redemptions (multi_use) or 1 for single_use */
    maxRedemptions: integer("max_redemptions").default(1).notNull(),
    /** Required when usageType = customer */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    discountType: varchar("discount_type", { length: 20 }).notNull().default("percent"),
    discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }),
    validTo: timestamp("valid_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    redemptionCount: integer("redemption_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    merchantCodeIdx: uniqueIndex("vouchers_merchant_code_idx").on(table.merchantId, table.code),
    merchantIdx: index("vouchers_merchant_id_idx").on(table.merchantId),
    activeIdx: index("vouchers_merchant_active_idx").on(table.merchantId, table.isActive),
    customerIdx: index("vouchers_customer_id_idx").on(table.customerId),
  })
);

export const voucherRedemptions = pgTable(
  "voucher_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => vouchers.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    code: varchar("code", { length: 64 }).notNull(),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("voucher_redemptions_merchant_id_idx").on(table.merchantId),
    voucherIdx: index("voucher_redemptions_voucher_id_idx").on(table.voucherId),
    orderIdx: index("voucher_redemptions_order_id_idx").on(table.orderId),
    customerIdx: index("voucher_redemptions_customer_id_idx").on(table.customerId),
  })
);

// ============================================================================
// DAILY REPORTS
// ============================================================================

export const dailyReports = pgTable(
  "daily_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    reportDate: varchar("report_date", { length: 10 }).notNull(), // YYYY-MM-DD
    totalOrders: integer("total_orders").default(0),
    totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
    totalTax: decimal("total_tax", { precision: 10, scale: 2 }).default("0"),
    totalDiscount: decimal("total_discount", { precision: 10, scale: 2 }).default("0"),
    paymentBreakdown: json("payment_breakdown"), // {cash: 100, card: 200, terminal: 150}
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdIdx: index("daily_reports_merchant_id_idx").on(table.merchantId),
    reportDateIdx: index("daily_reports_report_date_idx").on(table.reportDate),
  })
);

// ============================================================================
// CMS PAGES (merchant website / homepage builder)
// ============================================================================

/** OpenPage site config + exported HTML (primary CMS engine) */
export type CmsOpenPageBlock = {
  id: string;
  type: string;
  variant: string;
  props: Record<string, unknown>;
};

export type CmsOpenPageConfig = {
  name: string;
  blocks: CmsOpenPageBlock[];
  pages?: Array<{ id: string; name: string; path: string; blocks: CmsOpenPageBlock[] }>;
  theme?: Record<string, unknown>;
};

export type CmsOpenPageData = {
  engine: "openpage";
  config: CmsOpenPageConfig;
  html: string;
  defaultLocale?: "en" | "fr" | "de";
  locales?: Partial<
    Record<"en" | "fr" | "de", { config: CmsOpenPageConfig; html: string }>
  >;
};

/** @deprecated Puck editor page data — migrated to OpenPage on read */
export type CmsPuckItem = {
  type: string;
  props: Record<string, unknown>;
};

/** @deprecated migrated to OpenPage on read */
export type CmsPuckData = {
  content: CmsPuckItem[];
  root: { props?: Record<string, unknown> };
  zones?: Record<string, CmsPuckItem[]>;
};

/** @deprecated legacy ChaiBuilder block — migrated on read */
export type CmsBlock = {
  _id?: string;
  _type?: string;
  type?: string;
  [key: string]: unknown;
};

export type CmsTheme = Record<string, unknown>;

export const cmsPages = pgTable(
  "cms_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    isHomepage: boolean("is_homepage").notNull().default(false),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    templateKey: varchar("template_key", { length: 40 }),
    /** OpenPage `{ engine, config, html }` — legacy Puck/Chai migrated in the service */
    blocks: json("blocks")
      .$type<CmsOpenPageData | CmsPuckData | CmsBlock[]>()
      .notNull()
      .default({ engine: "openpage", config: { name: "", blocks: [] }, html: "" }),
    /** Optional theme / metadata */
    theme: json("theme").$type<CmsTheme | null>(),
    seoTitle: varchar("seo_title", { length: 200 }),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    merchantSlugUq: uniqueIndex("cms_pages_merchant_slug_uq").on(table.merchantId, table.slug),
    merchantHomepageIdx: index("cms_pages_merchant_homepage_idx").on(table.merchantId, table.isHomepage),
  })
);

// ============================================================================
// CHASLAY CRAFT.JS PAGE BUILDER (test import — parallel to OpenPage CMS)
// ============================================================================

export const chaslayHomepageBuilders = pgTable(
  "chaslay_homepage_builders",
  {
    id: serial("id").primaryKey(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull().default("Untitled"),
    editorState: text("editor_state"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    merchantIdx: index("chaslay_homepage_builders_merchant_idx").on(table.merchantId),
    activeIdx: index("chaslay_homepage_builders_active_idx").on(table.merchantId, table.isActive),
  })
);

export const chaslayHomepageBuilderPages = pgTable(
  "chaslay_homepage_builder_pages",
  {
    id: serial("id").primaryKey(),
    homepageBuilderId: integer("homepage_builder_id")
      .notNull()
      .references(() => chaslayHomepageBuilders.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull().default("Home"),
    slug: varchar("slug", { length: 255 }).notNull().default("home"),
    editorState: text("editor_state"),
    isHomepage: boolean("is_homepage").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    builderSlugUq: uniqueIndex("chaslay_homepage_builder_pages_slug_uq").on(
      table.homepageBuilderId,
      table.slug
    ),
    builderSortIdx: index("chaslay_homepage_builder_pages_sort_idx").on(
      table.homepageBuilderId,
      table.sortOrder
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const cmsPagesRelations = relations(cmsPages, ({ one }) => ({
  merchant: one(merchants, {
    fields: [cmsPages.merchantId],
    references: [merchants.id],
  }),
}));

export const chaslayHomepageBuildersRelations = relations(chaslayHomepageBuilders, ({ one, many }) => ({
  merchant: one(merchants, {
    fields: [chaslayHomepageBuilders.merchantId],
    references: [merchants.id],
  }),
  pages: many(chaslayHomepageBuilderPages),
}));

export const chaslayHomepageBuilderPagesRelations = relations(chaslayHomepageBuilderPages, ({ one }) => ({
  builder: one(chaslayHomepageBuilders, {
    fields: [chaslayHomepageBuilderPages.homepageBuilderId],
    references: [chaslayHomepageBuilders.id],
  }),
  merchant: one(merchants, {
    fields: [chaslayHomepageBuilderPages.merchantId],
    references: [merchants.id],
  }),
}));

export const resellersRelations = relations(resellers, ({ many }) => ({
  merchants: many(merchants),
}));

export const editionsRelations = relations(editions, ({ many }) => ({
  merchants: many(merchants),
}));

export const merchantsRelations = relations(merchants, ({ many, one }) => ({
  reseller: one(resellers, {
    fields: [merchants.resellerId],
    references: [resellers.id],
  }),
  edition: one(editions, {
    fields: [merchants.editionId],
    references: [editions.id],
  }),
  devices: many(devices),
  licenses: many(licenses),
  licenseTransactions: many(licenseTransactions),
  vatSettings: many(vatSettings),
  categories: many(categories),
  products: many(products),
  customers: many(customers),
  orders: many(orders),
  paymentTerminals: many(paymentTerminals),
  paymentTransactions: many(paymentTransactions),
  loyaltyCards: many(loyaltyCards),
  loyaltyTransactions: many(loyaltyTransactions),
  giftCards: many(giftCards),
  giftCardPurchases: many(giftCardPurchases),
  giftCardTransactions: many(giftCardTransactions),
  loyaltyPointLots: many(loyaltyPointLots),
  loyaltyPointEvents: many(loyaltyPointEvents),
  dailyReports: many(dailyReports),
  rfidReaders: many(rfidReaders),
  deliveryZones: many(deliveryZones),
  modifierGroups: many(modifierGroups),
  floorPlans: many(floorPlans),
  diningTables: many(diningTables),
  reservations: many(reservations),
  subscriptionPayments: many(subscriptionPayments),
  cmsPages: many(cmsPages),
  chaslayHomepageBuilders: many(chaslayHomepageBuilders),
  chaslayHomepageBuilderPages: many(chaslayHomepageBuilderPages),
  vouchers: many(vouchers),
  voucherRedemptions: many(voucherRedemptions),
}));

export const vouchersRelations = relations(vouchers, ({ one, many }) => ({
  merchant: one(merchants, { fields: [vouchers.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [vouchers.customerId], references: [customers.id] }),
  redemptions: many(voucherRedemptions),
}));

export const voucherRedemptionsRelations = relations(voucherRedemptions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [voucherRedemptions.merchantId],
    references: [merchants.id],
  }),
  voucher: one(vouchers, {
    fields: [voucherRedemptions.voucherId],
    references: [vouchers.id],
  }),
  order: one(orders, { fields: [voucherRedemptions.orderId], references: [orders.id] }),
  customer: one(customers, {
    fields: [voucherRedemptions.customerId],
    references: [customers.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  merchant: one(merchants, { fields: [reservations.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [reservations.customerId], references: [customers.id] }),
  table: one(diningTables, { fields: [reservations.tableId], references: [diningTables.id] }),
}));

export const floorPlansRelations = relations(floorPlans, ({ one, many }) => ({
  merchant: one(merchants, { fields: [floorPlans.merchantId], references: [merchants.id] }),
  tables: many(diningTables),
}));

export const diningTablesRelations = relations(diningTables, ({ one, many }) => ({
  merchant: one(merchants, { fields: [diningTables.merchantId], references: [merchants.id] }),
  floorPlan: one(floorPlans, { fields: [diningTables.floorPlanId], references: [floorPlans.id] }),
  qrCodes: many(tableQrCodes),
}));

export const tableQrCodesRelations = relations(tableQrCodes, ({ one }) => ({
  merchant: one(merchants, { fields: [tableQrCodes.merchantId], references: [merchants.id] }),
  table: one(diningTables, { fields: [tableQrCodes.tableId], references: [diningTables.id] }),
}));

export const tableSessionsRelations = relations(tableSessions, ({ one, many }) => ({
  merchant: one(merchants, { fields: [tableSessions.merchantId], references: [merchants.id] }),
  table: one(diningTables, { fields: [tableSessions.tableId], references: [diningTables.id] }),
  orders: many(orders),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  merchant: one(merchants, { fields: [devices.merchantId], references: [merchants.id] }),
  licenses: many(licenses),
}));

export const licensesRelations = relations(licenses, ({ one }) => ({
  merchant: one(merchants, { fields: [licenses.merchantId], references: [merchants.id] }),
  device: one(devices, { fields: [licenses.deviceId], references: [devices.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  merchant: one(merchants, { fields: [products.merchantId], references: [merchants.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  orderItems: many(orderItems),
  modifierLinks: many(productModifierGroups),
}));

export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  merchant: one(merchants, { fields: [modifierGroups.merchantId], references: [merchants.id] }),
  options: many(modifierOptions),
  productLinks: many(productModifierGroups),
}));

export const modifierOptionsRelations = relations(modifierOptions, ({ one }) => ({
  group: one(modifierGroups, { fields: [modifierOptions.groupId], references: [modifierGroups.id] }),
}));

export const productModifierGroupsRelations = relations(productModifierGroups, ({ one }) => ({
  product: one(products, { fields: [productModifierGroups.productId], references: [products.id] }),
  group: one(modifierGroups, { fields: [productModifierGroups.groupId], references: [modifierGroups.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  merchant: one(merchants, { fields: [orders.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  tableSession: one(tableSessions, {
    fields: [orders.tableSessionId],
    references: [tableSessions.id],
  }),
  items: many(orderItems),
  paymentTransactions: many(paymentTransactions),
  refunds: many(orderRefunds),
}));

/** Required so `orders.with.paymentTransactions` can be inferred by Drizzle. */
export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [paymentTransactions.merchantId],
    references: [merchants.id],
  }),
  order: one(orders, {
    fields: [paymentTransactions.orderId],
    references: [orders.id],
  }),
  terminal: one(paymentTerminals, {
    fields: [paymentTransactions.terminalId],
    references: [paymentTerminals.id],
  }),
}));

export const heldOrdersRelations = relations(heldOrders, ({ one }) => ({
  merchant: one(merchants, { fields: [heldOrders.merchantId], references: [merchants.id] }),
}));

export const kdsStationsRelations = relations(kdsStations, ({ one }) => ({
  merchant: one(merchants, { fields: [kdsStations.merchantId], references: [merchants.id] }),
}));

export const odsDisplaysRelations = relations(odsDisplays, ({ one }) => ({
  merchant: one(merchants, { fields: [odsDisplays.merchantId], references: [merchants.id] }),
}));

export const odsOrdersRelations = relations(odsOrders, ({ one }) => ({
  merchant: one(merchants, { fields: [odsOrders.merchantId], references: [merchants.id] }),
}));

export const odsDismissedOrdersRelations = relations(odsDismissedOrders, ({ one }) => ({
  merchant: one(merchants, { fields: [odsDismissedOrders.merchantId], references: [merchants.id] }),
}));

export const kdsTicketsRelations = relations(kdsTickets, ({ one, many }) => ({
  merchant: one(merchants, { fields: [kdsTickets.merchantId], references: [merchants.id] }),
  items: many(kdsTicketItems),
}));

export const kdsTicketItemsRelations = relations(kdsTicketItems, ({ one }) => ({
  ticket: one(kdsTickets, { fields: [kdsTicketItems.ticketId], references: [kdsTickets.id] }),
}));

export const signageScreensRelations = relations(signageScreens, ({ one }) => ({
  merchant: one(merchants, { fields: [signageScreens.merchantId], references: [merchants.id] }),
  playlist: one(signagePlaylists, {
    fields: [signageScreens.playlistId],
    references: [signagePlaylists.id],
  }),
}));

export const signagePlaylistsRelations = relations(signagePlaylists, ({ one, many }) => ({
  merchant: one(merchants, { fields: [signagePlaylists.merchantId], references: [merchants.id] }),
  slides: many(signageSlides),
  screens: many(signageScreens),
}));

export const signageSlidesRelations = relations(signageSlides, ({ one }) => ({
  playlist: one(signagePlaylists, {
    fields: [signageSlides.playlistId],
    references: [signagePlaylists.id],
  }),
}));

export const customerAddressesRelations = relations(customerAddresses, ({ one }) => ({
  customer: one(customers, {
    fields: [customerAddresses.customerId],
    references: [customers.id],
  }),
  merchant: one(merchants, {
    fields: [customerAddresses.merchantId],
    references: [merchants.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderRefundsRelations = relations(orderRefunds, ({ one }) => ({
  order: one(orders, { fields: [orderRefunds.orderId], references: [orders.id] }),
  merchant: one(merchants, { fields: [orderRefunds.merchantId], references: [merchants.id] }),
}));

export const loyaltyCardsRelations = relations(loyaltyCards, ({ one, many }) => ({
  merchant: one(merchants, { fields: [loyaltyCards.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [loyaltyCards.customerId], references: [customers.id] }),
  transactions: many(loyaltyTransactions),
}));

export const giftCardsRelations = relations(giftCards, ({ one, many }) => ({
  merchant: one(merchants, { fields: [giftCards.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [giftCards.customerId], references: [customers.id] }),
  transactions: many(giftCardTransactions),
}));

export const giftCardPurchasesRelations = relations(giftCardPurchases, ({ one }) => ({
  merchant: one(merchants, {
    fields: [giftCardPurchases.merchantId],
    references: [merchants.id],
  }),
  card: one(giftCards, {
    fields: [giftCardPurchases.cardId],
    references: [giftCards.id],
  }),
}));

export const giftCardTransactionsRelations = relations(giftCardTransactions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [giftCardTransactions.merchantId],
    references: [merchants.id],
  }),
  card: one(giftCards, {
    fields: [giftCardTransactions.cardId],
    references: [giftCards.id],
  }),
  order: one(orders, {
    fields: [giftCardTransactions.orderId],
    references: [orders.id],
  }),
}));

export const loyaltyPointLotsRelations = relations(loyaltyPointLots, ({ one }) => ({
  merchant: one(merchants, { fields: [loyaltyPointLots.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [loyaltyPointLots.customerId], references: [customers.id] }),
  order: one(orders, { fields: [loyaltyPointLots.orderId], references: [orders.id] }),
}));

export const loyaltyPointEventsRelations = relations(loyaltyPointEvents, ({ one }) => ({
  merchant: one(merchants, { fields: [loyaltyPointEvents.merchantId], references: [merchants.id] }),
  customer: one(customers, { fields: [loyaltyPointEvents.customerId], references: [customers.id] }),
  order: one(orders, { fields: [loyaltyPointEvents.orderId], references: [orders.id] }),
  product: one(products, { fields: [loyaltyPointEvents.productId], references: [products.id] }),
}));

export const rfidReadersRelations = relations(rfidReaders, ({ one }) => ({
  merchant: one(merchants, { fields: [rfidReaders.merchantId], references: [merchants.id] }),
}));

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  merchant: one(merchants, { fields: [deliveryZones.merchantId], references: [merchants.id] }),
}));

export const paymentTerminalsRelations = relations(paymentTerminals, ({ one }) => ({
  merchant: one(merchants, { fields: [paymentTerminals.merchantId], references: [merchants.id] }),
}));

/** Newsletter / marketing campaigns designed and sent by merchants */
export const newsletterCampaigns = pgTable(
  "newsletter_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull().default("Newsletter"),
    subject: varchar("subject", { length: 300 }).notNull(),
    bodyHtml: text("body_html").notNull().default(""),
    /** Unlayer design JSON (reloadable in the email editor). */
    designJson: json("design_json").$type<Record<string, unknown> | null>(),
    status: varchar("status", { length: 30 }).notNull().default("draft"), // draft | sending | sent | failed
    audience: varchar("audience", { length: 30 }).notNull().default("all"), // all | selected
    recipientCount: integer("recipient_count").default(0),
    sentCount: integer("sent_count").default(0),
    failedCount: integer("failed_count").default(0),
    selectedEmails: json("selected_emails").$type<string[] | null>(),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("newsletter_campaigns_merchant_idx").on(table.merchantId),
    statusIdx: index("newsletter_campaigns_status_idx").on(table.merchantId, table.status),
  })
);

/** Platform-wide transactional email send log (superadmin usage + per-merchant attribution). */
export const emailSendLog = pgTable(
  "email_send_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    provider: varchar("provider", { length: 20 }).notNull(), // smtp | brevo | sendgrid
    source: varchar("source", { length: 30 }).notNull(), // platform | merchant_smtp | merchant_brevo | env
    emailType: varchar("email_type", { length: 50 }).notNull().default("general"),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }),
    status: varchar("status", { length: 20 }).notNull().default("sent"), // sent | failed
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("email_send_log_merchant_idx").on(table.merchantId),
    typeIdx: index("email_send_log_type_idx").on(table.emailType),
    createdIdx: index("email_send_log_created_idx").on(table.createdAt),
    merchantCreatedIdx: index("email_send_log_merchant_created_idx").on(
      table.merchantId,
      table.createdAt
    ),
  })
);

/** Log of marketing emails (newsletter + reorder reminders) */
export const marketingEmailLog = pgTable(
  "marketing_email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => newsletterCampaigns.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 255 }).notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    type: varchar("type", { length: 40 }).notNull(), // newsletter | reorder_reminder
    status: varchar("status", { length: 30 }).notNull().default("sent"), // sent | failed
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("marketing_email_log_merchant_idx").on(table.merchantId),
    emailIdx: index("marketing_email_log_email_idx").on(table.merchantId, table.email),
    typeIdx: index("marketing_email_log_type_idx").on(table.merchantId, table.type),
  })
);

/** Cash drawer shifts for WebPOS / counter */
export const posShifts = pgTable(
  "pos_shifts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => merchantStaff.id, { onDelete: "set null" }),
    staffName: varchar("staff_name", { length: 255 }),
    status: varchar("status", { length: 20 }).default("open").notNull(), // open | closed
    openedAt: timestamp("opened_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    openingCash: decimal("opening_cash", { precision: 12, scale: 2 }).default("0").notNull(),
    closingCashCounted: decimal("closing_cash_counted", { precision: 12, scale: 2 }),
    expectedCash: decimal("expected_cash", { precision: 12, scale: 2 }),
    cashSales: decimal("cash_sales", { precision: 12, scale: 2 }).default("0"),
    cardSales: decimal("card_sales", { precision: 12, scale: 2 }).default("0"),
    terminalSales: decimal("terminal_sales", { precision: 12, scale: 2 }).default("0"),
    otherSales: decimal("other_sales", { precision: 12, scale: 2 }).default("0"),
    orderCount: integer("order_count").default(0),
    variance: decimal("variance", { precision: 12, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("pos_shifts_merchant_idx").on(table.merchantId),
    statusIdx: index("pos_shifts_status_idx").on(table.merchantId, table.status),
    openedIdx: index("pos_shifts_opened_idx").on(table.merchantId, table.openedAt),
  })
);

/** Manual cash in/out during an open POS shift (petty cash, bank drops, etc.) */
export const posCashMovements = pgTable(
  "pos_cash_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => posShifts.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => merchantStaff.id, { onDelete: "set null" }),
    staffName: varchar("staff_name", { length: 255 }),
    type: varchar("type", { length: 10 }).notNull(), // in | out
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("pos_cash_movements_merchant_idx").on(table.merchantId),
    shiftIdx: index("pos_cash_movements_shift_idx").on(table.shiftId),
    createdIdx: index("pos_cash_movements_created_idx").on(table.merchantId, table.createdAt),
  })
);

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ one, many }) => ({
  edition: one(editions, {
    fields: [subscriptionPlans.editionId],
    references: [editions.id],
  }),
  payments: many(subscriptionPayments),
}));

export const subscriptionAddonsRelations = relations(subscriptionAddons, ({ many }) => ({
  merchantSubscriptions: many(merchantAddonSubscriptions),
  payments: many(subscriptionAddonPayments),
}));

export const merchantAddonSubscriptionsRelations = relations(merchantAddonSubscriptions, ({ one }) => ({
  merchant: one(merchants, {
    fields: [merchantAddonSubscriptions.merchantId],
    references: [merchants.id],
  }),
  addon: one(subscriptionAddons, {
    fields: [merchantAddonSubscriptions.addonId],
    references: [subscriptionAddons.id],
  }),
}));

export const subscriptionAddonPaymentsRelations = relations(subscriptionAddonPayments, ({ one }) => ({
  merchant: one(merchants, {
    fields: [subscriptionAddonPayments.merchantId],
    references: [merchants.id],
  }),
  addon: one(subscriptionAddons, {
    fields: [subscriptionAddonPayments.addonId],
    references: [subscriptionAddons.id],
  }),
}));

export const subscriptionPaymentsRelations = relations(subscriptionPayments, ({ one }) => ({
  merchant: one(merchants, {
    fields: [subscriptionPayments.merchantId],
    references: [merchants.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptionPayments.planId],
    references: [subscriptionPlans.id],
  }),
}));

// ============================================================================
// PLATFORM SHOP (superadmin sells supplies to merchants)
// ============================================================================

export type PlatformShopOrderLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

/** Catalog items sold by Reborn to merchants */
export const platformShopProducts = pgTable(
  "platform_shop_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
    discountPercent: integer("discount_percent"),
    imageUrl: varchar("image_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    activeIdx: index("platform_shop_products_active_idx").on(table.isActive),
    sortIdx: index("platform_shop_products_sort_idx").on(table.sortOrder),
  })
);

/** Voucher codes for the platform shop checkout */
export const platformShopVouchers = pgTable(
  "platform_shop_vouchers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    label: varchar("label", { length: 255 }),
    discountPercent: integer("discount_percent"),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: uniqueIndex("platform_shop_vouchers_code_idx").on(table.code),
    activeIdx: index("platform_shop_vouchers_active_idx").on(table.isActive),
  })
);

/** Merchant purchases from the platform shop */
export const platformShopOrders = pgTable(
  "platform_shop_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).notNull().default("pending"), // pending | paid | cancelled | fulfilled
    paymentStatus: varchar("payment_status", { length: 30 }).notNull().default("pending"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("CHF"),
    voucherCode: varchar("voucher_code", { length: 50 }),
    items: json("items").$type<PlatformShopOrderLine[]>().notNull().default([]),
    notes: text("notes"),
    adyenSessionId: varchar("adyen_session_id", { length: 255 }),
    adyenPspReference: varchar("adyen_psp_reference", { length: 255 }),
    adyenResultCode: varchar("adyen_result_code", { length: 50 }),
    paidAt: timestamp("paid_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("platform_shop_orders_merchant_idx").on(table.merchantId),
    statusIdx: index("platform_shop_orders_status_idx").on(table.status),
    createdIdx: index("platform_shop_orders_created_idx").on(table.createdAt),
  })
);

export const platformShopOrdersRelations = relations(platformShopOrders, ({ one }) => ({
  merchant: one(merchants, {
    fields: [platformShopOrders.merchantId],
    references: [merchants.id],
  }),
}));

// ============================================================================
// PLATFORM LOGS & MESSAGES (superadmin system logs, merchant/reseller alerts)
// ============================================================================

export type PlatformLogLevel = "debug" | "info" | "warn" | "error";
export type PlatformMessageKind = "announcement" | "incident" | "whats_new";
export type PlatformMessageAudience =
  | "all_merchants"
  | "all_resellers"
  | "all"
  | "merchant"
  | "reseller";
export type PlatformMessageSeverity = "info" | "warning" | "critical";

/** System-level event log for superadmin */
export const platformEventLogs = pgTable(
  "platform_event_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    level: varchar("level", { length: 10 }).notNull().default("info"),
    category: varchar("category", { length: 80 }).notNull().default("system"),
    message: text("message").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    actorRole: varchar("actor_role", { length: 20 }),
    actorId: uuid("actor_id"),
    merchantId: uuid("merchant_id"),
    resellerId: uuid("reseller_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    levelIdx: index("platform_event_logs_level_idx").on(table.level),
    categoryIdx: index("platform_event_logs_category_idx").on(table.category),
    createdIdx: index("platform_event_logs_created_idx").on(table.createdAt),
  })
);

/** Platform announcements, incidents, and what's-new entries */
export const platformMessages = pgTable(
  "platform_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: varchar("kind", { length: 20 }).notNull().default("announcement"),
    audience: varchar("audience", { length: 30 }).notNull().default("all_merchants"),
    targetMerchantId: uuid("target_merchant_id"),
    targetResellerId: uuid("target_reseller_id"),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    externalUrl: varchar("external_url", { length: 500 }),
    externalLabel: varchar("external_label", { length: 120 }),
    showOnLogin: boolean("show_on_login").notNull().default(true),
    showInBanner: boolean("show_in_banner").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdBySuperadminId: uuid("created_by_superadmin_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    kindIdx: index("platform_messages_kind_idx").on(table.kind),
    audienceIdx: index("platform_messages_audience_idx").on(table.audience),
    activeIdx: index("platform_messages_active_idx").on(table.isActive),
    createdIdx: index("platform_messages_created_idx").on(table.createdAt),
  })
);

/** Per-viewer dismissals (merchant/reseller/superadmin) */
export const platformMessageDismissals = pgTable(
  "platform_message_dismissals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => platformMessages.id, { onDelete: "cascade" }),
    viewerRole: varchar("viewer_role", { length: 20 }).notNull(),
    viewerId: uuid("viewer_id").notNull(),
    dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueDismiss: uniqueIndex("platform_message_dismissals_unique").on(
      table.messageId,
      table.viewerRole,
      table.viewerId
    ),
    viewerIdx: index("platform_message_dismissals_viewer_idx").on(table.viewerRole, table.viewerId),
  })
);

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

export type SupportTicketCategory = "technical" | "accounting" | "miscellaneous";
export type SupportTicketStatus = "open" | "answered" | "closed";

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: varchar("ticket_number", { length: 20 }).notNull(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    resellerId: uuid("reseller_id").references(() => resellers.id, { onDelete: "set null" }),
    category: varchar("category", { length: 30 }).notNull().default("technical"),
    subcategory: varchar("subcategory", { length: 80 }),
    subject: varchar("subject", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    /** When false, ticket is visible in superadmin support inbox only (POS diagnostic auto-reports). */
    merchantVisible: boolean("merchant_visible").notNull().default(true),
    assignedToSuperadminId: uuid("assigned_to_superadmin_id"),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    autoCloseAt: timestamp("auto_close_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    merchantIdx: index("support_tickets_merchant_idx").on(table.merchantId),
    resellerIdx: index("support_tickets_reseller_idx").on(table.resellerId),
    statusIdx: index("support_tickets_status_idx").on(table.status),
    numberIdx: uniqueIndex("support_tickets_number_idx").on(table.ticketNumber),
    createdIdx: index("support_tickets_created_idx").on(table.createdAt),
  })
);

export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorRole: varchar("author_role", { length: 20 }).notNull(),
    authorId: uuid("author_id"),
    authorName: varchar("author_name", { length: 255 }),
    body: text("body").notNull(),
    attachmentUrl: varchar("attachment_url", { length: 500 }),
    attachmentName: varchar("attachment_name", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ticketIdx: index("support_ticket_messages_ticket_idx").on(table.ticketId),
    createdIdx: index("support_ticket_messages_created_idx").on(table.createdAt),
  })
);

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  merchant: one(merchants, { fields: [supportTickets.merchantId], references: [merchants.id] }),
  reseller: one(resellers, { fields: [supportTickets.resellerId], references: [resellers.id] }),
  messages: many(supportTicketMessages),
}));

export const supportTicketMessagesRelations = relations(supportTicketMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportTicketMessages.ticketId],
    references: [supportTickets.id],
  }),
}));
