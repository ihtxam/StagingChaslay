package com.chaslay.pos.sync

import com.chaslay.pos.data.local.dao.AddonGroupDao
import com.chaslay.pos.data.local.dao.AddonOptionDao
import com.chaslay.pos.data.local.dao.CategoryDao
import com.chaslay.pos.data.local.dao.ComboSlotDao
import com.chaslay.pos.data.local.dao.ComboSlotOptionDao
import com.chaslay.pos.data.local.dao.ModifierGroupDao
import com.chaslay.pos.data.local.dao.ModifierOptionDao
import com.chaslay.pos.data.local.dao.ProductAddonGroupDao
import com.chaslay.pos.data.local.dao.ProductDao
import com.chaslay.pos.data.local.dao.ProductModifierGroupDao
import com.chaslay.pos.data.local.dao.ProductVariantDao
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.AddonOptionEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ComboSlotEntity
import com.chaslay.pos.data.local.entity.ComboSlotOptionEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ModifierOptionEntity
import com.chaslay.pos.data.local.entity.ProductAddonGroupEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.ProductModifierGroupEntity
import com.chaslay.pos.data.local.entity.ProductVariantEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.preferences.SyncPreferences
import com.chaslay.pos.util.TextEncoding
import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.PushCatalogCategoryDto
import com.chaslay.pos.data.remote.dto.PushCatalogProductDto
import com.chaslay.pos.data.remote.dto.PushCatalogRequest
import com.chaslay.pos.data.remote.dto.SyncBusinessDto
import com.chaslay.pos.data.remote.dto.SyncCategoryDto
import com.chaslay.pos.data.remote.dto.SyncExtraDto
import com.chaslay.pos.data.remote.dto.SyncModifierGroupDto
import com.chaslay.pos.data.remote.dto.SyncProductDto
import com.chaslay.pos.data.remote.dto.SyncVariantDto
import com.chaslay.pos.data.repository.SettingsRepository
import com.google.gson.JsonElement
import com.chaslay.pos.data.repository.ReceiptPublicUrls
import java.time.Instant
import java.util.Calendar
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

enum class MenuSyncMode {
    /** Upsert cloud items; keep local-only rows */
    MERGE,
    /** Deactivate local catalog, then full bootstrap from cloud */
    REPLACE
}

