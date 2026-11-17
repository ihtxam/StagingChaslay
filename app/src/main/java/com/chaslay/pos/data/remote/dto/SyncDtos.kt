package com.chaslay.pos.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

data class SyncCategoryDto(
    val id: String,
    val name: String,
    val sort_order: Int? = null,
    val color_hex: String? = null,
    val online_visible: Boolean? = null,
    val kiosk_visible: Boolean? = null,
    val updated_at: String? = null,
    val deleted_at: String? = null
)

data class SyncProductDto(
    val id: String,
    val category_id: String? = null,
    val name: String,
    val description: String? = null,
    val price: Double = 0.0,
    @SerializedName("cost") val costPrice: Double? = null,
    val tax_rate: Double? = null,
    val sku: String? = null,
    val barcode: String? = null,
    val image_url: String? = null,
    val sort_order: Int? = null,
    val in_stock: Boolean? = null,
    @SerializedName("is_open_price") val isOpenPrice: Boolean? = null,
    @SerializedName("sold_by_weight") val soldByWeight: Boolean? = null,
    @SerializedName("product_type") val productType: String? = null,
    @SerializedName(value = "combo_items", alternate = ["comboItems", "comboSlots"])
    val comboItems: JsonElement? = null,
    @SerializedName(value = "allow_extras", alternate = ["allowExtras"])
    val allowExtras: Boolean? = null,
    val extras: List<SyncExtraDto>? = null,
    @SerializedName(value = "modifier_groups", alternate = ["modifierGroups"])
    val modifierGroups: List<SyncModifierGroupDto>? = null,
    val variants: List<SyncVariantDto>? = null,
    val specifications: List<SyncVariantDto>? = null,
    val online_visible: Boolean? = null,
    val kiosk_visible: Boolean? = null,
    val updated_at: String? = null,
    val deleted_at: String? = null
)

data class SyncExtraDto(
    val id: String? = null,
    val name: String? = null,
    val price: Double = 0.0
)

data class SyncVariantDto(
    val id: String? = null,
    val name: String? = null,
    val price: Double? = null,
    @SerializedName(value = "isDefault", alternate = ["is_default"])
    val isDefault: Boolean? = null,
    @SerializedName(value = "sortOrder", alternate = ["sort_order"])
    val sortOrder: Int? = null,
    @SerializedName(value = "saleStatus", alternate = ["sale_status"])
    val saleStatus: String? = null
)

data class SyncModifierOptionDto(
    val id: String? = null,
    val name: String? = null,
    val price: Double? = null,
    @SerializedName(value = "isDefault", alternate = ["is_default"])
    val isDefault: Boolean? = null,
    @SerializedName(value = "saleStatus", alternate = ["sale_status"])
    val saleStatus: String? = null,
    val sortOrder: Int? = null
)

data class SyncModifierGroupDto(
    val id: String? = null,
    val title: String? = null,
    val name: String? = null,
    @SerializedName(value = "pricingType", alternate = ["pricing_type"])
    val pricingType: String? = null,
    @SerializedName(value = "selectionType", alternate = ["selection_type"])
    val selectionType: String? = null,
    @SerializedName(value = "minSelectable", alternate = ["min_selectable"])
    val minSelectable: Int? = null,
    @SerializedName(value = "maxSelectable", alternate = ["max_selectable"])
    val maxSelectable: Int? = null,
    @SerializedName(value = "allowMultipleSameItem", alternate = ["allow_multiple_same_item"])
    val allowMultipleSameItem: Boolean? = null,
    val sortOrder: Int? = null,
    val options: List<SyncModifierOptionDto>? = null
)

data class SyncComboOptionDto(
    @SerializedName(value = "productId", alternate = ["product_id", "id", "clientId", "client_id"])
    val productId: String? = null,
    @SerializedName(value = "sourceProductId", alternate = ["source_product_id"])
    val sourceProductId: String? = null,
    @SerializedName(value = "extraPrice", alternate = ["extra_price"])
    val extraPrice: Double? = null
)

