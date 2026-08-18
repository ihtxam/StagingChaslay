package com.chaslay.pos.printer

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.PrinterConfigEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.local.entity.TransactionEntity
import com.chaslay.pos.data.local.entity.TransactionItemEntity
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.EndOfDayReport
import com.chaslay.pos.domain.model.VatBreakdownRow
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.formatMoneyAmount
import com.chaslay.pos.domain.model.roundMoney
import com.chaslay.pos.data.repository.ReceiptPublicUrls
import com.chaslay.pos.receipt.ReceiptQrGenerator
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import javax.inject.Inject
import javax.inject.Singleton

data class DiscoveredPrinter(
    val name: String,
    val address: String
)

@Singleton
class BluetoothPrinterService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val usbPrinterManager: UsbPrinterManager,
    private val printerConfigDao: com.chaslay.pos.data.local.dao.PrinterConfigDao,
    private val receiptQrGenerator: ReceiptQrGenerator
) {
    private val kitchenQtyLine = Regex("^\\d+x\\s+", RegexOption.IGNORE_CASE)
    private val kitchenDiscountNote = Regex("""^\d+(\.\d+)?% off$|(?i)^adjusted from """)

    private fun bluetoothAdapter(): BluetoothAdapter? {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        return manager?.adapter
    }

    fun simulatedPrinter(): DiscoveredPrinter = SIMULATED_PRINTER

    fun discoverPrinters(hasBluetoothPermission: Boolean): List<DiscoveredPrinter> {
        val printers = mutableListOf(SIMULATED_PRINTER)
        if (!hasBluetoothPermission) return printers
        return runCatching {
            val adapter = bluetoothAdapter() ?: return printers
            if (!adapter.isEnabled) return printers
            adapter.bondedDevices.orEmpty().mapTo(printers) { device ->
                DiscoveredPrinter(name = device.name ?: "Unknown", address = device.address)
            }
            printers
        }.getOrElse {
            Log.w(TAG, "Bluetooth discovery failed", it)
            printers
        }
    }

    /**
     * Scans the local Wi-Fi subnet (/24) for ESC/POS network printers listening on the
     * standard JetDirect/RAW port 9100. Returns any hosts that accept a TCP connection.
     */
    suspend fun discoverNetworkPrinters(
        port: Int = 9100,
        extraHosts: List<String> = emptyList()
    ): List<DiscoveredPrinter> =
        withContext(Dispatchers.IO) {
            val results = linkedMapOf<String, DiscoveredPrinter>()
            extraHosts.map { it.trim() }.filter { it.isNotBlank() }.forEach { raw ->
                val (host, probePort) = parseHostPort(raw)
                if (canReachNetworkPrinter(host, probePort)) {
                    results[host] = DiscoveredPrinter("Network printer ($host)", host)
                }
            }

            val localIp = localIpAddress()
            if (localIp == null) {
                Log.w(TAG, "Network scan skipped: no local IPv4 address")
                return@withContext results.values.toList()
            }
            val prefix = localIp.substringBeforeLast('.', "")
            if (prefix.isBlank()) {
                Log.w(TAG, "Network scan skipped: invalid local IP $localIp")
                return@withContext results.values.toList()
            }
            Log.i(TAG, "Scanning $prefix.1-254:$port from $localIp")
            val semaphore = Semaphore(16)
            coroutineScope {
                (1..254).map { host ->
                    async {
                        semaphore.withPermit {
                            val ip = "$prefix.$host"
                            if (ip in results) return@async null
                            if (canReachNetworkPrinter(ip, port)) {
                                DiscoveredPrinter("Network printer ($ip)", ip)
                            } else null
                        }
                    }
                }.mapNotNull { deferred ->
                    deferred.await()?.also { printer -> results[printer.address] = printer }
                }
            }
            Log.i(TAG, "Network scan finished: ${results.size} printer(s)")
            results.values.toList()
        }

    fun canReachNetworkPrinter(address: String, port: Int = 9100, timeoutMs: Int = 2000): Boolean {
        val trimmed = address.trim()
        if (trimmed.isBlank()) return false
        val (host, resolvedPort) = parseHostPort(trimmed)
        if (!isNetworkAddress(host)) return false
        return runCatching {
            val socket = java.net.Socket()
            try {
                localIpAddress()?.let { local ->
                    runCatching { socket.bind(java.net.InetSocketAddress(local, 0)) }
                }
                socket.connect(java.net.InetSocketAddress(host, resolvedPort), timeoutMs)
                true
            } finally {
                runCatching { socket.close() }
            }
        }.getOrDefault(false)
    }

    fun currentLocalIpv4(): String? = localIpAddress()

    /** Opens a short connection to verify the printer is reachable (Bluetooth / Wi-Fi / USB). */
    suspend fun warmupConnection(address: String, connectionType: String) = withContext(Dispatchers.IO) {
        if (address.isBlank() || isSimulated(address)) return@withContext
        runCatching {
            when {
                connectionType == "USB" || isUsbAddress(address) ->
                    usbPrinterManager.sendBytes(address, ESC_INIT)
                isNetworkAddress(address) -> {
                    val (host, port) = parseHostPort(address)
                    java.net.Socket().use { socket ->
                        socket.connect(java.net.InetSocketAddress(host, port), 3000)
                    }
                }
                else -> {
                    val adapter = bluetoothAdapter() ?: return@runCatching
                    val device = adapter.getRemoteDevice(address)
                    val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                    socket.connect()
                    socket.close()
                }
            }
        }.onFailure { e -> Log.w(TAG, "Warmup failed for $address: ${e.message}") }
    }

    private fun localIpAddress(): String? = runCatching {
        val interfaces = java.net.NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback }
            .sortedByDescending { iface ->
                when {
                    iface.name.lowercase().startsWith("wlan") -> 3
                    iface.name.lowercase().startsWith("wifi") -> 3
                    iface.name.lowercase().startsWith("eth") -> 2
                    else -> 1
                }
            }
        interfaces.flatMap { it.inetAddresses.toList() }
            .firstOrNull { addr ->
                !addr.isLoopbackAddress &&
                    addr is java.net.Inet4Address &&
                    addr.isSiteLocalAddress
            }?.hostAddress
    }.getOrNull()

    private fun parseHostPort(address: String): Pair<String, Int> {
        val trimmed = address.trim()
        val colon = trimmed.lastIndexOf(':')
        return if (colon > 0 && trimmed.substring(colon + 1).toIntOrNull() != null) {
            trimmed.substring(0, colon) to trimmed.substring(colon + 1).toInt()
        } else {
            trimmed to 9100
        }
    }

    fun printReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        appendAdyenCustomerReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        appendAdyenCashierReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        loyaltyPointsEarned: Int? = null,
        loyaltyPointsBalance: Int? = null
    ): Result<Unit> {
        val payload = buildEscPosReceipt(
            settings,
            transaction,
            items,
            appendAdyenCustomerReceipt = appendAdyenCustomerReceipt,
            appendAdyenCashierReceipt = appendAdyenCashierReceipt,
            loyaltyPointsEarned = loyaltyPointsEarned,
            loyaltyPointsBalance = loyaltyPointsBalance
        )
        return sendBytes(settings.printerMacAddress, settings, payload, "Receipt ${transaction.transactionNumber}")
    }

    fun testPrint(settings: BusinessSettingsEntity): Result<Unit> {
        val payload = buildTestReceipt(settings)
        return sendBytes(settings.printerMacAddress, settings, payload, "Test print")
    }

    fun openCashDrawer(settings: BusinessSettingsEntity): Result<Unit> {
        val payload = ESC_INIT + byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
        return sendBytes(settings.printerMacAddress, settings, payload, "Cash drawer")
    }

    suspend fun routeOpenCashDrawer(settings: BusinessSettingsEntity): Result<Unit> = withContext(Dispatchers.IO) {
        val payload = ESC_INIT + byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
        val drawerPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.openCashDrawer && it.address.isNotBlank() }
        if (drawerPrinters.isEmpty()) {
            return@withContext openCashDrawer(settings)
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in drawerPrinters) {
            last = sendBytes(printer.address, settings, payload, "Cash drawer ${printer.name}")
        }
        last
    }

    suspend fun routeCartReceipt(
        settings: BusinessSettingsEntity,
        cart: CartSummary,
        context: ReceiptPrintContext,
        discountAmount: Double,
        tipAmount: Double,
        total: Double
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            val payload = buildCartReceipt(settings, cart, context, discountAmount, tipAmount, total)
            return@withContext sendBytes(settings.printerMacAddress, settings, payload, "Receipt")
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val payload = buildCartReceipt(
                settings, cart, context, discountAmount, tipAmount, total, lineWidth
            )
            last = sendBytes(printer.address, settings, payload, "Receipt ${printer.name}")
        }
        last
    }

    fun printCartPreview(
        settings: BusinessSettingsEntity,
        lines: List<Pair<String, Double>>,
        total: Double,
        title: String = "PREVIEW RECEIPT"
    ): Result<Unit> {
        val sb = StringBuilder()
        appendHeader(sb, settings.receiptHeader.ifBlank { settings.businessName })
        sb.appendLine(center(title))
        sb.appendLine(center("--------------------------------"))
        lines.forEach { (label, amount) ->
            sb.appendLine(label)
            sb.appendLine(right(formatMoney(amount, settings.currencySymbol)))
        }
        sb.appendLine("--------------------------------")
        sb.appendLine("TOTAL: ${formatMoney(total, settings.currencySymbol)}")
        appendFooter(sb, settings.receiptFooter)
        sb.appendLine("\n\n\n")
        return sendBytes(settings.printerMacAddress, settings, encodePayload(sb.toString()), "Preview receipt")
    }

    suspend fun routeCartPreview(
        settings: BusinessSettingsEntity,
        lines: List<Pair<String, Double>>,
        total: Double,
        title: String = "PREVIEW RECEIPT"
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            return@withContext printCartPreview(settings, lines, total, title)
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val sb = StringBuilder()
            appendHeader(sb, settings.receiptHeader.ifBlank { settings.businessName }, lineWidth)
            sb.appendLine(center(title, lineWidth))
            sb.appendLine(center(sepDash(lineWidth), lineWidth))
            lines.forEach { (label, amount) ->
                sb.appendLine(label)
                sb.appendLine(right(formatMoney(amount, settings.currencySymbol), lineWidth))
            }
            sb.appendLine("-".repeat(lineWidth.coerceAtMost(32)))
            sb.appendLine("TOTAL: ${formatMoney(total, settings.currencySymbol)}")
            appendFooter(sb, settings.receiptFooter, lineWidth)
            sb.appendLine("\n\n\n")
            last = sendBytes(printer.address, settings, encodePayload(sb.toString()), "Preview ${printer.name}")
        }
        last
    }

    suspend fun routeEndOfDayReport(
        settings: BusinessSettingsEntity,
        report: EndOfDayReport
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val reportPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printEndOfDayReports && it.address.isNotBlank() }
        if (reportPrinters.isNotEmpty()) {
            var last: Result<Unit> = Result.success(Unit)
            for (printer in reportPrinters) {
                val lineWidth = lineWidthFor(printer.paperWidthMm)
                val payload = buildEndOfDayReport(settings, report, lineWidth)
                last = sendBytes(printer.address, settings, payload, "End of day ${printer.name}")
            }
            return@withContext last
        }
        val legacyAddress = settings.printerMacAddress?.takeIf { it.isNotBlank() }
            ?: return@withContext Result.failure(IllegalStateException("No report printer configured. Add a printer with ENDOFDAY REPORTS enabled."))
        val payload = buildEndOfDayReport(settings, report, LINE_WIDTH_80)
        sendBytes(legacyAddress, settings, payload, "End of day report")
    }

    suspend fun printEndOfDayReport(settings: BusinessSettingsEntity, report: EndOfDayReport): Result<Unit> =
        routeEndOfDayReport(settings, report)

    fun printKitchenTicket(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        isFollowUp: Boolean,
        message: String?,
        categories: List<CategoryEntity> = emptyList(),
        products: List<ProductEntity> = emptyList(),
        meta: KitchenPrintMeta = KitchenPrintMeta(),
        paperWidthMm: Int = 80
    ): Result<Unit> {
        if (settings.posMode != PosMode.RESTAURANT) return Result.success(Unit)
        if (items.isEmpty() && !isFollowUp) return Result.success(Unit)
        val lineWidth = lineWidthFor(paperWidthMm)
        val kitchenItems = items.filter {
            resolvePrintTarget(it.productId, categories, products) != PrintTarget.POS
        }
        val posItems = items.filter {
            val target = resolvePrintTarget(it.productId, categories, products)
            target == PrintTarget.POS || target == PrintTarget.BOTH
        }
        val ticketItems = when {
            isFollowUp -> emptyList()
            kitchenItems.isNotEmpty() -> kitchenItems
            else -> items
        }
        var lastResult: Result<Unit> = Result.success(Unit)
        if (ticketItems.isNotEmpty() || isFollowUp) {
            val payload = buildKitchenTicket(
                settings = settings,
                tableName = tableName,
                serviceType = serviceType,
                round = round,
                items = ticketItems,
                isFollowUp = isFollowUp,
                message = message,
                meta = meta,
                lineWidth = lineWidth
            )
            val mac = settings.kitchenPrinterMacAddress
                ?: settings.printerMacAddress
                ?: SIMULATED_ADDRESS
            lastResult = sendBytes(mac, settings, payload, "Kitchen ticket")
        }
        if (posItems.isNotEmpty() && !isFollowUp) {
            val barPayload = buildBarTicket(settings, tableName, round, posItems, lineWidth)
            val mac = settings.printerMacAddress ?: SIMULATED_ADDRESS
            lastResult = sendBytes(mac, settings, barPayload, "Bar ticket")
        }
        return lastResult
    }

    /**
     * Routes a kitchen ticket to every saved printer that is enabled and set to print kitchen
     * tickets, printing only the items linked to each printer (by product or category). Falls back
     * to the legacy single kitchen-printer behaviour when no kitchen printers are configured.
     */
    suspend fun routeKitchen(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        isFollowUp: Boolean,
        message: String?,
        products: List<ProductEntity> = emptyList(),
        categories: List<CategoryEntity> = emptyList(),
        meta: KitchenPrintMeta = KitchenPrintMeta()
    ): Result<Unit> = withContext(Dispatchers.IO) {
        if (settings.posMode != PosMode.RESTAURANT) return@withContext Result.success(Unit)
        if (items.isEmpty() && !isFollowUp) return@withContext Result.success(Unit)
        val kitchenPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printKitchenTickets && it.address.isNotBlank() }
        if (kitchenPrinters.isEmpty()) {
            return@withContext printKitchenTicket(
                settings, tableName, serviceType, round, items, isFollowUp, message, categories, products, meta,
                defaultKitchenPaperWidthMm()
            )
        }
        var last: Result<Unit> = Result.success(Unit)
        var printedAny = false
        for (printer in kitchenPrinters) {
            val subset = if (isFollowUp) emptyList() else items.filter { matchesPrinter(it, printer, products) }
            if (!isFollowUp && subset.isEmpty()) continue
            val lineWidth = lineWidthFor(defaultKitchenPaperWidthMm())
            val payload = buildKitchenTicket(
                settings, tableName, serviceType, round, subset, isFollowUp, message, meta, lineWidth
            )
            last = sendBytes(printer.address, settings, payload, "Kitchen ${printer.name}")
            printedAny = true
        }
        if (printedAny) last else Result.success(Unit)
    }

    suspend fun routeGiftCardSaleReceipt(
        settings: BusinessSettingsEntity,
        code: String,
        balance: Double,
        recipientEmail: String? = null,
        holderName: String? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            return@withContext printGiftCardSaleReceipt(settings, code, balance, recipientEmail, holderName)
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val payload = buildGiftCardSaleReceipt(settings, code, balance, recipientEmail, holderName, lineWidth)
            last = sendBytes(printer.address, settings, payload, "Gift card ${printer.name}")
        }
        last
    }

    private suspend fun printGiftCardSaleReceipt(
        settings: BusinessSettingsEntity,
        code: String,
        balance: Double,
        recipientEmail: String?,
        holderName: String?
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val lineWidth = lineWidthFor(80)
        val payload = buildGiftCardSaleReceipt(settings, code, balance, recipientEmail, holderName, lineWidth)
        val address = settings.printerMacAddress?.trim().orEmpty()
        if (address.isBlank()) return@withContext Result.failure(IllegalStateException("No receipt printer configured"))
        sendBytes(address, settings, payload, "Gift card receipt")
    }

    private fun buildGiftCardSaleReceipt(
        settings: BusinessSettingsEntity,
        code: String,
        balance: Double,
        recipientEmail: String?,
        holderName: String?,
        lineWidth: Int
    ): ByteArray {
        val sym = settings.currencySymbol
        val sep = "=".repeat(lineWidth)
        val thin = "-".repeat(lineWidth)
        val labels = ReceiptLabels.forLanguage(settings.defaultLanguage)
        val displayCode = com.chaslay.pos.domain.model.GiftCardCode.barcodePayload(code)
        val taxRate = giftCardVatRate(settings, settings.defaultServiceType)
        val vatRow = ReceiptVatCalculator.vatRowForGiftCardAmount(
            balance,
            taxRate,
            settings.vatIncludedInPrice
        )
        val total = vatRow?.brut ?: balance

        val sb = StringBuilder()
        sb.appendLine(sep)
        appendCenteredLines(sb, settings.businessName, lineWidth, bold = false)
        sb.appendLine(sep)
        sb.appendLine(center("GIFT CARD", lineWidth))
        sb.appendLine(thin)
        holderName?.takeIf { it.isNotBlank() }?.let {
            sb.appendLine("Holder: ${it.take(lineWidth - 8)}")
        }
        recipientEmail?.takeIf { it.isNotBlank() }?.let {
            sb.appendLine("Email: ${it.take(lineWidth - 7)}")
        }
        sb.appendLine(
            leftRight("Balance", "$sym ${String.format(Locale.US, "%.2f", balance)}", lineWidth)
        )
        if (kotlin.math.abs(total - balance) >= 0.01) {
            sb.appendLine(
                leftRight(labels.total, "$sym ${String.format(Locale.US, "%.2f", total)}", lineWidth)
            )
        }
        if (settings.receiptShowVatTable && vatRow != null && vatRow.tva >= 0.01) {
            sb.appendLine(thin)
            appendReceiptVatSection(sb, listOf(vatRow), labels, lineWidth, settings.vatIncludedInPrice)
        }
        sb.appendLine(thin)
        sb.appendLine(center("Scan barcode to redeem", lineWidth))
        sb.appendLine(sep)
        appendFooter(sb, settings.receiptFooter, lineWidth)
        val barcodePayload = displayCode
        return finalizeGiftCardPayload(sb.toString(), settings, lineWidth, barcodePayload, displayCode)
    }

    private fun giftCardVatRate(
        settings: BusinessSettingsEntity,
        serviceType: com.chaslay.pos.domain.model.ServiceType?
    ): Double = when (serviceType) {
        com.chaslay.pos.domain.model.ServiceType.DINE_IN -> settings.dineInVatRate
        else -> settings.takeawayVatRate
    }

    private fun finalizeGiftCardPayload(
        text: String,
        settings: BusinessSettingsEntity,
        lineWidth: Int,
        barcodePayload: String,
        displayCode: String
    ): ByteArray {
        val body = EscPosEncoder.encode(text)
        val barcodeBytes = escPosCode128(barcodePayload)
        val labelBytes = EscPosEncoder.encode(escAlignCenter() + displayCode.take(lineWidth) + "\n" + escAlignLeft())
        val scannable = barcodeBytes + labelBytes
        return buildPrintPayload(body, settings, lineWidth, scannable, cutFeedLines = 2)
    }

    /** ESC/POS Code128 (GS k 73) — subset B, HRI off (label printed separately). */
    private fun escPosCode128(data: String, height: Int = 72, width: Int = 2): ByteArray {
        val raw = data.trim()
        if (raw.isEmpty()) return byteArrayOf()
        val encoded = if (raw.startsWith("{")) raw else "{B$raw"
        val payload = encoded.toByteArray(Charsets.US_ASCII)
        if (payload.isEmpty() || payload.size > 255) return byteArrayOf()
        return byteArrayOf(
            0x1B, 0x61, 0x01,
            0x1D, 0x68, height.coerceIn(1, 255).toByte(),
            0x1D, 0x77, width.coerceIn(1, 6).toByte(),
            0x1D, 0x48, 0,
            0x1D, 0x6B, 73, payload.size.toByte()
        ) + payload + byteArrayOf(0x0A, 0x1B, 0x61, 0x00)
    }

    /**
     * Routes a customer receipt to every saved printer set to print order receipts. Falls back to
     * the legacy single receipt-printer behaviour when none are configured.
     */
    suspend fun routeReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        appendAdyenCustomerReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        appendAdyenCashierReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        loyaltyPointsEarned: Int? = null,
        loyaltyPointsBalance: Int? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        if (receiptPrinters.isEmpty()) {
            return@withContext printReceipt(
                settings,
                transaction,
                items,
                appendAdyenCustomerReceipt,
                appendAdyenCashierReceipt,
                loyaltyPointsEarned,
                loyaltyPointsBalance
            )
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in receiptPrinters) {
            val lineWidth = lineWidthFor(printer.paperWidthMm)
            val payload = buildEscPosReceipt(
                settings,
                transaction,
                items,
                lineWidth,
                appendAdyenCustomerReceipt,
                appendAdyenCashierReceipt,
                loyaltyPointsEarned,
                loyaltyPointsBalance
            )
            last = sendBytes(printer.address, settings, payload, "Receipt ${printer.name}")
            if (printer.openCashDrawer) {
                sendBytes(
                    printer.address,
                    settings,
                    ESC_INIT + byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte()),
                    "Cash drawer"
                )
            }
        }
        last
    }

    /**
     * Prints an Adyen Terminal API payment receipt (CustomerReceipt / CashierReceipt)
     * to every configured order receipt printer.
     */
    suspend fun routeAdyenPaymentReceipt(
        settings: BusinessSettingsEntity,
        receipt: com.chaslay.pos.payment.AdyenTerminalReceipt
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val receiptPrinters = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
            .filter { it.isEnabled && it.printOrderReceipts && it.address.isNotBlank() }
        val targets = if (receiptPrinters.isEmpty()) {
            listOf(null)
        } else {
            receiptPrinters
        }
        var last: Result<Unit> = Result.success(Unit)
        for (printer in targets) {
            val lineWidth = printer?.let { lineWidthFor(it.paperWidthMm) } ?: LINE_WIDTH_80
            val text = com.chaslay.pos.payment.AdyenPaymentReceiptFormatter.toPlainText(receipt, lineWidth)
            val payload = finalizePayload(text, settings, lineWidth, receiptUrl = null)
            val address = printer?.address ?: settings.printerMacAddress
            last = sendBytes(address, settings, payload, "Adyen ${receipt.documentQualifier}")
        }
        last
    }

    private fun matchesPrinter(
        item: TableOrderItemEntity,
        printer: PrinterConfigEntity,
        products: List<ProductEntity>
    ): Boolean {
        if (printer.printAllProducts) return true
        val productIds = printer.linkedProductIds.split(",").mapNotNull { it.trim().toLongOrNull() }.toSet()
        if (item.productId in productIds) return true
        val categoryIds = printer.linkedCategoryIds.split(",").mapNotNull { it.trim().toLongOrNull() }.toSet()
        val product = products.find { it.id == item.productId }
        return product != null && product.categoryId in categoryIds
    }

    fun resolvePrintTarget(
        productId: Long,
        categories: List<CategoryEntity>,
        products: List<ProductEntity>
    ): PrintTarget {
        val product = products.find { it.id == productId }
        product?.printTarget?.let { return it }
        val category = categories.find { it.id == product?.categoryId }
        return category?.printTarget ?: PrintTarget.KITCHEN
    }

    private fun buildBarTicket(
        settings: BusinessSettingsEntity,
        tableName: String,
        round: Int,
        items: List<TableOrderItemEntity>,
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        appendHeader(sb, settings.kitchenTicketHeader, lineWidth)
        sb.appendLine(escBold(true))
        sb.appendLine(center("BAR / POS", lineWidth))
        sb.appendLine(escBold(false))
        sb.appendLine(center(settings.businessName, lineWidth))
        if (tableName.isNotBlank()) sb.appendLine(formatKitchenTableLine(tableName, "Table"))
        sb.appendLine(center(sepDash(lineWidth), lineWidth))
        items.forEach { item ->
            appendKitchenItemBlock(sb, item, settings, lineWidth)
        }
        appendFooter(sb, settings.kitchenTicketFooter, lineWidth)
        sb.appendLine("\n\n\n")
        return encodePayload(sb.toString())
    }

    private fun buildKitchenTicket(
        settings: BusinessSettingsEntity,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        isFollowUp: Boolean,
        message: String?,
        meta: KitchenPrintMeta = KitchenPrintMeta(),
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        val labels = ReceiptLabels.forLanguage(settings.defaultLanguage)
        val timeFmt = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        val sepEq = "=".repeat(lineWidth)
        val dash = sepDash(lineWidth)

        if (isFollowUp) {
            sb.appendLine(escBold(true))
            sb.appendLine(labels.kitchenMessageTitle)
            if (tableName.isNotBlank()) sb.appendLine(formatKitchenTableLine(tableName, labels.table))
            sb.appendLine(escBold(false))
            sb.appendLine(sepDash(lineWidth))
            message.orEmpty().lines().forEach { line ->
                val trimmed = line.trim()
                if (trimmed.isNotBlank()) sb.appendLine(trimmed)
            }
            sb.appendLine(sepDash(lineWidth))
            val followUpParts = buildList {
                meta.orderNumber?.trim()?.takeIf { it.isNotBlank() }?.let { add("#${shortenOrderNumber(it)}") }
                add(timeFmt.format(Date(System.currentTimeMillis())))
            }
            sb.appendLine(followUpParts.joinToString(" · "))
            appendFooter(sb, settings.kitchenTicketFooter, lineWidth)
            sb.appendLine("\n\n\n")
            return encodePayload(sb.toString())
        }

        val effectiveFulfillment = resolveKitchenFulfillment(meta.fulfillmentType, serviceType)
        val orderNo = meta.orderNumber?.trim()?.takeIf { it.isNotBlank() }
        val fulfillmentLabel = labels.fulfillmentLabel(effectiveFulfillment, serviceType)
        val isDineIn = effectiveFulfillment == FulfillmentType.DINE_IN

        if (meta.cancelled) {
            sb.appendLine(escBold(true))
            sb.appendLine(labels.cancelledKitchenTitle)
            sb.appendLine(escBold(false))
            if (!meta.cancelReason.isNullOrBlank()) {
                sb.appendLine(meta.cancelReason.trim())
            }
        } else if (!isDineIn) {
            sb.appendLine(escBold(true))
            sb.appendLine(center(labels.kitchenTitle, lineWidth))
            sb.appendLine(escBold(false))
        }

        if (isDineIn) {
            // Compact left header: dine-in + table. No oversized type — it wastes paper.
            sb.appendLine(escBold(true))
            sb.appendLine(fulfillmentLabel)
            tableName.takeIf { it.isNotBlank() }?.let {
                sb.appendLine(formatKitchenTableLine(it, labels.table))
            }
            sb.appendLine(escBold(false))
        } else if (effectiveKitchenHeaderScale(settings) > 1) {
            sb.append(escAlignCenter())
            sb.append(escKitchenSize(effectiveKitchenHeaderScale(settings), bold = true))
            sb.appendLine(fulfillmentLabel)
            sb.append(escKitchenSizeReset())
            sb.append(escAlignLeft())
        } else {
            sb.appendLine(escBold(true))
            sb.appendLine(center(fulfillmentLabel, lineWidth))
            sb.appendLine(escBold(false))
        }
        when (effectiveFulfillment) {
            FulfillmentType.DELIVERY -> {
                meta.deliveryName?.takeIf { it.isNotBlank() }?.let {
                    sb.appendLine(center("${labels.deliverTo}: $it", lineWidth))
                }
                meta.deliveryAddress?.takeIf { it.isNotBlank() }?.let { addr ->
                    addr.chunked(lineWidth.coerceAtMost(32)).forEach { sb.appendLine(it) }
                }
                meta.deliveryPhone?.takeIf { it.isNotBlank() }?.let {
                    sb.appendLine(center("${labels.tel}: $it", lineWidth))
                }
                val deliveryLabel = meta.pickupTimeMs?.let { timeFmt.format(Date(it)) } ?: labels.asap
                sb.appendLine(center("${labels.deliveryAt}: $deliveryLabel", lineWidth))
            }
            FulfillmentType.PICKUP -> {
                val pickupLabel = meta.pickupTimeMs?.let { timeFmt.format(Date(it)) } ?: labels.asap
                sb.appendLine(center("${labels.pickupAt}: $pickupLabel", lineWidth))
            }
            else -> Unit
        }

        sb.appendLine(center(sepEq, lineWidth))
        val itemCount = items.sumOf { if (it.isWeighed) 1 else it.quantity }
        val numsLabel = "($itemCount)"
        sb.appendLine(
            "${labels.itemsHeader}${" ".repeat((lineWidth - labels.itemsHeader.length - numsLabel.length).coerceAtLeast(1))}$numsLabel"
        )
        sb.appendLine(dash)

        meta.fireCourseNumber?.let { course ->
            sb.appendLine(escBold(true))
            sb.appendLine(center("*** ${labels.fireCourse} $course ***", lineWidth))
            sb.appendLine(escBold(false))
        }

        val courses = items.groupBy { it.courseNumber }.toSortedMap()
        if (courses.size <= 1) {
            items.forEach { item ->
                appendKitchenItemBlock(sb, item, settings, lineWidth, meta.cancelled)
            }
        } else {
            courses.forEach { (course, courseItems) ->
                sb.appendLine(escBold(true))
                sb.appendLine(center("--- ${labels.courseLabel} $course ---", lineWidth))
                sb.appendLine(escBold(false))
                courseItems.forEach { item ->
                    appendKitchenItemBlock(sb, item, settings, lineWidth, meta.cancelled)
                }
                sb.appendLine(dash)
            }
        }

        sb.appendLine(center(sepDash(lineWidth), lineWidth))
        val orderedAt = meta.orderedAtMs ?: System.currentTimeMillis()
        val staff = meta.cashierName?.trim().orEmpty()
        val source = labels.orderSourceLabel(meta.orderSource)
        val footerParts = buildList {
            if (staff.isNotBlank()) add(staff)
            add(timeFmt.format(Date(orderedAt)))
            orderNo?.let { add("#${shortenOrderNumber(it)}") }
            add(source)
        }
        sb.appendLine(center(footerParts.joinToString(" · "), lineWidth))
        appendFooter(sb, settings.kitchenTicketFooter, lineWidth)
        sb.appendLine("\n\n\n")
        return encodePayload(sb.toString())
    }

    /** "Table-5" from a stored name like "5", "Table 5", or "Table-5". */
    private fun formatKitchenTableLine(tableName: String, tableLabel: String): String {
        val raw = tableName.trim()
        if (raw.isBlank()) return ""
        val prefix = tableLabel.trim().trimEnd(':', ' ', '\u00A0')
        val stripped = raw
            .replace(Regex("^(?i)(table|tisch|tavolo|tavola)\\s*[-:.]?\\s*"), "")
            .trim()
        val name = stripped.ifBlank { raw }
        return "$prefix-$name"
    }

    private fun resolveKitchenFulfillment(
        fulfillmentType: FulfillmentType,
        serviceType: ServiceType
    ): FulfillmentType = when (fulfillmentType) {
        FulfillmentType.WALK_IN -> when (serviceType) {
            ServiceType.TAKEAWAY -> FulfillmentType.PICKUP
            ServiceType.DINE_IN -> FulfillmentType.DINE_IN
        }
        else -> fulfillmentType
    }

    private fun buildCartReceipt(
        settings: BusinessSettingsEntity,
        cart: CartSummary,
        context: ReceiptPrintContext,
        discountAmount: Double,
        tipAmount: Double,
        total: Double,
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sb = StringBuilder()
        val labels = ReceiptLabels.forLanguage(settings.defaultLanguage)
        val dateTimeFmt = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        val sepEq = "=".repeat(lineWidth.coerceAtMost(32))
        val subtotal = cart.subtotal - cart.itemDiscountTotal
        val discountFactor = receiptDiscountFactor(
            settings.vatIncludedInPrice,
            settings.vatAfterDiscount,
            subtotal,
            discountAmount
        )
        val giftCardRate = giftCardVatRate(settings, cart.serviceType)
        val vatRows = ReceiptVatCalculator.vatRowsFromCartItems(
            cart.items,
            discountFactor,
            giftCardRate,
            cart.vatIncludedInPrice
        )

        if (context.isProvisional) {
            appendCenteredLines(sb, "PROVISIONAL", lineWidth, bold = true)
            sb.appendLine(center(sepEq, lineWidth))
        }
        appendReceiptStoreBlock(sb, settings, lineWidth)
        sb.appendLine(center(sepEq, lineWidth))

        context.tableName?.let {
            wrapText("${labels.table} $it", lineWidth).forEach { line ->
                sb.appendLine(center(line, lineWidth))
            }
        }
        if (context.fulfillmentType == FulfillmentType.DELIVERY ||
            cart.fulfillmentType == FulfillmentType.DELIVERY
        ) {
            cart.deliveryName?.takeIf { it.isNotBlank() }?.let { name ->
                sb.appendLine("${labels.deliverTo}: $name")
            }
            cart.deliveryPhone?.takeIf { it.isNotBlank() }?.let { phone ->
                sb.appendLine("${labels.tel}: $phone")
            }
            val addr = listOfNotNull(cart.deliveryAddress, cart.deliveryZip)
                .filter { it.isNotBlank() }
                .joinToString(", ")
            if (addr.isNotBlank()) {
                sb.appendLine("${labels.delivery}:")
                wrapText(addr, lineWidth).forEach { sb.appendLine(it) }
            }
        } else {
            cart.deliveryName?.takeIf { it.isNotBlank() }?.let { name ->
                sb.appendLine("${labels.deliverTo}: $name")
            }
            cart.deliveryPhone?.takeIf { it.isNotBlank() }?.let { phone ->
                sb.appendLine("${labels.tel}: $phone")
            }
        }

        sb.appendLine(center(sepEq, lineWidth))
        cart.items.forEach { item ->
            val label = buildString {
                append(item.displayQtyLabel())
                if (item.variantName != null) append(" (${item.variantName})")
            }
            val lineAmount = if (cart.vatIncludedInPrice) item.lineTotal else item.lineSubtotal
            sb.appendLine(
                leftRight(label.take(lineWidth - 12), formatMoney(lineAmount, settings.currencySymbol), lineWidth)
            )
            item.displayRateLabel(settings.currencySymbol)?.let { rate ->
                sb.appendLine("  $rate")
            }
            if (item.lineDiscount > 0) {
                sb.appendLine(
                    leftRight(
                        "  ${labels.itemDiscount}",
                        "-${formatMoney(item.lineDiscount, settings.currencySymbol)}",
                        lineWidth
                    )
                )
            }
            ReceiptVatCalculator.modifierSummary(item)?.let { mods ->
                sb.appendLine("  ($mods)")
            }
            item.notes?.lines()?.filter { line ->
                !Regex("^\\d+x\\s+").containsMatchIn(line.trim())
            }?.map { it.trim() }?.filter { it.isNotBlank() }?.forEach { note ->
                sb.appendLine("  ${labels.note} $note")
            }
        }

        if (discountAmount > 0.0) {
            sb.appendLine(leftRight(labels.discount, "-${formatMoney(discountAmount, settings.currencySymbol)}", lineWidth))
        }

        if (tipAmount > 0.0) {
            sb.appendLine(leftRight(labels.tip, formatMoney(tipAmount, settings.currencySymbol), lineWidth))
        }

        appendReceiptTotal(sb, labels.total, total, settings.currencySymbol, lineWidth)

        appendLoyaltyReceiptLines(sb, context.loyaltyPointsEarned, context.loyaltyPointsBalance, lineWidth)

        if (!context.isProvisional) {
            context.paymentMethod?.let { method ->
                sb.appendLine(leftRight(labels.payment, labels.paymentMethod(method), lineWidth))
                context.amountPaid?.let { paid ->
                    sb.appendLine(leftRight(labels.paid, twoDp(paid), lineWidth))
                }
            }
        }

        // VAT after payment — Net / Tax / Gross table plus tax-total (never print Net as tax).
        if (settings.receiptShowVatTable && vatRows.isNotEmpty()) {
            appendReceiptVatSection(sb, vatRows, labels, lineWidth, cart.vatIncludedInPrice)
        }

        val orderType = labels.fulfillmentLabel(context.fulfillmentType, context.serviceType)
        appendReceiptMetaFooter(
            sb = sb,
            dateTime = dateTimeFmt.format(Date()),
            staffName = context.staffName,
            showStaff = settings.receiptShowStaffLine,
            lineWidth = lineWidth,
            orderNumber = context.orderNumber,
            orderType = orderType
        )
        appendFooter(sb, settings.receiptFooter, lineWidth)
        val deliveryDirectionsUrl = deliveryDirectionsUrlForCart(settings, cart, context, lineWidth, sb)
        sb.appendLine("\n\n\n")
        return finalizePayload(sb.toString(), settings, lineWidth, deliveryDirectionsUrl = deliveryDirectionsUrl)
    }

    private fun buildEscPosReceipt(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        items: List<TransactionItemEntity>,
        lineWidth: Int = LINE_WIDTH_80,
        appendAdyenCustomerReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        appendAdyenCashierReceipt: com.chaslay.pos.payment.AdyenTerminalReceipt? = null,
        loyaltyPointsEarned: Int? = null,
        loyaltyPointsBalance: Int? = null
    ): ByteArray {
        val sb = StringBuilder()
        val labels = ReceiptLabels.forLanguage(settings.defaultLanguage)
        val dateTimeFmt = SimpleDateFormat("dd-MM-yyyy HH:mm", Locale.getDefault())
        val sepEq = "=".repeat(lineWidth.coerceAtMost(32))
        val itemBrut = items.sumOf { it.lineTotal }
        val orderDiscount = resolveReceiptDiscount(transaction)
        val discountFactor = receiptDiscountFactor(
            settings.vatIncludedInPrice,
            settings.vatAfterDiscount,
            itemBrut,
            orderDiscount
        )
        val giftCardRate = giftCardVatRate(settings, transaction.serviceType)
        val vatRows = ReceiptVatCalculator.vatRowsFromTransactionItems(
            items,
            discountFactor,
            giftCardRate,
            settings.vatIncludedInPrice
        )

        appendReceiptStoreBlock(sb, settings, lineWidth)
        sb.appendLine(center(sepEq, lineWidth))
        items.forEach { item ->
            val label = buildString {
                append(formatTxItemQtyLabel(item))
                if (item.variantName != null) append(" (${item.variantName})")
            }
            val lineAmount = if (settings.vatIncludedInPrice) item.lineTotal else item.lineSubtotal
            sb.appendLine(
                leftRight(label.take(lineWidth - 12), formatMoney(lineAmount, settings.currencySymbol), lineWidth)
            )
            if (item.isWeighed) {
                val kg = item.quantity / 1000.0
                sb.appendLine(
                    leftRight(
                        "  ${String.format(Locale.US, "Weight %.3f kg", kg)}",
                        "",
                        lineWidth
                    ).trimEnd()
                )
            }
            formatTxItemRateLabel(item, settings.currencySymbol)?.let { rate ->
                sb.appendLine("  $rate")
            }
            val qtyFactor = if (item.isWeighed) item.quantity / 1000.0 else item.quantity.toDouble()
            val lineDiscount = item.lineDiscountPerUnit * qtyFactor
            if (lineDiscount > 0.0) {
                sb.appendLine(
                    leftRight(
                        "  ${labels.itemDiscount}",
                        "-${formatMoney(lineDiscount, settings.currencySymbol)}",
                        lineWidth
                    )
                )
            }
            ReceiptVatCalculator.modifierSummaryFromNotes(item.notes)?.let { mods ->
                sb.appendLine("  ($mods)")
            }
        }

        if (orderDiscount > 0.0) {
            val discountLabel = if (transaction.discountPercent > 0) {
                labels.discountPercent.format(transaction.discountPercent.toInt())
            } else {
                labels.discount
            }
            sb.appendLine(leftRight(discountLabel, "-${formatMoney(orderDiscount, settings.currencySymbol)}", lineWidth))
        }

        if (transaction.tipAmount > 0.0) {
            sb.appendLine(leftRight(labels.tip, formatMoney(transaction.tipAmount, settings.currencySymbol), lineWidth))
        }

        if (kotlin.math.abs(transaction.roundingAmount) >= 0.01) {
            val sign = if (transaction.roundingAmount > 0) "+" else ""
            sb.appendLine(
                leftRight(
                    labels.rounding,
                    "$sign${formatMoney(transaction.roundingAmount, settings.currencySymbol)}",
                    lineWidth
                )
            )
        }

        appendReceiptTotal(sb, labels.total, transaction.total, settings.currencySymbol, lineWidth)

        appendLoyaltyReceiptLines(sb, loyaltyPointsEarned, loyaltyPointsBalance, lineWidth)

        parseGiftCardPaymentAmount(transaction.notes)?.let { giftPaid ->
            sb.appendLine(
                leftRight(
                    "Gift card",
                    "-${formatMoney(giftPaid, settings.currencySymbol)}",
                    lineWidth
                )
            )
        }

        parseGiftCardRemainingAmount(transaction.notes)?.let { remaining ->
            sb.appendLine(
                leftRight(
                    "Gift card remaining",
                    formatMoney(remaining, settings.currencySymbol),
                    lineWidth
                )
            )
        }

        sb.appendLine(leftRight(labels.payment, labels.paymentMethod(transaction.paymentMethod), lineWidth))
        sb.appendLine(leftRight(labels.paid, twoDp(transaction.total), lineWidth))
        transaction.cardReference?.takeIf { it.isNotBlank() }?.let { ref ->
            sb.appendLine(leftRight("Terminal ref:", ref.take(lineWidth - 14), lineWidth))
        }

        // VAT after payment — Net / Tax / Gross table plus tax-total (never print Net as tax).
        if (settings.receiptShowVatTable && vatRows.isNotEmpty()) {
            appendReceiptVatSection(sb, vatRows, labels, lineWidth, settings.vatIncludedInPrice)
        }

        val serviceType = transaction.serviceType ?: com.chaslay.pos.domain.model.ServiceType.TAKEAWAY
        val orderType = labels.fulfillmentLabel(
            com.chaslay.pos.domain.model.FulfillmentType.WALK_IN,
            serviceType
        )
        appendReceiptMetaFooter(
            sb = sb,
            dateTime = dateTimeFmt.format(Date(transaction.createdAt)),
            staffName = transaction.userName,
            showStaff = settings.receiptShowStaffLine,
            lineWidth = lineWidth,
            orderNumber = transaction.transactionNumber,
            orderType = orderType
        )
        transaction.notes?.lines()
            ?.filter { it.isNotBlank() && !it.startsWith("Gift card payment:") && !it.startsWith("Gift card remaining:") }
            ?.forEach { line ->
            sb.appendLine(line)
        }
        appendFooter(sb, settings.receiptFooter, lineWidth)
        val qrUrl = if (settings.receiptShowQrCode) {
            transaction.receiptUrl?.takeIf { it.isNotBlank() }
                ?: ReceiptPublicUrls.build(settings.receiptBaseUrl, transaction.id)
        } else null
        if (qrUrl != null) {
            sb.appendLine(center(sepDash(lineWidth), lineWidth))
            sb.appendLine(center(labels.scanDigitalReceipt, lineWidth))
        }
        val deliveryDirectionsUrl = deliveryDirectionsUrlForTransaction(settings, transaction, lineWidth, sb)
        com.chaslay.pos.payment.AdyenPaymentReceiptStorage.appendable(appendAdyenCustomerReceipt)
            ?.takeIf { settings.adyenReceiptDigitalOnly != true }
            ?.let { receipt -> appendAdyenReceiptBlock(sb, receipt, lineWidth) }
        return finalizePayload(
            sb.toString(),
            settings,
            lineWidth,
            receiptUrl = qrUrl,
            deliveryDirectionsUrl = deliveryDirectionsUrl
        )
    }

    private fun appendAdyenReceiptBlock(
        sb: StringBuilder,
        receipt: com.chaslay.pos.payment.AdyenTerminalReceipt,
        lineWidth: Int
    ) {
        sb.appendLine(center(sepDash(lineWidth), lineWidth))
        sb.append(com.chaslay.pos.payment.AdyenPaymentReceiptFormatter.toPlainText(receipt, lineWidth))
    }

    private fun buildEndOfDayReport(
        settings: BusinessSettingsEntity,
        report: EndOfDayReport,
        lineWidth: Int = LINE_WIDTH_80
    ): ByteArray {
        val sym = settings.currencySymbol
        val dateFmt = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
        val divider = "=".repeat(lineWidth)
        val dashes = "-".repeat(lineWidth)
        val compact = lineWidth <= LINE_WIDTH_58
        val sb = StringBuilder()

        sb.appendLine(divider)
        appendCenteredLines(sb, settings.businessName, lineWidth, bold = false)
        sb.appendLine(divider)
        sb.appendLine("")
        appendCenteredLines(sb, "END OF DAY", lineWidth, bold = false)
        sb.appendLine("")
        appendCenteredLines(sb, "Report Period", lineWidth, bold = false)
        val periodLabel = if (report.periodStart > 0) {
            "${dateFmt.format(Date(report.periodStart))} to ${dateFmt.format(Date(report.periodEnd))}"
        } else {
            dateFmt.format(Date())
        }
        wrapText(periodLabel, lineWidth).forEach { sb.appendLine(center(it, lineWidth)) }
        sb.appendLine("")
        sb.appendLine(dashes)
        sb.appendLine(center("SALES SUMMARY", lineWidth))
        sb.appendLine(dashes)
        sb.appendLine(leftRight("Subtotal", formatMoney(report.subtotal, sym), lineWidth))
        sb.appendLine("")

        sb.appendLine(if (compact) "TVA" else center("TVA", lineWidth))
        sb.appendLine(vatRow("Type", "Net", "TVA", "Brut", lineWidth))
        report.vatRows.forEach { row ->
            sb.appendLine(
                vatRow(
                    row.label,
                    twoDp(row.net),
                    twoDp(row.tva),
                    twoDp(row.brut),
                    lineWidth
                )
            )
        }
        sb.appendLine(
            vatRow(
                "Total",
                twoDp(report.netTotal),
                twoDp(report.taxTotal),
                twoDp(report.brutTotal),
                lineWidth
            )
        )
        sb.appendLine(dashes)
        appendReceiptTotal(sb, "TOTAL", report.brutTotal, sym, lineWidth)
        if (report.tipsTotal > 0.0) {
            sb.appendLine(leftRight("Tips (not taxable)", formatMoney(report.tipsTotal, sym), lineWidth))
            sb.appendLine(leftRight("GRAND TOTAL", formatMoney(report.grandTotal, sym), lineWidth))
        }
        sb.appendLine(leftRight("Orders", report.salesCount.toString(), lineWidth))
        report.coversServed?.let { covers ->
            sb.appendLine(leftRight("Guests served", covers.toString(), lineWidth))
        }
        if (report.refundTotal > 0.0) {
            sb.appendLine("")
            sb.appendLine(dashes)
            sb.appendLine(center("REFUNDS", lineWidth))
            sb.appendLine(dashes)
            sb.appendLine(leftRight("Refunds total", formatMoney(report.refundTotal, sym), lineWidth))
            sb.appendLine(leftRight("Refund count", report.refundCount.toString(), lineWidth))
            report.refundedOrders.forEach { row ->
                sb.appendLine(
                    leftRight(
                        row.orderNumber.take(18),
                        "-${formatMoney(row.refundAmount, sym)}",
                        lineWidth
                    )
                )
                row.refundReason?.takeIf { it.isNotBlank() }?.let { reason ->
                    wrapText(reason, lineWidth).forEach { sb.appendLine(it) }
                }
            }
        }
        sb.appendLine("")

        sb.appendLine(dashes)
        sb.appendLine(center("PAYMENT METHODS", lineWidth))
        sb.appendLine(dashes)
        report.paymentRows.forEach { row ->
            sb.appendLine(
                payRow(
                    row.label,
                    "${"%.1f".format(row.percent)}%",
                    formatMoney(row.amount, sym),
                    lineWidth
                )
            )
        }
        sb.appendLine(dashes)
        sb.appendLine(leftRight("Total", formatMoney(report.paymentRows.sumOf { it.amount }, sym), lineWidth))
        sb.appendLine("")

        sb.appendLine(dashes)
        sb.appendLine(center("ORDER TYPES", lineWidth))
        sb.appendLine(dashes)
        report.orderTypeRows.forEach { row ->
            sb.appendLine(
                orderTypeRow(
                    row.label,
                    row.count.toString(),
                    "${"%.1f".format(row.percent)}%",
                    formatMoney(row.amount, sym),
                    lineWidth
                )
            )
        }
        sb.appendLine(dashes)
        sb.appendLine(leftRight("Total", formatMoney(report.orderTypeRows.sumOf { it.amount }, sym), lineWidth))

        if (report.productsSold.isNotEmpty()) {
            sb.appendLine("")
            sb.appendLine(dashes)
            sb.appendLine(center("PRODUCTS SOLD", lineWidth))
            sb.appendLine(dashes)
            sb.appendLine(leftRight("Total qty", report.productsSold.sumOf { it.quantitySold }.toString(), lineWidth))
            val nameWidth = (lineWidth - 6).coerceAtLeast(10)
            report.productsSold.forEach { product ->
                val name = product.productName.take(nameWidth).padEnd(nameWidth.coerceAtMost(lineWidth - 6))
                sb.appendLine(leftRight(name, product.quantitySold.toString(), lineWidth))
            }
        }
        sb.appendLine("\n\n\n")
        return encodePayload(sb.toString())
    }

    private fun appendReceiptStoreBlock(
        sb: StringBuilder,
        settings: BusinessSettingsEntity,
        lineWidth: Int
    ) {
        if (settings.receiptHeader.isNotBlank()) {
            appendHeader(sb, settings.receiptHeader, lineWidth)
        } else {
            appendCenteredLines(sb, settings.businessName, lineWidth, bold = true)
            listOfNotNull(
                settings.address.trim().takeIf { it.isNotEmpty() },
                settings.phone.trim().takeIf { it.isNotEmpty() },
                settings.email.trim().takeIf { it.isNotEmpty() },
                settings.website.trim().takeIf { it.isNotEmpty() }
            ).forEach { line ->
                wrapText(line, lineWidth).forEach { wrapped ->
                    sb.appendLine(center(wrapped, lineWidth))
                }
            }
        }
        if (settings.vatNumber.isNotBlank()) {
            sb.appendLine(center(settings.vatNumber, lineWidth))
        }
    }

    private fun appendCenteredLines(
        sb: StringBuilder,
        text: String,
        lineWidth: Int,
        bold: Boolean = false
    ) {
        if (bold) sb.append(escBold(true))
        wrapText(text, lineWidth).forEach { line ->
            sb.appendLine(center(line, lineWidth))
        }
        if (bold) sb.append(escBold(false))
    }

    private fun wrapText(text: String, width: Int): List<String> {
        if (text.length <= width) return listOf(text)
        val words = text.split(' ')
        val lines = mutableListOf<String>()
        var current = ""
        for (word in words) {
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (candidate.length <= width) {
                current = candidate
            } else {
                if (current.isNotEmpty()) lines.add(current)
                current = if (word.length <= width) {
                    word
                } else {
                    word.chunked(width).forEach { chunk ->
                        if (current.isNotEmpty()) {
                            lines.add(current)
                            current = ""
                        }
                        lines.add(chunk)
                    }
                    ""
                }
            }
        }
        if (current.isNotEmpty()) lines.add(current)
        return lines.ifEmpty { listOf(text.take(width)) }
    }

    private fun appendLoyaltyReceiptLines(
        sb: StringBuilder,
        pointsEarned: Int?,
        pointsBalance: Int?,
        lineWidth: Int
    ) {
        if ((pointsEarned ?: 0) <= 0 && pointsBalance == null) return
        sb.appendLine(center(sepDash(lineWidth), lineWidth))
        pointsEarned?.takeIf { it > 0 }?.let {
            sb.appendLine(leftRight("Points earned", "+$it", lineWidth))
        }
        pointsBalance?.let {
            sb.appendLine(leftRight("Points balance", "$it", lineWidth))
        }
    }

    private fun parseGiftCardPaymentAmount(notes: String?): Double? =
        notes?.lineSequence()
            ?.map { it.trim() }
            ?.firstOrNull { it.startsWith("Gift card payment:", ignoreCase = true) }
            ?.substringAfter(":", "")
            ?.trim()
            ?.toDoubleOrNull()
            ?.takeIf { it > 0.0 }

    private fun parseGiftCardRemainingAmount(notes: String?): Double? =
        notes?.lineSequence()
            ?.map { it.trim() }
            ?.firstOrNull { it.startsWith("Gift card remaining:", ignoreCase = true) }
            ?.substringAfter(":", "")
            ?.trim()
            ?.toDoubleOrNull()
            ?.takeIf { it >= 0.0 }

    private fun appendReceiptTotal(
        sb: StringBuilder,
        totalLabel: String,
        total: Double,
        currencySymbol: String,
        lineWidth: Int
    ) {
        val amount = formatMoney(total, currencySymbol)
        val compact = lineWidth <= LINE_WIDTH_58
        sb.append(escAlignLeft())
        sb.append(escDoubleHeight(false))
        sb.append(escBold(true))
        if (compact) {
            sb.appendLine(center(totalLabel, lineWidth))
            sb.appendLine(center(amount, lineWidth))
        } else {
            sb.append(escAlignCenter())
            sb.append(escDoubleHeight(true))
            sb.appendLine(leftRight(totalLabel, amount, lineWidth))
            sb.append(escDoubleHeight(false))
        }
        sb.append(escBold(false))
        sb.append(escAlignLeft())
    }

    private fun appendReceiptVatSection(
        sb: StringBuilder,
        rows: List<com.chaslay.pos.domain.model.VatBreakdownRow>,
        labels: ReceiptLabels,
        lineWidth: Int,
        vatIncludedInPrice: Boolean
    ) {
        if (rows.isEmpty()) return
        if (vatIncludedInPrice) {
            sb.appendLine(labels.vatIncludedNote)
        }
        appendVatTable(sb, rows, labels, lineWidth)
        val vatTotal = rows.sumOf { it.tva }
        sb.appendLine(leftRight(labels.vatTotal, twoDp(vatTotal), lineWidth))
    }

    private fun appendVatTable(
        sb: StringBuilder,
        rows: List<com.chaslay.pos.domain.model.VatBreakdownRow>,
        labels: ReceiptLabels,
        lineWidth: Int
    ) {
        sb.appendLine(vatRow(labels.vatType, labels.vatNet, labels.vatTax, labels.vatGross, lineWidth))
        rows.forEach { row ->
            val typeLabel = "${labels.vatTitle}: ${ReceiptVatCalculator.formatRate(row.rate)}%"
            sb.appendLine(
                vatRow(typeLabel, twoDp(row.net), twoDp(row.tva), twoDp(row.brut), lineWidth)
            )
        }
        if (rows.size > 1) {
            sb.appendLine(
                vatRow(
                    labels.total,
                    twoDp(rows.sumOf { it.net }),
                    twoDp(rows.sumOf { it.tva }),
                    twoDp(rows.sumOf { it.brut }),
                    lineWidth
                )
            )
        }
    }

    private fun appendReceiptMetaFooter(
        sb: StringBuilder,
        dateTime: String,
        staffName: String?,
        showStaff: Boolean,
        lineWidth: Int,
        orderNumber: String? = null,
        orderType: String? = null
    ) {
        val parts = buildList {
            add(dateTime)
            orderNumber?.trim()?.takeIf { it.isNotBlank() }?.let { add(shortenOrderNumber(it, maxLen = 16)) }
            orderType?.trim()?.takeIf { it.isNotBlank() }?.let { add(it) }
            if (showStaff) {
                staffName?.trim()?.takeIf { it.isNotBlank() }?.let { add(it) }
            }
        }
        // Keep footer compact — never double-height for long TX numbers.
        sb.append(escDoubleHeight(false))
        sb.append(escBold(false))
        sb.appendLine(center(parts.joinToString(" | "), lineWidth))
    }

    private fun formatTxItemQtyLabel(item: TransactionItemEntity): String =
        if (item.isWeighed) {
            val kg = item.quantity / 1000.0
            String.format(Locale.US, "%.3f kg %s", kg, item.productName)
        } else {
            "${item.quantity}x ${item.productName}"
        }

    private fun formatTxItemRateLabel(item: TransactionItemEntity, currencySymbol: String): String? =
        if (item.isWeighed) {
            String.format(Locale.US, "%.2f %s/kg", item.unitPrice, currencySymbol)
        } else null

    /** Shorten long TX refs for the receipt footer, e.g. TX-20260801-005747-8949 → TX-005747-8949 */
    private fun shortenOrderNumber(orderNumber: String, maxLen: Int = 16): String {
        if (orderNumber.length <= maxLen) return orderNumber
        val parts = orderNumber.split('-')
        if (parts.size >= 3) {
            val short = buildString {
                append(parts.first())
                append('-')
                append(parts[parts.size - 2])
                append('-')
                append(parts.last())
            }
            if (short.length <= maxLen) return short
        }
        return "…" + orderNumber.takeLast(maxLen - 1)
    }

    private fun vatRow(type: String, net: String, tva: String, brut: String, lineWidth: Int = LINE_WIDTH_80): String {
        val numWidth = if (lineWidth <= LINE_WIDTH_58) 6 else 8
        val typeWidth = (lineWidth - numWidth * 3).coerceAtLeast(8)
        val t = type.take(typeWidth).padEnd(typeWidth)
        return t +
            net.takeLast(numWidth).padStart(numWidth) +
            tva.takeLast(numWidth).padStart(numWidth) +
            brut.takeLast(numWidth).padStart(numWidth)
    }

    private fun payRow(
        label: String,
        percent: String,
        amount: String,
        lineWidth: Int = LINE_WIDTH_80
    ): String {
        if (lineWidth <= LINE_WIDTH_58) {
            return leftRight("${label.take(12)} $percent", amount, lineWidth)
        }
        val amountWidth = 12
        val percentWidth = 7
        val labelWidth = (lineWidth - amountWidth - percentWidth).coerceAtLeast(10)
        val l = label.take(labelWidth).padEnd(labelWidth)
        return l + percent.padStart(percentWidth) + amount.padStart(amountWidth)
    }

    private fun orderTypeRow(
        label: String,
        count: String,
        percent: String,
        amount: String,
        lineWidth: Int = LINE_WIDTH_80
    ): String {
        if (lineWidth <= LINE_WIDTH_58) {
            return leftRight("${label.take(8)} ${count}x $percent", amount, lineWidth)
        }
        val amountWidth = 12
        val percentWidth = 8
        val countWidth = 3
        val labelWidth = (lineWidth - amountWidth - percentWidth - countWidth).coerceAtLeast(8)
        val l = label.take(labelWidth).padEnd(labelWidth)
        return l + count.padStart(countWidth) + percent.padStart(percentWidth) + amount.padStart(amountWidth)
    }


    private fun buildTestReceipt(settings: BusinessSettingsEntity): ByteArray {
        val text = buildString {
            appendLine(center(settings.businessName))
            appendLine(center("TEST PRINT"))
            appendLine("Fran\u00E7ais: esp\u00E8ces caf\u00E9 cr\u00E8me")
            appendLine("Test: é è ü Ø")
            appendLine(center("Printer OK"))
            appendLine("\n\n\n")
        }
        return encodePayload(text)
    }

    private fun encodePayload(text: String): ByteArray {
        return buildPrintPayload(EscPosEncoder.encode(text))
    }

    private fun buildPrintPayload(
        body: ByteArray,
        settings: BusinessSettingsEntity? = null,
        lineWidth: Int = LINE_WIDTH_80,
        qrBytes: ByteArray = byteArrayOf(),
        cutFeedLines: Int = 4
    ): ByteArray {
        val logo = settings?.let { receiptLogoBytes(it, lineWidth) } ?: byteArrayOf()
        return ESC_INIT + ESC_CODEPAGE_CP850 + logo + body + qrBytes + paperCutCommand(cutFeedLines)
    }

    private fun paperCutCommand(feedLines: Int = 4): ByteArray =
        byteArrayOf(0x1B, 0x64, feedLines.coerceIn(0, 255).toByte()) + ESC_CUT

    private fun finalizePayload(
        text: String,
        settings: BusinessSettingsEntity,
        lineWidth: Int = LINE_WIDTH_80,
        receiptUrl: String? = null,
        deliveryDirectionsUrl: String? = null
    ): ByteArray {
        val body = EscPosEncoder.encode(text)
        val qrParts = mutableListOf<ByteArray>()
        if (settings.receiptShowQrCode && !receiptUrl.isNullOrBlank()) {
            qrParts.add(receiptQrRaster(receiptUrl, lineWidth))
        }
        if (settings.receiptDeliveryDirectionsQr && !deliveryDirectionsUrl.isNullOrBlank()) {
            qrParts.add(receiptQrRaster(deliveryDirectionsUrl, lineWidth))
        }
        val qrBytes = qrParts.fold(byteArrayOf()) { acc, part -> acc + part }
        val cutFeed = if (qrBytes.isNotEmpty()) 2 else 4
        return buildPrintPayload(body, settings, lineWidth, qrBytes, cutFeed)
    }

    private fun receiptQrRaster(url: String, lineWidth: Int): ByteArray {
        // Compact raster QR — native ESC/POS module size 1 is unreliable on many printers.
        val maxWidthPx = if (lineWidth >= LINE_WIDTH_80) RECEIPT_QR_RASTER_PX_80 else RECEIPT_QR_RASTER_PX_58
        val bitmap = receiptQrGenerator.generateReceiptQrBitmap(url, maxWidthPx)
        val raster = EscPosImageEncoder.encodeRaster(
            bitmap,
            maxWidthPx,
            maxWidthPx,
            filter = false,
            darkThreshold = 128
        ) ?: return byteArrayOf()
        if (!bitmap.isRecycled) bitmap.recycle()
        return EscPosEncoder.encode(escAlignCenter()) + raster + EscPosEncoder.encode(escAlignLeft())
    }

    private var cachedLogoKey: String? = null
    private var cachedLogoBytes: ByteArray? = null

    private fun receiptLogoBytes(settings: BusinessSettingsEntity, lineWidth: Int): ByteArray? {
        val uriString = settings.logoUri?.trim()?.takeIf { it.isNotBlank() } ?: return null
        val cacheKey = "$uriString@$lineWidth"
        if (cacheKey == cachedLogoKey && cachedLogoBytes != null) return cachedLogoBytes
        val maxWidthPx = if (lineWidth >= LINE_WIDTH_80) 320 else 240
        val maxHeightPx = 160
        return runCatching {
            val uri = if (uriString.startsWith("/")) {
                Uri.fromFile(java.io.File(uriString))
            } else {
                Uri.parse(uriString)
            }
            val options = BitmapFactory.Options().apply { inSampleSize = 2 }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                val bitmap = BitmapFactory.decodeStream(stream, null, options) ?: return null
                val raster = EscPosImageEncoder.encodeRaster(bitmap, maxWidthPx, maxHeightPx) ?: return null
                if (bitmap != null && !bitmap.isRecycled) bitmap.recycle()
                EscPosEncoder.encode("\n${escAlignCenter()}") + raster + EscPosEncoder.encode("${escAlignLeft()}\n")
            }.also { bytes ->
                if (bytes != null) {
                    cachedLogoKey = cacheKey
                    cachedLogoBytes = bytes
                }
            }
        }.getOrNull()
    }

    private fun resolveReceiptDiscount(transaction: TransactionEntity): Double {
        if (transaction.discountAmount > 0.0) return transaction.discountAmount
        if (transaction.discountPercent > 0.0) {
            return transaction.subtotal * (transaction.discountPercent / 100.0)
        }
        return 0.0
    }

    private fun effectiveKitchenItemScale(settings: BusinessSettingsEntity): Int {
        val scale = settings.kitchenItemTextScale
        if (scale in 1..3) return scale
        return if (settings.kitchenLargeItemText) 2 else 1
    }

    private fun effectiveKitchenHeaderScale(settings: BusinessSettingsEntity): Int {
        val scale = settings.kitchenHeaderTextScale
        if (scale in 1..3) return scale
        return if (settings.kitchenLargeHeaderText) 2 else 1
    }

    private fun escKitchenSize(scale: Int, bold: Boolean = false): String = buildString {
        when (scale.coerceIn(1, 3)) {
            3 -> append(escDoubleSize(true))
            2 -> append(escDoubleHeight(true))
            else -> Unit
        }
        if (bold || scale > 1) append(escBold(true))
    }

    private fun escKitchenSizeReset(): String =
        escBold(false) + escDoubleHeight(false) + escDoubleSize(false)

    private fun sendBytes(
        mac: String?,
        settings: BusinessSettingsEntity,
        payload: ByteArray,
        label: String
    ): Result<Unit> {
        if (mac.isNullOrBlank()) {
            return Result.failure(IllegalStateException("No printer configured"))
        }
        if (isSimulated(mac)) {
            Log.i(TAG, "$label (simulated):\n${EscPosEncoder.decodeForLog(payload)}")
            return Result.success(Unit)
        }
        if (isUsbAddress(mac)) {
            return usbPrinterManager.sendBytes(mac, payload)
        }
        if (isNetworkAddress(mac)) {
            return sendBytesOverNetwork(mac, payload)
        }
        return runCatching {
            val adapter = bluetoothAdapter() ?: error("Bluetooth not available")
            val device = adapter.getRemoteDevice(mac)
            val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            socket.connect()
            val output = socket.getOutputStream()
            transmitPayload(output, payload)
            output.flush()
            Thread.sleep(150)
            socket.close()
        }
    }

    private fun transmitPayload(output: java.io.OutputStream, payload: ByteArray) {
        val chunkSize = 512
        var offset = 0
        while (offset < payload.size) {
            val end = minOf(offset + chunkSize, payload.size)
            output.write(payload, offset, end - offset)
            output.flush()
            offset = end
            if (payload.size > chunkSize) {
                Thread.sleep(25)
            }
        }
        val waitMs = (payload.size / 512 * 80).coerceIn(100, 4000)
        Thread.sleep(waitMs.toLong())
    }

    private fun sendBytesOverNetwork(address: String, payload: ByteArray): Result<Unit> = runCatching {
        val (host, port) = parseHostPort(address)
        val socket = java.net.Socket()
        try {
            localIpAddress()?.let { local ->
                runCatching { socket.bind(java.net.InetSocketAddress(local, 0)) }
            }
            socket.connect(java.net.InetSocketAddress(host, port), 4000)
            socket.getOutputStream().apply {
                write(payload)
                flush()
            }
        } finally {
            runCatching { socket.close() }
        }
    }

    private fun formatKitchenItemQtyLabel(item: TableOrderItemEntity): String {
        val label = buildString {
            append(item.productName)
            if (item.variantName != null) append(" (${item.variantName})")
        }
        return if (item.isWeighed) {
            val kg = item.quantity / 1000.0
            String.format(Locale.US, "%.3f kg %s", kg, label)
        } else {
            "${item.quantity}x $label"
        }
    }

    private fun appendKitchenItemBlock(
        sb: StringBuilder,
        item: TableOrderItemEntity,
        settings: BusinessSettingsEntity,
        lineWidth: Int,
        cancelled: Boolean = false
    ) {
        val line = if (cancelled) "- ${formatKitchenItemQtyLabel(item)}" else formatKitchenItemQtyLabel(item)
        sb.append(escAlignLeft())
        val itemScale = effectiveKitchenItemScale(settings)
        val wrapped = wrapText(line, lineWidth)
        if (itemScale > 1) {
            wrapped.forEach { row ->
                sb.append(escKitchenSize(itemScale, bold = true))
                sb.appendLine(row)
                sb.append(escKitchenSizeReset())
            }
        } else {
            wrapped.forEach { row -> sb.appendLine(row) }
        }
        appendKitchenNotes(sb, item.notes)
    }

    private fun appendKitchenNotes(sb: StringBuilder, notes: String?) {
        if (notes.isNullOrBlank()) return
        val lines = notes.lines().map { it.trim() }.filter { it.isNotBlank() }
        val startIndex = if (lines.firstOrNull() == com.chaslay.pos.domain.model.COMBO_NOTES_MARKER) 1 else 0
        lines.drop(startIndex).forEach { noteLine ->
            if (isKitchenDiscountNote(noteLine)) return@forEach
            if (kitchenQtyLine.containsMatchIn(noteLine)) {
                sb.appendLine("  $noteLine")
            } else if (noteLine.contains(":")) {
                sb.appendLine("  $noteLine")
            } else {
                sb.appendLine("  Note: $noteLine")
            }
        }
    }

    private fun isKitchenDiscountNote(line: String): Boolean =
        kitchenDiscountNote.containsMatchIn(line.trim())

    private fun appendHeader(sb: StringBuilder, header: String, lineWidth: Int = LINE_WIDTH_80) {
        if (header.isBlank()) return
        header.lines().forEach { line ->
            if (line.isNotBlank()) sb.appendLine(center(line.trim(), lineWidth))
        }
    }

    private fun appendFooter(sb: StringBuilder, footer: String, lineWidth: Int = LINE_WIDTH_80) {
        if (footer.isBlank()) return
        sb.appendLine(center(sepDash(lineWidth), lineWidth))
        footer.lines().forEach { line ->
            if (line.isNotBlank()) sb.appendLine(center(line.trim(), lineWidth))
        }
    }

    private fun sepDash(lineWidth: Int): String = "-".repeat(lineWidth)

    private fun googleMapsNavigationUrl(address: String): String {
        val encoded = URLEncoder.encode(address.trim(), StandardCharsets.UTF_8.toString())
        return "https://www.google.com/maps/dir/?api=1&destination=$encoded"
    }

    private fun parseDeliveryAddressFromNotes(notes: String?): String? {
        if (notes.isNullOrBlank() || !notes.contains("--- DELIVERY ---")) return null
        val address = notes.lines()
            .firstOrNull { it.trim().startsWith("Address:", ignoreCase = true) }
            ?.substringAfter(":")
            ?.trim()
            .orEmpty()
        val zip = notes.lines()
            .firstOrNull { it.trim().startsWith("ZIP:", ignoreCase = true) }
            ?.substringAfter(":")
            ?.trim()
            .orEmpty()
        return listOfNotNull(address.takeIf { it.isNotBlank() }, zip.takeIf { it.isNotBlank() })
            .joinToString(", ")
            .ifBlank { null }
    }

    private fun deliveryAddressFromCart(
        cart: CartSummary,
        context: ReceiptPrintContext
    ): String? {
        val isDelivery = context.fulfillmentType == FulfillmentType.DELIVERY ||
            cart.fulfillmentType == FulfillmentType.DELIVERY
        if (!isDelivery) return null
        return listOfNotNull(cart.deliveryAddress, cart.deliveryZip)
            .filter { it.isNotBlank() }
            .joinToString(", ")
            .ifBlank { null }
    }

    private fun appendDeliveryDirectionsLabel(
        sb: StringBuilder,
        settings: BusinessSettingsEntity,
        address: String?,
        lineWidth: Int
    ): String? {
        if (!settings.receiptDeliveryDirectionsQr || address.isNullOrBlank()) return null
        sb.appendLine(center(sepDash(lineWidth), lineWidth))
        sb.appendLine(center("GET DIRECTIONS", lineWidth))
        return googleMapsNavigationUrl(address)
    }

    private fun deliveryDirectionsUrlForCart(
        settings: BusinessSettingsEntity,
        cart: CartSummary,
        context: ReceiptPrintContext,
        lineWidth: Int,
        sb: StringBuilder
    ): String? = appendDeliveryDirectionsLabel(sb, settings, deliveryAddressFromCart(cart, context), lineWidth)

    private fun deliveryDirectionsUrlForTransaction(
        settings: BusinessSettingsEntity,
        transaction: TransactionEntity,
        lineWidth: Int,
        sb: StringBuilder
    ): String? = appendDeliveryDirectionsLabel(
        sb,
        settings,
        parseDeliveryAddressFromNotes(transaction.notes),
        lineWidth
    )

    private fun paymentLabel(method: PaymentMethod): String = when (method) {
        PaymentMethod.CASH -> "Cash"
        PaymentMethod.CARD -> "Card"
        PaymentMethod.TAP_TO_PAY -> "Tap-to-Pay"
        PaymentMethod.ADYEN_TERMINAL -> "Adyen"
        PaymentMethod.PAY_LATER -> "Pay Later"
        PaymentMethod.GIFT_CARD -> "Gift card"
    }

    private fun lineWidthFor(paperWidthMm: Int): Int =
        if (paperWidthMm >= 80) LINE_WIDTH_80 else LINE_WIDTH_58

    /** Prefer widest configured printer (80mm default) for legacy kitchen routing. */
    private fun defaultKitchenPaperWidthMm(): Int = 80

    private fun center(text: String, width: Int = LINE_WIDTH_80): String {
        if (text.length >= width) return text
        val pad = (width - text.length) / 2
        return " ".repeat(pad.coerceAtLeast(0)) + text
    }

    private fun right(text: String, width: Int = LINE_WIDTH_80): String {
        if (text.length >= width) return text
        return " ".repeat(width - text.length) + text
    }

    private fun escBold(on: Boolean): String =
        if (on) "\u001B\u0045\u0001" else "\u001B\u0045\u0000"

    private fun leftRight(label: String, value: String, width: Int = LINE_WIDTH_80): String {
        val valueLen = value.length
        val maxLabelLen = (width - valueLen - 1).coerceAtLeast(1)
        val trimmedLabel = if (label.length > maxLabelLen) label.take(maxLabelLen) else label
        val space = width - trimmedLabel.length - valueLen
        return if (space < 1) {
            (trimmedLabel.take((width - valueLen - 1).coerceAtLeast(1)) + " " + value).take(width)
        } else {
            trimmedLabel + " ".repeat(space) + value
        }
    }

    private fun escAlignCenter(): String = "\u001B\u0061\u0001"

    private fun escAlignLeft(): String = "\u001B\u0061\u0000"

    private fun escDoubleHeight(on: Boolean): String =
        if (on) "\u001D\u0021\u0001" else "\u001D\u0021\u0000"

    private fun escDoubleSize(on: Boolean): String =
        if (on) "\u001D\u0021\u0011" else "\u001D\u0021\u0000"

    private fun twoDp(value: Double): String =
        String.format(Locale.getDefault(), "%.2f", roundMoney(value))

    private fun formatMoney(amount: Double, symbol: String): String =
        formatMoneyAmount(amount, symbol)

    companion object {
        const val SIMULATED_ADDRESS = "simulated"
        val SIMULATED_PRINTER = DiscoveredPrinter("Simulated (test)", SIMULATED_ADDRESS)
        private const val TAG = "PrinterService"
        private const val LINE_WIDTH_58 = 32
        private const val LINE_WIDTH_80 = 48
        /** Thermal digital-receipt QR — matches WebPOS RECEIPT_QR_RASTER_PX_80 (180px). */
        private const val RECEIPT_QR_RASTER_PX_80 = 180
        /** Thermal digital-receipt QR on 58mm paper — matches WebPOS. */
        private const val RECEIPT_QR_RASTER_PX_58 = 136
        private const val LINE_WIDTH = LINE_WIDTH_80
        private val SPP_UUID = java.util.UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private val ESC_INIT = byteArrayOf(0x1B, 0x40)
        private val ESC_CODEPAGE_CP850 = byteArrayOf(0x1B, 0x74, 0x02)
        private val ESC_CUT = byteArrayOf(0x1D, 0x56, 0x00)

        fun isSimulated(address: String?): Boolean = address == SIMULATED_ADDRESS

        fun isUsbAddress(address: String?): Boolean = UsbPrinterManager.isUsbAddress(address)

        private val IPV4_REGEX =
            Regex("""^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$""")

        /** A WiFi/network printer address is an IPv4 host with an optional :port. */
        fun isNetworkAddress(address: String?): Boolean =
            address != null && IPV4_REGEX.matches(address.trim())
    }
}
