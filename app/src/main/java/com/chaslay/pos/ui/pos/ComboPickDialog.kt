package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.ComboPickState
import com.chaslay.pos.domain.model.ComboSelection
import com.chaslay.pos.domain.model.ComboSlotModel
import com.chaslay.pos.domain.model.ComboSlotOptionModel
import com.chaslay.pos.domain.model.ProductCustomizeState
import com.chaslay.pos.domain.model.ProductWithVariants
import com.chaslay.pos.domain.model.SelectedAddon
import com.chaslay.pos.domain.model.SelectedModifier
import java.util.Locale
import java.util.UUID

data class ComboPickResult(
    val selections: List<ComboSelection>,
    val quantity: Int,
    val unitPrice: Double,
    val comboExtras: List<SelectedAddon> = emptyList(),
    val comboModifiers: List<SelectedModifier> = emptyList()
)

private data class ComboSlotPick(
    val pickId: String,
    val productId: Long,
    val productName: String,
    val extraPrice: Double,
    val extras: List<SelectedAddon> = emptyList(),
    val modifiers: List<SelectedModifier> = emptyList(),
    val qty: Int = 1
) {
    val surcharge: Double
        get() = extraPrice + extras.sumOf { it.price * it.quantity }
}

@Composable
fun ComboPickDialog(
    state: ComboPickState,
    currencySymbol: String,
    showProductImages: Boolean = false,
    onConfirm: (ComboPickResult) -> Unit,
    onDismiss: () -> Unit
) {
    val combo = state.combo
    val product = combo.product
    var itemQty by remember { mutableIntStateOf(1) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val picks = remember(combo.product.id) {
        mutableStateMapOf<Long, List<ComboSlotPick>>().apply {
            combo.slots.forEach { slot -> put(slot.id, emptyList()) }
        }
    }
    var comboModifiers by remember { mutableStateOf<List<SelectedModifier>>(emptyList()) }
    var comboAddons by remember { mutableStateOf<List<SelectedAddon>>(emptyList()) }
    var nestedOption by remember { mutableStateOf<Pair<ComboSlotModel, ComboSlotOptionModel>?>(null) }
    var showComboExtras by remember { mutableStateOf(false) }

    fun slotQty(slotId: Long) = picks[slotId].orEmpty().sumOf { it.qty }

    val extrasTotal = combo.slots.sumOf { slot ->
        picks[slot.id].orEmpty().sumOf { it.surcharge * it.qty }
    } + comboAddons.sumOf { it.price * it.quantity }
    val unitPrice = product.price + extrasTotal
    val lineTotal = unitPrice * itemQty

    val allValid = combo.slots.all { slot ->
        val count = slotQty(slot.id)
        count >= slot.minPick && count <= slot.maxPick
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f),
            color = Color(0xFF1E1E1E),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(product.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(
                            stringResource(R.string.combo_deal_price, currencySymbol, product.price),
                            color = Color(0xFF4CAF50),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFFE57373))
                    }
                }

                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        if (combo.slots.isEmpty()) {
                            Text(
                                stringResource(R.string.combo_choices_unavailable),
                                color = Color(0xFFFFCC80),
                                fontSize = 14.sp
                            )
                        }
                        combo.slots.forEach { slot ->
                            ComboSlotSection(
                                slot = slot,
                                picks = picks[slot.id].orEmpty(),
                                currencySymbol = currencySymbol,
                                showProductImages = showProductImages,
                                onToggle = { option ->
                                    errorMessage = null
                                    if (option.hasCustomize) {
                                        nestedOption = slot to option
                                        return@ComboSlotSection
                                    }
                                    val current = picks[slot.id].orEmpty()
                                    if (slot.maxPick <= 1) {
                                        picks[slot.id] = listOf(option.toSimplePick())
                                    } else {
                                        val existing = current.find {
                                            it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty()
                                        }
                                        val total = current.sumOf { it.qty }
                                        if (existing != null) {
                                            picks[slot.id] = if (existing.qty > 1) {
                                                current.map { if (it.pickId == existing.pickId) it.copy(qty = it.qty - 1) else it }
                                            } else {
                                                current.filter { it.pickId != existing.pickId }
                                            }
                                        } else if (total < slot.maxPick) {
                                            picks[slot.id] = current + option.toSimplePick()
                                        }
                                    }
                                },
                                onIncrement = { option ->
                                    val current = picks[slot.id].orEmpty()
                                    if (current.sumOf { it.qty } >= slot.maxPick) return@ComboSlotSection
                                    val existing = current.find {
                                        it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty()
                                    }
                                    picks[slot.id] = if (existing != null) {
                                        current.map { if (it.pickId == existing.pickId) it.copy(qty = it.qty + 1) else it }
                                    } else {
                                        current + option.toSimplePick()
                                    }
                                },
                                onDecrement = { option ->
                                    val current = picks[slot.id].orEmpty()
                                    val existing = current.find {
                                        it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty()
                                    } ?: return@ComboSlotSection
                                    picks[slot.id] = if (existing.qty > 1) {
                                        current.map { if (it.pickId == existing.pickId) it.copy(qty = it.qty - 1) else it }
                                    } else {
                                        current.filter { it.pickId != existing.pickId }
                                    }
                                }
                            )
                        }
                        if (combo.hasComboExtras) {
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        stringResource(R.string.combo_extras),
                                        color = Color.White,
                                        fontWeight = FontWeight.SemiBold,
                                        fontSize = 15.sp
                                    )
                                    Text(
                                        stringResource(R.string.combo_customize_item),
                                        color = Color(0xFF80CBC4),
                                        fontSize = 12.sp,
                                        modifier = Modifier.clickable { showComboExtras = true }
                                    )
                                }
                                val extraLabels = comboModifiers.map { it.name } + comboAddons.map { it.name }
                                if (extraLabels.isNotEmpty()) {
                                    Text(
                                        extraLabels.joinToString(", "),
                                        color = Color(0xFFB0B0B0),
                                        fontSize = 12.sp
                                    )
                                }
                            }
                        }
                    }

                    Column(
                        modifier = Modifier
                            .width(68.dp)
                            .fillMaxHeight()
                            .background(Color(0xFF252525))
                            .padding(vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        IconButton(
                            onClick = { itemQty++ },
                            modifier = Modifier.background(Color(0xFF00897B), RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                        }
                        Text(
                            itemQty.toString(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 26.sp,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                        IconButton(
                            onClick = { if (itemQty > 1) itemQty-- },
                            modifier = Modifier.background(Color(0xFF424242), RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White)
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    errorMessage?.let { msg ->
                        Text(msg, color = Color(0xFFE57373), fontSize = 12.sp)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            stringResource(R.string.total_items, itemQty),
                            color = Color.Gray,
                            fontSize = 13.sp
                        )
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )
                    }
                    Button(
                        onClick = {
                            val validation = validateComboPicks(combo.slots, picks)
                            if (validation != null) {
                                errorMessage = validation
                                return@Button
                            }
                            errorMessage = null
                            onConfirm(
                                ComboPickResult(
                                    selections = buildComboSelections(combo.slots, picks),
                                    quantity = itemQty,
                                    unitPrice = unitPrice,
                                    comboExtras = comboAddons,
                                    comboModifiers = comboModifiers
                                )
                            )
                        },
                        enabled = allValid,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF00897B),
                            disabledContainerColor = Color(0xFF424242)
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            stringResource(R.string.combo_add_to_order).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }

    nestedOption?.let { (slot, option) ->
        ProductCustomizeDialog(
            state = ProductCustomizeState(
                product = option.toCustomizeProduct(),
                modifierGroups = option.modifierGroups,
                addonGroups = option.addonGroups,
                openPrice = option.extraPrice
            ),
            currencySymbol = currencySymbol,
            showProductImages = showProductImages,
            onAdd = { result ->
                val pick = ComboSlotPick(
                    pickId = UUID.randomUUID().toString(),
                    productId = option.productId,
                    productName = option.productName,
                    extraPrice = option.extraPrice,
                    extras = result.addons,
                    modifiers = result.modifiers,
                    qty = 1
                )
                val current = picks[slot.id].orEmpty()
                picks[slot.id] = if (slot.maxPick <= 1) {
                    listOf(pick)
                } else {
                    val total = current.sumOf { it.qty }
                    if (total >= slot.maxPick) current else current + pick
                }
                nestedOption = null
                errorMessage = null
            },
            onDismiss = { nestedOption = null }
        )
    }

    if (showComboExtras) {
        ProductCustomizeDialog(
            state = ProductCustomizeState(
                product = product.copy(price = 0.0, isCombo = false),
                modifierGroups = combo.modifierGroups,
                addonGroups = combo.addonGroups,
                openPrice = 0.0,
                initialModifiers = comboModifiers,
                initialAddons = comboAddons
            ),
            currencySymbol = currencySymbol,
            showProductImages = showProductImages,
            onAdd = { result ->
                comboModifiers = result.modifiers
                comboAddons = result.addons
                showComboExtras = false
            },
            onDismiss = { showComboExtras = false }
        )
    }
}

@Composable
private fun ComboSlotSection(
    slot: ComboSlotModel,
    picks: List<ComboSlotPick>,
    currencySymbol: String,
    showProductImages: Boolean = false,
    onToggle: (ComboSlotOptionModel) -> Unit,
    onIncrement: (ComboSlotOptionModel) -> Unit,
    onDecrement: (ComboSlotOptionModel) -> Unit
) {
    val selectedCount = picks.sumOf { it.qty }
    val tileHeight = if (showProductImages) 108.dp else 84.dp
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(slot.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(
                comboSlotHeader(slot, selectedCount),
                color = if (selectedCount >= slot.minPick) Color(0xFF80CBC4) else Color.Gray,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
        if (slot.options.isEmpty()) {
            Text(
                stringResource(R.string.combo_slot_empty),
                color = Color(0xFFFFCC80),
                fontSize = 13.sp
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                slot.options.chunked(3).forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        row.forEach { option ->
                            val qty = picks
                                .filter { it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty() }
                                .sumOf { it.qty }
                            val selected = picks.any { it.productId == option.productId }
                            ComboOptionTile(
                                optionName = option.productName,
                                imageUri = option.imageUri,
                                extraPrice = option.extraPrice,
                                currencySymbol = currencySymbol,
                                customizeHint = option.hasCustomize,
                                qty = qty,
                                selected = selected,
                                showQty = slot.maxPick > 1 && !option.hasCustomize,
                                showProductImages = showProductImages,
                                tileHeight = tileHeight,
                                modifier = Modifier.weight(1f),
                                onToggle = { onToggle(option) },
                                onIncrement = { onIncrement(option) },
                                onDecrement = { onDecrement(option) }
                            )
                        }
                        repeat(3 - row.size) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
            val customized = picks.filter { it.extras.isNotEmpty() || it.modifiers.isNotEmpty() }
            if (customized.isNotEmpty()) {
                customized.forEach { pick ->
                    val extras = pick.modifiers.map { it.name } + pick.extras.map { it.name }
                    Text(
                        "${pick.productName}${if (pick.qty > 1) " ×${pick.qty}" else ""}: ${extras.joinToString(", ")}",
                        color = Color(0xFFB0B0B0),
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun ComboOptionTile(
    optionName: String,
    imageUri: String?,
    extraPrice: Double,
    currencySymbol: String,
    customizeHint: Boolean,
    qty: Int,
    selected: Boolean,
    showQty: Boolean,
    showProductImages: Boolean,
    tileHeight: Dp,
    modifier: Modifier = Modifier,
    onToggle: () -> Unit,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit
) {
    Box(
        modifier = modifier
            .height(tileHeight)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) Color(0xFF00897B) else Color(0xFF555555),
                shape = RoundedCornerShape(8.dp)
            )
            .background(
                if (selected) Color(0xFF1B3A38) else Color(0xFF333333),
                RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onToggle)
            .padding(8.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            if (showProductImages && !imageUri.isNullOrBlank()) {
                coil.compose.AsyncImage(
                    model = imageUri,
                    contentDescription = null,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    contentScale = ContentScale.Crop
                )
            }
            Text(
                optionName,
                color = Color.White,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp,
                maxLines = 2,
                textAlign = TextAlign.Center
            )
            when {
                extraPrice > 0 -> Text(
                    "+$currencySymbol ${"%.2f".format(Locale.getDefault(), extraPrice)}",
                    color = Color(0xFFFFB74D),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
                customizeHint -> Text(
                    stringResource(R.string.combo_customize_item),
                    color = Color(0xFF80CBC4),
                    fontSize = 10.sp
                )
            }
            if (showQty && selected) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = onDecrement,
                        modifier = Modifier.height(28.dp)
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White)
                    }
                    Text(
                        qty.toString(),
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )
                    IconButton(
                        onClick = onIncrement,
                        modifier = Modifier.height(28.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
private fun comboSlotHeader(slot: ComboSlotModel, selectedCount: Int): String {
    return when {
        slot.minPick == slot.maxPick ->
            stringResource(R.string.combo_slot_included, slot.maxPick)
        selectedCount > 0 ->
            stringResource(R.string.combo_slot_selected, selectedCount, slot.maxPick)
        else ->
            stringResource(R.string.combo_slot_pick_range, slot.minPick, slot.maxPick)
    }
}

private fun ComboSlotOptionModel.toSimplePick() = ComboSlotPick(
    pickId = UUID.randomUUID().toString(),
    productId = productId,
    productName = productName,
    extraPrice = extraPrice
)

private fun ComboSlotOptionModel.toCustomizeProduct() = ProductWithVariants(
    id = productId,
    name = productName,
    sku = null,
    barcode = null,
    categoryId = null,
    categoryName = null,
    taxRate = 0.0,
    price = extraPrice,
    costPrice = null,
    imageUri = imageUri,
    isActive = true,
    isOpenPrice = false,
    variants = emptyList()
)

private fun validateComboPicks(
    slots: List<ComboSlotModel>,
    picks: Map<Long, List<ComboSlotPick>>
): String? {
    slots.forEach { slot ->
        val count = picks[slot.id].orEmpty().sumOf { it.qty }
        if (count < slot.minPick) return "Please choose ${slot.minPick} for ${slot.name}"
        if (count > slot.maxPick) return "Too many picks for ${slot.name}"
    }
    return null
}

private fun buildComboSelections(
    slots: List<ComboSlotModel>,
    picks: Map<Long, List<ComboSlotPick>>
): List<ComboSelection> {
    val result = mutableListOf<ComboSelection>()
    slots.forEach { slot ->
        picks[slot.id].orEmpty().forEach { pick ->
            repeat(pick.qty) {
                result.add(
                    ComboSelection(
                        slotName = slot.name,
                        productId = pick.productId,
                        productName = pick.productName,
                        extraPrice = pick.extraPrice,
                        extras = pick.extras,
                        modifiers = pick.modifiers
                    )
                )
            }
        }
    }
    return result
}