data class SyncComboSlotDto(
    val id: String? = null,
    val name: String? = null,
    @SerializedName(value = "minPick", alternate = ["min_pick"])
    val minPick: Int? = null,
    @SerializedName(value = "maxPick", alternate = ["max_pick"])
    val maxPick: Int? = null,
    @SerializedName(value = "options", alternate = ["products", "items"])
    val options: List<SyncComboOptionDto>? = null,
    @SerializedName(value = "productId", alternate = ["product_id"])
    val productId: String? = null,
    val quantity: Int? = null
)

data class SyncBusinessDto(
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val address: String? = null,
    @SerializedName("vat_number") val vatNumber: String? = null,
    @SerializedName("vat_rate") val vatRate: Double? = null,
    @SerializedName("tax_takeaway_rate") val taxTakeawayRate: Double? = null,
    @SerializedName("tax_dine_in_rate") val taxDineInRate: Double? = null,
    @SerializedName("tax_delivery_rate") val taxDeliveryRate: Double? = null,
    @SerializedName("tax_included_in_price") val taxIncludedInPrice: Boolean? = null,
    @SerializedName("vat_after_discount") val vatAfterDiscount: Boolean? = null,
    @SerializedName("default_language") val defaultLanguage: String? = null,
    @SerializedName("store_hours") val storeHours: Map<String, Map<String, List<SyncStoreHoursSlotDto>>>? = null,
    @SerializedName("receipt_base_url") val receiptBaseUrl: String? = null
)

data class SyncStoreHoursSlotDto(
    val open: String,
    val close: String
)

data class SyncDiningTableDto(
    val id: String,
    val label: String,
    val capacity: Int? = null,
    val shape: String? = null,
    @SerializedName("pos_x") val posX: Double? = null,
    @SerializedName("pos_y") val posY: Double? = null,
    val width: Double? = null,
    val height: Double? = null,
    val rotation: Double? = null,
    @SerializedName("sort_order") val sortOrder: Int? = null
)

data class SyncFloorPlanDto(
    val id: String,
    val name: String,
    @SerializedName("canvas_width") val canvasWidth: Int? = null,
    @SerializedName("canvas_height") val canvasHeight: Int? = null,
    @SerializedName("sort_order") val sortOrder: Int? = null,
    val tables: List<SyncDiningTableDto> = emptyList()
)

data class MenuBootstrapResponse(
    val serverTime: Long,
    @SerializedName("platform_about_html") val platformAboutHtml: String? = null,
    val business: SyncBusinessDto? = null,
    val categories: List<SyncCategoryDto> = emptyList(),
    val products: List<SyncProductDto> = emptyList(),
    @SerializedName("floor_plans") val floorPlans: List<SyncFloorPlanDto> = emptyList(),
    @SerializedName("reserved_table_ids") val reservedTableIds: List<String> = emptyList()
)

data class MenuChangesResponse(
    val serverTime: Long,
    val categories: List<SyncCategoryDto> = emptyList(),
    val products: List<SyncProductDto> = emptyList()
)

data class OnlineOrderItemDto(
    val productName: String? = null,
    val name: String? = null,
    val quantity: Int = 1,
    val unitPrice: Double = 0.0,
    val lineTotal: Double? = null,
    val notes: String? = null
)

data class IncomingOnlineOrderDto(
    val id: String,
    val order_number: String,
    val source: String? = null,
    val status: String? = null,
    val service_type: String? = null,
    val fulfillment_type: String? = null,
    val customer_name: String? = null,
    val customer_phone: String? = null,
    val delivery_address: String? = null,
    val pickup_time_ms: Long? = null,
    val subtotal: Double = 0.0,
    val tax_total: Double = 0.0,
    val total: Double = 0.0,
    val notes: String? = null,
    val payload: JsonElement? = null,
    val created_at: String? = null,
    @SerializedName("print_kitchen") val print_kitchen: Boolean? = null
)

data class IncomingOrdersResponse(
    val serverTime: Long,
    val orders: List<IncomingOnlineOrderDto> = emptyList()
)

data class AckResponse(
    val ok: Boolean = true
)

data class DiagnosticReportRequest(
    val subject: String,
    val body: String,
    val auto: Boolean = true,
    @SerializedName("device_id") val deviceId: String? = null,
    @SerializedName("app_version") val appVersion: String? = null
)

