package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.ScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.AddonGroupModel
import com.chaslay.pos.domain.model.ModifierGroupModel
import com.chaslay.pos.domain.model.ProductCustomizeState
import com.chaslay.pos.domain.model.SelectedAddon
import com.chaslay.pos.domain.model.SelectedModifier
import java.util.Locale

data class CustomizedProductResult(
    val variantName: String?,
    val unitPrice: Double,
    val sku: String?,
    val quantity: Int,
    val modifiers: List<SelectedModifier>,
    val addons: List<SelectedAddon>,
    val notes: String?
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProductCustomizeDialog(
    state: ProductCustomizeState,
    currencySymbol: String,
    showProductImages: Boolean = false,
    autoReturnOnSingleExtra: Boolean = false,
    onAdd: (CustomizedProductResult) -> Unit,
    onDismiss: () -> Unit
) {
    val product = state.product
    val basePrice = state.openPrice ?: product.price
    val editKey = state.editingItemId ?: "new-${product.id}"
    var selectedVariant by remember(editKey) {
        mutableStateOf(
            state.initialVariantName?.let { name -> product.variants.find { it.name == name } }
                ?: product.variants.firstOrNull()
        )
    }
    var itemQty by remember(editKey) { mutableIntStateOf(state.initialQuantity.coerceAtLeast(1)) }
    var userNotes by remember(editKey) { mutableStateOf("") }
    var showNotes by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val modifierQty = remember(editKey) {
        mutableStateMapOf<Long, Int>().apply {
            state.modifierGroups.filter { !it.isSingleSelect }.forEach { group ->
                group.options.forEach { opt ->
                    state.initialModifiers.find { it.name == opt.name }?.let { put(opt.id, it.quantity) }
                }
            }
        }
    }
    val addonQty = remember(editKey) {
        mutableStateMapOf<Long, Int>().apply {
            state.addonGroups.forEach { group ->
                group.options.forEach { opt ->
                    state.initialAddons.find { it.name == opt.name }?.let { put(opt.id, it.quantity) }
                }
            }
        }
    }
    val singleModifier = remember(editKey) {
        mutableStateMapOf<Long, Long>().apply {
            state.modifierGroups.filter { it.isSingleSelect }.forEach { group ->
                val match = state.initialModifiers.find { mod -> group.options.any { it.name == mod.name } }
                match?.let { mod ->
                    group.options.find { it.name == mod.name }?.let { opt -> put(group.id, opt.id) }
                }
            }
        }
    }
    var activeTab by remember(editKey) { mutableIntStateOf(0) }
    val customizeTabs = remember(state.modifierGroups, state.addonGroups) {
        buildList {
            state.modifierGroups.forEach { add(CustomizeTabKind.Modifier(it)) }
            state.addonGroups.forEach { add(CustomizeTabKind.Addon(it)) }
        }
    }
    val isEditing = state.editingItemId != null

    val unitBase = selectedVariant?.price ?: basePrice
    val addonTotal = state.addonGroups.sumOf { group ->
        group.options.sumOf { opt -> (addonQty[opt.id] ?: 0) * opt.price }
    }
    val lineTotal = (unitBase + addonTotal) * itemQty
    val onlyOneExtraToChoose = customizeTabs.size == 1 && when (val tab = customizeTabs.firstOrNull()) {
        is CustomizeTabKind.Modifier -> tab.group.options.count { it.inStock } == 1
        is CustomizeTabKind.Addon -> tab.group.options.count { it.inStock } == 1
        null -> false
    }

    fun confirmCustomize() {
        val validation = validateSelections(state, singleModifier, modifierQty, addonQty)
        if (validation != null) {
            errorMessage = validation
            return
        }
        errorMessage = null
        val extrasTotal = state.addonGroups.sumOf { group ->
            group.options.sumOf { opt -> (addonQty[opt.id] ?: 0) * opt.price }
        }
        onAdd(
            CustomizedProductResult(
                variantName = selectedVariant?.name,
                unitPrice = unitBase + extrasTotal,
                sku = selectedVariant?.sku ?: product.sku,
                quantity = itemQty,
                modifiers = buildModifiers(state.modifierGroups, singleModifier, modifierQty),
                addons = buildAddons(state.addonGroups, addonQty),
                notes = userNotes.trim().ifBlank { null }
            )
        )
    }

    fun maybeAutoReturn() {
        if (autoReturnOnSingleExtra && onlyOneExtraToChoose) confirmCustomize()
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
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), unitBase + addonTotal)}",
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
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        if (product.variants.isNotEmpty()) {
                            OptionGroupSection(
                                title = stringResource(R.string.specification),
                                subtitle = stringResource(R.string.choose_one)
                            ) {
                                product.variants.forEach { variant ->
                                    OptionChip(
                                        label = variant.name,
                                        priceLabel = "$currencySymbol ${"%.2f".format(Locale.getDefault(), variant.price)}",
                                        selected = selectedVariant?.id == variant.id,
                                        onClick = { selectedVariant = variant }
                                    )
                                }
                            }
                        }

                        if (customizeTabs.isNotEmpty()) {
                            val tabIndex = activeTab.coerceIn(0, (customizeTabs.size - 1).coerceAtLeast(0))
                            ScrollableTabRow(
                                selectedTabIndex = tabIndex,
                                containerColor = Color(0xFF252525),
                                contentColor = Color.White,
                                edgePadding = 0.dp
                            ) {
                                customizeTabs.forEachIndexed { index, tab ->
                                    Tab(
                                        selected = tabIndex == index,
                                        onClick = { activeTab = index },
                                        text = {
                                            Text(
                                                tab.title,
                                                fontSize = 12.sp,
                                                fontWeight = if (tabIndex == index) FontWeight.Bold else FontWeight.Normal
                                            )
                                        }
                                    )
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            when (val tab = customizeTabs.getOrNull(tabIndex)) {
                                is CustomizeTabKind.Modifier -> {
                                    ModifierAddonGrid(
                                        currencySymbol = currencySymbol,
                                        group = tab.group,
                                        singleModifier = singleModifier,
                                        modifierQty = modifierQty,
                                        onSelectSingle = { groupId, optionId ->
                                            singleModifier[groupId] = optionId
                                            modifierQty.clear()
                                            modifierQty[optionId] = 1
                                            maybeAutoReturn()
                                        },
                                        onModifierIncrement = { group, optionId ->
                                            val total = group.options.sumOf { modifierQty[it.id] ?: 0 }
                                            if (total < group.limitQuantity) {
                                                modifierQty[optionId] = (modifierQty[optionId] ?: 0) + 1
                                                maybeAutoReturn()
                                            }
                                        },
                                        onDecrement = { optionId ->
                                            val q = (modifierQty[optionId] ?: 0) - 1
                                            if (q <= 0) modifierQty.remove(optionId) else modifierQty[optionId] = q
                                        }
                                    )
                                }
                                is CustomizeTabKind.Addon -> {
                                    ModifierAddonGrid(
                                        currencySymbol = currencySymbol,
                                        addonGroup = tab.group,
                                        addonQty = addonQty,
                                        onAddonIncrement = { group, optionId ->
                                            val total = group.options.sumOf { addonQty[it.id] ?: 0 }
                                            val current = addonQty[optionId] ?: 0
                                            if (group.allowMultipleSame || current == 0) {
                                                if (total < group.limitQuantity) {
                                                    addonQty[optionId] = current + 1
                                                    maybeAutoReturn()
                                                }
                                            } else {
                                                addonQty.keys.filter { id ->
                                                    group.options.any { it.id == id }
                                                }.forEach { addonQty.remove(it) }
                                                addonQty[optionId] = 1
                                                maybeAutoReturn()
                                            }
                                        },
                                        onDecrement = { optionId ->
                                            val q = (addonQty[optionId] ?: 0) - 1
                                            if (q <= 0) addonQty.remove(optionId) else addonQty[optionId] = q
                                        }
                                    )
                                }
                                null -> Unit
                            }
                        }
                    }

                    Column(
                        modifier = Modifier
                            .width(132.dp)
                            .fillMaxHeight()
                            .background(Color(0xFF252525))
                            .padding(horizontal = 10.dp, vertical = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        TextButton(
                            onClick = { showNotes = true },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Edit, contentDescription = null, tint = Color(0xFF80CBC4), modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(
                                if (userNotes.isBlank()) stringResource(R.string.add_notes) else stringResource(R.string.edit_notes),
                                color = Color(0xFF80CBC4),
                                fontSize = 12.sp,
                                maxLines = 1
                            )
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF00897B))
                                .clickable { itemQty++ },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
                        }
                        Text(
                            itemQty.toString(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 28.sp,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                        Box(
                            modifier = Modifier
                                .size(52.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF424242))
                                .clickable { if (itemQty > 1) itemQty-- },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp,
                            textAlign = TextAlign.Center
                        )
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

                    Button(
                        onClick = { confirmCustomize() },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B)),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            if (isEditing) {
                                stringResource(R.string.save).uppercase()
                            } else {
                                stringResource(R.string.add_to_cart).uppercase()
                            },
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }

    if (showNotes) {
        androidx.compose.material3.AlertDialog(
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

private sealed class CustomizeTabKind(val title: String) {
    data class Modifier(val group: ModifierGroupModel) : CustomizeTabKind(group.name)
    data class Addon(val group: AddonGroupModel) : CustomizeTabKind(group.name)
}

@Composable
private fun ModifierAddonGrid(
    currencySymbol: String,
    group: ModifierGroupModel? = null,
    addonGroup: AddonGroupModel? = null,
    singleModifier: Map<Long, Long> = emptyMap(),
    modifierQty: Map<Long, Int> = emptyMap(),
    addonQty: Map<Long, Int> = emptyMap(),
    onSelectSingle: (Long, Long) -> Unit = { _, _ -> },
    onModifierIncrement: (ModifierGroupModel, Long) -> Unit = { _, _ -> },
    onAddonIncrement: (AddonGroupModel, Long) -> Unit = { _, _ -> },
    onDecrement: (Long) -> Unit = {}
) {
    val inStockModifiers = group?.options.orEmpty().filter { it.inStock }
    val inStockAddons = addonGroup?.options.orEmpty().filter { it.inStock }
    if (inStockModifiers.isEmpty() && inStockAddons.isEmpty()) return

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (group != null) {
            inStockModifiers.chunked(3).forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    row.forEach { option ->
                        val qty = modifierQty[option.id] ?: 0
                        val selected = if (group.isSingleSelect) {
                            singleModifier[group.id] == option.id
                        } else {
                            qty > 0
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            ModifierGridTile(
                                label = option.name,
                                priceLabel = null,
                                selected = selected,
                                quantity = qty,
                                onClick = {
                                    if (group.isSingleSelect) onSelectSingle(group.id, option.id)
                                    else onModifierIncrement(group, option.id)
                                },
                                onDecrement = if (!group.isSingleSelect && qty > 0) {
                                    { onDecrement(option.id) }
                                } else {
                                    null
                                }
                            )
                        }
                    }
                    repeat(3 - row.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        } else if (addonGroup != null) {
            inStockAddons.chunked(3).forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    row.forEach { option ->
                        val qty = addonQty[option.id] ?: 0
                        Box(modifier = Modifier.weight(1f)) {
                            ModifierGridTile(
                                label = option.name,
                                priceLabel = "+$currencySymbol ${"%.2f".format(Locale.getDefault(), option.price)}",
                                selected = qty > 0,
                                quantity = qty,
                                onClick = { onAddonIncrement(addonGroup, option.id) },
                                onDecrement = if (qty > 0) ({ onDecrement(option.id) }) else null
                            )
                        }
                    }
                    repeat(3 - row.size) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun ModifierGridTile(
    label: String,
    priceLabel: String?,
    selected: Boolean,
    quantity: Int,
    onClick: () -> Unit,
    onDecrement: (() -> Unit)?
) {
    val border = if (selected) Color(0xFF0D9488) else Color(0xFF555555)
    val bg = if (selected) Color(0xFF1B3A38) else Color(0xFF333333)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp, max = 80.dp)
            .border(2.dp, border, RoundedCornerShape(8.dp))
            .background(bg, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp)
    ) {
        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                priceLabel ?: stringResource(R.string.included),
                color = if (selected) Color(0xFF80CBC4) else Color(0xFFFCD34D),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
            Text(
                label,
                color = Color.White,
                fontSize = 13.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                textAlign = TextAlign.Center,
                maxLines = 2
            )
        }
        if (selected && onDecrement != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(22.dp)
                    .background(Color(0xFF424242), RoundedCornerShape(11.dp))
                    .clickable(onClick = onDecrement),
                contentAlignment = Alignment.Center
            ) {
                Text("−", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        if (quantity > 1) {
            Text(
                "×$quantity",
                color = Color(0xFF80CBC4),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.BottomEnd)
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OptionGroupSection(title: String, subtitle: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Text(subtitle, color = Color.Gray, fontSize = 11.sp)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun OptionChip(
    label: String,
    priceLabel: String? = null,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (selected) Color(0xFF00897B) else Color(0xFF333333)
    Box(
        modifier = Modifier
            .border(1.dp, if (selected) Color(0xFF00897B) else Color(0xFF555555), RoundedCornerShape(20.dp))
            .background(bg, RoundedCornerShape(20.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                label,
                color = Color.White,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp
            )
            priceLabel?.let {
                Text(it, color = if (selected) Color(0xFFE0F2F1) else Color(0xFF9E9E9E), fontSize = 10.sp)
            }
        }
    }
}

@Composable
private fun QtyOptionChip(
    label: String,
    priceLabel: String? = null,
    quantity: Int,
    maxTotal: Int,
    currentTotal: Int,
    allowRepeat: Boolean = true,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit
) {
    val selected = quantity > 0
    val canAdd = !selected && currentTotal < maxTotal && (allowRepeat || quantity == 0)
    val bg = if (selected) Color(0xFF00897B) else Color(0xFF333333)
    Row(
        modifier = Modifier
            .border(1.dp, if (selected) Color(0xFF00897B) else Color(0xFF555555), RoundedCornerShape(20.dp))
            .background(bg, RoundedCornerShape(20.dp))
            .then(if (canAdd) Modifier.clickable(onClick = onIncrement) else Modifier)
            .padding(start = 12.dp, end = if (selected) 2.dp else 12.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = if (selected) 2.dp else 0.dp)) {
            Text(
                label,
                color = Color.White,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                fontSize = 13.sp
            )
            priceLabel?.let {
                Text(it, color = if (selected) Color(0xFFE0F2F1) else Color(0xFF9E9E9E), fontSize = 10.sp)
            }
        }
        if (selected) {
            IconButton(onClick = onDecrement, modifier = Modifier.height(30.dp).width(30.dp)) {
                Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White, modifier = Modifier.height(16.dp))
            }
            Text(
                quantity.toString(),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                modifier = Modifier.width(18.dp),
                textAlign = TextAlign.Center
            )
            IconButton(onClick = onIncrement, modifier = Modifier.height(30.dp).width(30.dp)) {
                Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.height(16.dp))
            }
        } else if (canAdd) {
            Icon(Icons.Default.Add, contentDescription = null, tint = Color(0xFF80CBC4), modifier = Modifier.height(18.dp))
        }
    }
}

private fun groupSubtitle(group: ModifierGroupModel): String {
    val pick = if (group.limitQuantity <= 1) "Choose 1" else "Up to ${group.limitQuantity}"
    val req = if (group.required) " ? Required" else ""
    return pick + req
}

private fun addonGroupSubtitle(group: AddonGroupModel): String {
    val pick = if (group.limitQuantity <= 1) "Choose 1" else "Up to ${group.limitQuantity}"
    val req = if (group.required) " ? Required" else ""
    return pick + req + " ? Paid extras"
}

private fun validateSelections(
    state: ProductCustomizeState,
    singleModifier: Map<Long, Long>,
    modifierQty: Map<Long, Int>,
    addonQty: Map<Long, Int>
): String? {
    state.modifierGroups.forEach { group ->
        val count = if (group.isSingleSelect) {
            if (singleModifier[group.id] != null) 1 else 0
        } else {
            group.options.sumOf { modifierQty[it.id] ?: 0 }
        }
        if (group.required && count == 0) return "Please choose ${group.name}"
        if (count > group.limitQuantity) return "Too many selections for ${group.name}"
    }
    state.addonGroups.forEach { group ->
        val count = group.options.sumOf { addonQty[it.id] ?: 0 }
        if (group.required && count == 0) return "Please choose ${group.name}"
        if (count > group.limitQuantity) return "Too many add-ons for ${group.name}"
    }
    return null
}

private fun buildModifiers(
    groups: List<ModifierGroupModel>,
    singleModifier: Map<Long, Long>,
    modifierQty: Map<Long, Int>
): List<SelectedModifier> {
    val result = mutableListOf<SelectedModifier>()
    groups.forEach { group ->
        if (group.isSingleSelect) {
            val optionId = singleModifier[group.id] ?: return@forEach
            val name = group.options.find { it.id == optionId }?.name ?: return@forEach
            result.add(SelectedModifier(name, 1))
        } else {
            group.options.forEach { opt ->
                val q = modifierQty[opt.id] ?: 0
                if (q > 0) result.add(SelectedModifier(opt.name, q))
            }
        }
    }
    return result
}

private fun buildAddons(
    groups: List<AddonGroupModel>,
    addonQty: Map<Long, Int>
): List<SelectedAddon> {
    val result = mutableListOf<SelectedAddon>()
    groups.forEach { group ->
        group.options.forEach { opt ->
            val q = addonQty[opt.id] ?: 0
            if (q > 0) result.add(SelectedAddon(opt.name, opt.price, q))
        }
    }
    return result
}
