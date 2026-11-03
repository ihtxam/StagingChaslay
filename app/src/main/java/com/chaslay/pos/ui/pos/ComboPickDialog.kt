package com.chaslay.pos.ui.pos
import com.chaslay.pos.ui.theme.posUiColors

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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Remove
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.PosDimens
import java.util.Locale
import java.util.UUID

data class ComboPickResult(
    val selections: List<ComboSelection>,
    val quantity: Int,
    val unitPrice: Double,
    val comboExtras: List<SelectedAddon> = emptyList(),
    val comboModifiers: List<SelectedModifier> = emptyList(),
    val notes: String? = null
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
    val comboSingleModifier = remember(combo.product.id) {
        mutableStateMapOf<Long, Long>().apply {
            combo.modifierGroups.filter { it.isSingleSelect }.forEach { group ->
                group.options.firstOrNull { it.isDefault && it.inStock }?.let { opt -> put(group.id, opt.id) }
            }
        }
    }
    val comboModifierQty = remember(combo.product.id) {
        mutableStateMapOf<Long, Int>().apply {
            combo.modifierGroups.filter { !it.isSingleSelect }.forEach { group ->
                group.options.filter { it.isDefault && it.inStock }.forEach { opt ->
                    if (!containsKey(opt.id)) put(opt.id, 1)
                }
            }
            combo.modifierGroups.filter { it.isSingleSelect }.forEach { group ->
                if (comboSingleModifier[group.id] == null) {
                    group.options.firstOrNull { it.isDefault && it.inStock }?.let { opt ->
                        comboSingleModifier[group.id] = opt.id
                        put(opt.id, 1)
                    }
                } else {
                    comboSingleModifier[group.id]?.let { put(it, 1) }
                }
            }
        }
    }
    val comboAddonQty = remember(combo.product.id) {
        mutableStateMapOf<Long, Int>().apply {
            combo.addonGroups.forEach { group ->
                group.options.filter { it.isDefault && it.inStock }.forEach { opt ->
                    if (!containsKey(opt.id)) put(opt.id, 1)
                }
            }
        }
    }
    var nestedOption by remember { mutableStateOf<Pair<ComboSlotModel, ComboSlotOptionModel>?>(null) }
    var userNotes by remember { mutableStateOf("") }
    var showNotes by remember { mutableStateOf(false) }

    val msgChooseOptionFor = stringResource(R.string.customize_choose_option_for)
    val msgTooManyModifiers = stringResource(R.string.customize_too_many_modifiers)
    val msgTooManyAddons = stringResource(R.string.customize_too_many_addons)

    fun slotQty(slotId: Long) = picks[slotId].orEmpty().sumOf { it.qty }

    val extrasTotal = combo.slots.sumOf { slot ->
        picks[slot.id].orEmpty().sumOf { it.surcharge * it.qty }
    } + combo.addonGroups.sumOf { group ->
        group.options.sumOf { opt -> (comboAddonQty[opt.id] ?: 0) * opt.price }
    }
    val unitPrice = product.price + extrasTotal
    val lineTotal = unitPrice * itemQty

    val allValid = combo.slots.all { slot ->
        val count = slotQty(slot.id)
        count >= slot.safeMinPick() && count <= slot.safeMaxPick()
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f),
            color = posUiColors().surface,
            shape = PosShapes.Dialog,
            shadowElevation = 8.dp,
            tonalElevation = 0.dp,
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(posUiColors().surfaceSubtle)
                        .padding(horizontal = PosDimens.Space4, vertical = PosDimens.Space3),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(product.name, color = posUiColors().textPrimary, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(
                            stringResource(R.string.combo_deal_price, currencySymbol, product.price),
                            color = PosColors.Success,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = posUiColors().textSecondary)
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
                                color = PosColors.Warning,
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
                                    if (option.canCustomize()) {
                                        nestedOption = slot to option
                                        return@ComboSlotSection
                                    }
                                    applySimpleToggle(picks, slot, option)
                                },
                                onIncrement = { option ->
                                    applySimpleIncrement(picks, slot, option)
                                },
                                onDecrement = { option ->
                                    applySimpleDecrement(picks, slot, option)
                                }
                            )
                        }
                        if (combo.hasComboExtras) {
                            ProductExtraGroupsInlineEditor(
                                modifierGroups = combo.modifierGroups,
                                addonGroups = combo.addonGroups,
                                currencySymbol = currencySymbol,
                                singleModifier = comboSingleModifier,
                                modifierQty = comboModifierQty,
                                addonQty = comboAddonQty,
                                onSelectionChanged = { errorMessage = null }
                            )
                        }
                    }

                    Column(
                        modifier = Modifier
                            .width(132.dp)
                            .fillMaxHeight()
                            .background(posUiColors().surfaceSubtle)
                            .border(1.dp, posUiColors().border)
                            .padding(horizontal = 10.dp, vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        TextButton(
                            onClick = { showNotes = true },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, tint = PosColors.Primary, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                if (userNotes.isBlank()) stringResource(R.string.add_notes) else stringResource(R.string.edit_notes),
                                color = PosColors.Primary,
                                fontSize = 12.sp,
                                maxLines = 1
                            )
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        Box(
                            modifier = Modifier
                                .size(PosDimens.ControlHeightMd)
                                .clip(PosShapes.Large)
                                .background(PosColors.Primary)
                                .clickable { itemQty++ },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = PosColors.TextOnPrimary, modifier = Modifier.size(28.dp))
                        }
                        Text(
                            itemQty.toString(),
                            color = posUiColors().textPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 28.sp,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                        Box(
                            modifier = Modifier
                                .size(PosDimens.ControlHeightMd)
                                .clip(PosShapes.Large)
                                .background(posUiColors().surfaceMuted)
                                .clickable { if (itemQty > 1) itemQty-- },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = null, tint = posUiColors().textPrimary, modifier = Modifier.size(28.dp))
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}",
                            color = posUiColors().textPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            textAlign = TextAlign.Center
                        )
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(posUiColors().surfaceSubtle)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    errorMessage?.let { msg ->
                        Text(msg, color = PosColors.Danger, fontSize = 12.sp)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            stringResource(R.string.total_items, itemQty),
                            color = posUiColors().textSecondary,
                            fontSize = 13.sp
                        )
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}",
                            color = posUiColors().textPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onDismiss,
                            modifier = Modifier.weight(1f),
                            shape = PosShapes.Medium,
                            border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
                        ) {
                            Text(stringResource(R.string.cancel), color = posUiColors().textPrimary)
                        }
                        Button(
                            onClick = {
                            val snapshot = combo.slots.associate { slot ->
                                slot.id to picks[slot.id].orEmpty().toList()
                            }
                            val validation = validateComboPicks(combo.slots, snapshot)
                            if (validation != null) {
                                errorMessage = validation
                                return@Button
                            }
                            val builtModifiers = buildModifiers(combo.modifierGroups, comboSingleModifier, comboModifierQty)
                            val builtAddons = buildAddons(combo.addonGroups, comboAddonQty)
                            val extrasValidation = validateSelections(
                                state = ProductCustomizeState(
                                    product = product,
                                    modifierGroups = combo.modifierGroups,
                                    addonGroups = combo.addonGroups,
                                ),
                                singleModifier = comboSingleModifier,
                                modifierQty = comboModifierQty,
                                addonQty = comboAddonQty,
                                hasVariants = false,
                                selectedVariant = null,
                                chooseOptionFor = msgChooseOptionFor,
                                chooseSpecification = msgChooseOptionFor,
                                tooManyModifiers = msgTooManyModifiers,
                                tooManyAddons = msgTooManyAddons,
                            )
                            if (extrasValidation != null) {
                                errorMessage = extrasValidation
                                return@Button
                            }
                            errorMessage = null
                            onConfirm(
                                ComboPickResult(
                                    selections = buildComboSelections(combo.slots, snapshot),
                                    quantity = itemQty.coerceAtLeast(1),
                                    unitPrice = unitPrice,
                                    comboExtras = builtAddons,
                                    comboModifiers = builtModifiers,
                                    notes = userNotes.trim().ifBlank { null }
                                )
                            )
                        },
                        enabled = allValid,
                        modifier = Modifier
                            .weight(1f)
                            .height(PosDimens.ControlHeightMd),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PosColors.Primary,
                            contentColor = PosColors.TextOnPrimary,
                            disabledContainerColor = posUiColors().surfaceMuted,
                            disabledContentColor = posUiColors().textMuted,
                        ),
                        shape = PosShapes.Medium
                    ) {
                        Text(
                            stringResource(R.string.combo_add_to_order),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
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
            autoReturnOnSingleExtra = true,
            onAdd = { result ->
                val pick = ComboSlotPick(
                    pickId = UUID.randomUUID().toString(),
                    productId = option.productId,
                    productName = option.productName.ifBlank { "Item" },
                    extraPrice = option.extraPrice,
                    extras = result.addons.orEmpty(),
                    modifiers = result.modifiers.orEmpty(),
                    qty = 1
                )
                val current = picks[slot.id].orEmpty()
                val maxPick = slot.safeMaxPick()
                picks[slot.id] = if (maxPick <= 1) {
                    listOf(pick)
                } else {
                    val total = current.sumOf { it.qty }
                    if (total >= maxPick) current else current + pick
                }
                nestedOption = null
                errorMessage = null
            },
            onDismiss = { nestedOption = null }
        )
    }

    if (showNotes) {
        AlertDialog(
            onDismissRequest = { showNotes = false },
            title = { Text(stringResource(R.string.item_notes)) },
            text = {
                OutlinedTextField(
                    value = userNotes,
                    onValueChange = { userNotes = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
            },
            confirmButton = {
                TextButton(onClick = { showNotes = false }) { Text(stringResource(R.string.save)) }
            }
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
    val tileHeight = if (showProductImages) 92.dp else 64.dp
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(slot.name, color = posUiColors().textPrimary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(
                comboSlotHeader(slot, selectedCount),
                color = if (selectedCount >= slot.minPick) PosColors.Primary else posUiColors().textMuted,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
        if (slot.options.isEmpty()) {
            Text(
                stringResource(R.string.combo_slot_empty),
                color = PosColors.Warning,
                fontSize = 13.sp
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                slot.options.chunked(3).forEach { row ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
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
                                customizeHint = option.canCustomize(),
                                qty = qty,
                                selected = selected,
                                showQty = slot.safeMaxPick() > 1 && !option.canCustomize(),
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
                        color = posUiColors().textSecondary,
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
                color = if (selected) PosColors.Primary else posUiColors().border,
                shape = PosShapes.Small
            )
            .background(
                if (selected) posUiColors().surfaceSelected else posUiColors().surface,
                PosShapes.Small
            )
            .clickable(onClick = onToggle)
            .padding(horizontal = 6.dp, vertical = 5.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(end = if (selected) 14.dp else 0.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            if (showProductImages && !imageUri.isNullOrBlank()) {
                coil.compose.AsyncImage(
                    model = imageUri,
                    contentDescription = null,
                    modifier = Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    contentScale = ContentScale.Crop
                )
                Spacer(Modifier.height(4.dp))
            }
            Text(
                optionName,
                color = posUiColors().textPrimary,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                fontSize = 12.sp,
                lineHeight = 14.sp,
                maxLines = 2,
                textAlign = TextAlign.Center
            )
            when {
                extraPrice > 0 -> {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        "+$currencySymbol ${"%.2f".format(Locale.getDefault(), extraPrice)}",
                        color = PosColors.Warning,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                customizeHint -> {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        stringResource(R.string.combo_customize_item),
                        color = PosColors.Primary,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            if (showQty && selected) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = onDecrement,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = null, tint = posUiColors().textPrimary, modifier = Modifier.size(16.dp))
                    }
                    Text(
                        qty.toString(),
                        color = posUiColors().textPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(horizontal = 2.dp)
                    )
                    IconButton(
                        onClick = onIncrement,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, tint = posUiColors().textPrimary, modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
        if (selected) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(PosColors.Primary),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = PosColors.TextOnPrimary,
                    modifier = Modifier.size(11.dp)
                )
            }
        }
    }
}

@Composable
private fun comboSlotHeader(slot: ComboSlotModel, selectedCount: Int): String {
    val minPick = slot.safeMinPick()
    val maxPick = slot.safeMaxPick()
    return when {
        minPick == maxPick ->
            stringResource(R.string.combo_slot_included, maxPick)
        selectedCount > 0 ->
            stringResource(R.string.combo_slot_selected, selectedCount, maxPick)
        else ->
            stringResource(R.string.combo_slot_pick_range, minPick, maxPick)
    }
}

private fun ComboSlotOptionModel.canCustomize(): Boolean {
    val hasInStockModifiers = modifierGroups.any { group -> group.options.any { it.inStock } }
    val hasInStockAddons = addonGroups.any { group -> group.options.any { it.inStock } }
    return hasInStockModifiers || hasInStockAddons
}

private fun ComboSlotModel.safeMaxPick(): Int = maxPick.coerceAtLeast(1)

private fun ComboSlotModel.safeMinPick(): Int = minPick.coerceIn(0, safeMaxPick())

private fun applySimpleToggle(
    picks: MutableMap<Long, List<ComboSlotPick>>,
    slot: ComboSlotModel,
    option: ComboSlotOptionModel
) {
    val current = picks[slot.id].orEmpty()
    val maxPick = slot.safeMaxPick()
    if (maxPick <= 1) {
        picks[slot.id] = listOf(option.toSimplePick())
        return
    }
    val existing = current.find {
        it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty()
    }
    val total = current.sumOf { it.qty }
    picks[slot.id] = when {
        existing != null && existing.qty > 1 ->
            current.map { if (it.pickId == existing.pickId) it.copy(qty = it.qty - 1) else it }
        existing != null ->
            current.filter { it.pickId != existing.pickId }
        total < maxPick ->
            current + option.toSimplePick()
        else -> current
    }
}

private fun applySimpleIncrement(
    picks: MutableMap<Long, List<ComboSlotPick>>,
    slot: ComboSlotModel,
    option: ComboSlotOptionModel
) {
    val current = picks[slot.id].orEmpty()
    if (current.sumOf { it.qty } >= slot.safeMaxPick()) return
    val existing = current.find {
        it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty()
    }
    picks[slot.id] = if (existing != null) {
        current.map { if (it.pickId == existing.pickId) it.copy(qty = it.qty + 1) else it }
    } else {
        current + option.toSimplePick()
    }
}

private fun applySimpleDecrement(
    picks: MutableMap<Long, List<ComboSlotPick>>,
    slot: ComboSlotModel,
    option: ComboSlotOptionModel
) {
    val current = picks[slot.id].orEmpty()
    val existing = current.find {
        it.productId == option.productId && it.extras.isEmpty() && it.modifiers.isEmpty()
    } ?: return
    picks[slot.id] = if (existing.qty > 1) {
        current.map { if (it.pickId == existing.pickId) it.copy(qty = it.qty - 1) else it }
    } else {
        current.filter { it.pickId != existing.pickId }
    }
}

private fun ComboSlotOptionModel.toSimplePick() = ComboSlotPick(
    pickId = UUID.randomUUID().toString(),
    productId = productId,
    productName = productName.ifBlank { "Item" },
    extraPrice = extraPrice
)

private fun ComboSlotOptionModel.toCustomizeProduct() = ProductWithVariants(
    id = productId,
    name = productName.ifBlank { "Item" },
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
    isWeighed = false,
    isCombo = false,
    variants = emptyList()
)

private fun validateComboPicks(
    slots: List<ComboSlotModel>,
    picks: Map<Long, List<ComboSlotPick>>
): String? {
    slots.forEach { slot ->
        val count = picks[slot.id].orEmpty().sumOf { it.qty }
        val minPick = slot.safeMinPick()
        val maxPick = slot.safeMaxPick()
        if (count < minPick) return "Please choose $minPick for ${slot.name}"
        if (count > maxPick) return "Too many picks for ${slot.name}"
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
            repeat(pick.qty.coerceAtLeast(0)) {
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
