package com.chaslay.pos.printer

import android.content.Context
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.BusinessSettingsEntity
import com.chaslay.pos.data.local.entity.TableOrderItemEntity
import com.chaslay.pos.data.repository.ProductRepository
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.ServiceType
import com.chaslay.pos.sync.FloorSyncRepository
import com.chaslay.pos.sync.KitchenPrintRetryQueue
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class KitchenPrintDelivery @Inject constructor(
    private val printerService: BluetoothPrinterService,
    private val productRepository: ProductRepository,
    private val floorSyncRepository: FloorSyncRepository,
    private val kitchenPrintRetryQueue: KitchenPrintRetryQueue,
    @ApplicationContext private val appContext: Context
) {
    suspend fun deliver(
        settings: BusinessSettingsEntity,
        orderId: String,
        tableName: String,
        serviceType: ServiceType,
        round: Int,
        items: List<TableOrderItemEntity>,
        meta: KitchenPrintMeta,
        isFollowUp: Boolean = false,
        message: String? = null
    ): Result<Unit> = withContext(Dispatchers.IO) {
        if (settings.posMode != PosMode.RESTAURANT) return@withContext Result.success(Unit)
        if (usesRemoteKitchenPrint(settings)) {
            return@withContext runCatching {
                floorSyncRepository.queueKitchenPrint(
                    settings = settings,
                    orderId = orderId,
                    tableName = tableName,
                    serviceType = serviceType.name,
                    round = round,
                    items = items,
                    meta = meta
                )
            }
        }
        val categories = productRepository.getAllCategories()
        val products = productRepository.getAllProducts()
        val printResult = printerService.routeKitchen(
            settings = settings,
            tableName = tableName,
            serviceType = serviceType,
            round = round,
            items = items,
            isFollowUp = isFollowUp,
            message = message,
            categories = categories,
            products = products,
            meta = meta
        )
        if (printResult.isSuccess) return@withContext Result.success(Unit)
        if (settings.kitchenPrintRetryEnabled) {
            kitchenPrintRetryQueue.enqueue(
                settings = settings,
                tableName = tableName,
                serviceType = serviceType,
                round = round,
                items = items,
                meta = meta
            )
            return@withContext Result.failure(
                Exception(appContext.getString(R.string.kitchen_print_retry_queued))
            )
        }
        printResult.map { }
    }

    private fun usesRemoteKitchenPrint(settings: BusinessSettingsEntity): Boolean =
        settings.floorSyncEnabled &&
            FloorDeviceRole.fromApi(settings.floorDeviceRole) == FloorDeviceRole.WAITER
}