data class SyncAdyenConfigDto(
    val merchant_account: String? = null,
    val api_key: String? = null,
    val client_id: String? = null
)

data class SyncPaymentTerminalDto(
    val id: String? = null,
    val terminal_id: String,
    val terminal_name: String? = null,
    val serial_number: String? = null,
    val status: String? = null
)

data class SyncPaymentMethodsDto(
    val express: Boolean = true,
    val cash: Boolean = true,
    val card: Boolean = true,
    val terminal: Boolean = false,
    @SerializedName("tap_to_pay") val tapToPay: Boolean = false,
    @SerializedName("giftCard") val giftCard: Boolean = false,
    val invoice: Boolean = true,
)

data class SyncFeaturesDto(
    @SerializedName("courses_enabled") val coursesEnabled: Boolean = false,
    @SerializedName("floor_plan_enabled") val floorPlanEnabled: Boolean = false,
    @SerializedName("pax_ordering_enabled") val paxOrderingEnabled: Boolean = false,
    @SerializedName("shifts_enabled") val shiftsEnabled: Boolean = false,
    @SerializedName("reservations_enabled") val reservationsEnabled: Boolean = false
)

data class SyncReservationDto(
    val id: String,
    val code: String,
    @SerializedName("guest_name") val guestName: String,
    @SerializedName("guest_phone") val guestPhone: String,
    @SerializedName("guest_email") val guestEmail: String? = null,
    @SerializedName("party_size") val partySize: Int = 2,
    @SerializedName("reserved_at") val reservedAt: String,
    val status: String,
    @SerializedName("table_id") val tableId: String? = null,
    @SerializedName("table_label") val tableLabel: String? = null,
    val notes: String? = null,
    @SerializedName("internal_notes") val internalNotes: String? = null,
    val source: String? = null
)

data class ReservationsSyncResponse(
    val serverTime: Long = 0L,
    val reservations: List<SyncReservationDto> = emptyList(),
    @SerializedName("reserved_table_ids") val reservedTableIds: List<String> = emptyList()
)

data class ReservationsConfigRequest(
    val enabled: Boolean
)

data class ReservationsConfigResponse(
    val ok: Boolean = true,
    val enabled: Boolean = false
)

data class ReservationActionRequest(
    val action: String,
    val tableId: String? = null,
    val cancelReason: String? = null,
    val sendRejectionEmail: Boolean? = null
)

data class ReservationActionResponse(
    val ok: Boolean = true,
    val reservation: SyncReservationDto? = null,
    val error: String? = null
)

data class SyncCheckoutDiscountPresetDto(
    val id: String? = null,
    val name: String? = null,
    val percent: Double = 0.0
)

data class SyncCheckoutDto(
    val tipsEnabled: Boolean = true,
    val terminalAskGratuityEnabled: Boolean = false,
    val tipPresetsPercent: List<Double> = listOf(0.0, 5.0, 10.0, 15.0),
    val allowCustomTip: Boolean = true,
    val discountsEnabled: Boolean = true,
    val discountPresets: List<SyncCheckoutDiscountPresetDto> = emptyList(),
    val roundingStep: Double = 0.05,
    val quickCashEnabled: Boolean = true,
    val quickCashDenominations: List<Double> = listOf(10.0, 20.0, 50.0, 100.0),
    val splitBillsEnabled: Boolean = true,
    val maxSplitParts: Int = 8,
    val vatIncludedInPrice: Boolean = false,
    /** Net prices: order discounts reduce VAT base when true (default, Swiss law). */
    val vatAfterDiscount: Boolean = true,
    /** Restaurant only: hide table picker / Tables tab when false (fast-food mode). */
    val tablesEnabled: Boolean = true,
    val posMode: String? = null,
    val retailTakeawayEnabled: Boolean = false,
    val retailDeliveryEnabled: Boolean = false,
    val retailDineInEnabled: Boolean = false,
    val requireTableForDineIn: Boolean? = null,
    /** fire_per_course | send_all_once */
    val courseSendMode: String? = null,
    /** Show Cash/Card/Terminal quick-pay buttons under products. */
    val expressCheckoutEnabled: Boolean = true,
    /** cart | product_grid */
    val expressPayPlacement: String? = null,
    val retailCashTenderDialogEnabled: Boolean = true,
    val checkoutEurDisplayEnabled: Boolean = false,
    val checkoutChfToEurRate: Double = 0.0
)

