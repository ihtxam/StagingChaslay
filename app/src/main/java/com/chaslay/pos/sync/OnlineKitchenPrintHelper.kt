package com.chaslay.pos.sync

import com.chaslay.pos.data.local.dao.HeldOrderDao
import com.chaslay.pos.data.local.dao.HeldOrderItemDao
import com.chaslay.pos.data.local.dao.PrinterConfigDao
import com.chaslay.pos.data.local.entity.HeldOrderEntity
import com.chaslay.pos.data.local.entity.HeldOrderItemEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.HeldOrderStatus
import com.chaslay.pos.printer.BluetoothPrinterService
import com.chaslay.pos.printer.KitchenPrintMeta
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class OnlineKitchenPrintHelper @Inject constructor(
    private val settingsRepository: SettingsRepository,
    private val productRepository: ProductRepository,
    private val printerService: BluetoothPrinterService,
    private val printerConfigDao: PrinterConfigDao,
    private val heldOrderDao: HeldOrderDao,
    private val heldOrderItemDao: HeldOrderItemDao
) {
    suspend fun autoPrintIfEnabled(
        heldOrderId: String,
        orderSource: String?,
        printKitchen: Boolean = true
    ) = withContext(Dispatchers.IO) {
        if (printKitchen == false) return@withContext
        val settings = settingsRepository.getSettings()
        if (!settings.autoPrintKitchen) return@withContext

        val hasKitchenPrinter = runCatching { printerConfigDao.getAll() }
            .getOrDefault(emptyList())
            .any { it.isEnabled && it.printKitchenTickets && it.address.isNotBlank() }
        if (!hasKitchenPrinter) return@withContext

        val order = heldOrderDao.getById(heldOrderId) ?: return@withContext
        val items = heldOrderItemDao.getByOrder(heldOrderId)
        if (items.isEmpty()) return@withContext

        val tableName = when (order.fulfillmentType) {
            FulfillmentType.PICKUP -> "Takeaway"
            FulfillmentType.DELIVERY -> "Delivery"
            else -> order.tableName ?: "Walk-in"
        }
        val meta = buildKitchenMeta(order, orderSource)
        val kitchenItems = items.map { it.toKitchenItem(order.id) }

        runCatching {
            printerService.routeKitchen(
                settings = settings,
                tableName = tableName,
                serviceType = order.serviceType,
                round = 1,
                items = kitchenItems,
                isFollowUp = false,
                message = null,
                categories = productRepository.getAllCategories(),
                products = productRepository.getAllProducts(),
                meta = meta
            )
        }.onSuccess {
            heldOrderDao.upsert(
                order.copy(
                    status = HeldOrderStatus.SENT_TO_KITCHEN,
                    updatedAt = System.currentTimeMillis()
                )
            )
        }
    }

    companion object {
        fun orderSourceLabel(source: String?): String {
            return when (source?.lowercase()?.replace("_", "")) {
                "justeat" -> "JUST EAT"
                "ubereats" -> "UBER EATS"
                "onlineshop" -> "ONLINE SHOP"
                "online" -> "ONLINE"
                else -> source?.uppercase()?.takeIf { it.isNotBlank() } ?: "ONLINE"
            }
        }

        fun buildKitchenMeta(order: HeldOrderEntity, orderSource: String?): KitchenPrintMeta {
            val isDelivery = order.fulfillmentType == FulfillmentType.DELIVERY
            return KitchenPrintMeta(
                orderNumber = order.orderNumber,
                fulfillmentType = order.fulfillmentType,
                pickupTimeMs = order.pickupTimeMs,
                orderedAtMs = order.createdAt,
                orderSource = orderSourceLabel(orderSource),
                cashierName = order.customerDisplayName(),
                deliveryName = if (isDelivery) order.deliveryName else null,
                deliveryAddress = if (isDelivery) order.deliveryAddress else null,
                deliveryPhone = order.deliveryPhone
            )
        }

        private fun HeldOrderEntity.customerDisplayName(): String? =
            deliveryName?.takeIf { it.isNotBlank() } ?: userName.takeIf { it != "Online" }

        private fun HeldOrderItemEntity.toKitchenItem(orderId: String) = TableOrderItemEntity(
            id = id,
            orderId = orderId,
            productId = productId,
            productName = productName,
            variantName = variantName,
            unitPrice = unitPrice,
            quantity = quantity,
            taxRate = taxRate,
            notes = notes,
            courseNumber = courseNumber
        )
    }
}