@Singleton
class MenuSyncRepository @Inject constructor(
    private val syncApi: SyncApi,
    private val syncPreferences: SyncPreferences,
    private val syncApiKeyStore: SyncApiKeyStore,
    private val categoryDao: CategoryDao,
    private val productDao: ProductDao,
    private val comboSlotDao: ComboSlotDao,
    private val comboSlotOptionDao: ComboSlotOptionDao,
    private val modifierGroupDao: ModifierGroupDao,
    private val modifierOptionDao: ModifierOptionDao,
    private val addonGroupDao: AddonGroupDao,
    private val addonOptionDao: AddonOptionDao,
    private val productModifierGroupDao: ProductModifierGroupDao,
    private val productAddonGroupDao: ProductAddonGroupDao,
    private val productVariantDao: ProductVariantDao,
    private val settingsRepository: SettingsRepository
) {
    suspend fun syncMenu(mode: MenuSyncMode = MenuSyncMode.MERGE): MenuSyncResult =
        withContext(Dispatchers.IO) {
            if (!syncApiKeyStore.hasKey()) {
                return@withContext MenuSyncResult(skipped = true, message = "No sync API key")
            }
            val syncBusinessInfo = syncPreferences.isSyncBusinessInfoEnabled()
            if (mode == MenuSyncMode.REPLACE) {
                productDao.deactivateAll()
                categoryDao.deactivateAll()
                syncPreferences.resetMenuSyncCursor()
            }

            val lastSync = syncPreferences.getLastMenuSyncMs()
            val forceBootstrap = mode == MenuSyncMode.REPLACE || lastSync <= 0L
            var businessSynced = false
            val bootstrap = if (forceBootstrap) {
                syncApi.bootstrap()
            } else {
                // Incremental changes omit unchanged combos, so always refresh slots
                // from the full catalog. WebPOS reads the same slot options live.
                runCatching { syncApi.bootstrap() }.getOrNull()
            }
            val (serverTime, categories, products) = if (forceBootstrap) {
                Triple(bootstrap!!.serverTime, bootstrap.categories, bootstrap.products)
            } else {
                val changes = syncApi.menuChanges(lastSync)
                Triple(changes.serverTime, changes.categories, changes.products)
            }
            if (syncBusinessInfo) {
                bootstrap?.business?.let { dto ->
                    applyBusinessInfo(dto)
                    businessSynced = true
                }
            }

            val categoryIdByRemote = mutableMapOf<String, Long>()
            categories.forEach { dto ->
                val localId = upsertCategory(dto)
                if (localId != null) categoryIdByRemote[dto.id] = localId
            }
            categoryDao.getActive().forEach { category ->
                val remote = category.remoteId
                if (!remote.isNullOrBlank()) categoryIdByRemote.putIfAbsent(remote, category.id)
            }
            val productIdByRemote = mutableMapOf<String, Long>()
            products.forEach { dto ->
                val localId = upsertProduct(dto, categoryIdByRemote)
                if (localId != null) productIdByRemote[dto.id] = localId
            }
            persistComboSlotsFromCatalog(
                catalogProducts = bootstrap?.products ?: products,
                categoryIdByRemote = categoryIdByRemote,
                productIdByRemote = productIdByRemote
            )
            persistModifiersFromCatalog(
                catalogProducts = bootstrap?.products ?: products,
                productIdByRemote = productIdByRemote
            )
            persistVariantsFromCatalog(
                catalogProducts = bootstrap?.products ?: products,
                productIdByRemote = productIdByRemote
            )

            syncPreferences.setLastMenuSyncMs(serverTime)
            if (categories.isNotEmpty() || products.isNotEmpty()) {
                syncPreferences.setMenuCloudSynced(true)
            }
            val businessNote = if (businessSynced) " + business info" else ""
            MenuSyncResult(
                categories = categories.size,
                products = products.size,
                serverTime = serverTime,
                mode = mode,
                businessSynced = businessSynced,
                message = if (products.isEmpty() && categories.isEmpty()) {
                    "Online menu is empty — add products in the merchant panel first"
                } else {
                    "Pulled ${categories.size} categories, ${products.size} products$businessNote"
                }
            )
        }

    /** Push local active catalog to merchant panel. */
    suspend fun pushMenuToCloud(): MenuSyncResult = withContext(Dispatchers.IO) {
        if (!syncApiKeyStore.hasKey()) {
            return@withContext MenuSyncResult(skipped = true, message = "No sync API key")
        }
        val categories = categoryDao.getActive()
        val products = productDao.getAllActive()
        if (categories.isEmpty() && products.isEmpty()) {
            return@withContext MenuSyncResult(message = "Local menu is empty")
        }

        val catClientIds = categories.associate { cat ->
            cat.id to (cat.remoteId?.takeIf { it.isNotBlank() } ?: "local-cat-${cat.id}")
        }
        val payload = PushCatalogRequest(
            categories = categories.map { cat ->
                PushCatalogCategoryDto(
                    clientId = catClientIds[cat.id]!!,
                    name = TextEncoding.repairCatalogText(cat.name),
                    sortOrder = cat.sortOrder,
                    color = cat.colorHex
                )
            },
            products = products.map { p ->
                PushCatalogProductDto(
                    clientId = p.remoteId?.takeIf { it.isNotBlank() } ?: "local-prod-${p.id}",
                    name = TextEncoding.repairCatalogText(p.name),
                    price = p.price,
                    categoryClientId = p.categoryId?.let { catClientIds[it] },
                    sku = p.sku,
                    barcode = p.barcode,
                    isTaxable = p.taxRate > 0.0,
                    sortOrder = p.sortOrder
                )
            }
        )
        val response = syncApi.pushCatalog(payload)

        // Persist server clientIds as remoteId for future sync
        categories.forEach { cat ->
            val clientId = catClientIds[cat.id] ?: return@forEach
            if (cat.remoteId != clientId) {
                categoryDao.update(cat.copy(remoteId = clientId))
            }
        }
        products.forEach { p ->
            val clientId = p.remoteId?.takeIf { it.isNotBlank() } ?: "local-prod-${p.id}"
            if (p.remoteId != clientId) {
                productDao.update(p.copy(remoteId = clientId))
            }
        }

        MenuSyncResult(
            categories = categories.size,
            products = products.size,
            serverTime = response.serverTime,
            message = "Pushed ${categories.size} categories, ${products.size} products to panel"
        )
    }

    private suspend fun applyBusinessInfo(dto: SyncBusinessDto) {
        val current = settingsRepository.getSettings()
        val hours = parseStoreHours(dto.storeHours)
        val merged = current.copy(
            businessName = dto.name?.takeIf { it.isNotBlank() } ?: current.businessName,
            phone = dto.phone?.takeIf { it.isNotBlank() } ?: current.phone,
            email = dto.email?.takeIf { it.isNotBlank() } ?: current.email,
            address = dto.address?.takeIf { it.isNotBlank() } ?: current.address,
            vatNumber = dto.vatNumber?.takeIf { it.isNotBlank() } ?: current.vatNumber,
            takeawayVatRate = dto.taxTakeawayRate?.takeIf { it > 0.0 } ?: current.takeawayVatRate,
            dineInVatRate = dto.taxDineInRate?.takeIf { it > 0.0 } ?: current.dineInVatRate,
            vatIncludedInPrice = dto.taxIncludedInPrice ?: current.vatIncludedInPrice,
            vatAfterDiscount = dto.vatAfterDiscount ?: current.vatAfterDiscount,
            defaultLanguage = dto.defaultLanguage?.takeIf { it.isNotBlank() } ?: current.defaultLanguage,
            receiptBaseUrl = dto.receiptBaseUrl?.takeIf { it.isNotBlank() }?.let { ReceiptPublicUrls.normalizeBase(it) }
                ?: current.receiptBaseUrl,
            openHour = hours?.getOrNull(0) ?: current.openHour,
            openMinute = hours?.getOrNull(1) ?: current.openMinute,
            closeHour = hours?.getOrNull(2) ?: current.closeHour,
            closeMinute = hours?.getOrNull(3) ?: current.closeMinute
        )
        settingsRepository.saveSettings(merged)
    }

    /** Returns openHour, openMinute, closeHour, closeMinute from takeaway hours for today. */
    private fun parseStoreHours(
        storeHours: Map<String, Map<String, List<com.chaslay.pos.data.remote.dto.SyncStoreHoursSlotDto>>>?
    ): List<Int>? {
        if (storeHours.isNullOrEmpty()) return null
        val dayKey = when (Calendar.getInstance().get(Calendar.DAY_OF_WEEK)) {
            Calendar.MONDAY -> "mon"
            Calendar.TUESDAY -> "tue"
            Calendar.WEDNESDAY -> "wed"
            Calendar.THURSDAY -> "thu"
            Calendar.FRIDAY -> "fri"
            Calendar.SATURDAY -> "sat"
            Calendar.SUNDAY -> "sun"
            else -> "mon"
        }
        val channel = storeHours["takeaway"] ?: storeHours["display"] ?: storeHours.values.firstOrNull()
        val slots = channel?.get(dayKey).orEmpty()
        val slot = slots.firstOrNull() ?: return null
        val open = parseHourMinute(slot.open) ?: return null
        val close = parseHourMinute(slot.close) ?: return null
        return listOf(open.first, open.second, close.first, close.second)
    }

    private fun parseHourMinute(value: String): Pair<Int, Int>? {
        val parts = value.trim().split(":")
        if (parts.size < 2) return null
        val hour = parts[0].toIntOrNull() ?: return null
        val minute = parts[1].toIntOrNull() ?: return null
        return hour to minute
    }

    private suspend fun upsertCategory(dto: SyncCategoryDto): Long? {
        val deleted = dto.deleted_at != null
        val existing = categoryDao.getByRemoteId(dto.id)
        val entity = CategoryEntity(
            id = existing?.id ?: 0L,
            remoteId = dto.id,
            name = TextEncoding.repairCatalogText(dto.name),
            sortOrder = dto.sort_order ?: existing?.sortOrder ?: 0,
            colorHex = dto.color_hex ?: existing?.colorHex ?: "#5B9BD5",
            isActive = !deleted,
            onlineVisible = dto.online_visible ?: true,
            updatedAt = parseInstantMs(dto.updated_at)
        )
        return if (existing == null) categoryDao.insert(entity) else {
            categoryDao.update(entity)
            existing.id
        }
    }

    private suspend fun upsertProduct(dto: SyncProductDto, categoryIdByRemote: Map<String, Long>): Long? {
        val deleted = dto.deleted_at != null
        val existing = productDao.getByRemoteId(dto.id)
        val categoryId = dto.category_id?.let { categoryIdByRemote[it] }
        val isCombo = dto.productType == "combo" || existing?.isCombo == true
        val isOpenPrice = dto.isOpenPrice == true || dto.productType == "open_price"
        val isWeighed = dto.soldByWeight == true || dto.productType == "weighed"
        val entity = ProductEntity(
            id = existing?.id ?: 0L,
            remoteId = dto.id,
            name = TextEncoding.repairCatalogText(dto.name),
            sku = dto.sku ?: existing?.sku,
            barcode = dto.barcode?.takeIf { it.isNotBlank() } ?: existing?.barcode,
            categoryId = categoryId ?: existing?.categoryId,
            taxRate = dto.tax_rate ?: existing?.taxRate ?: 0.0,
            price = dto.price,
            imageUri = dto.image_url ?: existing?.imageUri,
            isActive = !deleted && dto.in_stock != false,
            isOpenPrice = isOpenPrice,
            isWeighed = isWeighed && !isOpenPrice,
            isCombo = isCombo,
            onlineVisible = dto.online_visible ?: true,
            sortOrder = dto.sort_order ?: existing?.sortOrder ?: 0,
            updatedAt = parseInstantMs(dto.updated_at)
        )
        return if (existing == null) {
            productDao.insert(entity)
        } else {
            productDao.update(entity)
            existing.id
        }.also { localId ->
            persistProductVariants(localId, dto)
        }
    }

    private suspend fun persistVariantsFromCatalog(
        catalogProducts: List<SyncProductDto>,
        productIdByRemote: Map<String, Long>
    ) {
        catalogProducts.forEach { dto ->
            val localId = productIdByRemote[dto.id] ?: productDao.getByRemoteId(dto.id)?.id ?: return@forEach
            persistProductVariants(localId, dto)
        }
    }

    private suspend fun persistProductVariants(localProductId: Long, dto: SyncProductDto) {
        val raw = dto.variants ?: dto.specifications ?: emptyList()
        productVariantDao.deactivateByProduct(localProductId)
        val entities = raw.mapIndexedNotNull { index, variant ->
            variant.toEntity(localProductId, index)
        }
        if (entities.isNotEmpty()) {
            productVariantDao.insertAll(entities)
        }
    }

    private fun SyncVariantDto.toEntity(localProductId: Long, index: Int): ProductVariantEntity? {
        val variantName = name?.trim().orEmpty()
        if (variantName.isEmpty()) return null
        if (saleStatus == "out_of_stock") return null
        return ProductVariantEntity(
            productId = localProductId,
            name = TextEncoding.repairCatalogText(variantName),
            price = price ?: 0.0,
            sortOrder = sortOrder ?: index,
            isActive = true
        )
    }

    private suspend fun persistComboSlotsFromCatalog(
        catalogProducts: List<SyncProductDto>,
        categoryIdByRemote: Map<String, Long>,
        productIdByRemote: MutableMap<String, Long>
    ) {
        catalogProducts.forEach { dto ->
            if (productIdByRemote[dto.id] != null) return@forEach
            val localId = upsertProduct(dto, categoryIdByRemote)
            if (localId != null) productIdByRemote[dto.id] = localId
        }
        productDao.getAllActive().forEach { product ->
            val remote = product.remoteId
            if (!remote.isNullOrBlank()) productIdByRemote.putIfAbsent(remote, product.id)
        }
        catalogProducts.forEach { dto ->
            val localId = productIdByRemote[dto.id] ?: productDao.getByRemoteId(dto.id)?.id ?: return@forEach
            if (dto.productType == "combo" || hasComboItemsPayload(dto.comboItems)) {
                persistComboSlots(localId, dto.comboItems, productIdByRemote)
            }
        }
    }

    private suspend fun persistComboSlots(
        comboProductId: Long,
        rawSlots: JsonElement?,
        productIdByRemote: Map<String, Long>
    ) {
        comboSlotOptionDao.deleteByComboProduct(comboProductId)
        comboSlotDao.deleteByComboProduct(comboProductId)
        val slots = parseComboItems(rawSlots)
        if (slots.isEmpty()) return
        slots.forEachIndexed { slotIndex, slot ->
            val resolved = slot.options.mapNotNull { opt ->
                val productId = resolveLocalProductId(opt.remoteId, productIdByRemote) ?: return@mapNotNull null
                productId to opt.extraPrice
            }.distinctBy { it.first }
            if (resolved.isEmpty()) return@forEachIndexed
            val slotId = comboSlotDao.insert(
                ComboSlotEntity(
                    comboProductId = comboProductId,
                    name = slot.name,
                    minPick = slot.minPick,
                    maxPick = slot.maxPick,
                    sortOrder = slotIndex
                )
            )
            comboSlotOptionDao.insertAll(
                resolved.mapIndexed { optIndex, (productId, extraPrice) ->
                    ComboSlotOptionEntity(
                        slotId = slotId,
                        productId = productId,
                        extraPrice = extraPrice,
                        sortOrder = optIndex
                    )
                }
            )
        }
    }

    private suspend fun persistModifiersFromCatalog(
        catalogProducts: List<SyncProductDto>,
        productIdByRemote: Map<String, Long>
    ) {
        catalogProducts.forEach { dto ->
            val localId = productIdByRemote[dto.id] ?: productDao.getByRemoteId(dto.id)?.id ?: return@forEach
            persistProductModifiers(localId, dto)
        }
    }

    private suspend fun persistProductModifiers(localProductId: Long, dto: SyncProductDto) {
        val groups = dto.modifierGroups
        val extras = dto.extras
        if (groups == null && extras == null) return
        productModifierGroupDao.deleteByProduct(localProductId)
        productAddonGroupDao.deleteByProduct(localProductId)
        if (!groups.isNullOrEmpty()) {
            groups.forEachIndexed { index, group ->
                val remoteId = group.id?.takeIf { it.isNotBlank() } ?: return@forEachIndexed
                val priced = group.pricingType != "free" &&
                    group.options.orEmpty().any { (it.price ?: 0.0) > 0.0 }
                if (priced) {
                    val groupId = upsertAddonGroup(remoteId, group)
                    productAddonGroupDao.insertAll(
                        listOf(ProductAddonGroupEntity(localProductId, groupId, index))
                    )
                } else {
                    val groupId = upsertModifierGroup(remoteId, group)
                    productModifierGroupDao.insertAll(
                        listOf(ProductModifierGroupEntity(localProductId, groupId, index))
                    )
                }
            }
        } else if (!extras.isNullOrEmpty()) {
            val groupId = upsertLegacyExtrasGroup(dto.id, extras)
            productAddonGroupDao.insertAll(
                listOf(ProductAddonGroupEntity(localProductId, groupId, 0))
            )
        }
    }

    private suspend fun upsertModifierGroup(remoteId: String, group: SyncModifierGroupDto): Long {
        val existing = modifierGroupDao.getByRemoteId(remoteId)
        val entity = ModifierGroupEntity(
            id = existing?.id ?: 0L,
            remoteId = remoteId,
            name = TextEncoding.repairCatalogText(group.title ?: group.name ?: "Options"),
            limitQuantity = (group.maxSelectable ?: 1).coerceAtLeast(1),
            required = group.selectionType == "required" || (group.minSelectable ?: 0) > 0,
            sortOrder = group.sortOrder ?: existing?.sortOrder ?: 0,
            isActive = true
        )
        val id = if (existing == null) modifierGroupDao.insert(entity) else {
            modifierGroupDao.update(entity)
            existing.id
        }
        modifierOptionDao.deleteByGroup(id)
        val options = group.options.orEmpty().mapIndexedNotNull { index, opt ->
            val name = opt.name?.trim().orEmpty()
            if (name.isEmpty()) return@mapIndexedNotNull null
            ModifierOptionEntity(
                groupId = id,
                name = TextEncoding.repairCatalogText(name),
                sortOrder = opt.sortOrder ?: index,
                inStock = opt.saleStatus != "out_of_stock",
                isActive = true
            )
        }
        if (options.isNotEmpty()) modifierOptionDao.insertAll(options)
        return id
    }

    private suspend fun upsertAddonGroup(remoteId: String, group: SyncModifierGroupDto): Long {
        val existing = addonGroupDao.getByRemoteId(remoteId)
        val entity = AddonGroupEntity(
            id = existing?.id ?: 0L,
            remoteId = remoteId,
            name = TextEncoding.repairCatalogText(group.title ?: group.name ?: "Extras"),
            limitQuantity = (group.maxSelectable ?: 1).coerceAtLeast(1),
            required = group.selectionType == "required" || (group.minSelectable ?: 0) > 0,
            allowMultipleSame = group.allowMultipleSameItem == true,
            sortOrder = group.sortOrder ?: existing?.sortOrder ?: 0,
            isActive = true
        )
        val id = if (existing == null) addonGroupDao.insert(entity) else {
            addonGroupDao.update(entity)
            existing.id
        }
        addonOptionDao.deleteByGroup(id)
        val options = group.options.orEmpty().mapIndexedNotNull { index, opt ->
            val name = opt.name?.trim().orEmpty()
            if (name.isEmpty()) return@mapIndexedNotNull null
            AddonOptionEntity(
                groupId = id,
                name = TextEncoding.repairCatalogText(name),
                price = opt.price ?: 0.0,
                sortOrder = opt.sortOrder ?: index,
                inStock = opt.saleStatus != "out_of_stock",
                isActive = true
            )
        }
        if (options.isNotEmpty()) addonOptionDao.insertAll(options)
        return id
    }

    private suspend fun upsertLegacyExtrasGroup(productRemoteId: String, extras: List<SyncExtraDto>): Long {
        val remoteId = "legacy-extras:$productRemoteId"
        val existing = addonGroupDao.getByRemoteId(remoteId)
        val entity = AddonGroupEntity(
            id = existing?.id ?: 0L,
            remoteId = remoteId,
            name = "Extras",
            limitQuantity = extras.size.coerceAtLeast(1),
            required = false,
            allowMultipleSame = false,
            sortOrder = 0,
            isActive = true
        )
        val id = if (existing == null) addonGroupDao.insert(entity) else {
            addonGroupDao.update(entity)
            existing.id
        }
        addonOptionDao.deleteByGroup(id)
        val options = extras.mapIndexedNotNull { index, extra ->
            val name = extra.name?.trim().orEmpty()
            if (name.isEmpty()) return@mapIndexedNotNull null
            AddonOptionEntity(
                groupId = id,
                name = TextEncoding.repairCatalogText(name),
                price = extra.price,
                sortOrder = index,
                isActive = true
            )
        }
        if (options.isNotEmpty()) addonOptionDao.insertAll(options)
        return id
    }

    private suspend fun resolveLocalProductId(
        remote: String,
        productIdByRemote: Map<String, Long>
    ): Long? {
        if (remote.isBlank()) return null
        productIdByRemote[remote]?.let { return it }
        productDao.getByRemoteId(remote)?.id?.let { return it }
        remote.toLongOrNull()?.let { localId ->
            if (productDao.getById(localId) != null) return localId
        }
        return null
    }

    private fun parseInstantMs(value: String?): Long {
        if (value.isNullOrBlank()) return System.currentTimeMillis()
        return runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(System.currentTimeMillis())
    }
}

data class MenuSyncResult(
    val categories: Int = 0,
    val products: Int = 0,
    val serverTime: Long = 0L,
    val skipped: Boolean = false,
    val mode: MenuSyncMode = MenuSyncMode.MERGE,
    val businessSynced: Boolean = false,
    val message: String? = null
)
