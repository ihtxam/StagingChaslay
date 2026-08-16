package com.chaslay.pos.ui.ongoing

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.CartManager
import com.chaslay.pos.data.repository.HeldOrderRepository
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.data.repository.TransactionRepository
import com.chaslay.pos.debug.CrashLogger
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.domain.model.OngoingOrderCard
import com.chaslay.pos.domain.model.OngoingOrderSource
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PaymentStatus
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.domain.model.TableOrderStatus
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.KitchenPrintMeta
import com.chaslay.pos.sync.OnlineKitchenPrintHelper
import com.chaslay.pos.sync.OnlineOrderAlertCoordinator
import dagger.hilt.android.lifecycle.HiltViewModel
import java.util.Calendar
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class OrdersStatusFilter { ACTIVE, COMPLETED }

enum class OrdersChannelFilter { ALL, DINE_IN, TAKEAWAY, DELIVERY }

enum class OrdersPaymentFilter { ALL, UNPAID }

data class OngoingOrdersUiState(
    val orders: List<OngoingOrderCard> = emptyList(),
    val statusFilter: OrdersStatusFilter = OrdersStatusFilter.ACTIVE,
    val channelFilter: OrdersChannelFilter = OrdersChannelFilter.ALL,
    val paymentFilter: OrdersPaymentFilter = OrdersPaymentFilter.ALL,
    val searchQuery: String = "",
    val currencySymbol: String = "CHF",
    val isLoading: Boolean = false,
    val errorMessage: String? = null
) {
    val filteredOrders: List<OngoingOrderCard>
        get() {
            val q = searchQuery.trim().lowercase()
            return orders.filter { card ->
                if (!matchesChannel(card, channelFilter)) return@filter false
                if (paymentFilter == OrdersPaymentFilter.UNPAID && !isUnpaid(card)) return@filter false
                if (q.isBlank()) return@filter true
                val hay = listOfNotNull(
                    card.orderNumber,
                    card.tableName,
                    card.customerLabel,
                    card.statusLabel
                ).joinToString(" ").lowercase()
                hay.contains(q)
            }
        }
}

