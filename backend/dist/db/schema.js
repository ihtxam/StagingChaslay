"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reservations = exports.tableQrCodes = exports.diningTables = exports.floorPlans = exports.orderRefunds = exports.orderItems = exports.signageSlides = exports.signageScreens = exports.signagePlaylists = exports.SIGNAGE_SLIDE_TYPES = exports.SIGNAGE_ORIENTATIONS = exports.SIGNAGE_TEMPLATES = exports.odsDismissedOrders = exports.odsOrders = exports.odsDisplays = exports.ODS_THEMES = exports.kdsTicketItems = exports.kdsTickets = exports.KDS_LAYOUT_MODES = exports.KDS_THEMES = exports.kdsStations = exports.deliveryDriverShifts = exports.deliveryDriverLocations = exports.posSessions = exports.heldOrders = exports.orders = exports.customerAddresses = exports.customers = exports.productModifierGroups = exports.modifierOptions = exports.modifierGroups = exports.products = exports.categories = exports.vatSettings = exports.licenseTransactions = exports.licenses = exports.devices = exports.subscriptionPayments = exports.passwordResetTokens = exports.platformSettings = exports.subscriptionAddonPayments = exports.merchantAddonSubscriptions = exports.subscriptionAddons = exports.subscriptionPlans = exports.merchantStaff = exports.merchantRoles = exports.merchants = exports.editions = exports.resellers = exports.superadmins = void 0;
exports.orderRefundsRelations = exports.orderItemsRelations = exports.customerAddressesRelations = exports.signageSlidesRelations = exports.signagePlaylistsRelations = exports.signageScreensRelations = exports.kdsTicketItemsRelations = exports.kdsTicketsRelations = exports.odsDismissedOrdersRelations = exports.odsOrdersRelations = exports.odsDisplaysRelations = exports.kdsStationsRelations = exports.heldOrdersRelations = exports.paymentTransactionsRelations = exports.ordersRelations = exports.productModifierGroupsRelations = exports.modifierOptionsRelations = exports.modifierGroupsRelations = exports.productsRelations = exports.licensesRelations = exports.devicesRelations = exports.tableQrCodesRelations = exports.diningTablesRelations = exports.floorPlansRelations = exports.reservationsRelations = exports.voucherRedemptionsRelations = exports.vouchersRelations = exports.merchantsRelations = exports.editionsRelations = exports.resellersRelations = exports.cmsPagesRelations = exports.cmsPages = exports.dailyReports = exports.voucherRedemptions = exports.vouchers = exports.offers = exports.loyaltyPointEvents = exports.loyaltyPointLots = exports.giftCardTransactions = exports.giftCardPurchases = exports.giftCards = exports.loyaltyTransactions = exports.loyaltyCards = exports.paymentTransactions = exports.deliveryZones = exports.rfidReaders = exports.paymentTerminals = exports.chaslayFloorPrintJobs = exports.chaslayFloorTableOrders = exports.chaslayFloorDevices = void 0;
exports.supportTicketMessagesRelations = exports.supportTicketsRelations = exports.supportTicketMessages = exports.supportTickets = exports.platformMessageDismissals = exports.platformMessages = exports.platformEventLogs = exports.platformShopOrdersRelations = exports.platformShopOrders = exports.platformShopVouchers = exports.platformShopProducts = exports.subscriptionPaymentsRelations = exports.subscriptionAddonPaymentsRelations = exports.merchantAddonSubscriptionsRelations = exports.subscriptionAddonsRelations = exports.subscriptionPlansRelations = exports.productRecipesRelations = exports.inventoryMovementsRelations = exports.inventoryUnitRatiosRelations = exports.inventoryUnitsRelations = exports.inventoryCategoriesRelations = exports.inventoryStockLotsRelations = exports.inventoryItemsRelations = exports.inventorySuppliersRelations = exports.productRecipes = exports.inventoryStockLots = exports.inventoryMovements = exports.inventoryUnitRatios = exports.inventoryUnits = exports.inventoryCategories = exports.inventoryItems = exports.inventorySuppliers = exports.posCashMovements = exports.posShifts = exports.marketingEmailLog = exports.emailSendLog = exports.newsletterCampaigns = exports.paymentTerminalsRelations = exports.deliveryZonesRelations = exports.rfidReadersRelations = exports.loyaltyPointEventsRelations = exports.loyaltyPointLotsRelations = exports.giftCardTransactionsRelations = exports.giftCardPurchasesRelations = exports.giftCardsRelations = exports.loyaltyCardsRelations = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
// ============================================================================
// SUPERADMIN & AUTHENTICATION
// ============================================================================
exports.superadmins = (0, pg_core_1.pgTable)("superadmins", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }).notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    role: (0, pg_core_1.varchar)("role", { length: 50 }).default("superadmin").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    /** Can be assigned support tickets (technical issues). */
    handlesSupport: (0, pg_core_1.boolean)("handles_support").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    emailIdx: (0, pg_core_1.uniqueIndex)("superadmins_email_idx").on(table.email),
}));
// ============================================================================
// RESELLERS (AGENCIES) — normal tenants between superadmin and merchants
// ============================================================================
exports.resellers = (0, pg_core_1.pgTable)("resellers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }).notNull(),
    phone: (0, pg_core_1.varchar)("phone", { length: 40 }),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(), // active | suspended
    /**
     * Device-license seat pool granted by Superadmin.
     * Reseller issues seats to their own merchants from this quota.
     */
    licenseSeats: (0, pg_core_1.integer)("license_seats").default(0).notNull(),
    /** Optional branding JSON for future white-label */
    branding: (0, pg_core_1.json)("branding").$type(),
    createdBySuperadminId: (0, pg_core_1.uuid)("created_by_superadmin_id").references(() => exports.superadmins.id, {
        onDelete: "set null",
    }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    emailIdx: (0, pg_core_1.uniqueIndex)("resellers_email_idx").on(table.email),
    statusIdx: (0, pg_core_1.index)("resellers_status_idx").on(table.status),
}));
// ============================================================================
// EDITIONS (POS feature packs / versions)
// ============================================================================
exports.editions = (0, pg_core_1.pgTable)("editions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    /** platform = superadmin templates; reseller = agency-owned */
    ownerType: (0, pg_core_1.varchar)("owner_type", { length: 20 }).default("platform").notNull(),
    /** null when ownerType=platform; reseller id when ownerType=reseller */
    ownerId: (0, pg_core_1.uuid)("owner_id"),
    name: (0, pg_core_1.varchar)("name", { length: 150 }).notNull(),
    note: (0, pg_core_1.text)("note"),
    /** retail | restaurant | both */
    businessCategory: (0, pg_core_1.varchar)("business_category", { length: 20 }).default("both").notNull(),
    /** EditionFeatureKey[] */
    features: (0, pg_core_1.json)("features").$type().default([]).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    ownerIdx: (0, pg_core_1.index)("editions_owner_idx").on(table.ownerType, table.ownerId),
    nameIdx: (0, pg_core_1.index)("editions_name_idx").on(table.name),
}));
// ============================================================================
// MERCHANTS (TENANTS)
// ============================================================================
exports.merchants = (0, pg_core_1.pgTable)("merchants", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull().unique(),
    phone: (0, pg_core_1.varchar)("phone", { length: 20 }),
    businessLicense: (0, pg_core_1.varchar)("business_license", { length: 255 }),
    address: (0, pg_core_1.text)("address"),
    city: (0, pg_core_1.varchar)("city", { length: 100 }),
    country: (0, pg_core_1.varchar)("country", { length: 100 }),
    vatNumber: (0, pg_core_1.varchar)("vat_number", { length: 50 }),
    vatRate: (0, pg_core_1.decimal)("vat_rate", { precision: 5, scale: 2 }).default("0"),
    // Channel-specific tax rates (%). Fall back to vatRate when null/0 unused.
    taxTakeawayRate: (0, pg_core_1.decimal)("tax_takeaway_rate", { precision: 5, scale: 2 }).default("0"),
    taxDineInRate: (0, pg_core_1.decimal)("tax_dine_in_rate", { precision: 5, scale: 2 }).default("0"),
    taxDeliveryRate: (0, pg_core_1.decimal)("tax_delivery_rate", { precision: 5, scale: 2 }).default("0"),
    /** When true, menu prices are gross (TVA included); when false, tax is added on top at checkout. */
    taxIncludedInPrice: (0, pg_core_1.boolean)("tax_included_in_price").default(false).notNull(),
    /**
     * Tax-exclusive only: when true, order discounts reduce the VAT base; when false, VAT stays on
     * pre-discount net and the discount reduces the payable total (online shop legacy behavior).
     */
    vatAfterDiscount: (0, pg_core_1.boolean)("vat_after_discount").default(true).notNull(),
    // Online shop: path slug + optional DNS subdomain (e.g. demo → demo.domain)
    slug: (0, pg_core_1.varchar)("slug", { length: 100 }),
    subdomain: (0, pg_core_1.varchar)("subdomain", { length: 63 }),
    /** Custom apex/domain for CMS website (e.g. cafe.ch) — DNS CNAME to platform */
    customDomain: (0, pg_core_1.varchar)("custom_domain", { length: 255 }),
    shopEnabled: (0, pg_core_1.boolean)("shop_enabled").default(false).notNull(),
    /**
     * Soft close for online ordering (shop stays browsable).
     * When false, visitors see “not accepting orders… please call us”.
     */
    acceptingOrders: (0, pg_core_1.boolean)("accepting_orders").default(true).notNull(),
    /**
     * Soft close for online reservations (module can stay enabled).
     * When false, visitors see “not accepting reservations… please call us”.
     */
    acceptingReservations: (0, pg_core_1.boolean)("accepting_reservations").default(true).notNull(),
    /** When true, shop root serves published CMS homepage instead of menu */
    cmsHomepageEnabled: (0, pg_core_1.boolean)("cms_homepage_enabled").default(false).notNull(),
    // Online ordering channels
    pickupEnabled: (0, pg_core_1.boolean)("pickup_enabled").default(true).notNull(),
    dineInEnabled: (0, pg_core_1.boolean)("dine_in_enabled").default(true).notNull(),
    deliveryEnabled: (0, pg_core_1.boolean)("delivery_enabled").default(true).notNull(),
    /**
     * Where customers choose pickup / delivery / dine-in:
     * checkout | popup_start | menu
     */
    channelSelectMode: (0, pg_core_1.varchar)("channel_select_mode", { length: 20 }).default("checkout").notNull(),
    /** Show product photos on the public menu */
    menuShowProductImages: (0, pg_core_1.boolean)("menu_show_product_images").default(true).notNull(),
    /** Show category banner images on the public menu */
    menuShowCategoryBanners: (0, pg_core_1.boolean)("menu_show_category_banners").default(true).notNull(),
    /**
     * Online shop cart layout:
     * hidden_slide (default) | sticky_right
     */
    cartLayout: (0, pg_core_1.varchar)("cart_layout", { length: 20 }).default("hidden_slide").notNull(),
    /**
     * Allow customers to schedule / program orders for later.
     * When false, orders can only be placed during opening hours (ASAP only).
     */
    scheduledOrdersEnabled: (0, pg_core_1.boolean)("scheduled_orders_enabled").default(true).notNull(),
    // Per-channel weekly hours (+ optional display for homepage banner):
    // { takeaway: { mon: [{ open, close }] }, delivery, dine_in, display }
    storeHours: (0, pg_core_1.json)("store_hours").$type().default({}),
    shopLogoUrl: (0, pg_core_1.varchar)("shop_logo_url", { length: 500 }),
    shopBannerUrl: (0, pg_core_1.varchar)("shop_banner_url", { length: 500 }),
    latitude: (0, pg_core_1.decimal)("latitude", { precision: 10, scale: 7 }),
    longitude: (0, pg_core_1.decimal)("longitude", { precision: 10, scale: 7 }),
    pickupEtaMinutes: (0, pg_core_1.integer)("pickup_eta_minutes").default(25),
    deliveryEtaMinutes: (0, pg_core_1.integer)("delivery_eta_minutes").default(45),
    /** Minimum lead time (minutes) before a customer can schedule a pre-order */
    minPreOrderDelayMinutes: (0, pg_core_1.integer)("min_pre_order_delay_minutes").default(30),
    /**
     * Fixed CHF amount added to each menu item base price for delivery orders
     * (e.g. 2 → delivery item prices = takeaway + 2.00).
     */
    deliveryMenuMarkup: (0, pg_core_1.decimal)("delivery_menu_markup", { precision: 10, scale: 2 }).default("0"),
    /** Driver pay: hourly | per_order | both */
    deliveryDriverPayMode: (0, pg_core_1.varchar)("delivery_driver_pay_mode", { length: 20 })
        .default("both")
        .notNull(),
    deliveryDriverHourlyRate: (0, pg_core_1.decimal)("delivery_driver_hourly_rate", { precision: 10, scale: 2 }).default("0"),
    deliveryPerOrderFee: (0, pg_core_1.decimal)("delivery_per_order_fee", { precision: 10, scale: 2 }).default("0"),
    // Adyen credentials (merchant-level; shared by online shop + payment terminals)
    adyenMerchantAccount: (0, pg_core_1.varchar)("adyen_merchant_account", { length: 255 }),
    adyenApiKey: (0, pg_core_1.text)("adyen_api_key"),
    adyenClientId: (0, pg_core_1.varchar)("adyen_client_id", { length: 255 }),
    /** Adyen Terminal API: test vs live environment */
    adyenLiveEnvironment: (0, pg_core_1.boolean)("adyen_live_environment").default(false).notNull(),
    /** Adyen cloud device region: EU | US | AU | APSE */
    adyenLiveRegion: (0, pg_core_1.varchar)("adyen_live_region", { length: 10 }).default("EU").notNull(),
    /** Use legacy Terminal API sync URL instead of Cloud Device API */
    adyenUseLegacyEndpoint: (0, pg_core_1.boolean)("adyen_use_legacy_endpoint").default(false).notNull(),
    /** WebPOS payment method toggles (merchant panel counter sales) */
    webposExpressEnabled: (0, pg_core_1.boolean)("webpos_express_enabled").default(true).notNull(),
    webposCashEnabled: (0, pg_core_1.boolean)("webpos_cash_enabled").default(true).notNull(),
    webposCardEnabled: (0, pg_core_1.boolean)("webpos_card_enabled").default(true).notNull(),
    webposTerminalEnabled: (0, pg_core_1.boolean)("webpos_terminal_enabled").default(true).notNull(),
    /** Allow Gift Card as a WebPOS tender (requires gift card settings enabled) */
    webposGiftCardEnabled: (0, pg_core_1.boolean)("webpos_gift_card_enabled").default(false).notNull(),
    /** Allow Invoice as a WebPOS / Android checkout tender */
    webposInvoiceEnabled: (0, pg_core_1.boolean)("webpos_invoice_enabled").default(true).notNull(),
    /** Bank details printed on A4 invoices + Swiss QR-bill */
    bankIban: (0, pg_core_1.varchar)("bank_iban", { length: 34 }),
    bankQrIban: (0, pg_core_1.varchar)("bank_qr_iban", { length: 34 }),
    bankName: (0, pg_core_1.varchar)("bank_name", { length: 255 }),
    bankAccountHolder: (0, pg_core_1.varchar)("bank_account_holder", { length: 255 }),
    /** Per-merchant invoice number sequence (INV-YYYY-NNNNN) */
    invoiceSequence: (0, pg_core_1.integer)("invoice_sequence").default(0).notNull(),
    /**
     * Gift card / stored-value settings:
     * { enabled, presetDenominations, minAmount, maxAmount, reloadEnabled, customAmountEnabled }
     */
    giftCardSettings: (0, pg_core_1.json)("gift_card_settings").$type(),
    /** Fixed CHF surcharge added to online card checkouts */
    onlineCardFeeFixed: (0, pg_core_1.decimal)("online_card_fee_fixed", { precision: 10, scale: 2 }).default("0"),
    /** Percent surcharge on (subtotal+tax+delivery+tip) for online card checkouts */
    onlineCardFeePercent: (0, pg_core_1.decimal)("online_card_fee_percent", { precision: 6, scale: 3 }).default("0"),
    // Online shop fidelity / loyalty program (customer account points)
    loyaltyEnabled: (0, pg_core_1.boolean)("loyalty_enabled").default(false).notNull(),
    /** Points earned per 1.00 CHF of paid food subtotal (default 1) */
    loyaltyEarnPointsPerChf: (0, pg_core_1.decimal)("loyalty_earn_points_per_chf", { precision: 8, scale: 3 }).default("1"),
    /** Points required to redeem 1.00 CHF discount (default 100) */
    loyaltyRedeemPointsPerChf: (0, pg_core_1.integer)("loyalty_redeem_points_per_chf").default(100).notNull(),
    /** Earn lots expire after this many days (default 30) */
    loyaltyPointsExpiryDays: (0, pg_core_1.integer)("loyalty_points_expiry_days").default(30).notNull(),
    panelLanguage: (0, pg_core_1.varchar)("panel_language", { length: 10 }).default("en").notNull(), // en | fr | de
    /** Default language for online shop + CMS homepage (null = fall back to panelLanguage) */
    shopLanguage: (0, pg_core_1.varchar)("shop_language", { length: 10 }), // en | fr | de
    /** Reborn/FoodTruck Android POS sync key (X-Api-Key header) */
    syncApiKey: (0, pg_core_1.varchar)("sync_api_key", { length: 64 }),
    // Restaurant floor / PAX
    floorPlanEnabled: (0, pg_core_1.boolean)("floor_plan_enabled").default(false).notNull(),
    // When true: order & bill per person (Person 1…) at a table; kitchen tickets split by seat
    paxOrderingEnabled: (0, pg_core_1.boolean)("pax_ordering_enabled").default(false).notNull(),
    /**
     * Dine-in course firing (starter/main/…). Off by default — many venues only need
     * send-to-kitchen / kitchen message without multi-course workflow.
     */
    coursesEnabled: (0, pg_core_1.boolean)("courses_enabled").default(false).notNull(),
    /**
     * When true, WebPOS requires an open cash shift before selling.
     * Staff declare opening float and reconcile cash on close.
     */
    shiftsEnabled: (0, pg_core_1.boolean)("shifts_enabled").default(false).notNull(),
    /**
     * Max concurrent main POS stations (WebPOS + Android register). 0 = unlimited.
     */
    maxPosPosts: (0, pg_core_1.integer)("max_pos_posts").default(0).notNull(),
    /**
     * Max concurrent waiter stations (waiter web + Android waiter). 0 = unlimited.
     */
    maxWaiterPosts: (0, pg_core_1.integer)("max_waiter_posts").default(0).notNull(),
    /** Max staff accounts (merchant panel users). 0 = unlimited. */
    maxStaff: (0, pg_core_1.integer)("max_staff").default(0).notNull(),
    /**
     * Paid restaurant inventory + recipes addon. Superadmin/reseller only (like POS seats).
     */
    inventoryAddonEnabled: (0, pg_core_1.boolean)("inventory_addon_enabled").default(false).notNull(),
    /**
     * Paid Reborn Screens (digital menu boards). Superadmin/reseller only — TVs do not consume POS seats.
     */
    signageAddonEnabled: (0, pg_core_1.boolean)("signage_addon_enabled").default(false).notNull(),
    /** Max TV screens when the signage addon is on. Default 2. */
    signageScreenLimit: (0, pg_core_1.integer)("signage_screen_limit").default(2).notNull(),
    /** Paid kitchen display (KDS) addon. Superadmin/reseller only. */
    kdsAddonEnabled: (0, pg_core_1.boolean)("kds_addon_enabled").default(false).notNull(),
    /** Paid order display system (ODS) addon. Superadmin/reseller only. */
    odsAddonEnabled: (0, pg_core_1.boolean)("ods_addon_enabled").default(false).notNull(),
    /**
     * Extra yield / waste factor applied to recipe usage on sale (0–0.50). Default 20%.
     */
    inventoryWasteFactor: (0, pg_core_1.decimal)("inventory_waste_factor", { precision: 5, scale: 4 })
        .default("0.20")
        .notNull(),
    /** Master switch: email preferred supplier when an item hits par / reorder point. */
    inventoryAutoReorderEmailEnabled: (0, pg_core_1.boolean)("inventory_auto_reorder_email_enabled")
        .default(false)
        .notNull(),
    /** Days before expiry to alert store admin (default 30 ≈ one month). */
    inventoryExpiryAlertDays: (0, pg_core_1.integer)("inventory_expiry_alert_days").default(30).notNull(),
    /** WebPOS / counter accent theme: teal | green | blue | violet */
    posColorTheme: (0, pg_core_1.varchar)("pos_color_theme", { length: 20 }).default("teal").notNull(),
    /** Online / phone restaurant table reservations */
    reservationsEnabled: (0, pg_core_1.boolean)("reservations_enabled").default(false).notNull(),
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
    reservationSettings: (0, pg_core_1.json)("reservation_settings").$type(),
    /**
     * Holiday / vacation mode (programmable in advance):
     * {
     *   manualActive?: boolean,
     *   popupImageUrl?: string | null,
     *   message?: string | null,
     *   periods?: Array<{ id, startDate, endDate, title? }>  // YYYY-MM-DD inclusive (Europe/Zurich)
     * }
     */
    vacationSettings: (0, pg_core_1.json)("vacation_settings").$type(),
    /**
     * Merchant SMTP for newsletters / marketing (optional; falls back to platform Brevo).
     * { enabled, host, port, secure, user, password, fromEmail, fromName }
     */
    emailSmtpSettings: (0, pg_core_1.json)("email_smtp_settings").$type(),
    /** Per-merchant Brevo API key + from + usage counters */
    emailBrevoSettings: (0, pg_core_1.json)("email_brevo_settings").$type(),
    /**
     * Email delivery: platform = Superadmin Brevo; own = merchant SMTP/Brevo.
     * Default platform for new merchants; existing merchants with own SMTP/Brevo stay on own.
     */
    emailDeliveryMode: (0, pg_core_1.varchar)("email_delivery_mode", { length: 20 })
        .default("platform")
        .notNull(),
    /**
     * Marketing automation:
     * { reorderReminderEnabled, reorderReminderDays, reorderReminderSubject, reorderReminderBody }
     */
    marketingSettings: (0, pg_core_1.json)("marketing_settings").$type(),
    /**
     * Overview / EOD report email delivery:
     * { language, sendEveryDay, sendEveryMonth, emails, lastSentDailyDate, lastSentMonthlyKey }
     */
    reportEmailSettings: (0, pg_core_1.json)("report_email_settings").$type(),
    /**
     * POS / WebPOS receipt + kitchen + printer profiles:
     * { receiptHeader, receiptFooter, kitchenTicketHeader/Footer, paperWidthMm,
     *   receiptLanguage, receiptShowVatTable/StaffLine/QrCode, receiptLogoUrl,
     *   autoPrintReceipt, autoPrintKitchen, printers: PosPrinterProfile[] }
     */
    posPrintSettings: (0, pg_core_1.json)("pos_print_settings").$type(),
    /**
     * Table QR stand defaults for dashboard downloads:
     * { headerText, subtitleText, layoutTemplate: vertical | horizontal | curved }
     */
    tableQrSettings: (0, pg_core_1.json)("table_qr_settings").$type(),
    /**
     * Shared WebPOS / Android checkout behaviour:
     * tips, discount presets, rounding, quick-cash denominations, split bills.
     */
    posCheckoutSettings: (0, pg_core_1.json)("pos_checkout_settings").$type(),
    /**
     * Just Eat / Uber Eats credentials + toggles:
     * { justEat: { enabled, testMode, storeId, apiKey, webhookSecret, autoAccept }, uberEats: { ... } }
     */
    deliveryPlatformSettings: (0, pg_core_1.json)("delivery_platform_settings").$type(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(), // active, suspended, trial, expired
    subscriptionPlan: (0, pg_core_1.varchar)("subscription_plan", { length: 50 }).default("free"), // free, starter, professional, enterprise
    trialEndsAt: (0, pg_core_1.timestamp)("trial_ends_at"),
    subscriptionEndsAt: (0, pg_core_1.timestamp)("subscription_ends_at"),
    /** Active billing interval for auto-renewal */
    subscriptionBillingCycle: (0, pg_core_1.varchar)("subscription_billing_cycle", { length: 20 }),
    /** Adyen Checkout recurringDetailReference for platform subscription renewals */
    adyenRecurringDetailReference: (0, pg_core_1.varchar)("adyen_recurring_detail_reference", { length: 255 }),
    /** Owning reseller/agency (null = legacy unassigned) */
    resellerId: (0, pg_core_1.uuid)("reseller_id").references(() => exports.resellers.id, { onDelete: "set null" }),
    /** Assigned POS edition / feature pack (null = legacy full access) */
    editionId: (0, pg_core_1.uuid)("edition_id").references(() => exports.editions.id, { onDelete: "set null" }),
    /** Locked vertical: retail shop vs restaurant / food service. */
    businessCategory: (0, pg_core_1.varchar)("business_category", { length: 20 }),
    /** Reseller/agency billing flag — paid plan assigned by superadmin or owning reseller */
    planBillingPaid: (0, pg_core_1.boolean)("plan_billing_paid").default(true).notNull(),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }).notNull(),
    /** Set when merchant chooses a password (invite accepted or admin set one) */
    passwordSetAt: (0, pg_core_1.timestamp)("password_set_at"),
    /** SHA-256 of one-time invite / password-setup token */
    inviteTokenHash: (0, pg_core_1.varchar)("invite_token_hash", { length: 64 }),
    inviteTokenExpiresAt: (0, pg_core_1.timestamp)("invite_token_expires_at"),
    inviteSentAt: (0, pg_core_1.timestamp)("invite_sent_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    emailIdx: (0, pg_core_1.uniqueIndex)("merchants_email_idx").on(table.email),
    statusIdx: (0, pg_core_1.index)("merchants_status_idx").on(table.status),
    slugIdx: (0, pg_core_1.uniqueIndex)("merchants_slug_idx").on(table.slug),
    subdomainIdx: (0, pg_core_1.uniqueIndex)("merchants_subdomain_idx").on(table.subdomain),
    customDomainIdx: (0, pg_core_1.uniqueIndex)("merchants_custom_domain_idx").on(table.customDomain),
    syncApiKeyIdx: (0, pg_core_1.uniqueIndex)("merchants_sync_api_key_idx").on(table.syncApiKey),
    inviteTokenIdx: (0, pg_core_1.index)("merchants_invite_token_hash_idx").on(table.inviteTokenHash),
    resellerIdx: (0, pg_core_1.index)("merchants_reseller_idx").on(table.resellerId),
    editionIdx: (0, pg_core_1.index)("merchants_edition_idx").on(table.editionId),
}));
// ============================================================================
// MERCHANT STAFF & ROLES (panel + POS / WebPOS)
// ============================================================================
exports.merchantRoles = (0, pg_core_1.pgTable)("merchant_roles", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 100 }).notNull(),
    /** Comma-separated permission keys (see backend/src/lib/permissions.ts) */
    permissions: (0, pg_core_1.text)("permissions").notNull().default(""),
    isSystem: (0, pg_core_1.boolean)("is_system").default(false).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantNameIdx: (0, pg_core_1.uniqueIndex)("merchant_roles_merchant_name_idx").on(table.merchantId, table.name),
    merchantIdIdx: (0, pg_core_1.index)("merchant_roles_merchant_id_idx").on(table.merchantId),
}));
exports.merchantStaff = (0, pg_core_1.pgTable)("merchant_staff", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    roleId: (0, pg_core_1.uuid)("role_id")
        .notNull()
        .references(() => exports.merchantRoles.id, { onDelete: "restrict" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }),
    pinHash: (0, pg_core_1.varchar)("pin_hash", { length: 255 }),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }),
    /** Can sign in to merchant backend panel (email + password) */
    canAccessPanel: (0, pg_core_1.boolean)("can_access_panel").default(false).notNull(),
    /** Adyen POI terminal id preferred by this staff member on WebPOS/waiter. */
    preferredTerminalId: (0, pg_core_1.varchar)("preferred_terminal_id", { length: 255 }),
    /** Optional override for delivery driver hourly wage (CHF/h). */
    deliveryHourlyRateOverride: (0, pg_core_1.decimal)("delivery_hourly_rate_override", { precision: 10, scale: 2 }),
    /** Optional override for per-delivery fee (CHF). */
    deliveryPerOrderFeeOverride: (0, pg_core_1.decimal)("delivery_per_order_fee_override", { precision: 10, scale: 2 }),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("merchant_staff_merchant_id_idx").on(table.merchantId),
    merchantEmailIdx: (0, pg_core_1.uniqueIndex)("merchant_staff_merchant_email_idx").on(table.merchantId, table.email),
}));
exports.subscriptionPlans = (0, pg_core_1.pgTable)("subscription_plans", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    /** platform = superadmin; reseller = agency-owned package */
    ownerType: (0, pg_core_1.varchar)("owner_type", { length: 20 }).default("platform").notNull(),
    ownerId: (0, pg_core_1.uuid)("owner_id"),
    name: (0, pg_core_1.varchar)("name", { length: 100 }).notNull(),
    slug: (0, pg_core_1.varchar)("slug", { length: 50 }).notNull().unique(),
    description: (0, pg_core_1.text)("description"),
    priceMonthly: (0, pg_core_1.decimal)("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
    priceYearly: (0, pg_core_1.decimal)("price_yearly", { precision: 10, scale: 2 }),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).notNull().default("CHF"),
    /** Linked POS version — features applied on subscribe */
    editionId: (0, pg_core_1.uuid)("edition_id").references(() => exports.editions.id, { onDelete: "set null" }),
    maxDevices: (0, pg_core_1.integer)("max_devices").notNull().default(1),
    maxProducts: (0, pg_core_1.integer)("max_products"),
    /** Max concurrent main POS stations. 0 = unlimited. */
    maxPosPosts: (0, pg_core_1.integer)("max_pos_posts").default(0).notNull(),
    /** Max concurrent waiter stations. 0 = unlimited. */
    maxWaiterPosts: (0, pg_core_1.integer)("max_waiter_posts").default(0).notNull(),
    /** Max staff accounts. 0 = unlimited. */
    maxStaff: (0, pg_core_1.integer)("max_staff").default(0).notNull(),
    /** Addons bundled in this package */
    includedAddons: (0, pg_core_1.json)("included_addons").$type().default({}),
    features: (0, pg_core_1.json)("features").$type().default([]),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    /** Visible for merchants to purchase in their panel */
    isPublic: (0, pg_core_1.boolean)("is_public").notNull().default(true),
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    trialDays: (0, pg_core_1.integer)("trial_days").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    slugIdx: (0, pg_core_1.uniqueIndex)("subscription_plans_slug_idx").on(table.slug),
    activeIdx: (0, pg_core_1.index)("subscription_plans_active_idx").on(table.isActive),
    ownerIdx: (0, pg_core_1.index)("subscription_plans_owner_idx").on(table.ownerType, table.ownerId),
    editionIdx: (0, pg_core_1.index)("subscription_plans_edition_idx").on(table.editionId),
}));
/** Purchasable add-ons (inventory, signage, extra POS posts, etc.) */
exports.subscriptionAddons = (0, pg_core_1.pgTable)("subscription_addons", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    ownerType: (0, pg_core_1.varchar)("owner_type", { length: 20 }).default("platform").notNull(),
    ownerId: (0, pg_core_1.uuid)("owner_id"),
    slug: (0, pg_core_1.varchar)("slug", { length: 50 }).notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 100 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    /** inventory | signage | kds | ods | extra_pos_post | extra_waiter_post | extra_staff */
    addonKey: (0, pg_core_1.varchar)("addon_key", { length: 40 }).notNull(),
    priceMonthly: (0, pg_core_1.decimal)("price_monthly", { precision: 10, scale: 2 }).notNull().default("0"),
    priceYearly: (0, pg_core_1.decimal)("price_yearly", { precision: 10, scale: 2 }),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).notNull().default("CHF"),
    /** Quantity bump for limit-style addons (e.g. +1 POS post, +2 signage screens) */
    quantity: (0, pg_core_1.integer)("quantity").default(1).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    isPublic: (0, pg_core_1.boolean)("is_public").notNull().default(true),
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    slugOwnerIdx: (0, pg_core_1.uniqueIndex)("subscription_addons_slug_owner_idx").on(table.slug, table.ownerType, table.ownerId),
    activeIdx: (0, pg_core_1.index)("subscription_addons_active_idx").on(table.isActive),
    ownerIdx: (0, pg_core_1.index)("subscription_addons_owner_idx").on(table.ownerType, table.ownerId),
}));
/** Active merchant add-on subscriptions */
exports.merchantAddonSubscriptions = (0, pg_core_1.pgTable)("merchant_addon_subscriptions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    addonId: (0, pg_core_1.uuid)("addon_id")
        .notNull()
        .references(() => exports.subscriptionAddons.id, { onDelete: "restrict" }),
    billingCycle: (0, pg_core_1.varchar)("billing_cycle", { length: 20 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("active"),
    periodStart: (0, pg_core_1.timestamp)("period_start"),
    periodEnd: (0, pg_core_1.timestamp)("period_end"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("merchant_addon_subscriptions_merchant_idx").on(table.merchantId),
    addonIdx: (0, pg_core_1.index)("merchant_addon_subscriptions_addon_idx").on(table.addonId),
    statusIdx: (0, pg_core_1.index)("merchant_addon_subscriptions_status_idx").on(table.status),
}));
/** Add-on payment records (Adyen checkout) */
exports.subscriptionAddonPayments = (0, pg_core_1.pgTable)("subscription_addon_payments", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    addonId: (0, pg_core_1.uuid)("addon_id")
        .notNull()
        .references(() => exports.subscriptionAddons.id, { onDelete: "restrict" }),
    billingCycle: (0, pg_core_1.varchar)("billing_cycle", { length: 20 }).notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).notNull().default("CHF"),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("pending"),
    adyenSessionId: (0, pg_core_1.varchar)("adyen_session_id", { length: 255 }),
    adyenPspReference: (0, pg_core_1.varchar)("adyen_psp_reference", { length: 255 }),
    adyenRecurringDetailReference: (0, pg_core_1.varchar)("adyen_recurring_detail_reference", { length: 255 }),
    isRecurring: (0, pg_core_1.boolean)("is_recurring").default(false).notNull(),
    adyenResultCode: (0, pg_core_1.varchar)("adyen_result_code", { length: 50 }),
    paidAt: (0, pg_core_1.timestamp)("paid_at"),
    periodStart: (0, pg_core_1.timestamp)("period_start"),
    periodEnd: (0, pg_core_1.timestamp)("period_end"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("subscription_addon_payments_merchant_id_idx").on(table.merchantId),
    addonIdIdx: (0, pg_core_1.index)("subscription_addon_payments_addon_id_idx").on(table.addonId),
    statusIdx: (0, pg_core_1.index)("subscription_addon_payments_status_idx").on(table.status),
    sessionIdx: (0, pg_core_1.index)("subscription_addon_payments_session_idx").on(table.adyenSessionId),
}));
/** Platform-wide key/value settings (e.g. platform Adyen credentials) */
exports.platformSettings = (0, pg_core_1.pgTable)("platform_settings", {
    key: (0, pg_core_1.varchar)("key", { length: 100 }).primaryKey(),
    value: (0, pg_core_1.text)("value"),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
});
/** One-time password reset tokens for superadmin / reseller / merchant / staff. */
exports.passwordResetTokens = (0, pg_core_1.pgTable)("password_reset_tokens", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull(),
    role: (0, pg_core_1.varchar)("role", { length: 20 }).notNull(),
    accountId: (0, pg_core_1.uuid)("account_id").notNull(),
    tokenHash: (0, pg_core_1.varchar)("token_hash", { length: 64 }).notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    usedAt: (0, pg_core_1.timestamp)("used_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    tokenHashIdx: (0, pg_core_1.uniqueIndex)("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    emailIdx: (0, pg_core_1.index)("password_reset_tokens_email_idx").on(table.email),
    expiresIdx: (0, pg_core_1.index)("password_reset_tokens_expires_idx").on(table.expiresAt),
}));
/** Merchant subscription purchases paid to the platform Adyen account */
exports.subscriptionPayments = (0, pg_core_1.pgTable)("subscription_payments", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    planId: (0, pg_core_1.uuid)("plan_id")
        .notNull()
        .references(() => exports.subscriptionPlans.id, { onDelete: "restrict" }),
    billingCycle: (0, pg_core_1.varchar)("billing_cycle", { length: 20 }).notNull(), // monthly | yearly
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).notNull().default("CHF"),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("pending"), // pending | paid | failed | cancelled
    adyenSessionId: (0, pg_core_1.varchar)("adyen_session_id", { length: 255 }),
    adyenPspReference: (0, pg_core_1.varchar)("adyen_psp_reference", { length: 255 }),
    adyenRecurringDetailReference: (0, pg_core_1.varchar)("adyen_recurring_detail_reference", { length: 255 }),
    isRecurring: (0, pg_core_1.boolean)("is_recurring").default(false).notNull(),
    adyenResultCode: (0, pg_core_1.varchar)("adyen_result_code", { length: 50 }),
    paidAt: (0, pg_core_1.timestamp)("paid_at"),
    periodStart: (0, pg_core_1.timestamp)("period_start"),
    periodEnd: (0, pg_core_1.timestamp)("period_end"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("subscription_payments_merchant_id_idx").on(table.merchantId),
    planIdIdx: (0, pg_core_1.index)("subscription_payments_plan_id_idx").on(table.planId),
    statusIdx: (0, pg_core_1.index)("subscription_payments_status_idx").on(table.status),
    sessionIdx: (0, pg_core_1.index)("subscription_payments_session_idx").on(table.adyenSessionId),
}));
// ============================================================================
// DEVICES
// ============================================================================
exports.devices = (0, pg_core_1.pgTable)("devices", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    deviceId: (0, pg_core_1.varchar)("device_id", { length: 255 }).notNull().unique(), // POS-{MERCHANT_ID}-{UUID}-{TIMESTAMP}
    deviceName: (0, pg_core_1.varchar)("device_name", { length: 255 }).notNull(),
    deviceType: (0, pg_core_1.varchar)("device_type", { length: 50 }).notNull(), // mobile, tablet, terminal
    osVersion: (0, pg_core_1.varchar)("os_version", { length: 50 }),
    appVersion: (0, pg_core_1.varchar)("app_version", { length: 50 }),
    lastSync: (0, pg_core_1.timestamp)("last_sync"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("devices_merchant_id_idx").on(table.merchantId),
    deviceIdIdx: (0, pg_core_1.uniqueIndex)("devices_device_id_idx").on(table.deviceId),
}));
// ============================================================================
// LICENSING SYSTEM
// ============================================================================
exports.licenses = (0, pg_core_1.pgTable)("licenses", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    deviceId: (0, pg_core_1.uuid)("device_id")
        .notNull()
        .references(() => exports.devices.id, { onDelete: "cascade" }),
    licenseKey: (0, pg_core_1.varchar)("license_key", { length: 255 }).notNull().unique(), // M123ABC-D456EFG-7K9M2P-2025
    licenseType: (0, pg_core_1.varchar)("license_type", { length: 50 }).notNull(), // trial, yearly, custom
    trialDays: (0, pg_core_1.integer)("trial_days").default(7),
    startsAt: (0, pg_core_1.timestamp)("starts_at").notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    renewalNotifiedAt: (0, pg_core_1.timestamp)("renewal_notified_at"),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(), // active, expired, suspended
    /** When set, this seat was issued from a reseller's license pool */
    issuedByResellerId: (0, pg_core_1.uuid)("issued_by_reseller_id").references(() => exports.resellers.id, {
        onDelete: "set null",
    }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("licenses_merchant_id_idx").on(table.merchantId),
    deviceIdIdx: (0, pg_core_1.index)("licenses_device_id_idx").on(table.deviceId),
    licenseKeyIdx: (0, pg_core_1.uniqueIndex)("licenses_license_key_idx").on(table.licenseKey),
    statusIdx: (0, pg_core_1.index)("licenses_status_idx").on(table.status),
    expiresAtIdx: (0, pg_core_1.index)("licenses_expires_at_idx").on(table.expiresAt),
    issuedByResellerIdx: (0, pg_core_1.index)("licenses_issued_by_reseller_idx").on(table.issuedByResellerId),
}));
// ============================================================================
// LICENSE TRANSACTIONS
// ============================================================================
exports.licenseTransactions = (0, pg_core_1.pgTable)("license_transactions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    transactionType: (0, pg_core_1.varchar)("transaction_type", { length: 50 }).notNull(), // purchase, renewal, upgrade
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).default("USD").notNull(),
    paymentStatus: (0, pg_core_1.varchar)("payment_status", { length: 50 }).notNull(), // pending, completed, failed
    paymentMethod: (0, pg_core_1.varchar)("payment_method", { length: 50 }), // card, bank_transfer
    paymentId: (0, pg_core_1.varchar)("payment_id", { length: 255 }),
    invoiceNumber: (0, pg_core_1.varchar)("invoice_number", { length: 255 }).unique(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("license_transactions_merchant_id_idx").on(table.merchantId),
    paymentStatusIdx: (0, pg_core_1.index)("license_transactions_payment_status_idx").on(table.paymentStatus),
}));
// ============================================================================
// VAT SETTINGS
// ============================================================================
exports.vatSettings = (0, pg_core_1.pgTable)("vat_settings", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    country: (0, pg_core_1.varchar)("country", { length: 100 }).notNull(),
    vatRate: (0, pg_core_1.decimal)("vat_rate", { precision: 5, scale: 2 }).notNull(),
    taxId: (0, pg_core_1.varchar)("tax_id", { length: 255 }),
    isDefault: (0, pg_core_1.boolean)("is_default").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("vat_settings_merchant_id_idx").on(table.merchantId),
}));
// ============================================================================
// PRODUCTS & CATEGORIES
// ============================================================================
exports.categories = (0, pg_core_1.pgTable)("categories", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    color: (0, pg_core_1.varchar)("color", { length: 7 }), // hex color
    imageUrl: (0, pg_core_1.varchar)("image_url", { length: 500 }),
    /** Special shelf for promotional / offer products */
    isOffersCategory: (0, pg_core_1.boolean)("is_offers_category").default(false).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    clientId: (0, pg_core_1.varchar)("client_id", { length: 64 }), // offline sync id from POS device
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("categories_merchant_id_idx").on(table.merchantId),
    clientIdIdx: (0, pg_core_1.index)("categories_client_id_idx").on(table.clientId),
}));
exports.products = (0, pg_core_1.pgTable)("products", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    categoryId: (0, pg_core_1.uuid)("category_id").references(() => exports.categories.id, { onDelete: "set null" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    sku: (0, pg_core_1.varchar)("sku", { length: 100 }),
    barcode: (0, pg_core_1.varchar)("barcode", { length: 255 }),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }).notNull(),
    cost: (0, pg_core_1.decimal)("cost", { precision: 10, scale: 2 }),
    stock: (0, pg_core_1.integer)("stock").default(0).notNull(),
    lowStockThreshold: (0, pg_core_1.integer)("low_stock_threshold").default(5),
    isTaxable: (0, pg_core_1.boolean)("is_taxable").default(true).notNull(),
    description: (0, pg_core_1.text)("description"),
    imageUrl: (0, pg_core_1.varchar)("image_url", { length: 500 }),
    // Offline-first retail POS extensions
    productType: (0, pg_core_1.varchar)("product_type", { length: 50 }).default("standard").notNull(), // standard | open_price | weighed | combo | modifier
    isOpenPrice: (0, pg_core_1.boolean)("is_open_price").default(false).notNull(),
    soldByWeight: (0, pg_core_1.boolean)("sold_by_weight").default(false).notNull(),
    weightUnit: (0, pg_core_1.varchar)("weight_unit", { length: 10 }).default("kg"), // kg | g | lb
    // [{ minQty: 10, price: 2.5 }, ...]
    bulkPricing: (0, pg_core_1.json)("bulk_pricing").$type().default([]),
    // [{ id, name, price }] legacy flat extras (kept for POS sync; prefer modifier groups)
    extras: (0, pg_core_1.json)("extras").$type().default([]),
    // Combo slots: [{ id, name, minPick, maxPick, options: [{ productId, extraPrice? }] }]
    // Legacy fixed components also supported: [{ productId, quantity, name? }]
    comboItems: (0, pg_core_1.json)("combo_items")
        .$type()
        .default([]),
    // [{ id, name, price, saleStatus, isDefault, sortOrder }] size/spec variants
    specifications: (0, pg_core_1.json)("specifications")
        .$type()
        .default([]),
    buttonColor: (0, pg_core_1.varchar)("button_color", { length: 20 }), // POS button color hex
    allowExtras: (0, pg_core_1.boolean)("allow_extras").default(false).notNull(),
    /** If set (>0), customer can claim this product free by spending this many loyalty points */
    loyaltyRewardPoints: (0, pg_core_1.integer)("loyalty_reward_points"),
    /** Portions this recipe produces. Sale consumes line qty / yield (default 1). */
    recipeYield: (0, pg_core_1.decimal)("recipe_yield", { precision: 12, scale: 4 }).default("1").notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    clientId: (0, pg_core_1.varchar)("client_id", { length: 64 }), // offline sync id from POS device
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("products_merchant_id_idx").on(table.merchantId),
    barcodeIdx: (0, pg_core_1.index)("products_barcode_idx").on(table.barcode),
    barcodeUniqueIdx: (0, pg_core_1.uniqueIndex)("products_merchant_barcode_uidx")
        .on(table.merchantId, table.barcode)
        .where((0, drizzle_orm_1.sql) `${table.barcode} IS NOT NULL`),
    clientIdIdx: (0, pg_core_1.index)("products_client_id_idx").on(table.clientId),
    typeIdx: (0, pg_core_1.index)("products_type_idx").on(table.productType),
    sortOrderIdx: (0, pg_core_1.index)("products_sort_order_idx").on(table.merchantId, table.sortOrder),
}));
// ============================================================================
// MODIFIER GROUPS (extras / add-ons)
// ============================================================================
exports.modifierGroups = (0, pg_core_1.pgTable)("modifier_groups", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    // free | fixed | toppings_by_size
    pricingType: (0, pg_core_1.varchar)("pricing_type", { length: 40 }).default("fixed").notNull(),
    // optional | required
    selectionType: (0, pg_core_1.varchar)("selection_type", { length: 40 }).default("optional").notNull(),
    minSelectable: (0, pg_core_1.integer)("min_selectable").default(0).notNull(),
    maxSelectable: (0, pg_core_1.integer)("max_selectable").default(1).notNull(),
    defaultCollapsed: (0, pg_core_1.boolean)("default_collapsed").default(false).notNull(),
    allowMultipleSameItem: (0, pg_core_1.boolean)("allow_multiple_same_item").default(false).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("modifier_groups_merchant_id_idx").on(table.merchantId),
}));
exports.modifierOptions = (0, pg_core_1.pgTable)("modifier_options", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    groupId: (0, pg_core_1.uuid)("group_id")
        .notNull()
        .references(() => exports.modifierGroups.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }).default("0").notNull(),
    // in_stock | out_of_stock
    saleStatus: (0, pg_core_1.varchar)("sale_status", { length: 40 }).default("in_stock").notNull(),
    isDefault: (0, pg_core_1.boolean)("is_default").default(false).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    /** Optional ingredient consumed when this extra is selected on a paid sale. */
    inventoryItemId: (0, pg_core_1.uuid)("inventory_item_id"),
    inventoryQty: (0, pg_core_1.decimal)("inventory_qty", { precision: 14, scale: 4 }).default("0").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    groupIdIdx: (0, pg_core_1.index)("modifier_options_group_id_idx").on(table.groupId),
    inventoryItemIdx: (0, pg_core_1.index)("modifier_options_inventory_item_idx").on(table.inventoryItemId),
}));
exports.productModifierGroups = (0, pg_core_1.pgTable)("product_modifier_groups", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    productId: (0, pg_core_1.uuid)("product_id")
        .notNull()
        .references(() => exports.products.id, { onDelete: "cascade" }),
    groupId: (0, pg_core_1.uuid)("group_id")
        .notNull()
        .references(() => exports.modifierGroups.id, { onDelete: "cascade" }),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    productIdIdx: (0, pg_core_1.index)("product_modifier_groups_product_id_idx").on(table.productId),
    groupIdIdx: (0, pg_core_1.index)("product_modifier_groups_group_id_idx").on(table.groupId),
    uniqueLink: (0, pg_core_1.uniqueIndex)("product_modifier_groups_unique").on(table.productId, table.groupId),
}));
// ============================================================================
// CUSTOMERS
// ============================================================================
exports.customers = (0, pg_core_1.pgTable)("customers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    email: (0, pg_core_1.varchar)("email", { length: 255 }),
    phone: (0, pg_core_1.varchar)("phone", { length: 20 }),
    firstName: (0, pg_core_1.varchar)("first_name", { length: 100 }),
    lastName: (0, pg_core_1.varchar)("last_name", { length: 100 }),
    passwordHash: (0, pg_core_1.varchar)("password_hash", { length: 255 }), // null = guest-only profile
    defaultAddress: (0, pg_core_1.text)("default_address"),
    defaultZip: (0, pg_core_1.varchar)("default_zip", { length: 20 }),
    defaultCity: (0, pg_core_1.varchar)("default_city", { length: 100 }),
    loyaltyPoints: (0, pg_core_1.integer)("loyalty_points").default(0),
    totalSpent: (0, pg_core_1.decimal)("total_spent", { precision: 10, scale: 2 }).default("0"),
    /** Opt-in for newsletters / marketing (default true when email known from orders) */
    marketingOptIn: (0, pg_core_1.boolean)("marketing_opt_in").default(true).notNull(),
    /** Denormalized last paid/completed web or POS order time */
    lastOrderAt: (0, pg_core_1.timestamp)("last_order_at"),
    /** Last automatic reorder-reminder email sent */
    lastReorderReminderAt: (0, pg_core_1.timestamp)("last_reorder_reminder_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("customers_merchant_id_idx").on(table.merchantId),
    emailIdx: (0, pg_core_1.index)("customers_email_idx").on(table.email),
    lastOrderIdx: (0, pg_core_1.index)("customers_last_order_idx").on(table.merchantId, table.lastOrderAt),
}));
/** Saved delivery addresses for logged-in shop customers (Home, Office, …). */
exports.customerAddresses = (0, pg_core_1.pgTable)("customer_addresses", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    customerId: (0, pg_core_1.uuid)("customer_id")
        .notNull()
        .references(() => exports.customers.id, { onDelete: "cascade" }),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    /** home | office | other | free-text label */
    label: (0, pg_core_1.varchar)("label", { length: 40 }).notNull().default("home"),
    address: (0, pg_core_1.text)("address").notNull(),
    zipCode: (0, pg_core_1.varchar)("zip_code", { length: 20 }),
    city: (0, pg_core_1.varchar)("city", { length: 100 }),
    latitude: (0, pg_core_1.decimal)("latitude", { precision: 10, scale: 7 }),
    longitude: (0, pg_core_1.decimal)("longitude", { precision: 10, scale: 7 }),
    isDefault: (0, pg_core_1.boolean)("is_default").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    customerIdx: (0, pg_core_1.index)("customer_addresses_customer_idx").on(table.customerId),
    merchantCustomerIdx: (0, pg_core_1.index)("customer_addresses_merchant_customer_idx").on(table.merchantId, table.customerId),
}));
// ============================================================================
// ORDERS
// ============================================================================
exports.orders = (0, pg_core_1.pgTable)("orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    orderNumber: (0, pg_core_1.varchar)("order_number", { length: 50 }).notNull().unique(),
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    orderType: (0, pg_core_1.varchar)("order_type", { length: 50 }).notNull(), // pos, web_shop
    /** online_shop | justeat | ubereats — ordering channel (POS filter / labels) */
    orderSource: (0, pg_core_1.varchar)("order_source", { length: 50 }),
    /** Aggregator external id for dedupe + status sync */
    externalOrderId: (0, pg_core_1.varchar)("external_order_id", { length: 255 }),
    // takeaway | dine_in | delivery — drives channel tax rate
    fulfillmentChannel: (0, pg_core_1.varchar)("fulfillment_channel", { length: 50 }).default("takeaway"),
    // web_shop lifecycle: pending_approval → accepted|preparing → ready → out_for_delivery? → completed | cancelled
    // legacy: pending (treated as pending_approval), completed, cancelled
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("pending").notNull(),
    subtotal: (0, pg_core_1.decimal)("subtotal", { precision: 10, scale: 2 }).notNull(),
    taxAmount: (0, pg_core_1.decimal)("tax_amount", { precision: 10, scale: 2 }).notNull(),
    discountAmount: (0, pg_core_1.decimal)("discount_amount", { precision: 10, scale: 2 }).default("0"),
    deliveryFee: (0, pg_core_1.decimal)("delivery_fee", { precision: 10, scale: 2 }).default("0"),
    tipAmount: (0, pg_core_1.decimal)("tip_amount", { precision: 10, scale: 2 }).default("0"),
    /** Cash rounding adjustment applied at checkout (can be negative) */
    roundingAmount: (0, pg_core_1.decimal)("rounding_amount", { precision: 10, scale: 2 }).default("0"),
    amountTendered: (0, pg_core_1.decimal)("amount_tendered", { precision: 10, scale: 2 }),
    changeDue: (0, pg_core_1.decimal)("change_due", { precision: 10, scale: 2 }),
    /** Staff who completed the POS / WebPOS sale */
    staffName: (0, pg_core_1.varchar)("staff_name", { length: 255 }),
    /** Stable staff id for own-sales EOD / reports (nullable for legacy rows) */
    staffId: (0, pg_core_1.uuid)("staff_id").references(() => exports.merchantStaff.id, { onDelete: "set null" }),
    /** Online card surcharge charged to the customer */
    cardFee: (0, pg_core_1.decimal)("card_fee", { precision: 10, scale: 2 }).default("0"),
    /** CHF discount applied from redeeming loyalty points as money */
    pointsDiscount: (0, pg_core_1.decimal)("points_discount", { precision: 10, scale: 2 }).default("0"),
    pointsEarned: (0, pg_core_1.integer)("points_earned").default(0),
    pointsRedeemed: (0, pg_core_1.integer)("points_redeemed").default(0),
    total: (0, pg_core_1.decimal)("total", { precision: 10, scale: 2 }).notNull(),
    paymentMethod: (0, pg_core_1.varchar)("payment_method", { length: 50 }), // cash, card, terminal, loyalty, online, invoice
    paymentStatus: (0, pg_core_1.varchar)("payment_status", { length: 50 }), // pending, awaiting_payment, completed, failed
    invoiceNumber: (0, pg_core_1.varchar)("invoice_number", { length: 50 }),
    invoiceIssuedAt: (0, pg_core_1.timestamp)("invoice_issued_at"),
    invoiceDueAt: (0, pg_core_1.timestamp)("invoice_due_at"),
    adyenReference: (0, pg_core_1.varchar)("adyen_reference", { length: 255 }),
    /** Original Adyen POI transaction timestamp (required for terminal card refunds) */
    adyenPoiTransactionTs: (0, pg_core_1.timestamp)("adyen_poi_transaction_ts"),
    /** Serialized Adyen Terminal API CustomerReceipt JSON */
    adyenCustomerReceiptJson: (0, pg_core_1.text)("adyen_customer_receipt_json"),
    /** Serialized Adyen Terminal API CashierReceipt JSON */
    adyenCashierReceiptJson: (0, pg_core_1.text)("adyen_cashier_receipt_json"),
    notes: (0, pg_core_1.text)("notes"),
    shippingAddress: (0, pg_core_1.text)("shipping_address"),
    /** Geocoded destination for delivery map (shop checkout / assign). */
    deliveryLatitude: (0, pg_core_1.decimal)("delivery_latitude", { precision: 10, scale: 7 }),
    deliveryLongitude: (0, pg_core_1.decimal)("delivery_longitude", { precision: 10, scale: 7 }),
    /** Delivery driver assigned from the panel (distinct from staffId = cashier). */
    assignedDeliveryStaffId: (0, pg_core_1.uuid)("assigned_delivery_staff_id").references(() => exports.merchantStaff.id, {
        onDelete: "set null",
    }),
    /** Public token for guest order tracking (no login). */
    deliveryTrackingToken: (0, pg_core_1.varchar)("delivery_tracking_token", { length: 64 }),
    deliveryZoneId: (0, pg_core_1.uuid)("delivery_zone_id"),
    scheduledFor: (0, pg_core_1.timestamp)("scheduled_for"), // null = ASAP
    customerName: (0, pg_core_1.varchar)("customer_name", { length: 255 }),
    customerPhone: (0, pg_core_1.varchar)("customer_phone", { length: 40 }),
    customerEmail: (0, pg_core_1.varchar)("customer_email", { length: 255 }),
    // Dine-in table service
    tableId: (0, pg_core_1.uuid)("table_id"),
    tableLabel: (0, pg_core_1.varchar)("table_label", { length: 50 }),
    guestCount: (0, pg_core_1.integer)("guest_count"), // PAX / covers for this check
    // Split billing: equal /N or per-seat payments
    billSplits: (0, pg_core_1.json)("bill_splits")
        .$type()
        .default([]),
    /** Links split-bill sibling orders (Android masterOrderId / WebPOS split checkout) */
    masterOrderId: (0, pg_core_1.varchar)("master_order_id", { length: 64 }),
    /** 1-based split check number within a masterOrderId group */
    splitCheckNumber: (0, pg_core_1.integer)("split_check_number"),
    clientId: (0, pg_core_1.varchar)("client_id", { length: 64 }), // offline POS transaction id
    deviceId: (0, pg_core_1.varchar)("device_id", { length: 255 }),
    syncedAt: (0, pg_core_1.timestamp)("synced_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    /** Merchant-estimated ready / pickup time (live-adjustable from Order Center) */
    estimatedReadyAt: (0, pg_core_1.timestamp)("estimated_ready_at"),
    /** Kitchen + receipt auto-print jobs completed for this order */
    printCount: (0, pg_core_1.integer)("print_count").default(0),
    cancelReason: (0, pg_core_1.text)("cancel_reason"),
    cancelledAt: (0, pg_core_1.timestamp)("cancelled_at"),
    refundAmount: (0, pg_core_1.decimal)("refund_amount", { precision: 10, scale: 2 }).default("0"),
    refundedAt: (0, pg_core_1.timestamp)("refunded_at"),
    /** Last refund reason (preset English or custom message) */
    refundReason: (0, pg_core_1.text)("refund_reason"),
    /** Cumulative goodwill / unreferenced compensation (not tied to original payment cap). */
    goodwillAmount: (0, pg_core_1.decimal)("goodwill_amount", { precision: 10, scale: 2 }).default("0"),
    /** Split tenders: [{ method, amount }] for mixed payments (gift + cash, etc.). */
    paymentBreakdown: (0, pg_core_1.json)("payment_breakdown").$type(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("orders_merchant_id_idx").on(table.merchantId),
    orderNumberIdx: (0, pg_core_1.uniqueIndex)("orders_order_number_idx").on(table.orderNumber),
    statusIdx: (0, pg_core_1.index)("orders_status_idx").on(table.status),
    createdAtIdx: (0, pg_core_1.index)("orders_created_at_idx").on(table.createdAt),
    clientIdIdx: (0, pg_core_1.index)("orders_client_id_idx").on(table.clientId),
    tableIdIdx: (0, pg_core_1.index)("orders_table_id_idx").on(table.tableId),
    masterOrderIdIdx: (0, pg_core_1.index)("orders_master_order_id_idx").on(table.masterOrderId),
    orderSourceIdx: (0, pg_core_1.index)("orders_merchant_order_source_idx").on(table.merchantId, table.orderSource),
    externalOrderIdx: (0, pg_core_1.index)("orders_merchant_external_order_idx").on(table.merchantId, table.orderSource, table.externalOrderId),
}));
// ============================================================================
// WEBPOS / POS HELD ORDERS (on-hold carts)
// ============================================================================
exports.heldOrders = (0, pg_core_1.pgTable)("held_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    label: (0, pg_core_1.varchar)("label", { length: 120 }),
    status: (0, pg_core_1.varchar)("status", { length: 40 }).default("held").notNull(), // held | sent_to_kitchen
    channel: (0, pg_core_1.varchar)("channel", { length: 50 }).default("takeaway"),
    cartJson: (0, pg_core_1.json)("cart_json").$type().notNull(),
    notes: (0, pg_core_1.text)("notes"),
    staffId: (0, pg_core_1.uuid)("staff_id"),
    staffName: (0, pg_core_1.varchar)("staff_name", { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("held_orders_merchant_id_idx").on(table.merchantId),
    statusIdx: (0, pg_core_1.index)("held_orders_status_idx").on(table.merchantId, table.status),
}));
// ============================================================================
// POS SESSION REGISTRY (concurrent station limits)
// ============================================================================
exports.posSessions = (0, pg_core_1.pgTable)("pos_sessions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    /** main = register till; waiter = floor order entry */
    sessionKind: (0, pg_core_1.varchar)("session_kind", { length: 20 }).default("main").notNull(),
    /** webpos | waiter_web | android */
    platform: (0, pg_core_1.varchar)("platform", { length: 30 }).notNull(),
    deviceId: (0, pg_core_1.varchar)("device_id", { length: 128 }).notNull(),
    deviceLabel: (0, pg_core_1.varchar)("device_label", { length: 255 }),
    staffId: (0, pg_core_1.uuid)("staff_id"),
    staffName: (0, pg_core_1.varchar)("staff_name", { length: 255 }),
    /** Main till only: local Print Agent reachable on last heartbeat */
    printAgentOnline: (0, pg_core_1.boolean)("print_agent_online"),
    lastHeartbeat: (0, pg_core_1.timestamp)("last_heartbeat").defaultNow().notNull(),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("pos_sessions_merchant_id_idx").on(table.merchantId),
    deviceIdx: (0, pg_core_1.index)("pos_sessions_merchant_device_idx").on(table.merchantId, table.deviceId, table.sessionKind),
    activeIdx: (0, pg_core_1.index)("pos_sessions_active_idx").on(table.merchantId, table.sessionKind, table.lastHeartbeat),
}));
/** Latest GPS ping per delivery driver (upserted on each location post). */
exports.deliveryDriverLocations = (0, pg_core_1.pgTable)("delivery_driver_locations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    staffId: (0, pg_core_1.uuid)("staff_id")
        .notNull()
        .references(() => exports.merchantStaff.id, { onDelete: "cascade" }),
    latitude: (0, pg_core_1.decimal)("latitude", { precision: 10, scale: 7 }).notNull(),
    longitude: (0, pg_core_1.decimal)("longitude", { precision: 10, scale: 7 }).notNull(),
    accuracyM: (0, pg_core_1.decimal)("accuracy_m", { precision: 10, scale: 2 }),
    heading: (0, pg_core_1.decimal)("heading", { precision: 6, scale: 2 }),
    speedMps: (0, pg_core_1.decimal)("speed_mps", { precision: 8, scale: 3 }),
    recordedAt: (0, pg_core_1.timestamp)("recorded_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantStaffUnique: (0, pg_core_1.uniqueIndex)("delivery_driver_locations_merchant_staff_uidx").on(table.merchantId, table.staffId),
    merchantRecordedIdx: (0, pg_core_1.index)("delivery_driver_locations_merchant_recorded_idx").on(table.merchantId, table.recordedAt),
}));
/** Driver clock-in windows for hourly wage (started when GPS tracking starts). */
exports.deliveryDriverShifts = (0, pg_core_1.pgTable)("delivery_driver_shifts", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    staffId: (0, pg_core_1.uuid)("staff_id")
        .notNull()
        .references(() => exports.merchantStaff.id, { onDelete: "cascade" }),
    startedAt: (0, pg_core_1.timestamp)("started_at").defaultNow().notNull(),
    endedAt: (0, pg_core_1.timestamp)("ended_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantStaffIdx: (0, pg_core_1.index)("delivery_driver_shifts_merchant_staff_idx").on(table.merchantId, table.staffId, table.startedAt),
}));
// ============================================================================
// KITCHEN DISPLAY (browser KDS)
// ============================================================================
exports.kdsStations = (0, pg_core_1.pgTable)("kds_stations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    token: (0, pg_core_1.varchar)("token", { length: 128 }).notNull(),
    /** Short numeric code for /kds/{code} URLs (like TV signage) */
    shortCode: (0, pg_core_1.varchar)("short_code", { length: 8 }),
    orderTypes: (0, pg_core_1.json)("order_types").$type().default([]).notNull(),
    categoryIds: (0, pg_core_1.json)("category_ids").$type().default([]).notNull(),
    productIds: (0, pg_core_1.json)("product_ids").$type().default([]).notNull(),
    /** Display theme: dark | light | teal */
    theme: (0, pg_core_1.varchar)("theme", { length: 32 }).default("dark").notNull(),
    /** Ticket layout: grid | rows | slider */
    layoutMode: (0, pg_core_1.varchar)("layout_mode", { length: 16 }).default("grid").notNull(),
    /** Grid columns when layoutMode=grid (1–6) */
    gridColumns: (0, pg_core_1.integer)("grid_columns").default(3).notNull(),
    /** Play alert when a pending ticket exceeds this many minutes */
    overdueMinutes: (0, pg_core_1.integer)("overdue_minutes").default(20).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("kds_stations_merchant_id_idx").on(table.merchantId),
    tokenIdx: (0, pg_core_1.index)("kds_stations_token_idx").on(table.token),
    shortCodeIdx: (0, pg_core_1.uniqueIndex)("kds_stations_short_code_uidx").on(table.shortCode),
}));
exports.KDS_THEMES = ["dark", "light", "teal"];
exports.KDS_LAYOUT_MODES = ["grid", "rows", "slider"];
exports.kdsTickets = (0, pg_core_1.pgTable)("kds_tickets", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    ticketKey: (0, pg_core_1.varchar)("ticket_key", { length: 255 }).notNull(),
    orderNumber: (0, pg_core_1.varchar)("order_number", { length: 64 }),
    tableLabel: (0, pg_core_1.varchar)("table_label", { length: 120 }),
    tabNumber: (0, pg_core_1.varchar)("tab_number", { length: 64 }),
    channel: (0, pg_core_1.varchar)("channel", { length: 50 }),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).default("pending").notNull(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("kds_tickets_merchant_id_idx").on(table.merchantId),
    ticketKeyIdx: (0, pg_core_1.index)("kds_tickets_merchant_ticket_key_idx").on(table.merchantId, table.ticketKey),
}));
exports.kdsTicketItems = (0, pg_core_1.pgTable)("kds_ticket_items", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    ticketId: (0, pg_core_1.uuid)("ticket_id")
        .notNull()
        .references(() => exports.kdsTickets.id, { onDelete: "cascade" }),
    lineId: (0, pg_core_1.varchar)("line_id", { length: 128 }).notNull(),
    productId: (0, pg_core_1.uuid)("product_id"),
    categoryId: (0, pg_core_1.uuid)("category_id"),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    quantity: (0, pg_core_1.decimal)("quantity", { precision: 12, scale: 3 }).notNull(),
    lineNote: (0, pg_core_1.text)("line_note"),
    courseNumber: (0, pg_core_1.integer)("course_number"),
    modifiersJson: (0, pg_core_1.json)("modifiers_json").$type().default({}),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).default("pending").notNull(),
    readyAt: (0, pg_core_1.timestamp)("ready_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    ticketIdx: (0, pg_core_1.index)("kds_ticket_items_ticket_id_idx").on(table.ticketId),
    lineIdx: (0, pg_core_1.index)("kds_ticket_items_line_id_idx").on(table.ticketId, table.lineId),
}));
exports.ODS_THEMES = ["light", "teal", "dark"];
exports.odsDisplays = (0, pg_core_1.pgTable)("ods_displays", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    token: (0, pg_core_1.varchar)("token", { length: 128 }).notNull(),
    /** Short numeric code for /ods/{code} URLs (like TV signage) */
    shortCode: (0, pg_core_1.varchar)("short_code", { length: 8 }),
    /** Customer board color theme */
    theme: (0, pg_core_1.varchar)("theme", { length: 32 }).default("light").notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("ods_displays_merchant_id_idx").on(table.merchantId),
    tokenIdx: (0, pg_core_1.uniqueIndex)("ods_displays_token_uidx").on(table.token),
    shortCodeIdx: (0, pg_core_1.uniqueIndex)("ods_displays_short_code_uidx").on(table.shortCode),
}));
exports.odsOrders = (0, pg_core_1.pgTable)("ods_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    orderNumber: (0, pg_core_1.varchar)("order_number", { length: 64 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).default("preparing").notNull(),
    readyAt: (0, pg_core_1.timestamp)("ready_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("ods_orders_merchant_id_idx").on(table.merchantId),
    merchantOrderIdx: (0, pg_core_1.uniqueIndex)("ods_orders_merchant_order_uidx").on(table.merchantId, table.orderNumber),
}));
/** Staff-dismissed pickup numbers — survives clear-all and blocks live merge re-appearance. */
exports.odsDismissedOrders = (0, pg_core_1.pgTable)("ods_dismissed_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    orderNumber: (0, pg_core_1.varchar)("order_number", { length: 64 }).notNull(),
    dismissedAt: (0, pg_core_1.timestamp)("dismissed_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("ods_dismissed_merchant_id_idx").on(table.merchantId),
    merchantOrderIdx: (0, pg_core_1.uniqueIndex)("ods_dismissed_merchant_order_uidx").on(table.merchantId, table.orderNumber),
}));
exports.SIGNAGE_TEMPLATES = [
    "dark_pizza",
    "kebab_green",
    "cafe_cream",
    "portrait_poster",
    "lunch_special",
];
exports.SIGNAGE_ORIENTATIONS = ["landscape", "portrait"];
exports.SIGNAGE_SLIDE_TYPES = ["menu", "image", "image_text"];
exports.signagePlaylists = (0, pg_core_1.pgTable)("signage_playlists", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    template: (0, pg_core_1.varchar)("template", { length: 40 }).default("dark_pizza").notNull(),
    schedule: (0, pg_core_1.json)("schedule").$type().default({ type: "always" }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("signage_playlists_merchant_id_idx").on(table.merchantId),
}));
exports.signageScreens = (0, pg_core_1.pgTable)("signage_screens", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    token: (0, pg_core_1.varchar)("token", { length: 128 }).notNull(),
    /** Short public code for TV URL (4–6 digits), e.g. /tv/48291 */
    shortCode: (0, pg_core_1.varchar)("short_code", { length: 8 }),
    orientation: (0, pg_core_1.varchar)("orientation", { length: 20 }).default("landscape").notNull(),
    template: (0, pg_core_1.varchar)("template", { length: 40 }).default("dark_pizza").notNull(),
    /** Physical screen diagonal in inches (preview sizing) */
    screenSizeIn: (0, pg_core_1.integer)("screen_size_in").default(32).notNull(),
    playlistId: (0, pg_core_1.uuid)("playlist_id").references(() => exports.signagePlaylists.id, { onDelete: "set null" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("signage_screens_merchant_id_idx").on(table.merchantId),
    tokenIdx: (0, pg_core_1.uniqueIndex)("signage_screens_token_uidx").on(table.token),
    shortCodeIdx: (0, pg_core_1.uniqueIndex)("signage_screens_short_code_uidx").on(table.shortCode),
}));
exports.signageSlides = (0, pg_core_1.pgTable)("signage_slides", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    playlistId: (0, pg_core_1.uuid)("playlist_id")
        .notNull()
        .references(() => exports.signagePlaylists.id, { onDelete: "cascade" }),
    type: (0, pg_core_1.varchar)("type", { length: 30 }).default("menu").notNull(),
    durationSec: (0, pg_core_1.integer)("duration_sec").default(10).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    categoryIds: (0, pg_core_1.json)("category_ids").$type().default([]).notNull(),
    headline: (0, pg_core_1.varchar)("headline", { length: 255 }),
    body: (0, pg_core_1.text)("body"),
    imageUrl: (0, pg_core_1.varchar)("image_url", { length: 500 }),
    showPrices: (0, pg_core_1.boolean)("show_prices").default(true).notNull(),
    showPhotos: (0, pg_core_1.boolean)("show_photos").default(true).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    playlistIdx: (0, pg_core_1.index)("signage_slides_playlist_id_idx").on(table.playlistId),
}));
// ============================================================================
// ORDER ITEMS
// ============================================================================
exports.orderItems = (0, pg_core_1.pgTable)("order_items", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    orderId: (0, pg_core_1.uuid)("order_id")
        .notNull()
        .references(() => exports.orders.id, { onDelete: "cascade" }),
    productId: (0, pg_core_1.uuid)("product_id").references(() => exports.products.id, { onDelete: "set null" }),
    productName: (0, pg_core_1.varchar)("product_name", { length: 255 }),
    quantity: (0, pg_core_1.decimal)("quantity", { precision: 12, scale: 3 }).notNull(), // supports weighed qty
    unitPrice: (0, pg_core_1.decimal)("unit_price", { precision: 10, scale: 2 }).notNull(),
    totalPrice: (0, pg_core_1.decimal)("total_price", { precision: 10, scale: 2 }).notNull(),
    taxAmount: (0, pg_core_1.decimal)("tax_amount", { precision: 10, scale: 2 }).notNull(),
    weightKg: (0, pg_core_1.decimal)("weight_kg", { precision: 12, scale: 3 }),
    selectedExtras: (0, pg_core_1.json)("selected_extras").$type().default([]),
    // Combo meal picks: [{ slotId, slotName, productId, productName, extraPrice, selectedExtras }]
    comboSelections: (0, pg_core_1.json)("combo_selections")
        .$type()
        .default([]),
    isOpenPrice: (0, pg_core_1.boolean)("is_open_price").default(false).notNull(),
    // 1-based seat / person index when pax ordering is on (kitchen: "Person 1")
    seatNumber: (0, pg_core_1.integer)("seat_number"),
    /** Cumulative quantity refunded on this line (partial item refunds). */
    refundedQuantity: (0, pg_core_1.decimal)("refunded_quantity", { precision: 12, scale: 3 }).default("0"),
}, (table) => ({
    orderIdIdx: (0, pg_core_1.index)("order_items_order_id_idx").on(table.orderId),
}));
// ============================================================================
// ORDER REFUNDS (partial + full history per ticket)
// ============================================================================
exports.orderRefunds = (0, pg_core_1.pgTable)("order_refunds", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    orderId: (0, pg_core_1.uuid)("order_id")
        .notNull()
        .references(() => exports.orders.id, { onDelete: "cascade" }),
    /** referenced = capped by order total; goodwill = unreferenced compensation */
    kind: (0, pg_core_1.varchar)("kind", { length: 20 }).default("referenced").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    reason: (0, pg_core_1.text)("reason"),
    staffId: (0, pg_core_1.uuid)("staff_id"),
    staffName: (0, pg_core_1.varchar)("staff_name", { length: 255 }),
    /** [{ orderItemId, productName, quantity }] when item-level refund */
    itemsJson: (0, pg_core_1.json)("items_json").$type(),
    /** Gift-first refund allocation { giftCard, cash, terminal, other } */
    allocationJson: (0, pg_core_1.json)("allocation_json").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("order_refunds_merchant_id_idx").on(table.merchantId),
    orderIdx: (0, pg_core_1.index)("order_refunds_order_id_idx").on(table.orderId),
    createdIdx: (0, pg_core_1.index)("order_refunds_created_at_idx").on(table.createdAt),
}));
// ============================================================================
// FLOOR PLANS & DINING TABLES
// ============================================================================
exports.floorPlans = (0, pg_core_1.pgTable)("floor_plans", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    canvasWidth: (0, pg_core_1.integer)("canvas_width").default(1000).notNull(),
    canvasHeight: (0, pg_core_1.integer)("canvas_height").default(700).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    /** Walls, doors, bar counters — [{ id, elementType, posX, posY, width, height, rotation }] */
    elementsJson: (0, pg_core_1.json)("elements_json").$type(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("floor_plans_merchant_id_idx").on(table.merchantId),
}));
exports.diningTables = (0, pg_core_1.pgTable)("dining_tables", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    floorPlanId: (0, pg_core_1.uuid)("floor_plan_id")
        .notNull()
        .references(() => exports.floorPlans.id, { onDelete: "cascade" }),
    label: (0, pg_core_1.varchar)("label", { length: 50 }).notNull(), // T1, Bar-2, …
    capacity: (0, pg_core_1.integer)("capacity").default(2).notNull(), // max PAX
    shape: (0, pg_core_1.varchar)("shape", { length: 20 }).default("rect").notNull(), // rect | round
    posX: (0, pg_core_1.integer)("pos_x").default(40).notNull(),
    posY: (0, pg_core_1.integer)("pos_y").default(40).notNull(),
    width: (0, pg_core_1.integer)("width").default(100).notNull(),
    height: (0, pg_core_1.integer)("height").default(80).notNull(),
    rotation: (0, pg_core_1.integer)("rotation").default(0).notNull(),
    // available | occupied | reserved | dirty
    status: (0, pg_core_1.varchar)("status", { length: 30 }).default("available").notNull(),
    currentOrderId: (0, pg_core_1.uuid)("current_order_id"),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("dining_tables_merchant_id_idx").on(table.merchantId),
    floorPlanIdIdx: (0, pg_core_1.index)("dining_tables_floor_plan_id_idx").on(table.floorPlanId),
}));
/** Optional static / temporary QR payloads per table (default QR uses table UUID). */
exports.tableQrCodes = (0, pg_core_1.pgTable)("table_qr_codes", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    tableId: (0, pg_core_1.uuid)("table_id")
        .notNull()
        .references(() => exports.diningTables.id, { onDelete: "cascade" }),
    /** static | temporary */
    codeType: (0, pg_core_1.varchar)("code_type", { length: 20 }).notNull().default("static"),
    /** QR payload string (CHASLAY:T:… or shop URL) */
    code: (0, pg_core_1.varchar)("code", { length: 512 }).notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("table_qr_codes_merchant_id_idx").on(table.merchantId),
    tableIdIdx: (0, pg_core_1.index)("table_qr_codes_table_id_idx").on(table.tableId),
}));
exports.reservations = (0, pg_core_1.pgTable)("reservations", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    code: (0, pg_core_1.varchar)("code", { length: 32 }).notNull(),
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    guestName: (0, pg_core_1.varchar)("guest_name", { length: 200 }).notNull(),
    guestEmail: (0, pg_core_1.varchar)("guest_email", { length: 255 }),
    guestPhone: (0, pg_core_1.varchar)("guest_phone", { length: 50 }).notNull(),
    partySize: (0, pg_core_1.integer)("party_size").notNull().default(2),
    reservedAt: (0, pg_core_1.timestamp)("reserved_at", { withTimezone: true }).notNull(),
    durationMinutes: (0, pg_core_1.integer)("duration_minutes").notNull().default(90),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("pending"),
    tableId: (0, pg_core_1.uuid)("table_id").references(() => exports.diningTables.id, { onDelete: "set null" }),
    tableLabel: (0, pg_core_1.varchar)("table_label", { length: 50 }),
    /** Slot promotion captured at booking time (e.g. 20) */
    discountPercent: (0, pg_core_1.integer)("discount_percent"),
    discountLabel: (0, pg_core_1.varchar)("discount_label", { length: 80 }),
    notes: (0, pg_core_1.text)("notes"),
    internalNotes: (0, pg_core_1.text)("internal_notes"),
    source: (0, pg_core_1.varchar)("source", { length: 30 }).notNull().default("web"), // web | phone | pos | dashboard
    confirmationSentAt: (0, pg_core_1.timestamp)("confirmation_sent_at", { withTimezone: true }),
    reminderSentAt: (0, pg_core_1.timestamp)("reminder_sent_at", { withTimezone: true }),
    acceptedAt: (0, pg_core_1.timestamp)("accepted_at", { withTimezone: true }),
    seatedAt: (0, pg_core_1.timestamp)("seated_at", { withTimezone: true }),
    cancelledAt: (0, pg_core_1.timestamp)("cancelled_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    merchantReservedIdx: (0, pg_core_1.index)("reservations_merchant_reserved_idx").on(table.merchantId, table.reservedAt),
    merchantStatusIdx: (0, pg_core_1.index)("reservations_merchant_status_idx").on(table.merchantId, table.status),
    merchantCodeUq: (0, pg_core_1.uniqueIndex)("reservations_merchant_code_uq").on(table.merchantId, table.code),
}));
// ============================================================================
// CHASLAY ANDROID FLOOR SYNC (waiter ↔ main POS coordination)
// ============================================================================
exports.chaslayFloorDevices = (0, pg_core_1.pgTable)("chaslay_floor_devices", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    deviceId: (0, pg_core_1.varchar)("device_id", { length: 255 }).notNull(),
    deviceName: (0, pg_core_1.varchar)("device_name", { length: 255 }),
    role: (0, pg_core_1.varchar)("role", { length: 30 }).default("STANDARD").notNull(), // MAIN_POS | WAITER | STANDARD
    lanHost: (0, pg_core_1.varchar)("lan_host", { length: 255 }),
    appVersion: (0, pg_core_1.varchar)("app_version", { length: 50 }),
    lastSeenAt: (0, pg_core_1.timestamp)("last_seen_at").defaultNow().notNull(),
}, (table) => ({
    merchantDeviceIdx: (0, pg_core_1.uniqueIndex)("chaslay_floor_devices_merchant_device_idx").on(table.merchantId, table.deviceId),
}));
exports.chaslayFloorTableOrders = (0, pg_core_1.pgTable)("chaslay_floor_table_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    localOrderId: (0, pg_core_1.varchar)("local_order_id", { length: 255 }).notNull(),
    tableId: (0, pg_core_1.integer)("table_id").default(0).notNull(),
    tableName: (0, pg_core_1.varchar)("table_name", { length: 255 }).default("").notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("OPEN").notNull(),
    serviceType: (0, pg_core_1.varchar)("service_type", { length: 50 }).default("DINE_IN").notNull(),
    userId: (0, pg_core_1.integer)("user_id").default(0).notNull(),
    userName: (0, pg_core_1.varchar)("user_name", { length: 255 }).default("").notNull(),
    cartJson: (0, pg_core_1.json)("cart_json").$type().default({}),
    sourceDeviceId: (0, pg_core_1.varchar)("source_device_id", { length: 255 }).default("").notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantLocalOrderIdx: (0, pg_core_1.uniqueIndex)("chaslay_floor_orders_merchant_local_idx").on(table.merchantId, table.localOrderId),
    merchantUpdatedIdx: (0, pg_core_1.index)("chaslay_floor_orders_merchant_updated_idx").on(table.merchantId, table.updatedAt),
}));
exports.chaslayFloorPrintJobs = (0, pg_core_1.pgTable)("chaslay_floor_print_jobs", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    jobType: (0, pg_core_1.varchar)("job_type", { length: 30 }).notNull(), // KITCHEN | RECEIPT
    status: (0, pg_core_1.varchar)("status", { length: 30 }).default("PENDING").notNull(), // PENDING | PROCESSING | DONE | FAILED
    payload: (0, pg_core_1.json)("payload").$type().default({}),
    sourceDeviceId: (0, pg_core_1.varchar)("source_device_id", { length: 255 }).default("").notNull(),
    targetRole: (0, pg_core_1.varchar)("target_role", { length: 30 }).default("MAIN_POS").notNull(),
    orderId: (0, pg_core_1.varchar)("order_id", { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    processedAt: (0, pg_core_1.timestamp)("processed_at"),
}, (table) => ({
    merchantStatusIdx: (0, pg_core_1.index)("chaslay_floor_print_jobs_merchant_status_idx").on(table.merchantId, table.status, table.createdAt),
}));
// ============================================================================
// PAYMENT TERMINALS (ADYEN)
// ============================================================================
exports.paymentTerminals = (0, pg_core_1.pgTable)("payment_terminals", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    terminalId: (0, pg_core_1.varchar)("terminal_id", { length: 255 }).notNull().unique(), // Adyen terminal ID
    terminalName: (0, pg_core_1.varchar)("terminal_name", { length: 255 }).notNull(),
    serialNumber: (0, pg_core_1.varchar)("serial_number", { length: 255 }),
    // Optional per-terminal Adyen overrides (falls back to merchant credentials)
    adyenMerchantAccount: (0, pg_core_1.varchar)("adyen_merchant_account", { length: 255 }),
    adyenApiKey: (0, pg_core_1.text)("adyen_api_key"),
    adyenClientId: (0, pg_core_1.varchar)("adyen_client_id", { length: 255 }),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(), // active, inactive, error
    lastHeartbeat: (0, pg_core_1.timestamp)("last_heartbeat"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("payment_terminals_merchant_id_idx").on(table.merchantId),
    terminalIdIdx: (0, pg_core_1.uniqueIndex)("payment_terminals_terminal_id_idx").on(table.terminalId),
}));
// ============================================================================
// RFID CARD READERS (gift / loyalty)
// ============================================================================
exports.rfidReaders = (0, pg_core_1.pgTable)("rfid_readers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    readerUid: (0, pg_core_1.varchar)("reader_uid", { length: 255 }).notNull(), // hardware / HID identifier
    connectionType: (0, pg_core_1.varchar)("connection_type", { length: 50 }).default("hid").notNull(), // hid | usb | ble
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(),
    lastSeenAt: (0, pg_core_1.timestamp)("last_seen_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("rfid_readers_merchant_id_idx").on(table.merchantId),
    readerUidIdx: (0, pg_core_1.uniqueIndex)("rfid_readers_reader_uid_idx").on(table.readerUid),
}));
exports.deliveryZones = (0, pg_core_1.pgTable)("delivery_zones", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    // GeoJSON-style ring: [[lng, lat], ...]
    polygon: (0, pg_core_1.json)("polygon").$type().notNull().default([]),
    // Optional ZIP fallback list
    zipCodes: (0, pg_core_1.json)("zip_codes").$type().default([]),
    minOrderAmount: (0, pg_core_1.decimal)("min_order_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    deliveryFee: (0, pg_core_1.decimal)("delivery_fee", { precision: 10, scale: 2 }).default("0").notNull(),
    estimatedMinutes: (0, pg_core_1.integer)("estimated_minutes").default(45),
    color: (0, pg_core_1.varchar)("color", { length: 20 }).default("#0d9488"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("delivery_zones_merchant_id_idx").on(table.merchantId),
}));
// ============================================================================
// PAYMENT TRANSACTIONS
// ============================================================================
exports.paymentTransactions = (0, pg_core_1.pgTable)("payment_transactions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    orderId: (0, pg_core_1.uuid)("order_id")
        .notNull()
        .references(() => exports.orders.id, { onDelete: "cascade" }),
    terminalId: (0, pg_core_1.uuid)("terminal_id").references(() => exports.paymentTerminals.id, { onDelete: "set null" }),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).default("USD").notNull(),
    paymentMethod: (0, pg_core_1.varchar)("payment_method", { length: 50 }).notNull(), // card, cash, terminal
    adyenReference: (0, pg_core_1.varchar)("adyen_reference", { length: 255 }),
    adyenPoiTransactionTs: (0, pg_core_1.timestamp)("adyen_poi_transaction_ts"),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).notNull(), // pending, authorized, captured, failed, refunded
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("payment_transactions_merchant_id_idx").on(table.merchantId),
    orderIdIdx: (0, pg_core_1.index)("payment_transactions_order_id_idx").on(table.orderId),
    statusIdx: (0, pg_core_1.index)("payment_transactions_status_idx").on(table.status),
}));
// ============================================================================
// LOYALTY CARDS (RFID)
// ============================================================================
exports.loyaltyCards = (0, pg_core_1.pgTable)("loyalty_cards", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    cardNumber: (0, pg_core_1.varchar)("card_number", { length: 255 }).notNull().unique(), // RFID card ID
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    cardType: (0, pg_core_1.varchar)("card_type", { length: 50 }).notNull(), // loyalty, gift_card
    balance: (0, pg_core_1.decimal)("balance", { precision: 10, scale: 2 }).default("0"),
    pointsBalance: (0, pg_core_1.integer)("points_balance").default(0),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(), // active, suspended, expired
    suspendedReason: (0, pg_core_1.text)("suspended_reason"),
    issuedAt: (0, pg_core_1.timestamp)("issued_at").defaultNow().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("loyalty_cards_merchant_id_idx").on(table.merchantId),
    cardNumberIdx: (0, pg_core_1.uniqueIndex)("loyalty_cards_card_number_idx").on(table.cardNumber),
    statusIdx: (0, pg_core_1.index)("loyalty_cards_status_idx").on(table.status),
}));
// ============================================================================
// LOYALTY TRANSACTIONS
// ============================================================================
exports.loyaltyTransactions = (0, pg_core_1.pgTable)("loyalty_transactions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    cardId: (0, pg_core_1.uuid)("card_id")
        .notNull()
        .references(() => exports.loyaltyCards.id, { onDelete: "cascade" }),
    transactionType: (0, pg_core_1.varchar)("transaction_type", { length: 50 }).notNull(), // purchase, reload, redemption, points_earned
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }),
    points: (0, pg_core_1.integer)("points"),
    balanceAfter: (0, pg_core_1.decimal)("balance_after", { precision: 10, scale: 2 }),
    description: (0, pg_core_1.text)("description"),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id, { onDelete: "set null" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("loyalty_transactions_merchant_id_idx").on(table.merchantId),
    cardIdIdx: (0, pg_core_1.index)("loyalty_transactions_card_id_idx").on(table.cardId),
}));
// ============================================================================
// GIFT CARDS (physical RFID / future e-card) — stored value + optional membership
// One physical card can hold prepaid CHF balance AND optional customer membership/points.
// ============================================================================
exports.giftCards = (0, pg_core_1.pgTable)("gift_cards", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    /** RFID UID for physical cards, or generated code for e-cards */
    cardNumber: (0, pg_core_1.varchar)("card_number", { length: 255 }).notNull(),
    /** physical | e_card */
    cardMediaType: (0, pg_core_1.varchar)("card_media_type", { length: 20 }).default("physical").notNull(),
    /** Stored-value / gift balance in CHF */
    balance: (0, pg_core_1.decimal)("balance", { precision: 10, scale: 2 }).default("0").notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 50 }).default("active").notNull(), // active, suspended, expired
    suspendedReason: (0, pg_core_1.text)("suspended_reason"),
    /** Optional membership: linked customer for points / visits */
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    membershipEnabled: (0, pg_core_1.boolean)("membership_enabled").default(false).notNull(),
    /** Active membership tier id from merchant gift_card_settings.membershipPlans */
    membershipPlanId: (0, pg_core_1.varchar)("membership_plan_id", { length: 64 }),
    /** Stamp-card progress (resets when reward earned) */
    stampCount: (0, pg_core_1.integer)("stamp_count").default(0).notNull(),
    pointsBalance: (0, pg_core_1.integer)("points_balance").default(0).notNull(),
    holderName: (0, pg_core_1.varchar)("holder_name", { length: 255 }),
    holderEmail: (0, pg_core_1.varchar)("holder_email", { length: 255 }),
    holderPhone: (0, pg_core_1.varchar)("holder_phone", { length: 40 }),
    /** Phase-2 e-card: delivery email / QR payload (stub fields) */
    ecardEmail: (0, pg_core_1.varchar)("ecard_email", { length: 255 }),
    ecardCode: (0, pg_core_1.varchar)("ecard_code", { length: 64 }),
    issuedAt: (0, pg_core_1.timestamp)("issued_at").defaultNow().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("gift_cards_merchant_id_idx").on(table.merchantId),
    cardNumberIdx: (0, pg_core_1.uniqueIndex)("gift_cards_merchant_card_number_idx").on(table.merchantId, table.cardNumber),
    ecardCodeIdx: (0, pg_core_1.uniqueIndex)("gift_cards_ecard_code_idx").on(table.ecardCode),
    statusIdx: (0, pg_core_1.index)("gift_cards_status_idx").on(table.status),
    customerIdIdx: (0, pg_core_1.index)("gift_cards_customer_id_idx").on(table.customerId),
}));
exports.giftCardPurchases = (0, pg_core_1.pgTable)("gift_card_purchases", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    recipientEmail: (0, pg_core_1.varchar)("recipient_email", { length: 255 }).notNull(),
    recipientName: (0, pg_core_1.varchar)("recipient_name", { length: 255 }),
    senderName: (0, pg_core_1.varchar)("sender_name", { length: 255 }),
    senderEmail: (0, pg_core_1.varchar)("sender_email", { length: 255 }),
    message: (0, pg_core_1.text)("message"),
    paymentMethod: (0, pg_core_1.varchar)("payment_method", { length: 20 }).default("card").notNull(),
    paymentStatus: (0, pg_core_1.varchar)("payment_status", { length: 30 }).default("awaiting_payment").notNull(),
    adyenReference: (0, pg_core_1.varchar)("adyen_reference", { length: 255 }),
    cardId: (0, pg_core_1.uuid)("card_id").references(() => exports.giftCards.id, { onDelete: "set null" }),
    fulfilledAt: (0, pg_core_1.timestamp)("fulfilled_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("gift_card_purchases_merchant_id_idx").on(table.merchantId),
    paymentStatusIdx: (0, pg_core_1.index)("gift_card_purchases_payment_status_idx").on(table.paymentStatus),
}));
exports.giftCardTransactions = (0, pg_core_1.pgTable)("gift_card_transactions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    cardId: (0, pg_core_1.uuid)("card_id")
        .notNull()
        .references(() => exports.giftCards.id, { onDelete: "cascade" }),
    /** sell | reload | redeem | adjust | membership_issue | points_earn | points_redeem */
    transactionType: (0, pg_core_1.varchar)("transaction_type", { length: 50 }).notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }),
    balanceAfter: (0, pg_core_1.decimal)("balance_after", { precision: 10, scale: 2 }),
    points: (0, pg_core_1.integer)("points"),
    pointsAfter: (0, pg_core_1.integer)("points_after"),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id, { onDelete: "set null" }),
    description: (0, pg_core_1.text)("description"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("gift_card_transactions_merchant_id_idx").on(table.merchantId),
    cardIdIdx: (0, pg_core_1.index)("gift_card_transactions_card_id_idx").on(table.cardId),
    orderIdIdx: (0, pg_core_1.index)("gift_card_transactions_order_id_idx").on(table.orderId),
}));
// ============================================================================
// SHOP LOYALTY POINT LOTS (FIFO expiry for customer accounts)
// ============================================================================
exports.loyaltyPointLots = (0, pg_core_1.pgTable)("loyalty_point_lots", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    customerId: (0, pg_core_1.uuid)("customer_id")
        .notNull()
        .references(() => exports.customers.id, { onDelete: "cascade" }),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id, { onDelete: "set null" }),
    pointsGranted: (0, pg_core_1.integer)("points_granted").notNull(),
    pointsRemaining: (0, pg_core_1.integer)("points_remaining").notNull(),
    earnedAt: (0, pg_core_1.timestamp)("earned_at").defaultNow().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    source: (0, pg_core_1.varchar)("source", { length: 40 }).default("earn").notNull(), // earn | adjustment | bonus
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    customerIdx: (0, pg_core_1.index)("loyalty_point_lots_customer_idx").on(table.customerId),
    merchantIdx: (0, pg_core_1.index)("loyalty_point_lots_merchant_idx").on(table.merchantId),
    expiresIdx: (0, pg_core_1.index)("loyalty_point_lots_expires_idx").on(table.expiresAt),
}));
exports.loyaltyPointEvents = (0, pg_core_1.pgTable)("loyalty_point_events", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    customerId: (0, pg_core_1.uuid)("customer_id")
        .notNull()
        .references(() => exports.customers.id, { onDelete: "cascade" }),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id, { onDelete: "set null" }),
    productId: (0, pg_core_1.uuid)("product_id").references(() => exports.products.id, { onDelete: "set null" }),
    eventType: (0, pg_core_1.varchar)("event_type", { length: 40 }).notNull(), // earn | redeem_cash | redeem_product | expire | adjust
    points: (0, pg_core_1.integer)("points").notNull(),
    meta: (0, pg_core_1.json)("meta").$type().default({}),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    customerIdx: (0, pg_core_1.index)("loyalty_point_events_customer_idx").on(table.customerId),
    merchantIdx: (0, pg_core_1.index)("loyalty_point_events_merchant_idx").on(table.merchantId),
}));
exports.offers = (0, pg_core_1.pgTable)("offers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    offerType: (0, pg_core_1.varchar)("offer_type", { length: 40 }).notNull(),
    rules: (0, pg_core_1.json)("rules").$type().default({}).notNull(),
    channels: (0, pg_core_1.json)("channels").$type().default([]).notNull(),
    categoryIds: (0, pg_core_1.json)("category_ids").$type().default([]).notNull(),
    productIds: (0, pg_core_1.json)("product_ids").$type().default([]).notNull(),
    scheduleMode: (0, pg_core_1.varchar)("schedule_mode", { length: 20 }).default("always").notNull(),
    daysOfWeek: (0, pg_core_1.json)("days_of_week").$type().default([]).notNull(),
    timeStart: (0, pg_core_1.varchar)("time_start", { length: 5 }),
    timeEnd: (0, pg_core_1.varchar)("time_end", { length: 5 }),
    validFrom: (0, pg_core_1.timestamp)("valid_from", { withTimezone: true }),
    validTo: (0, pg_core_1.timestamp)("valid_to", { withTimezone: true }),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    featured: (0, pg_core_1.boolean)("featured").default(true).notNull(),
    badgeLabel: (0, pg_core_1.varchar)("badge_label", { length: 40 }),
    priority: (0, pg_core_1.integer)("priority").default(0).notNull(),
    stackable: (0, pg_core_1.boolean)("stackable").default(false).notNull(),
    sortOrder: (0, pg_core_1.integer)("sort_order").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("offers_merchant_id_idx").on(table.merchantId),
    activeIdx: (0, pg_core_1.index)("offers_merchant_active_idx").on(table.merchantId, table.isActive),
}));
exports.vouchers = (0, pg_core_1.pgTable)("vouchers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    code: (0, pg_core_1.varchar)("code", { length: 64 }).notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }),
    usageType: (0, pg_core_1.varchar)("usage_type", { length: 20 }).notNull().default("multi_use"),
    /** Max redemptions (multi_use) or 1 for single_use */
    maxRedemptions: (0, pg_core_1.integer)("max_redemptions").default(1).notNull(),
    /** Required when usageType = customer */
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    discountType: (0, pg_core_1.varchar)("discount_type", { length: 20 }).notNull().default("percent"),
    discountValue: (0, pg_core_1.decimal)("discount_value", { precision: 10, scale: 2 }).notNull(),
    minOrderAmount: (0, pg_core_1.decimal)("min_order_amount", { precision: 10, scale: 2 }).default("0").notNull(),
    validFrom: (0, pg_core_1.timestamp)("valid_from", { withTimezone: true }),
    validTo: (0, pg_core_1.timestamp)("valid_to", { withTimezone: true }),
    isActive: (0, pg_core_1.boolean)("is_active").default(true).notNull(),
    redemptionCount: (0, pg_core_1.integer)("redemption_count").default(0).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    merchantCodeIdx: (0, pg_core_1.uniqueIndex)("vouchers_merchant_code_idx").on(table.merchantId, table.code),
    merchantIdx: (0, pg_core_1.index)("vouchers_merchant_id_idx").on(table.merchantId),
    activeIdx: (0, pg_core_1.index)("vouchers_merchant_active_idx").on(table.merchantId, table.isActive),
    customerIdx: (0, pg_core_1.index)("vouchers_customer_id_idx").on(table.customerId),
}));
exports.voucherRedemptions = (0, pg_core_1.pgTable)("voucher_redemptions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    voucherId: (0, pg_core_1.uuid)("voucher_id")
        .notNull()
        .references(() => exports.vouchers.id, { onDelete: "cascade" }),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id, { onDelete: "set null" }),
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    code: (0, pg_core_1.varchar)("code", { length: 64 }).notNull(),
    discountAmount: (0, pg_core_1.decimal)("discount_amount", { precision: 10, scale: 2 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("voucher_redemptions_merchant_id_idx").on(table.merchantId),
    voucherIdx: (0, pg_core_1.index)("voucher_redemptions_voucher_id_idx").on(table.voucherId),
    orderIdx: (0, pg_core_1.index)("voucher_redemptions_order_id_idx").on(table.orderId),
    customerIdx: (0, pg_core_1.index)("voucher_redemptions_customer_id_idx").on(table.customerId),
}));
// ============================================================================
// DAILY REPORTS
// ============================================================================
exports.dailyReports = (0, pg_core_1.pgTable)("daily_reports", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    reportDate: (0, pg_core_1.varchar)("report_date", { length: 10 }).notNull(), // YYYY-MM-DD
    totalOrders: (0, pg_core_1.integer)("total_orders").default(0),
    totalRevenue: (0, pg_core_1.decimal)("total_revenue", { precision: 10, scale: 2 }).default("0"),
    totalTax: (0, pg_core_1.decimal)("total_tax", { precision: 10, scale: 2 }).default("0"),
    totalDiscount: (0, pg_core_1.decimal)("total_discount", { precision: 10, scale: 2 }).default("0"),
    paymentBreakdown: (0, pg_core_1.json)("payment_breakdown"), // {cash: 100, card: 200, terminal: 150}
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdIdx: (0, pg_core_1.index)("daily_reports_merchant_id_idx").on(table.merchantId),
    reportDateIdx: (0, pg_core_1.index)("daily_reports_report_date_idx").on(table.reportDate),
}));
exports.cmsPages = (0, pg_core_1.pgTable)("cms_pages", {
    id: (0, pg_core_1.uuid)("id").defaultRandom().primaryKey(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    title: (0, pg_core_1.varchar)("title", { length: 200 }).notNull(),
    slug: (0, pg_core_1.varchar)("slug", { length: 120 }).notNull(),
    isHomepage: (0, pg_core_1.boolean)("is_homepage").notNull().default(false),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default("draft"),
    templateKey: (0, pg_core_1.varchar)("template_key", { length: 40 }),
    /** OpenPage `{ engine, config, html }` — legacy Puck/Chai migrated in the service */
    blocks: (0, pg_core_1.json)("blocks")
        .$type()
        .notNull()
        .default({ engine: "openpage", config: { name: "", blocks: [] }, html: "" }),
    /** Optional theme / metadata */
    theme: (0, pg_core_1.json)("theme").$type(),
    seoTitle: (0, pg_core_1.varchar)("seo_title", { length: 200 }),
    seoDescription: (0, pg_core_1.text)("seo_description"),
    publishedAt: (0, pg_core_1.timestamp)("published_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
    merchantSlugUq: (0, pg_core_1.uniqueIndex)("cms_pages_merchant_slug_uq").on(table.merchantId, table.slug),
    merchantHomepageIdx: (0, pg_core_1.index)("cms_pages_merchant_homepage_idx").on(table.merchantId, table.isHomepage),
}));
// ============================================================================
// RELATIONS
// ============================================================================
exports.cmsPagesRelations = (0, drizzle_orm_1.relations)(exports.cmsPages, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.cmsPages.merchantId],
        references: [exports.merchants.id],
    }),
}));
exports.resellersRelations = (0, drizzle_orm_1.relations)(exports.resellers, ({ many }) => ({
    merchants: many(exports.merchants),
}));
exports.editionsRelations = (0, drizzle_orm_1.relations)(exports.editions, ({ many }) => ({
    merchants: many(exports.merchants),
}));
exports.merchantsRelations = (0, drizzle_orm_1.relations)(exports.merchants, ({ many, one }) => ({
    reseller: one(exports.resellers, {
        fields: [exports.merchants.resellerId],
        references: [exports.resellers.id],
    }),
    edition: one(exports.editions, {
        fields: [exports.merchants.editionId],
        references: [exports.editions.id],
    }),
    devices: many(exports.devices),
    licenses: many(exports.licenses),
    licenseTransactions: many(exports.licenseTransactions),
    vatSettings: many(exports.vatSettings),
    categories: many(exports.categories),
    products: many(exports.products),
    customers: many(exports.customers),
    orders: many(exports.orders),
    paymentTerminals: many(exports.paymentTerminals),
    paymentTransactions: many(exports.paymentTransactions),
    loyaltyCards: many(exports.loyaltyCards),
    loyaltyTransactions: many(exports.loyaltyTransactions),
    giftCards: many(exports.giftCards),
    giftCardPurchases: many(exports.giftCardPurchases),
    giftCardTransactions: many(exports.giftCardTransactions),
    loyaltyPointLots: many(exports.loyaltyPointLots),
    loyaltyPointEvents: many(exports.loyaltyPointEvents),
    dailyReports: many(exports.dailyReports),
    rfidReaders: many(exports.rfidReaders),
    deliveryZones: many(exports.deliveryZones),
    modifierGroups: many(exports.modifierGroups),
    floorPlans: many(exports.floorPlans),
    diningTables: many(exports.diningTables),
    reservations: many(exports.reservations),
    subscriptionPayments: many(exports.subscriptionPayments),
    cmsPages: many(exports.cmsPages),
    vouchers: many(exports.vouchers),
    voucherRedemptions: many(exports.voucherRedemptions),
}));
exports.vouchersRelations = (0, drizzle_orm_1.relations)(exports.vouchers, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.vouchers.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.vouchers.customerId], references: [exports.customers.id] }),
    redemptions: many(exports.voucherRedemptions),
}));
exports.voucherRedemptionsRelations = (0, drizzle_orm_1.relations)(exports.voucherRedemptions, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.voucherRedemptions.merchantId],
        references: [exports.merchants.id],
    }),
    voucher: one(exports.vouchers, {
        fields: [exports.voucherRedemptions.voucherId],
        references: [exports.vouchers.id],
    }),
    order: one(exports.orders, { fields: [exports.voucherRedemptions.orderId], references: [exports.orders.id] }),
    customer: one(exports.customers, {
        fields: [exports.voucherRedemptions.customerId],
        references: [exports.customers.id],
    }),
}));
exports.reservationsRelations = (0, drizzle_orm_1.relations)(exports.reservations, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.reservations.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.reservations.customerId], references: [exports.customers.id] }),
    table: one(exports.diningTables, { fields: [exports.reservations.tableId], references: [exports.diningTables.id] }),
}));
exports.floorPlansRelations = (0, drizzle_orm_1.relations)(exports.floorPlans, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.floorPlans.merchantId], references: [exports.merchants.id] }),
    tables: many(exports.diningTables),
}));
exports.diningTablesRelations = (0, drizzle_orm_1.relations)(exports.diningTables, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.diningTables.merchantId], references: [exports.merchants.id] }),
    floorPlan: one(exports.floorPlans, { fields: [exports.diningTables.floorPlanId], references: [exports.floorPlans.id] }),
    qrCodes: many(exports.tableQrCodes),
}));
exports.tableQrCodesRelations = (0, drizzle_orm_1.relations)(exports.tableQrCodes, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.tableQrCodes.merchantId], references: [exports.merchants.id] }),
    table: one(exports.diningTables, { fields: [exports.tableQrCodes.tableId], references: [exports.diningTables.id] }),
}));
exports.devicesRelations = (0, drizzle_orm_1.relations)(exports.devices, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.devices.merchantId], references: [exports.merchants.id] }),
    licenses: many(exports.licenses),
}));
exports.licensesRelations = (0, drizzle_orm_1.relations)(exports.licenses, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.licenses.merchantId], references: [exports.merchants.id] }),
    device: one(exports.devices, { fields: [exports.licenses.deviceId], references: [exports.devices.id] }),
}));
exports.productsRelations = (0, drizzle_orm_1.relations)(exports.products, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.products.merchantId], references: [exports.merchants.id] }),
    category: one(exports.categories, { fields: [exports.products.categoryId], references: [exports.categories.id] }),
    orderItems: many(exports.orderItems),
    modifierLinks: many(exports.productModifierGroups),
}));
exports.modifierGroupsRelations = (0, drizzle_orm_1.relations)(exports.modifierGroups, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.modifierGroups.merchantId], references: [exports.merchants.id] }),
    options: many(exports.modifierOptions),
    productLinks: many(exports.productModifierGroups),
}));
exports.modifierOptionsRelations = (0, drizzle_orm_1.relations)(exports.modifierOptions, ({ one }) => ({
    group: one(exports.modifierGroups, { fields: [exports.modifierOptions.groupId], references: [exports.modifierGroups.id] }),
}));
exports.productModifierGroupsRelations = (0, drizzle_orm_1.relations)(exports.productModifierGroups, ({ one }) => ({
    product: one(exports.products, { fields: [exports.productModifierGroups.productId], references: [exports.products.id] }),
    group: one(exports.modifierGroups, { fields: [exports.productModifierGroups.groupId], references: [exports.modifierGroups.id] }),
}));
exports.ordersRelations = (0, drizzle_orm_1.relations)(exports.orders, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.orders.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.orders.customerId], references: [exports.customers.id] }),
    items: many(exports.orderItems),
    paymentTransactions: many(exports.paymentTransactions),
    refunds: many(exports.orderRefunds),
}));
/** Required so `orders.with.paymentTransactions` can be inferred by Drizzle. */
exports.paymentTransactionsRelations = (0, drizzle_orm_1.relations)(exports.paymentTransactions, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.paymentTransactions.merchantId],
        references: [exports.merchants.id],
    }),
    order: one(exports.orders, {
        fields: [exports.paymentTransactions.orderId],
        references: [exports.orders.id],
    }),
    terminal: one(exports.paymentTerminals, {
        fields: [exports.paymentTransactions.terminalId],
        references: [exports.paymentTerminals.id],
    }),
}));
exports.heldOrdersRelations = (0, drizzle_orm_1.relations)(exports.heldOrders, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.heldOrders.merchantId], references: [exports.merchants.id] }),
}));
exports.kdsStationsRelations = (0, drizzle_orm_1.relations)(exports.kdsStations, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.kdsStations.merchantId], references: [exports.merchants.id] }),
}));
exports.odsDisplaysRelations = (0, drizzle_orm_1.relations)(exports.odsDisplays, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.odsDisplays.merchantId], references: [exports.merchants.id] }),
}));
exports.odsOrdersRelations = (0, drizzle_orm_1.relations)(exports.odsOrders, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.odsOrders.merchantId], references: [exports.merchants.id] }),
}));
exports.odsDismissedOrdersRelations = (0, drizzle_orm_1.relations)(exports.odsDismissedOrders, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.odsDismissedOrders.merchantId], references: [exports.merchants.id] }),
}));
exports.kdsTicketsRelations = (0, drizzle_orm_1.relations)(exports.kdsTickets, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.kdsTickets.merchantId], references: [exports.merchants.id] }),
    items: many(exports.kdsTicketItems),
}));
exports.kdsTicketItemsRelations = (0, drizzle_orm_1.relations)(exports.kdsTicketItems, ({ one }) => ({
    ticket: one(exports.kdsTickets, { fields: [exports.kdsTicketItems.ticketId], references: [exports.kdsTickets.id] }),
}));
exports.signageScreensRelations = (0, drizzle_orm_1.relations)(exports.signageScreens, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.signageScreens.merchantId], references: [exports.merchants.id] }),
    playlist: one(exports.signagePlaylists, {
        fields: [exports.signageScreens.playlistId],
        references: [exports.signagePlaylists.id],
    }),
}));
exports.signagePlaylistsRelations = (0, drizzle_orm_1.relations)(exports.signagePlaylists, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.signagePlaylists.merchantId], references: [exports.merchants.id] }),
    slides: many(exports.signageSlides),
    screens: many(exports.signageScreens),
}));
exports.signageSlidesRelations = (0, drizzle_orm_1.relations)(exports.signageSlides, ({ one }) => ({
    playlist: one(exports.signagePlaylists, {
        fields: [exports.signageSlides.playlistId],
        references: [exports.signagePlaylists.id],
    }),
}));
exports.customerAddressesRelations = (0, drizzle_orm_1.relations)(exports.customerAddresses, ({ one }) => ({
    customer: one(exports.customers, {
        fields: [exports.customerAddresses.customerId],
        references: [exports.customers.id],
    }),
    merchant: one(exports.merchants, {
        fields: [exports.customerAddresses.merchantId],
        references: [exports.merchants.id],
    }),
}));
exports.orderItemsRelations = (0, drizzle_orm_1.relations)(exports.orderItems, ({ one }) => ({
    order: one(exports.orders, { fields: [exports.orderItems.orderId], references: [exports.orders.id] }),
    product: one(exports.products, { fields: [exports.orderItems.productId], references: [exports.products.id] }),
}));
exports.orderRefundsRelations = (0, drizzle_orm_1.relations)(exports.orderRefunds, ({ one }) => ({
    order: one(exports.orders, { fields: [exports.orderRefunds.orderId], references: [exports.orders.id] }),
    merchant: one(exports.merchants, { fields: [exports.orderRefunds.merchantId], references: [exports.merchants.id] }),
}));
exports.loyaltyCardsRelations = (0, drizzle_orm_1.relations)(exports.loyaltyCards, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.loyaltyCards.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.loyaltyCards.customerId], references: [exports.customers.id] }),
    transactions: many(exports.loyaltyTransactions),
}));
exports.giftCardsRelations = (0, drizzle_orm_1.relations)(exports.giftCards, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.giftCards.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.giftCards.customerId], references: [exports.customers.id] }),
    transactions: many(exports.giftCardTransactions),
}));
exports.giftCardPurchasesRelations = (0, drizzle_orm_1.relations)(exports.giftCardPurchases, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.giftCardPurchases.merchantId],
        references: [exports.merchants.id],
    }),
    card: one(exports.giftCards, {
        fields: [exports.giftCardPurchases.cardId],
        references: [exports.giftCards.id],
    }),
}));
exports.giftCardTransactionsRelations = (0, drizzle_orm_1.relations)(exports.giftCardTransactions, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.giftCardTransactions.merchantId],
        references: [exports.merchants.id],
    }),
    card: one(exports.giftCards, {
        fields: [exports.giftCardTransactions.cardId],
        references: [exports.giftCards.id],
    }),
    order: one(exports.orders, {
        fields: [exports.giftCardTransactions.orderId],
        references: [exports.orders.id],
    }),
}));
exports.loyaltyPointLotsRelations = (0, drizzle_orm_1.relations)(exports.loyaltyPointLots, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.loyaltyPointLots.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.loyaltyPointLots.customerId], references: [exports.customers.id] }),
    order: one(exports.orders, { fields: [exports.loyaltyPointLots.orderId], references: [exports.orders.id] }),
}));
exports.loyaltyPointEventsRelations = (0, drizzle_orm_1.relations)(exports.loyaltyPointEvents, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.loyaltyPointEvents.merchantId], references: [exports.merchants.id] }),
    customer: one(exports.customers, { fields: [exports.loyaltyPointEvents.customerId], references: [exports.customers.id] }),
    order: one(exports.orders, { fields: [exports.loyaltyPointEvents.orderId], references: [exports.orders.id] }),
    product: one(exports.products, { fields: [exports.loyaltyPointEvents.productId], references: [exports.products.id] }),
}));
exports.rfidReadersRelations = (0, drizzle_orm_1.relations)(exports.rfidReaders, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.rfidReaders.merchantId], references: [exports.merchants.id] }),
}));
exports.deliveryZonesRelations = (0, drizzle_orm_1.relations)(exports.deliveryZones, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.deliveryZones.merchantId], references: [exports.merchants.id] }),
}));
exports.paymentTerminalsRelations = (0, drizzle_orm_1.relations)(exports.paymentTerminals, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.paymentTerminals.merchantId], references: [exports.merchants.id] }),
}));
/** Newsletter / marketing campaigns designed and sent by merchants */
exports.newsletterCampaigns = (0, pg_core_1.pgTable)("newsletter_campaigns", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    title: (0, pg_core_1.varchar)("title", { length: 200 }).notNull().default("Newsletter"),
    subject: (0, pg_core_1.varchar)("subject", { length: 300 }).notNull(),
    bodyHtml: (0, pg_core_1.text)("body_html").notNull().default(""),
    /** Unlayer design JSON (reloadable in the email editor). */
    designJson: (0, pg_core_1.json)("design_json").$type(),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("draft"), // draft | sending | sent | failed
    audience: (0, pg_core_1.varchar)("audience", { length: 30 }).notNull().default("all"), // all | selected
    recipientCount: (0, pg_core_1.integer)("recipient_count").default(0),
    sentCount: (0, pg_core_1.integer)("sent_count").default(0),
    failedCount: (0, pg_core_1.integer)("failed_count").default(0),
    selectedEmails: (0, pg_core_1.json)("selected_emails").$type(),
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("newsletter_campaigns_merchant_idx").on(table.merchantId),
    statusIdx: (0, pg_core_1.index)("newsletter_campaigns_status_idx").on(table.merchantId, table.status),
}));
/** Platform-wide transactional email send log (superadmin usage + per-merchant attribution). */
exports.emailSendLog = (0, pg_core_1.pgTable)("email_send_log", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id").references(() => exports.merchants.id, { onDelete: "set null" }),
    provider: (0, pg_core_1.varchar)("provider", { length: 20 }).notNull(), // smtp | brevo | sendgrid
    source: (0, pg_core_1.varchar)("source", { length: 30 }).notNull(), // platform | merchant_smtp | merchant_brevo | env
    emailType: (0, pg_core_1.varchar)("email_type", { length: 50 }).notNull().default("general"),
    recipient: (0, pg_core_1.varchar)("recipient", { length: 255 }).notNull(),
    subject: (0, pg_core_1.varchar)("subject", { length: 500 }),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default("sent"), // sent | failed
    error: (0, pg_core_1.text)("error"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("email_send_log_merchant_idx").on(table.merchantId),
    typeIdx: (0, pg_core_1.index)("email_send_log_type_idx").on(table.emailType),
    createdIdx: (0, pg_core_1.index)("email_send_log_created_idx").on(table.createdAt),
    merchantCreatedIdx: (0, pg_core_1.index)("email_send_log_merchant_created_idx").on(table.merchantId, table.createdAt),
}));
/** Log of marketing emails (newsletter + reorder reminders) */
exports.marketingEmailLog = (0, pg_core_1.pgTable)("marketing_email_log", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    campaignId: (0, pg_core_1.uuid)("campaign_id").references(() => exports.newsletterCampaigns.id, {
        onDelete: "set null",
    }),
    email: (0, pg_core_1.varchar)("email", { length: 255 }).notNull(),
    customerId: (0, pg_core_1.uuid)("customer_id").references(() => exports.customers.id, { onDelete: "set null" }),
    type: (0, pg_core_1.varchar)("type", { length: 40 }).notNull(), // newsletter | reorder_reminder
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("sent"), // sent | failed
    error: (0, pg_core_1.text)("error"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("marketing_email_log_merchant_idx").on(table.merchantId),
    emailIdx: (0, pg_core_1.index)("marketing_email_log_email_idx").on(table.merchantId, table.email),
    typeIdx: (0, pg_core_1.index)("marketing_email_log_type_idx").on(table.merchantId, table.type),
}));
/** Cash drawer shifts for WebPOS / counter */
exports.posShifts = (0, pg_core_1.pgTable)("pos_shifts", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    staffId: (0, pg_core_1.uuid)("staff_id").references(() => exports.merchantStaff.id, { onDelete: "set null" }),
    staffName: (0, pg_core_1.varchar)("staff_name", { length: 255 }),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).default("open").notNull(), // open | closed
    openedAt: (0, pg_core_1.timestamp)("opened_at").defaultNow().notNull(),
    closedAt: (0, pg_core_1.timestamp)("closed_at"),
    openingCash: (0, pg_core_1.decimal)("opening_cash", { precision: 12, scale: 2 }).default("0").notNull(),
    closingCashCounted: (0, pg_core_1.decimal)("closing_cash_counted", { precision: 12, scale: 2 }),
    expectedCash: (0, pg_core_1.decimal)("expected_cash", { precision: 12, scale: 2 }),
    cashSales: (0, pg_core_1.decimal)("cash_sales", { precision: 12, scale: 2 }).default("0"),
    cardSales: (0, pg_core_1.decimal)("card_sales", { precision: 12, scale: 2 }).default("0"),
    terminalSales: (0, pg_core_1.decimal)("terminal_sales", { precision: 12, scale: 2 }).default("0"),
    otherSales: (0, pg_core_1.decimal)("other_sales", { precision: 12, scale: 2 }).default("0"),
    orderCount: (0, pg_core_1.integer)("order_count").default(0),
    variance: (0, pg_core_1.decimal)("variance", { precision: 12, scale: 2 }),
    notes: (0, pg_core_1.text)("notes"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("pos_shifts_merchant_idx").on(table.merchantId),
    statusIdx: (0, pg_core_1.index)("pos_shifts_status_idx").on(table.merchantId, table.status),
    openedIdx: (0, pg_core_1.index)("pos_shifts_opened_idx").on(table.merchantId, table.openedAt),
}));
/** Manual cash in/out during an open POS shift (petty cash, bank drops, etc.) */
exports.posCashMovements = (0, pg_core_1.pgTable)("pos_cash_movements", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    shiftId: (0, pg_core_1.uuid)("shift_id")
        .notNull()
        .references(() => exports.posShifts.id, { onDelete: "cascade" }),
    staffId: (0, pg_core_1.uuid)("staff_id").references(() => exports.merchantStaff.id, { onDelete: "set null" }),
    staffName: (0, pg_core_1.varchar)("staff_name", { length: 255 }),
    type: (0, pg_core_1.varchar)("type", { length: 10 }).notNull(), // in | out
    amount: (0, pg_core_1.decimal)("amount", { precision: 12, scale: 2 }).notNull(),
    reason: (0, pg_core_1.text)("reason"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("pos_cash_movements_merchant_idx").on(table.merchantId),
    shiftIdx: (0, pg_core_1.index)("pos_cash_movements_shift_idx").on(table.shiftId),
    createdIdx: (0, pg_core_1.index)("pos_cash_movements_created_idx").on(table.merchantId, table.createdAt),
}));
// ============================================================================
// RESTAURANT INVENTORY (premium addon) — Lightspeed-style items / recipes / suppliers
// ============================================================================
exports.inventorySuppliers = (0, pg_core_1.pgTable)("inventory_suppliers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    email: (0, pg_core_1.varchar)("email", { length: 255 }),
    phone: (0, pg_core_1.varchar)("phone", { length: 40 }),
    address: (0, pg_core_1.text)("address"),
    contactPerson: (0, pg_core_1.varchar)("contact_person", { length: 255 }),
    notes: (0, pg_core_1.text)("notes"),
    /** Soft-delete when items still reference this supplier */
    archivedAt: (0, pg_core_1.timestamp)("archived_at"),
    lastOrderEmailAt: (0, pg_core_1.timestamp)("last_order_email_at"),
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_suppliers_merchant_idx").on(table.merchantId),
    merchantNameIdx: (0, pg_core_1.index)("inventory_suppliers_merchant_name_idx").on(table.merchantId, table.name),
    demoIdx: (0, pg_core_1.index)("inventory_suppliers_demo_idx").on(table.merchantId, table.isDemo),
}));
exports.inventoryItems = (0, pg_core_1.pgTable)("inventory_items", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    /** Supplier / shelf barcode for storekeeper mobile scan */
    barcode: (0, pg_core_1.varchar)("barcode", { length: 255 }),
    /** kg | L | piece */
    unit: (0, pg_core_1.varchar)("unit", { length: 20 }).default("kg").notNull(),
    cost: (0, pg_core_1.decimal)("cost", { precision: 12, scale: 4 }).default("0").notNull(),
    onHand: (0, pg_core_1.decimal)("on_hand", { precision: 14, scale: 4 }).default("0").notNull(),
    /** Par / reorder point (Lightspeed par level) */
    minStock: (0, pg_core_1.decimal)("min_stock", { precision: 14, scale: 4 }).default("0").notNull(),
    /** Qty to request when at/below par */
    reorderQty: (0, pg_core_1.decimal)("reorder_qty", { precision: 14, scale: 4 }).default("0").notNull(),
    supplierId: (0, pg_core_1.uuid)("supplier_id").references(() => exports.inventorySuppliers.id, { onDelete: "set null" }),
    categoryId: (0, pg_core_1.uuid)("category_id"),
    perishable: (0, pg_core_1.boolean)("perishable").default(false).notNull(),
    autoReorderEnabled: (0, pg_core_1.boolean)("auto_reorder_enabled").default(false).notNull(),
    lastAutoReorderAt: (0, pg_core_1.timestamp)("last_auto_reorder_at"),
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_items_merchant_idx").on(table.merchantId),
    supplierIdx: (0, pg_core_1.index)("inventory_items_supplier_idx").on(table.supplierId),
    categoryIdx: (0, pg_core_1.index)("inventory_items_category_idx").on(table.categoryId),
    merchantNameIdx: (0, pg_core_1.index)("inventory_items_merchant_name_idx").on(table.merchantId, table.name),
    merchantBarcodeIdx: (0, pg_core_1.index)("inventory_items_merchant_barcode_idx").on(table.merchantId, table.barcode),
    demoIdx: (0, pg_core_1.index)("inventory_items_demo_idx").on(table.merchantId, table.isDemo),
}));
exports.inventoryCategories = (0, pg_core_1.pgTable)("inventory_categories", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    name: (0, pg_core_1.varchar)("name", { length: 100 }).notNull(),
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_categories_merchant_idx").on(table.merchantId),
    merchantNameUidx: (0, pg_core_1.uniqueIndex)("inventory_categories_merchant_name_uidx").on(table.merchantId, table.name),
    demoIdx: (0, pg_core_1.index)("inventory_categories_demo_idx").on(table.merchantId, table.isDemo),
}));
exports.inventoryUnits = (0, pg_core_1.pgTable)("inventory_units", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    code: (0, pg_core_1.varchar)("code", { length: 20 }).notNull(),
    name: (0, pg_core_1.varchar)("name", { length: 80 }).notNull(),
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_units_merchant_idx").on(table.merchantId),
    merchantCodeUidx: (0, pg_core_1.uniqueIndex)("inventory_units_merchant_code_uidx").on(table.merchantId, table.code),
    demoIdx: (0, pg_core_1.index)("inventory_units_demo_idx").on(table.merchantId, table.isDemo),
}));
exports.inventoryUnitRatios = (0, pg_core_1.pgTable)("inventory_unit_ratios", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    fromCode: (0, pg_core_1.varchar)("from_code", { length: 20 }).notNull(),
    toCode: (0, pg_core_1.varchar)("to_code", { length: 20 }).notNull(),
    /** 1 fromCode = factor toCode (1 kg = 1000 g). */
    factor: (0, pg_core_1.decimal)("factor", { precision: 16, scale: 6 }).notNull(),
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_unit_ratios_merchant_idx").on(table.merchantId),
    pairUidx: (0, pg_core_1.uniqueIndex)("inventory_unit_ratios_pair_uidx").on(table.merchantId, table.fromCode, table.toCode),
    demoIdx: (0, pg_core_1.index)("inventory_unit_ratios_demo_idx").on(table.merchantId, table.isDemo),
}));
exports.inventoryMovements = (0, pg_core_1.pgTable)("inventory_movements", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    itemId: (0, pg_core_1.uuid)("item_id")
        .notNull()
        .references(() => exports.inventoryItems.id, { onDelete: "cascade" }),
    /** in | out | waste | sale | adjust */
    type: (0, pg_core_1.varchar)("type", { length: 20 }).notNull(),
    qty: (0, pg_core_1.decimal)("qty", { precision: 14, scale: 4 }).notNull(),
    unitCost: (0, pg_core_1.decimal)("unit_cost", { precision: 12, scale: 4 }),
    note: (0, pg_core_1.text)("note"),
    supplierName: (0, pg_core_1.varchar)("supplier_name", { length: 255 }),
    orderId: (0, pg_core_1.uuid)("order_id").references(() => exports.orders.id, { onDelete: "set null" }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_movements_merchant_idx").on(table.merchantId),
    itemIdx: (0, pg_core_1.index)("inventory_movements_item_idx").on(table.itemId, table.createdAt),
    orderIdx: (0, pg_core_1.index)("inventory_movements_order_idx").on(table.orderId),
    typeIdx: (0, pg_core_1.index)("inventory_movements_type_idx").on(table.merchantId, table.type),
}));
/** FEFO stock lots — expiry tracked per inbound delivery. */
exports.inventoryStockLots = (0, pg_core_1.pgTable)("inventory_stock_lots", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    itemId: (0, pg_core_1.uuid)("item_id")
        .notNull()
        .references(() => exports.inventoryItems.id, { onDelete: "cascade" }),
    movementId: (0, pg_core_1.uuid)("movement_id").references(() => exports.inventoryMovements.id, { onDelete: "set null" }),
    qty: (0, pg_core_1.decimal)("qty", { precision: 14, scale: 4 }).notNull(),
    remainingQty: (0, pg_core_1.decimal)("remaining_qty", { precision: 14, scale: 4 }).notNull(),
    expiryDate: (0, pg_core_1.timestamp)("expiry_date"),
    note: (0, pg_core_1.text)("note"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("inventory_stock_lots_merchant_idx").on(table.merchantId),
    itemIdx: (0, pg_core_1.index)("inventory_stock_lots_item_idx").on(table.itemId, table.expiryDate),
    expiryIdx: (0, pg_core_1.index)("inventory_stock_lots_expiry_idx").on(table.merchantId, table.expiryDate),
}));
exports.productRecipes = (0, pg_core_1.pgTable)("product_recipes", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    productId: (0, pg_core_1.uuid)("product_id")
        .notNull()
        .references(() => exports.products.id, { onDelete: "cascade" }),
    itemId: (0, pg_core_1.uuid)("item_id")
        .notNull()
        .references(() => exports.inventoryItems.id, { onDelete: "cascade" }),
    qty: (0, pg_core_1.decimal)("qty", { precision: 14, scale: 4 }).notNull(),
    unit: (0, pg_core_1.varchar)("unit", { length: 20 }).default("kg").notNull(),
    /** Sample data from demo import — safe to bulk-delete */
    isDemo: (0, pg_core_1.boolean)("is_demo").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("product_recipes_merchant_idx").on(table.merchantId),
    productIdx: (0, pg_core_1.index)("product_recipes_product_idx").on(table.productId),
    itemIdx: (0, pg_core_1.index)("product_recipes_item_idx").on(table.itemId),
    productItemUidx: (0, pg_core_1.uniqueIndex)("product_recipes_product_item_uidx").on(table.productId, table.itemId),
    demoIdx: (0, pg_core_1.index)("product_recipes_demo_idx").on(table.merchantId, table.isDemo),
}));
exports.inventorySuppliersRelations = (0, drizzle_orm_1.relations)(exports.inventorySuppliers, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventorySuppliers.merchantId], references: [exports.merchants.id] }),
    items: many(exports.inventoryItems),
}));
exports.inventoryItemsRelations = (0, drizzle_orm_1.relations)(exports.inventoryItems, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventoryItems.merchantId], references: [exports.merchants.id] }),
    supplier: one(exports.inventorySuppliers, {
        fields: [exports.inventoryItems.supplierId],
        references: [exports.inventorySuppliers.id],
    }),
    movements: many(exports.inventoryMovements),
    stockLots: many(exports.inventoryStockLots),
    recipes: many(exports.productRecipes),
    category: one(exports.inventoryCategories, {
        fields: [exports.inventoryItems.categoryId],
        references: [exports.inventoryCategories.id],
    }),
}));
exports.inventoryStockLotsRelations = (0, drizzle_orm_1.relations)(exports.inventoryStockLots, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventoryStockLots.merchantId], references: [exports.merchants.id] }),
    item: one(exports.inventoryItems, { fields: [exports.inventoryStockLots.itemId], references: [exports.inventoryItems.id] }),
    movement: one(exports.inventoryMovements, {
        fields: [exports.inventoryStockLots.movementId],
        references: [exports.inventoryMovements.id],
    }),
}));
exports.inventoryCategoriesRelations = (0, drizzle_orm_1.relations)(exports.inventoryCategories, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventoryCategories.merchantId], references: [exports.merchants.id] }),
    items: many(exports.inventoryItems),
}));
exports.inventoryUnitsRelations = (0, drizzle_orm_1.relations)(exports.inventoryUnits, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventoryUnits.merchantId], references: [exports.merchants.id] }),
}));
exports.inventoryUnitRatiosRelations = (0, drizzle_orm_1.relations)(exports.inventoryUnitRatios, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventoryUnitRatios.merchantId], references: [exports.merchants.id] }),
}));
exports.inventoryMovementsRelations = (0, drizzle_orm_1.relations)(exports.inventoryMovements, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.inventoryMovements.merchantId], references: [exports.merchants.id] }),
    item: one(exports.inventoryItems, { fields: [exports.inventoryMovements.itemId], references: [exports.inventoryItems.id] }),
    order: one(exports.orders, { fields: [exports.inventoryMovements.orderId], references: [exports.orders.id] }),
}));
exports.productRecipesRelations = (0, drizzle_orm_1.relations)(exports.productRecipes, ({ one }) => ({
    merchant: one(exports.merchants, { fields: [exports.productRecipes.merchantId], references: [exports.merchants.id] }),
    product: one(exports.products, { fields: [exports.productRecipes.productId], references: [exports.products.id] }),
    item: one(exports.inventoryItems, { fields: [exports.productRecipes.itemId], references: [exports.inventoryItems.id] }),
}));
exports.subscriptionPlansRelations = (0, drizzle_orm_1.relations)(exports.subscriptionPlans, ({ one, many }) => ({
    edition: one(exports.editions, {
        fields: [exports.subscriptionPlans.editionId],
        references: [exports.editions.id],
    }),
    payments: many(exports.subscriptionPayments),
}));
exports.subscriptionAddonsRelations = (0, drizzle_orm_1.relations)(exports.subscriptionAddons, ({ many }) => ({
    merchantSubscriptions: many(exports.merchantAddonSubscriptions),
    payments: many(exports.subscriptionAddonPayments),
}));
exports.merchantAddonSubscriptionsRelations = (0, drizzle_orm_1.relations)(exports.merchantAddonSubscriptions, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.merchantAddonSubscriptions.merchantId],
        references: [exports.merchants.id],
    }),
    addon: one(exports.subscriptionAddons, {
        fields: [exports.merchantAddonSubscriptions.addonId],
        references: [exports.subscriptionAddons.id],
    }),
}));
exports.subscriptionAddonPaymentsRelations = (0, drizzle_orm_1.relations)(exports.subscriptionAddonPayments, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.subscriptionAddonPayments.merchantId],
        references: [exports.merchants.id],
    }),
    addon: one(exports.subscriptionAddons, {
        fields: [exports.subscriptionAddonPayments.addonId],
        references: [exports.subscriptionAddons.id],
    }),
}));
exports.subscriptionPaymentsRelations = (0, drizzle_orm_1.relations)(exports.subscriptionPayments, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.subscriptionPayments.merchantId],
        references: [exports.merchants.id],
    }),
    plan: one(exports.subscriptionPlans, {
        fields: [exports.subscriptionPayments.planId],
        references: [exports.subscriptionPlans.id],
    }),
}));
/** Catalog items sold by Reborn to merchants */
exports.platformShopProducts = (0, pg_core_1.pgTable)("platform_shop_products", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    name: (0, pg_core_1.varchar)("name", { length: 255 }).notNull(),
    description: (0, pg_core_1.text)("description"),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }).notNull().default("0"),
    discountPercent: (0, pg_core_1.integer)("discount_percent"),
    imageUrl: (0, pg_core_1.varchar)("image_url", { length: 500 }),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    sortOrder: (0, pg_core_1.integer)("sort_order").notNull().default(0),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    activeIdx: (0, pg_core_1.index)("platform_shop_products_active_idx").on(table.isActive),
    sortIdx: (0, pg_core_1.index)("platform_shop_products_sort_idx").on(table.sortOrder),
}));
/** Voucher codes for the platform shop checkout */
exports.platformShopVouchers = (0, pg_core_1.pgTable)("platform_shop_vouchers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    code: (0, pg_core_1.varchar)("code", { length: 50 }).notNull().unique(),
    label: (0, pg_core_1.varchar)("label", { length: 255 }),
    discountPercent: (0, pg_core_1.integer)("discount_percent"),
    discountAmount: (0, pg_core_1.decimal)("discount_amount", { precision: 10, scale: 2 }),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    maxUses: (0, pg_core_1.integer)("max_uses"),
    usedCount: (0, pg_core_1.integer)("used_count").notNull().default(0),
    expiresAt: (0, pg_core_1.timestamp)("expires_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    codeIdx: (0, pg_core_1.uniqueIndex)("platform_shop_vouchers_code_idx").on(table.code),
    activeIdx: (0, pg_core_1.index)("platform_shop_vouchers_active_idx").on(table.isActive),
}));
/** Merchant purchases from the platform shop */
exports.platformShopOrders = (0, pg_core_1.pgTable)("platform_shop_orders", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    status: (0, pg_core_1.varchar)("status", { length: 30 }).notNull().default("pending"), // pending | paid | cancelled | fulfilled
    paymentStatus: (0, pg_core_1.varchar)("payment_status", { length: 30 }).notNull().default("pending"),
    subtotal: (0, pg_core_1.decimal)("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
    discountAmount: (0, pg_core_1.decimal)("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"),
    total: (0, pg_core_1.decimal)("total", { precision: 10, scale: 2 }).notNull().default("0"),
    currency: (0, pg_core_1.varchar)("currency", { length: 3 }).notNull().default("CHF"),
    voucherCode: (0, pg_core_1.varchar)("voucher_code", { length: 50 }),
    items: (0, pg_core_1.json)("items").$type().notNull().default([]),
    notes: (0, pg_core_1.text)("notes"),
    adyenSessionId: (0, pg_core_1.varchar)("adyen_session_id", { length: 255 }),
    adyenPspReference: (0, pg_core_1.varchar)("adyen_psp_reference", { length: 255 }),
    adyenResultCode: (0, pg_core_1.varchar)("adyen_result_code", { length: 50 }),
    paidAt: (0, pg_core_1.timestamp)("paid_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("platform_shop_orders_merchant_idx").on(table.merchantId),
    statusIdx: (0, pg_core_1.index)("platform_shop_orders_status_idx").on(table.status),
    createdIdx: (0, pg_core_1.index)("platform_shop_orders_created_idx").on(table.createdAt),
}));
exports.platformShopOrdersRelations = (0, drizzle_orm_1.relations)(exports.platformShopOrders, ({ one }) => ({
    merchant: one(exports.merchants, {
        fields: [exports.platformShopOrders.merchantId],
        references: [exports.merchants.id],
    }),
}));
/** System-level event log for superadmin */
exports.platformEventLogs = (0, pg_core_1.pgTable)("platform_event_logs", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    level: (0, pg_core_1.varchar)("level", { length: 10 }).notNull().default("info"),
    category: (0, pg_core_1.varchar)("category", { length: 80 }).notNull().default("system"),
    message: (0, pg_core_1.text)("message").notNull(),
    metadata: (0, pg_core_1.json)("metadata").$type(),
    actorRole: (0, pg_core_1.varchar)("actor_role", { length: 20 }),
    actorId: (0, pg_core_1.uuid)("actor_id"),
    merchantId: (0, pg_core_1.uuid)("merchant_id"),
    resellerId: (0, pg_core_1.uuid)("reseller_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    levelIdx: (0, pg_core_1.index)("platform_event_logs_level_idx").on(table.level),
    categoryIdx: (0, pg_core_1.index)("platform_event_logs_category_idx").on(table.category),
    createdIdx: (0, pg_core_1.index)("platform_event_logs_created_idx").on(table.createdAt),
}));
/** Platform announcements, incidents, and what's-new entries */
exports.platformMessages = (0, pg_core_1.pgTable)("platform_messages", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    kind: (0, pg_core_1.varchar)("kind", { length: 20 }).notNull().default("announcement"),
    audience: (0, pg_core_1.varchar)("audience", { length: 30 }).notNull().default("all_merchants"),
    targetMerchantId: (0, pg_core_1.uuid)("target_merchant_id"),
    targetResellerId: (0, pg_core_1.uuid)("target_reseller_id"),
    title: (0, pg_core_1.varchar)("title", { length: 255 }).notNull(),
    body: (0, pg_core_1.text)("body").notNull(),
    severity: (0, pg_core_1.varchar)("severity", { length: 20 }).notNull().default("info"),
    externalUrl: (0, pg_core_1.varchar)("external_url", { length: 500 }),
    externalLabel: (0, pg_core_1.varchar)("external_label", { length: 120 }),
    showOnLogin: (0, pg_core_1.boolean)("show_on_login").notNull().default(true),
    showInBanner: (0, pg_core_1.boolean)("show_in_banner").notNull().default(false),
    isActive: (0, pg_core_1.boolean)("is_active").notNull().default(true),
    startsAt: (0, pg_core_1.timestamp)("starts_at"),
    endsAt: (0, pg_core_1.timestamp)("ends_at"),
    createdBySuperadminId: (0, pg_core_1.uuid)("created_by_superadmin_id"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    kindIdx: (0, pg_core_1.index)("platform_messages_kind_idx").on(table.kind),
    audienceIdx: (0, pg_core_1.index)("platform_messages_audience_idx").on(table.audience),
    activeIdx: (0, pg_core_1.index)("platform_messages_active_idx").on(table.isActive),
    createdIdx: (0, pg_core_1.index)("platform_messages_created_idx").on(table.createdAt),
}));
/** Per-viewer dismissals (merchant/reseller/superadmin) */
exports.platformMessageDismissals = (0, pg_core_1.pgTable)("platform_message_dismissals", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    messageId: (0, pg_core_1.uuid)("message_id")
        .notNull()
        .references(() => exports.platformMessages.id, { onDelete: "cascade" }),
    viewerRole: (0, pg_core_1.varchar)("viewer_role", { length: 20 }).notNull(),
    viewerId: (0, pg_core_1.uuid)("viewer_id").notNull(),
    dismissedAt: (0, pg_core_1.timestamp)("dismissed_at").defaultNow().notNull(),
}, (table) => ({
    uniqueDismiss: (0, pg_core_1.uniqueIndex)("platform_message_dismissals_unique").on(table.messageId, table.viewerRole, table.viewerId),
    viewerIdx: (0, pg_core_1.index)("platform_message_dismissals_viewer_idx").on(table.viewerRole, table.viewerId),
}));
exports.supportTickets = (0, pg_core_1.pgTable)("support_tickets", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    ticketNumber: (0, pg_core_1.varchar)("ticket_number", { length: 20 }).notNull(),
    merchantId: (0, pg_core_1.uuid)("merchant_id")
        .notNull()
        .references(() => exports.merchants.id, { onDelete: "cascade" }),
    resellerId: (0, pg_core_1.uuid)("reseller_id").references(() => exports.resellers.id, { onDelete: "set null" }),
    category: (0, pg_core_1.varchar)("category", { length: 30 }).notNull().default("technical"),
    subcategory: (0, pg_core_1.varchar)("subcategory", { length: 80 }),
    subject: (0, pg_core_1.varchar)("subject", { length: 255 }).notNull(),
    status: (0, pg_core_1.varchar)("status", { length: 20 }).notNull().default("open"),
    /** When false, ticket is visible in superadmin support inbox only (POS diagnostic auto-reports). */
    merchantVisible: (0, pg_core_1.boolean)("merchant_visible").notNull().default(true),
    assignedToSuperadminId: (0, pg_core_1.uuid)("assigned_to_superadmin_id"),
    lastMessageAt: (0, pg_core_1.timestamp)("last_message_at").defaultNow().notNull(),
    closedAt: (0, pg_core_1.timestamp)("closed_at"),
    autoCloseAt: (0, pg_core_1.timestamp)("auto_close_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
}, (table) => ({
    merchantIdx: (0, pg_core_1.index)("support_tickets_merchant_idx").on(table.merchantId),
    resellerIdx: (0, pg_core_1.index)("support_tickets_reseller_idx").on(table.resellerId),
    statusIdx: (0, pg_core_1.index)("support_tickets_status_idx").on(table.status),
    numberIdx: (0, pg_core_1.uniqueIndex)("support_tickets_number_idx").on(table.ticketNumber),
    createdIdx: (0, pg_core_1.index)("support_tickets_created_idx").on(table.createdAt),
}));
exports.supportTicketMessages = (0, pg_core_1.pgTable)("support_ticket_messages", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    ticketId: (0, pg_core_1.uuid)("ticket_id")
        .notNull()
        .references(() => exports.supportTickets.id, { onDelete: "cascade" }),
    authorRole: (0, pg_core_1.varchar)("author_role", { length: 20 }).notNull(),
    authorId: (0, pg_core_1.uuid)("author_id"),
    authorName: (0, pg_core_1.varchar)("author_name", { length: 255 }),
    body: (0, pg_core_1.text)("body").notNull(),
    attachmentUrl: (0, pg_core_1.varchar)("attachment_url", { length: 500 }),
    attachmentName: (0, pg_core_1.varchar)("attachment_name", { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
}, (table) => ({
    ticketIdx: (0, pg_core_1.index)("support_ticket_messages_ticket_idx").on(table.ticketId),
    createdIdx: (0, pg_core_1.index)("support_ticket_messages_created_idx").on(table.createdAt),
}));
exports.supportTicketsRelations = (0, drizzle_orm_1.relations)(exports.supportTickets, ({ one, many }) => ({
    merchant: one(exports.merchants, { fields: [exports.supportTickets.merchantId], references: [exports.merchants.id] }),
    reseller: one(exports.resellers, { fields: [exports.supportTickets.resellerId], references: [exports.resellers.id] }),
    messages: many(exports.supportTicketMessages),
}));
exports.supportTicketMessagesRelations = (0, drizzle_orm_1.relations)(exports.supportTicketMessages, ({ one }) => ({
    ticket: one(exports.supportTickets, {
        fields: [exports.supportTicketMessages.ticketId],
        references: [exports.supportTickets.id],
    }),
}));
//# sourceMappingURL=schema.js.map