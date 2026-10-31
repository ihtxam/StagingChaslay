package com.chaslay.pos.ui.reports

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.data.repository.AuthRepository
import com.chaslay.pos.domain.model.DailySalesReport
import com.chaslay.pos.domain.model.EodStaffSummaryRow
import com.chaslay.pos.domain.model.EndOfDayReport
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ProductSalesReport
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.isPaidSale
import com.chaslay.pos.domain.model.UserPerformanceReport
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.domain.model.roundMoney
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import android.content.Context
import android.util.Log
import com.chaslay.pos.domain.model.PosPermission
import com.chaslay.pos.util.PosLocalPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

enum class ReportRange { TODAY, YESTERDAY, LAST_WEEK, LAST_MONTH, LAST_3_MONTHS }

/** Calendar day selection for the End of Day tab (single day, not multi-day ranges). */
enum class EodDayPreset { TODAY, YESTERDAY, CUSTOM }

data class EodStaffOption(val userId: Long?, val name: String)

data class SalesReportSnapshot(
    val grossSales: Double = 0.0,
    val netSales: Double = 0.0,
    val averageTicket: Double = 0.0,
    val orderCount: Int = 0,
    val cancelledCount: Int = 0,
    val cancelledTotal: Double = 0.0,
    val totalTips: Double = 0.0,
    val totalDiscount: Double = 0.0,
    val totalRefunded: Double = 0.0,
    val cashTotal: Double = 0.0,
    val cashCount: Int = 0,
    val cardTotal: Double = 0.0,
    val cardCount: Int = 0,
    val taxTotal: Double = 0.0,
    val dineInVatRate: Double = 8.1,
    val takeawayVatRate: Double = 2.6,
    val dineInTotal: Double = 0.0,
    val dineInCount: Int = 0,
    val takeawayTotal: Double = 0.0,
    val takeawayCount: Int = 0
)

data class ProfitMarginSnapshot(
    val netMerchandise: Double = 0.0,
    val cogs: Double = 0.0,
    val grossProfit: Double = 0.0,
    val marginPercent: Double = 0.0,
    val linesMissingCost: Int = 0,
    val revenueChangePct: Double? = null,
    val profitChangePct: Double? = null
)

enum class ProfitBreakdown { CATEGORY, PRODUCT, DAY, MONTH }

data class ProfitMarginRow(
    val id: String,
    val label: String,
    val quantity: Double,
    val revenue: Double,
    val cogs: Double,
    val profit: Double,
    val marginPercent: Double?,
    val revenueChangePct: Double? = null,
    val profitChangePct: Double? = null
)

data class ProfitMarginReport(
    val summary: ProfitMarginSnapshot = ProfitMarginSnapshot(),
    val byProduct: List<ProfitMarginRow> = emptyList(),
    val byCategory: List<ProfitMarginRow> = emptyList(),
    val byDay: List<ProfitMarginRow> = emptyList(),
    val byMonth: List<ProfitMarginRow> = emptyList(),
    val fromCloud: Boolean = false,
    val previousRangeLabel: String? = null
)

data class ReportsUiState(
    val dailyReport: DailySalesReport = DailySalesReport(0, 0.0, 0.0, 0.0, 0.0),
    val salesReport: SalesReportSnapshot = SalesReportSnapshot(),
    val selectedRange: ReportRange = ReportRange.TODAY,
    val endOfDayReport: EndOfDayReport = EndOfDayReport(
        salesCount = 0,
        revenue = 0.0,
        taxTotal = 0.0,
        cashTotal = 0.0,
        cardTotal = 0.0,
        tapToPayTotal = 0.0,
        adyenTotal = 0.0,
        dineInTotal = 0.0,
        dineInCount = 0,
        takeawayTotal = 0.0,
        takeawayCount = 0
    ),
    val topProducts: List<ProductSalesReport> = emptyList(),
    val userPerformance: List<UserPerformanceReport> = emptyList(),
    val profitMargin: ProfitMarginSnapshot = ProfitMarginSnapshot(),
    val profitReport: ProfitMarginReport = ProfitMarginReport(),
    val profitBreakdown: ProfitBreakdown = ProfitBreakdown.PRODUCT,
    val eodStaffOptions: List<EodStaffOption> = emptyList(),
    val selectedEodStaffId: Long? = null,
    val canViewAllSales: Boolean = true,
    val eodDayPreset: EodDayPreset = EodDayPreset.TODAY,
    val eodCustomDayStartMs: Long = 0L,
    val eodIncludeProductsSold: Boolean = true,
    val eodIncludeStaffBreakdown: Boolean = false,
    val message: String? = null
)