@HiltViewModel
class OngoingOrdersViewModel @Inject constructor(
    private val heldOrderRepository: HeldOrderRepository,
    private val tableOrderRepository: TableOrderRepository,
    private val transactionRepository: TransactionRepository,
    private val cartManager: CartManager,
    private val sessionManager: SessionManager,
    private val settingsRepository: SettingsRepository,
    private val productRepository: ProductRepository,
    private val printerService: BluetoothPrinterService,
    private val crashLogger: CrashLogger,
    private val onlineOrderAlertCoordinator: OnlineOrderAlertCoordinator
) : ViewModel() {

    private val _uiState = MutableStateFlow(OngoingOrdersUiState())
    val uiState: StateFlow<OngoingOrdersUiState> = _uiState.asStateFlow()

    fun refresh() {
        viewModelScope.launch {
            val previous = _uiState.value
            _uiState.value = previous.copy(isLoading = true, errorMessage = null)
            runCatching { flushActiveTableCart() }
                .onFailure { e -> crashLogger.logError("OngoingOrders", "flushActiveTableCart failed", e) }
            runCatching {
                val settings = settingsRepository.getSettings()
                val currency = settings.currencySymbol.ifBlank { "CHF" }
                val orders = when (previous.statusFilter) {
                    OrdersStatusFilter.ACTIVE -> loadActiveOrders()
                    OrdersStatusFilter.COMPLETED -> loadCompletedOrders()
                }
                _uiState.value = previous.copy(
                    orders = orders.sortedByDescending { it.updatedAt },
                    currencySymbol = currency,
                    isLoading = false,
                    errorMessage = null
                )
            }.onFailure { e ->
                android.util.Log.e("ONGOING", "refresh failed", e)
                crashLogger.logError("OngoingOrders", "Failed to load ongoing orders", e)
                _uiState.value = previous.copy(
                    isLoading = false,
                    errorMessage = e.message ?: "Could not load orders"
                )
            }
        }
    }

    private suspend fun loadActiveOrders(): List<OngoingOrderCard> {
        val heldOrdersWithItems = heldOrderRepository.getOngoingHeldOrdersWithItems()
        android.util.Log.i(
            "ONGOING",
            "held=${heldOrdersWithItems.size} activeCount=${heldOrderRepository.countActive()}"
        )
        val heldTableOrderIds = heldOrdersWithItems.mapNotNull { (order, _) -> order.tableOrderId }.toSet()
        val held = heldOrdersWithItems.map { (order, items) ->
            val isPayLater = order.paymentMethod == PaymentMethod.PAY_LATER
            OngoingOrderCard(
                id = order.id,
                orderNumber = order.orderNumber,
                serviceType = order.serviceType,
                fulfillmentType = order.fulfillmentType,
                total = if (items.isEmpty()) order.total else CartSummary(items.map { it.toCartItem() }).total,
                itemCount = items.sumOf { it.quantity },
                statusLabel = when {
                    isPayLater -> "Awaiting payment"
                    order.status == HeldOrderStatus.SENT_TO_KITCHEN -> "Kitchen sent"
                    else -> "On hold"
                },
                source = OngoingOrderSource.HELD,
                tableName = order.tableName,
                customerLabel = order.deliveryName ?: order.deliveryPhone,
                paymentMethod = order.paymentMethod,
                pickupTimeMs = order.pickupTimeMs,
                updatedAt = order.updatedAt
            )
        }
        val table = runCatching {
            tableOrderRepository.getOngoingTableOrders()
                .filter { (order, _) -> order.id !in heldTableOrderIds }
                .map { (order, items) ->
                    val tableEntity = tableOrderRepository.getTable(order.tableId)
                    val cartItems = items.map { it.toCartItem() }
                    OngoingOrderCard(
                        id = order.id,
                        orderNumber = tableEntity?.name ?: order.id.take(6).uppercase(),
                        serviceType = order.serviceType,
                        fulfillmentType = FulfillmentType.DINE_IN,
                        total = if (cartItems.isEmpty()) 0.0 else CartSummary(cartItems).total,
                        itemCount = items.sumOf { it.quantity },
                        statusLabel = when (order.status) {
                            TableOrderStatus.SENT -> "Kitchen sent"
                            TableOrderStatus.HELD -> "On hold"
                            else -> "Open"
                        },
                        source = OngoingOrderSource.TABLE,
                        tableName = tableEntity?.name,
                        updatedAt = order.updatedAt
                    )
                }
        }.getOrElse { e ->
            crashLogger.logError("OngoingOrders", "Loading table orders failed", e)
            emptyList()
        }
        val merged = mergeWithActiveCart(held + table)
        android.util.Log.i("ONGOING", "heldCards=${held.size} tableCards=${table.size} merged=${merged.size}")
        return merged
    }

    private suspend fun loadCompletedOrders(): List<OngoingOrderCard> {
        val (startMs, endMs) = todayBounds()
        return transactionRepository.searchOrders(
            startMs = startMs,
            endMs = endMs,
            paymentMethod = null,
            serviceType = null
        ).filter { it.paymentStatus == PaymentStatus.COMPLETED }
            .map { tx ->
                val items = transactionRepository.getTransaction(tx.id)?.second.orEmpty()
                OngoingOrderCard(
                    id = tx.id,
                    orderNumber = tx.transactionNumber,
                    serviceType = tx.serviceType ?: ServiceType.TAKEAWAY,
                    fulfillmentType = when {
                        tx.tableId != null -> FulfillmentType.DINE_IN
                        tx.pickupTimeMs != null -> FulfillmentType.PICKUP
                        else -> FulfillmentType.WALK_IN
                    },
                    total = tx.total,
                    itemCount = items.sumOf { it.quantity },
                    statusLabel = "Completed",
                    source = OngoingOrderSource.TRANSACTION,
                    tableName = tx.tableId?.toString(),
                    paymentMethod = tx.paymentMethod,
                    pickupTimeMs = tx.pickupTimeMs,
                    updatedAt = tx.createdAt
                )
            }
    }

    private suspend fun flushActiveTableCart() {
        val cart = cartManager.snapshot()
        if (cart.tableId == null || cart.items.isEmpty()) return
        val userId = sessionManager.currentUserId.first() ?: 0L
        val userName = sessionManager.currentUserName.first() ?: "Cashier"
        val orderId = tableOrderRepository.syncCartToTable(cart, userId, userName)
        cartManager.setTableOrderId(orderId)
        val sentFlags = tableOrderRepository.getOrderItemEntities(orderId)
            .associate { it.id to (it.sentToKitchenAt != null) }
        cartManager.refreshSentFlags(sentFlags)
    }

    private fun mergeWithActiveCart(orders: List<OngoingOrderCard>): List<OngoingOrderCard> {
        val cart = cartManager.snapshot()
        val orderId = cart.tableOrderId ?: return orders
        if (cart.tableId == null || cart.items.isEmpty()) return orders
        val existing = orders.find { it.id == orderId && it.source == OngoingOrderSource.TABLE }
        val card = OngoingOrderCard(
            id = orderId,
            orderNumber = cart.tableName ?: existing?.orderNumber.orEmpty(),
            serviceType = cart.serviceType,
            fulfillmentType = cart.fulfillmentType,
            total = cart.total,
            itemCount = cart.items.sumOf { it.quantity },
            statusLabel = existing?.statusLabel ?: "Open",
            source = OngoingOrderSource.TABLE,
            tableName = cart.tableName,
            updatedAt = maxOf(existing?.updatedAt ?: 0L, System.currentTimeMillis())
        )
        return if (existing == null) {
            orders + card
        } else {
            orders.map { if (it.id == orderId && it.source == OngoingOrderSource.TABLE) card else it }
        }
    }

    fun setStatusFilter(filter: OrdersStatusFilter) {
        if (_uiState.value.statusFilter == filter) return
        _uiState.value = _uiState.value.copy(statusFilter = filter)
        refresh()
    }

    fun setChannelFilter(filter: OrdersChannelFilter) {
        _uiState.value = _uiState.value.copy(channelFilter = filter)
    }

    fun setPaymentFilter(filter: OrdersPaymentFilter) {
        _uiState.value = _uiState.value.copy(paymentFilter = filter)
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun resumeOrder(card: OngoingOrderCard, onDone: () -> Unit) {
        if (card.source == OngoingOrderSource.TRANSACTION) return
        viewModelScope.launch {
            val loaded = when (card.source) {
                OngoingOrderSource.HELD -> heldOrderRepository.loadHeldOrderToCart(cartManager, card.id)
                OngoingOrderSource.TABLE -> tableOrderRepository.loadTableOrderToCart(cartManager, card.id)
                OngoingOrderSource.TRANSACTION -> false
            }
            if (loaded) {
                if (card.source == OngoingOrderSource.HELD) {
                    onlineOrderAlertCoordinator.markActioned(card.id)
                }
                onDone()
            }
        }
    }

    fun printReceiptForOrder(card: OngoingOrderCard) {
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            when (card.source) {
                OngoingOrderSource.TRANSACTION -> {
                    val detail = transactionRepository.getTransaction(card.id) ?: return@launch
                    withContext(Dispatchers.IO) {
                        val (customerCopy, cashierCopy) = com.chaslay.pos.payment.AdyenPaymentReceiptStorage
                            .appendableForTransaction(detail.first)
                        printerService.routeReceipt(
                            settings,
                            detail.first,
                            detail.second,
                            customerCopy,
                            cashierCopy
                        )
                    }.onFailure { e ->
                        _uiState.value = _uiState.value.copy(errorMessage = e.message ?: "Print failed")
                    }
                }
                else -> {
                    val lines = loadOrderLines(card)
                    if (lines.isEmpty()) {
                        _uiState.value = _uiState.value.copy(errorMessage = "No items to print")
                        return@launch
                    }
                    val total = lines.sumOf { it.second }
                    withContext(Dispatchers.IO) {
                        printerService.routeCartPreview(
                            settings = settings,
                            lines = lines.map { it.first to it.second },
                            total = total,
                            title = "ORDER ${card.orderNumber}"
                        )
                    }.onFailure { e ->
                        _uiState.value = _uiState.value.copy(errorMessage = e.message ?: "Print failed")
                    }
                }
            }
        }
    }

    fun sendKitchenForOrder(card: OngoingOrderCard) {
        if (card.source == OngoingOrderSource.TRANSACTION) return
        viewModelScope.launch {
            val settings = settingsRepository.getSettings()
            val categories = productRepository.getAllCategories()
            val products = productRepository.getAllProducts()
            val userName = sessionManager.currentUserName.first() ?: "Cashier"
            val payload = loadKitchenPayload(card, userName) ?: run {
                _uiState.value = _uiState.value.copy(errorMessage = "No items to send")
                return@launch
            }
            withContext(Dispatchers.IO) {
                printerService.routeKitchen(
                    settings = settings,
                    tableName = payload.tableName,
                    serviceType = payload.serviceType,
                    round = payload.round,
                    items = payload.items,
                    isFollowUp = false,
                    message = null,
                    categories = categories,
                    products = products,
                    meta = payload.meta
                )
            }.onFailure { e ->
                _uiState.value = _uiState.value.copy(errorMessage = e.message ?: "Kitchen print failed")
            }
        }
    }

    private data class KitchenPayload(
        val tableName: String,
        val serviceType: ServiceType,
        val round: Int,
        val items: List<com.chaslay.pos.data.local.entity.TableOrderItemEntity>,
        val meta: KitchenPrintMeta
    )

    private suspend fun loadOrderLines(card: OngoingOrderCard): List<Pair<String, Double>> = when (card.source) {
        OngoingOrderSource.HELD -> {
            val detail = heldOrderRepository.getHeldOrderWithItems(card.id) ?: return emptyList()
            detail.second.map { "${it.quantity}x ${it.productName}" to (it.unitPrice * it.quantity) }
        }
        OngoingOrderSource.TABLE -> {
            tableOrderRepository.getOrderItems(card.id).map {
                "${it.quantity}x ${it.productName}" to it.lineSubtotal
            }
        }
        OngoingOrderSource.TRANSACTION -> emptyList()
    }

    private suspend fun loadKitchenPayload(card: OngoingOrderCard, userName: String): KitchenPayload? {
        return when (card.source) {
            OngoingOrderSource.HELD -> {
                val detail = heldOrderRepository.getHeldOrderWithItems(card.id) ?: return null
                val (order, items) = detail
                if (items.isEmpty()) return null
                val tableName = when (order.fulfillmentType) {
                    FulfillmentType.PICKUP -> "Takeaway"
                    FulfillmentType.DELIVERY -> "Delivery"
                    else -> order.tableName ?: "Walk-in"
                }
                KitchenPayload(
                    tableName = tableName,
                    serviceType = order.serviceType,
                    round = 1,
                    items = items.map { heldItem ->
                        com.chaslay.pos.data.local.entity.TableOrderItemEntity(
                            id = heldItem.id,
                            orderId = order.id,
                            productId = heldItem.productId,
                            productName = heldItem.productName,
                            variantName = heldItem.variantName,
                            unitPrice = heldItem.unitPrice,
                            quantity = heldItem.quantity,
                            taxRate = heldItem.taxRate,
                            notes = heldItem.notes,
                            courseNumber = heldItem.courseNumber
                        )
                    },
                    meta = OnlineKitchenPrintHelper.buildKitchenMeta(order, "ONLINE").copy(
                        cashierName = userName
                    )
                )
            }
            OngoingOrderSource.TABLE -> {
                val order = tableOrderRepository.getOrder(card.id) ?: return null
                var items = tableOrderRepository.getOrderItemEntities(card.id)
                    .filter { it.sentToKitchenAt == null }
                if (items.isEmpty()) {
                    items = tableOrderRepository.getOrderItemEntities(card.id)
                }
                if (items.isEmpty()) return null
                val table = tableOrderRepository.getTable(order.tableId)
                KitchenPayload(
                    tableName = table?.name ?: card.orderNumber,
                    serviceType = order.serviceType,
                    round = (order.kitchenRound) + 1,
                    items = items,
                    meta = KitchenPrintMeta(
                        orderNumber = card.orderNumber,
                        fulfillmentType = FulfillmentType.DINE_IN,
                        cashierName = userName
                    )
                )
            }
            OngoingOrderSource.TRANSACTION -> null
        }
    }

    private fun com.chaslay.pos.data.local.entity.HeldOrderItemEntity.toCartItem() = CartItem(
        id = id,
        productId = productId,
        productName = productName,
        variantName = variantName,
        unitPrice = unitPrice,
        quantity = quantity,
        taxRate = taxRate,
        sku = sku,
        courseNumber = courseNumber,
        isWeighed = isWeighed
    )

    private fun com.chaslay.pos.data.local.entity.TableOrderItemEntity.toCartItem() = CartItem(
        id = id,
        productId = productId,
        productName = productName,
        variantName = variantName,
        unitPrice = unitPrice,
        quantity = quantity,
        taxRate = taxRate,
        sentToKitchen = sentToKitchenAt != null,
        courseNumber = courseNumber,
        isWeighed = isWeighed
    )

    private fun todayBounds(): Pair<Long, Long> {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val start = cal.timeInMillis
        cal.add(Calendar.DAY_OF_YEAR, 1)
        return start to cal.timeInMillis
    }

    companion object {
        fun isUnpaid(card: OngoingOrderCard): Boolean =
            card.paymentMethod == PaymentMethod.PAY_LATER

        fun matchesChannel(card: OngoingOrderCard, filter: OrdersChannelFilter): Boolean = when (filter) {
            OrdersChannelFilter.ALL -> true
            OrdersChannelFilter.DINE_IN ->
                card.fulfillmentType == FulfillmentType.DINE_IN || card.serviceType == ServiceType.DINE_IN
            OrdersChannelFilter.TAKEAWAY ->
                card.fulfillmentType == FulfillmentType.PICKUP ||
                    (card.fulfillmentType == FulfillmentType.WALK_IN && card.serviceType == ServiceType.TAKEAWAY)
            OrdersChannelFilter.DELIVERY ->
                card.fulfillmentType == FulfillmentType.DELIVERY
        }
    }
}