data class SyncScaleDto(
    val enabled: Boolean = false,
    @SerializedName("com_port") val comPort: String? = null,
    @SerializedName("usb_address") val usbAddress: String? = null
)

data class SyncPrintDto(
    @SerializedName("adyen_receipt_digital_only") val adyenReceiptDigitalOnly: Boolean = false,
    @SerializedName("receipt_delivery_directions_qr") val receiptDeliveryDirectionsQr: Boolean = true,
    @SerializedName("auto_print_kitchen") val autoPrintKitchen: Boolean = true,
    @SerializedName("auto_print_receipt") val autoPrintReceipt: Boolean = true,
    @SerializedName("waiter_till_bell_enabled") val waiterTillBellEnabled: Boolean = true,
    @SerializedName("kitchen_print_retry_enabled") val kitchenPrintRetryEnabled: Boolean = true,
    @SerializedName("kitchen_print_retry_attempts") val kitchenPrintRetryAttempts: Int = 5,
    @SerializedName("kitchen_print_retry_interval_sec") val kitchenPrintRetryIntervalSec: Int = 5,
    /** Panel receipt template id; only "Default" today. */
    @SerializedName("receipt_template_name") val receiptTemplateName: String = "Default",
    @SerializedName("receipt_header") val receiptHeader: String = "",
    @SerializedName("receipt_footer") val receiptFooter: String = "",
    @SerializedName("receipt_show_vat_table") val receiptShowVatTable: Boolean = true,
    @SerializedName("receipt_show_staff_line") val receiptShowStaffLine: Boolean = true,
    @SerializedName("receipt_show_qr_code") val receiptShowQrCode: Boolean = true,
    @SerializedName("receipt_show_google_review_qr") val receiptShowGoogleReviewQr: Boolean = false,
    @SerializedName("receipt_google_reviews_url") val receiptGoogleReviewsUrl: String? = null,
    @SerializedName("receipt_body_text_scale") val receiptBodyTextScale: Int = 1
)

data class SyncCustomerDisplayDto(
    val enabled: Boolean = true,
    @SerializedName("access_token") val accessToken: String? = null,
    @SerializedName("short_code") val shortCode: String? = null,
    @SerializedName("merchant_slug") val merchantSlug: String? = null,
    @SerializedName("display_url") val displayUrl: String? = null,
)

data class PaymentConfigResponse(
    val serverTime: Long = 0L,
    val adyen: SyncAdyenConfigDto? = null,
    val default_terminal_id: String? = null,
    val terminals: List<SyncPaymentTerminalDto> = emptyList(),
    val terminal_ready: Boolean = false,
    @SerializedName("tap_to_pay_ready") val tapToPayReady: Boolean = false,
    @SerializedName("tap_to_pay_enabled") val tapToPayEnabled: Boolean = false,
    val methods: SyncPaymentMethodsDto? = null,
    val features: SyncFeaturesDto? = null,
    val checkout: SyncCheckoutDto? = null,
    @SerializedName("receipt_base_url") val receiptBaseUrl: String? = null,
    val scale: SyncScaleDto? = null,
    val print: SyncPrintDto? = null,
    val loyalty: SyncLoyaltyDto? = null,
    @SerializedName("customer_display") val customerDisplay: SyncCustomerDisplayDto? = null,
)

data class CdsLiveLineDto(
    val name: String,
    val qty: Double,
    val lineTotal: Double,
    val modifiers: String? = null,
)

data class CdsPushStateDto(
    val merchantName: String? = null,
    val currency: String = "CHF",
    val lines: List<CdsLiveLineDto> = emptyList(),
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val tax: Double = 0.0,
    val total: Double = 0.0,
    val phase: String,
    val receiptUrl: String? = null,
    val locale: String? = null,
    val updatedAt: Long = System.currentTimeMillis(),
)

data class CdsPushRequest(
    val state: CdsPushStateDto,
)