@HiltViewModel
class ReportsViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val transactionRepository: TransactionRepository,
    private val productRepository: ProductRepository,
    private val settingsRepository: SettingsRepository,
    private val printerService: BluetoothPrinterService,
    private val sessionManager: SessionManager,
    private val authRepository: AuthRepository,
    private val syncApi: SyncApi,
    private val syncApiKeyStore: SyncApiKeyStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReportsUiState())
    val uiState: StateFlow<ReportsUiState> = _uiState.asStateFlow()

    val currencySymbol: StateFlow<String> = settingsRepository.observeSettings()
        .map { it.currencySymbol }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "CHF")

    init {
        _uiState.update {
            it.copy(
                eodIncludeProductsSold = PosLocalPrefs.readEodIncludeProductsSold(appContext),
                eodIncludeStaffBreakdown = PosLocalPrefs.readEodIncludeStaffBreakdown(appContext),
            )
        }
        refresh()
    }

    fun setEodIncludeProductsSold(include: Boolean) {
        PosLocalPrefs.writeEodIncludeProductsSold(appContext, include)
        _uiState.update { it.copy(eodIncludeProductsSold = include) }
    }

    fun setEodIncludeStaffBreakdown(include: Boolean) {
        PosLocalPrefs.writeEodIncludeStaffBreakdown(appContext, include)
        _uiState.update { it.copy(eodIncludeStaffBreakdown = include) }
    }

    fun selectEodDayPreset(preset: EodDayPreset) {
        _uiState.update { it.copy(eodDayPreset = preset) }
        refresh()
    }

    fun selectEodCustomDay(dayStartMs: Long) {
        _uiState.update {
            it.copy(eodDayPreset = EodDayPreset.CUSTOM, eodCustomDayStartMs = dayStartMs)
        }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            val range = _uiState.value.selectedRange
            val (start, end) = rangeBounds(range)
            val (eodStart, eodEnd) = eodDayBounds(
                _uiState.value.eodDayPreset,
                _uiState.value.eodCustomDayStartMs,
            )
            val settings = settingsRepository.getSettings()
            val access = sessionManager.currentUserAccess.first()
            val userId = sessionManager.currentUserId.first()
            val viewAll = access == null || access.canViewAllSales()
            val ownOnly = access != null && !access.canViewAllSales()
            val selectedStaff = _uiState.value.selectedEodStaffId
            val scopeUserId = when {
                ownOnly -> userId
                viewAll && selectedStaff != null -> selectedStaff
                else -> null
            }
            val staffOptions = if (viewAll) {
                val company = EodStaffOption(null, "")
                val waiters = authRepository.getAllUsersWithRoles()
                    .filter { (user, _) -> user.isActive }
                    .map { (user, _) -> EodStaffOption(user.id, user.name) }
                    .sortedBy { it.name.lowercase() }
                listOf(company) + waiters
            } else {
                emptyList()
            }
            val scopeStaffName = scopeUserId?.let { id ->
                authRepository.getUser(id)?.name
                    ?: staffOptions.firstOrNull { it.userId == id }?.name
            }
            val allTx = transactionRepository.getTransactionsBetween(start, end)
            val eodAllTx = transactionRepository.getTransactionsBetween(eodStart, eodEnd)
            val transactions =
                if (scopeUserId != null) allTx.filter { it.userId == scopeUserId } else allTx
            val completed = transactions.filter { it.paymentStatus.isPaidSale() }
            val cancelled = transactions.filter { it.paymentStatus == PaymentStatus.CANCELLED }
            // Tips are not taxable and not part of sales: gross excludes tips (matches end-of-day brut).
            fun brutOf(tx: com.chaslay.pos.data.local.entity.TransactionEntity) =
                (tx.total - tx.tipAmount).coerceAtLeast(0.0)
            fun netBrut(tx: com.chaslay.pos.data.local.entity.TransactionEntity): Double {
                val refund = tx.refundAmount.coerceAtLeast(0.0)
                return (brutOf(tx) - refund.coerceAtMost(brutOf(tx))).coerceAtLeast(0.0)
            }
            val grossSales = roundMoney(completed.sumOf { netBrut(it) })
            val cancelledTotal = roundMoney(cancelled.sumOf { brutOf(it) })
            val taxTotal = roundMoney(completed.sumOf { tx ->
                val grossBefore = tx.total.coerceAtLeast(0.0001)
                val keepRatio = ((grossBefore - tx.refundAmount.coerceAtLeast(0.0)) / grossBefore)
                    .coerceIn(0.0, 1.0)
                tx.taxTotal * keepRatio
            })
            val salesReport = SalesReportSnapshot(
                grossSales = grossSales,
                netSales = roundMoney(grossSales - taxTotal),
                averageTicket = if (completed.isEmpty()) 0.0 else roundMoney(grossSales / completed.size),
                orderCount = completed.size,
                cancelledCount = cancelled.size,
                cancelledTotal = cancelledTotal,
                totalTips = roundMoney(completed.sumOf { tx ->
                    val grossBefore = tx.total.coerceAtLeast(0.0001)
                    val keepRatio = ((grossBefore - tx.refundAmount.coerceAtLeast(0.0)) / grossBefore)
                        .coerceIn(0.0, 1.0)
                    tx.tipAmount * keepRatio
                }),
                totalDiscount = roundMoney(completed.sumOf { it.discountAmount }),
                totalRefunded = roundMoney(completed.sumOf { it.refundAmount.coerceAtLeast(0.0) }),
                cashTotal = roundMoney(completed.filter { it.paymentMethod == PaymentMethod.CASH }.sumOf {
                    (it.total - it.refundAmount.coerceAtLeast(0.0)).coerceAtLeast(0.0)
                }),
                cashCount = completed.count { it.paymentMethod == PaymentMethod.CASH },
                cardTotal = roundMoney(completed.filter { it.paymentMethod != PaymentMethod.CASH }.sumOf {
                    (it.total - it.refundAmount.coerceAtLeast(0.0)).coerceAtLeast(0.0)
                }),
                cardCount = completed.count { it.paymentMethod != PaymentMethod.CASH },
                taxTotal = taxTotal,
                dineInVatRate = settings.dineInVatRate,
                takeawayVatRate = settings.takeawayVatRate,
                dineInTotal = roundMoney(completed.filter { it.serviceType == ServiceType.DINE_IN }.sumOf { netBrut(it) }),
                dineInCount = completed.count { it.serviceType == ServiceType.DINE_IN },
                takeawayTotal = roundMoney(completed.filter { it.serviceType == ServiceType.TAKEAWAY }.sumOf { netBrut(it) }),
                takeawayCount = completed.count { it.serviceType == ServiceType.TAKEAWAY }
            )
            val profitReportLocal = computeProfitReport(completed)
            val profitReport = fetchRemoteProfitReport(
                range = range,
                breakdown = _uiState.value.profitBreakdown,
                scopeUserId = scopeUserId,
                fallback = profitReportLocal
            )
            val staffBreakdown = if (viewAll && scopeUserId == null) {
                transactionRepository.getUserPerformance(eodStart, eodEnd).map {
                    EodStaffSummaryRow(it.userName, it.transactionCount, it.revenue)
                }
            } else {
                emptyList()
            }
            val baseEod = transactionRepository.buildEndOfDayReport(
                eodAllTx,
                eodStart,
                eodEnd,
                scopeUserId,
            )
            _uiState.value = ReportsUiState(
                dailyReport = transactionRepository.getDailyReport(),
                salesReport = salesReport,
                selectedRange = range,
                endOfDayReport = baseEod.copy(
                    scopeStaffName = scopeStaffName,
                    staffBreakdown = staffBreakdown,
                ),
                topProducts = transactionRepository.getProductsSold(start, end, scopeUserId),
                userPerformance = if (ownOnly) emptyList()
                else transactionRepository.getUserPerformance(start, end),
                profitMargin = profitReport.summary,
                profitReport = profitReport,
                profitBreakdown = _uiState.value.profitBreakdown,
                eodStaffOptions = staffOptions,
                selectedEodStaffId = if (viewAll) selectedStaff else null,
                canViewAllSales = viewAll,
                eodDayPreset = _uiState.value.eodDayPreset,
                eodCustomDayStartMs = _uiState.value.eodCustomDayStartMs,
                eodIncludeProductsSold = _uiState.value.eodIncludeProductsSold,
                eodIncludeStaffBreakdown = _uiState.value.eodIncludeStaffBreakdown,
            )
        }
    }

    fun selectProfitBreakdown(breakdown: ProfitBreakdown) {
        _uiState.update { it.copy(profitBreakdown = breakdown) }
        viewModelScope.launch {
            val state = _uiState.value
            val (start, end) = rangeBounds(state.selectedRange)
            val access = sessionManager.currentUserAccess.first()
            val userId = sessionManager.currentUserId.first()
            val ownOnly = access != null && !access.canViewAllSales()
            val viewAll = access == null || access.canViewAllSales()
            val scopeUserId = when {
                ownOnly -> userId
                viewAll && state.selectedEodStaffId != null -> state.selectedEodStaffId
                else -> null
            }
            if (!syncApiKeyStore.hasKey()) return@launch
            val allTx = transactionRepository.getTransactionsBetween(start, end)
            val transactions =
                if (scopeUserId != null) allTx.filter { it.userId == scopeUserId } else allTx
            val completed = transactions.filter { it.paymentStatus.isPaidSale() }
            val local = computeProfitReport(completed)
            val remote = fetchRemoteProfitReport(
                range = state.selectedRange,
                breakdown = breakdown,
                scopeUserId = scopeUserId,
                fallback = local
            )
            _uiState.update {
                it.copy(profitReport = remote, profitMargin = remote.summary)
            }
        }
    }

    private suspend fun fetchRemoteProfitReport(
        range: ReportRange,
        breakdown: ProfitBreakdown,
        scopeUserId: Long?,
        fallback: ProfitMarginReport
    ): ProfitMarginReport {
        if (!syncApiKeyStore.hasKey()) return fallback
        return try {
            val preset = reportPresetFor(range)
            val granularity = when (breakdown) {
                ProfitBreakdown.MONTH -> "month"
                ProfitBreakdown.DAY -> "day"
                else -> null
            }
            val staffId = scopeUserId?.let { resolveCloudStaffId(it) }
            val response = syncApi.profitMarginReport(
                preset = preset,
                granularity = granularity,
                staffId = staffId
            )
            val remote = response.report ?: return fallback
            ProfitMarginRemoteMapper.toLocal(remote)
        } catch (e: Exception) {
            Log.w(TAG, "Remote profit margin report failed; using local", e)
            fallback
        }
    }

    private suspend fun resolveCloudStaffId(localUserId: Long): String? {
        val user = authRepository.getUser(localUserId) ?: return null
        val email = user.email ?: return null
        return if (email.startsWith("sync:")) email.removePrefix("sync:") else null
    }

    private fun reportPresetFor(range: ReportRange): String = when (range) {
        ReportRange.TODAY -> "today"
        ReportRange.YESTERDAY -> "yesterday"
        ReportRange.LAST_WEEK -> "last_week"
        ReportRange.LAST_MONTH -> "last_month"
        ReportRange.LAST_3_MONTHS -> "last_3_months"
    }

    companion object {
        private const val TAG = "ReportsViewModel"
    }

    private suspend fun computeProfitReport(
        transactions: List<com.chaslay.pos.data.local.entity.TransactionEntity>
    ): ProfitMarginReport {
        val products = productRepository.getAllProducts()
        val categories = productRepository.getAllCategories()
        val costByProductId = products.associate { it.id to it.costPrice }
        val categoryByProductId = products.associate { it.id to it.categoryId }
        val categoryNameById = categories.associate { it.id to it.name }

        val productAgg = mutableMapOf<String, AggRow>()
        val categoryAgg = mutableMapOf<String, AggRow>()
        val dayAgg = mutableMapOf<String, AggRow>()
        val monthAgg = mutableMapOf<String, AggRow>()
        var netMerchandise = 0.0
        var cogs = 0.0
        var linesMissingCost = 0

        val zurich = java.time.ZoneId.of("Europe/Zurich")
        val dayFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd")
        val monthFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy-MM")

        for (tx in transactions) {
            val items = transactionRepository.getTransaction(tx.id)?.second.orEmpty()
            val txDay = java.time.Instant.ofEpochMilli(tx.createdAt).atZone(zurich).toLocalDate()
            val dayKey = txDay.format(dayFmt)
            val monthKey = txDay.format(monthFmt)

            for (item in items) {
                val metrics = lineProfitMetrics(item, costByProductId[item.productId])
                if (metrics == null) continue
                netMerchandise += metrics.revenue
                cogs += metrics.cogs
                if (metrics.missingCost) linesMissingCost++

                val productKey = item.productId?.takeIf { it > 0 }?.toString()
                    ?: "name:${item.productName}"
                addAgg(productAgg, productKey, item.productName, metrics)

                val catId = item.productId?.let { categoryByProductId[it] }
                val catKey = catId?.toString() ?: "uncategorized"
                val catLabel = catId?.let { categoryNameById[it] } ?: "Uncategorized"
                addAgg(categoryAgg, catKey, catLabel, metrics)

                addAgg(dayAgg, dayKey, dayKey, metrics)
                addAgg(monthAgg, monthKey, monthKey, metrics)
            }
        }

        netMerchandise = roundMoney(netMerchandise)
        cogs = roundMoney(cogs)
        val grossProfit = roundMoney(netMerchandise - cogs)
        val marginPercent = profitMarginPercent(netMerchandise, grossProfit) ?: 0.0
        val summary = ProfitMarginSnapshot(
            netMerchandise = netMerchandise,
            cogs = cogs,
            grossProfit = grossProfit,
            marginPercent = marginPercent,
            linesMissingCost = linesMissingCost
        )
        return ProfitMarginReport(
            summary = summary,
            byProduct = toProfitRows(productAgg).sortedByDescending { it.profit },
            byCategory = toProfitRows(categoryAgg).sortedByDescending { it.profit },
            byDay = toProfitRows(dayAgg).sortedBy { it.id },
            byMonth = toProfitRows(monthAgg).sortedBy { it.id }
        )
    }

    private data class AggRow(var label: String, var qty: Double = 0.0, var revenue: Double = 0.0, var cogs: Double = 0.0)

    private data class LineProfitMetrics(
        val keptUnits: Double,
        val revenue: Double,
        val cogs: Double,
        val missingCost: Boolean
    )

    private fun lineProfitMetrics(
        item: com.chaslay.pos.data.local.entity.TransactionItemEntity,
        unitCost: Double?
    ): LineProfitMetrics? {
        val keptQty = (item.quantity - item.refundedQuantity).coerceAtLeast(0)
        if (keptQty <= 0) return null
        val keptUnits = if (item.isWeighed) keptQty / 1000.0 else keptQty.toDouble()
        val revenue = if (item.quantity > 0) {
            item.lineSubtotal * (keptQty.toDouble() / item.quantity.toDouble())
        } else {
            item.lineSubtotal
        }.coerceAtLeast(0.0)
        val productId = item.productId
        val missingCost = productId != null && productId > 0L && (unitCost == null || unitCost < 0.0)
        val lineCogs = if (unitCost != null && unitCost >= 0.0) unitCost * keptUnits else 0.0
        return LineProfitMetrics(
            keptUnits = keptUnits,
            revenue = revenue,
            cogs = lineCogs,
            missingCost = missingCost
        )
    }

    private fun addAgg(map: MutableMap<String, AggRow>, key: String, label: String, metrics: LineProfitMetrics) {
        val row = map.getOrPut(key) { AggRow(label) }
        if (row.label.isBlank()) row.label = label
        row.qty += metrics.keptUnits
        row.revenue += metrics.revenue
        row.cogs += metrics.cogs
    }

    private fun toProfitRows(map: Map<String, AggRow>): List<ProfitMarginRow> =
        map.map { (id, row) ->
            val revenue = roundMoney(row.revenue)
            val cogs = roundMoney(row.cogs)
            val profit = roundMoney(revenue - cogs)
            ProfitMarginRow(
                id = id,
                label = row.label.ifBlank { id },
                quantity = roundMoney(row.qty),
                revenue = revenue,
                cogs = cogs,
                profit = profit,
                marginPercent = profitMarginPercent(revenue, profit)
            )
        }

    private fun profitMarginPercent(revenue: Double, profit: Double): Double? {
        if (revenue <= 0.0005) return if (profit > 0) 100.0 else null
        return roundMoney(profit / revenue * 100.0)
    }

    private fun rangeBounds(range: ReportRange): Pair<Long, Long> {
        val startCal = java.util.Calendar.getInstance()
        val endCal = java.util.Calendar.getInstance()
        when (range) {
            ReportRange.TODAY -> Unit
            ReportRange.YESTERDAY -> {
                startCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
                endCal.add(java.util.Calendar.DAY_OF_YEAR, -1)
            }
            ReportRange.LAST_WEEK -> startCal.add(java.util.Calendar.DAY_OF_YEAR, -7)
            ReportRange.LAST_MONTH -> startCal.add(java.util.Calendar.MONTH, -1)
            ReportRange.LAST_3_MONTHS -> startCal.add(java.util.Calendar.MONTH, -3)
        }
        return dayStart(startCal) to dayEnd(endCal)
    }

    private fun dayStart(calendar: java.util.Calendar): Long {
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 0)
        calendar.set(java.util.Calendar.MINUTE, 0)
        calendar.set(java.util.Calendar.SECOND, 0)
        calendar.set(java.util.Calendar.MILLISECOND, 0)
        return calendar.timeInMillis
    }

    private fun dayEnd(calendar: java.util.Calendar): Long {
        calendar.set(java.util.Calendar.HOUR_OF_DAY, 23)
        calendar.set(java.util.Calendar.MINUTE, 59)
        calendar.set(java.util.Calendar.SECOND, 59)
        calendar.set(java.util.Calendar.MILLISECOND, 999)
        return calendar.timeInMillis
    }

    private fun eodDayBounds(preset: EodDayPreset, customDayStartMs: Long): Pair<Long, Long> {
        val cal = java.util.Calendar.getInstance()
        when (preset) {
            EodDayPreset.TODAY -> Unit
            EodDayPreset.YESTERDAY -> cal.add(java.util.Calendar.DAY_OF_YEAR, -1)
            EodDayPreset.CUSTOM -> {
                if (customDayStartMs > 0L) {
                    cal.timeInMillis = customDayStartMs
                }
            }
        }
        return dayStart(cal) to dayEnd(cal)
    }

    fun selectRange(range: ReportRange) {
        _uiState.update { it.copy(selectedRange = range) }
        refresh()
    }

    fun selectEodStaff(userId: Long?) {
        _uiState.update { it.copy(selectedEodStaffId = userId) }
        refresh()
    }

    fun printEndOfDayReport() {
        viewModelScope.launch {
            val access = sessionManager.currentUserAccess.first()
            val userId = sessionManager.currentUserId.first()
            val state = _uiState.value
            if (access != null && !access.canViewAllSales()) {
                // Waiters may only print their own EOD.
                val report = state.endOfDayReport
                if (report.salesCount == 0 && report.revenue == 0.0) {
                    _uiState.update { it.copy(message = "No sales to report for your shift") }
                    return@launch
                }
            } else if (access != null && state.selectedEodStaffId != null &&
                state.selectedEodStaffId != userId && !access.canViewAllSales()
            ) {
                _uiState.update { it.copy(message = "You do not have permission to print other staff EOD") }
                return@launch
            }
            val settings = settingsRepository.getSettings()
            val includeStaffOnPrint = state.canViewAllSales &&
                state.selectedEodStaffId == null &&
                state.eodIncludeStaffBreakdown
            val report = state.endOfDayReport.copy(
                staffBreakdown = if (includeStaffOnPrint) state.endOfDayReport.staffBreakdown
                else emptyList(),
            )
            val printError = eodPrintGuard(settings, access)
            if (printError != null) {
                _uiState.update { it.copy(message = printError) }
                return@launch
            }
            val includeProducts = state.eodIncludeProductsSold
            withContext(Dispatchers.IO) {
                printerService.routeEndOfDayReport(settings, report, includeProducts)
            }.onSuccess { _uiState.update { it.copy(message = "End of day report printed") } }
                .onFailure { e -> _uiState.update { it.copy(message = e.message) } }
        }
    }

    fun printSalesReport() {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val printError = reportPrintGuard(settings)
            if (printError != null) {
                _uiState.update { it.copy(message = printError) }
                return@launch
            }
            val report = _uiState.value.endOfDayReport
            withContext(Dispatchers.IO) {
                printerService.routeEndOfDayReport(settings, report)
            }.onSuccess { _uiState.update { it.copy(message = "Sales report printed") } }
                .onFailure { e -> _uiState.update { it.copy(message = e.message) } }
        }
    }

    private suspend fun reportPrintGuard(settings: com.chaslay.pos.data.local.entity.BusinessSettingsEntity): String? {
        if (!settings.printerPrintReports) return "Enable report printing in Settings"
        return null
    }

    private fun eodPrintGuard(
        settings: com.chaslay.pos.data.local.entity.BusinessSettingsEntity,
        access: com.chaslay.pos.domain.model.UserAccess?
    ): String? {
        val mayPrintEod = access?.has(PosPermission.END_OF_DAY) == true ||
            access?.canAccessReports() == true
        if (!mayPrintEod) return "You do not have permission to print end of day reports"
        if (!settings.printerPrintReports && access?.has(PosPermission.END_OF_DAY) != true) {
            return "Enable report printing in Settings"
        }
        return null
    }
}