data class SyncLoyaltyDto(
    val enabled: Boolean = false,
    @SerializedName("earnPointsPerChf") val earnPointsPerChf: Double = 1.0,
    @SerializedName("redeemPointsPerChf") val redeemPointsPerChf: Int = 100
)

data class PushTerminalItemDto(
    val terminalId: String,
    val terminalName: String? = null,
    val serialNumber: String? = null,
    val status: String? = null
)

data class PushTerminalsRequest(
    val terminals: List<PushTerminalItemDto>? = null,
    val defaultTerminalId: String? = null,
    val adyenMerchantAccount: String? = null,
    val adyenApiKey: String? = null,
    val adyenClientId: String? = null,
    val adyenTerminalEnabled: Boolean? = null,
    val deviceLabel: String? = null
)

data class PushTerminalsResponse(
    val ok: Boolean = true,
    val upserted: Int = 0,
    val serverTime: Long = 0L
)

data class SyncStaffRoleDto(
    val id: String,
    val name: String,
    val permissions: List<String> = emptyList(),
    val isSystem: Boolean = false
)

data class SyncStaffMemberDto(
    val id: String,
    val name: String,
    val roleId: String,
    val pinHash: String? = null,
    val isActive: Boolean = true
)

data class StaffSyncResponse(
    val roles: List<SyncStaffRoleDto> = emptyList(),
    val staff: List<SyncStaffMemberDto> = emptyList()
)

data class VerifyStaffPinRequest(
    val pin: String
)

data class VerifyStaffPinResponse(
    val success: Boolean = true,
    val staff: SyncStaffProfileDto? = null
)

data class SyncStaffProfileDto(
    val id: String,
    val name: String,
    val roleId: String,
    val roleName: String,
    val permissions: List<String> = emptyList(),
  /** JWT for dashboard / gift-card APIs (returned by verify-pin). */
    val accessToken: String? = null
)

data class PushCatalogCategoryDto(
    val clientId: String,
    val name: String,
    val sortOrder: Int = 0,
    val color: String? = null
)

data class PushCatalogProductDto(
    val clientId: String,
    val name: String,
    val price: Double,
    val categoryClientId: String? = null,
    val sku: String? = null,
    val barcode: String? = null,
    val isTaxable: Boolean = true,
    val sortOrder: Int = 0
)

data class PushCatalogRequest(
    val categories: List<PushCatalogCategoryDto> = emptyList(),
    val products: List<PushCatalogProductDto> = emptyList()
)

data class PushCatalogResponse(
    val ok: Boolean = true,
    val serverTime: Long = 0L,
    val categoryMap: Map<String, String> = emptyMap(),
    val productMap: Map<String, String> = emptyMap()
)

data class ProfitMarginReportResponse(
    val success: Boolean = true,
    val report: RemoteProfitMarginReport? = null
)

data class RemoteProfitMarginReport(
    val granularity: String? = null,
    val previousRange: RemoteProfitRange? = null,
    val summary: RemoteProfitSummary? = null,
    @SerializedName("byProduct") val byProduct: List<RemoteProfitRow>? = null,
    @SerializedName("byCategory") val byCategory: List<RemoteProfitRow>? = null,
    @SerializedName("byPeriod") val byPeriod: List<RemoteProfitRow>? = null
)

data class RemoteProfitRange(
    val label: String? = null
)

data class RemoteProfitSummary(
    val revenue: Double = 0.0,
    val cogs: Double = 0.0,
    val profit: Double = 0.0,
    @SerializedName("marginPct") val marginPct: Double? = null,
    @SerializedName("revenueChangePct") val revenueChangePct: Double? = null,
    @SerializedName("profitChangePct") val profitChangePct: Double? = null,
    @SerializedName("linesMissingBuyingPrice") val linesMissingBuyingPrice: Int = 0
)

data class RemoteProfitRow(
    val id: String = "",
    val label: String = "",
    val quantity: Double = 0.0,
    val revenue: Double = 0.0,
    val cogs: Double = 0.0,
    val profit: Double = 0.0,
    @SerializedName("marginPct") val marginPct: Double? = null,
    @SerializedName("revenueChangePct") val revenueChangePct: Double? = null,
    @SerializedName("profitChangePct") val profitChangePct: Double? = null
)
