package com.chaslay.pos.ui.pos

import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import com.chaslay.pos.domain.model.UnifiedExtraGroup
import com.chaslay.pos.domain.model.hasCustomizableOptions
import com.chaslay.pos.domain.model.mergeProductExtraGroups
import com.chaslay.pos.domain.model.ProductCustomizeState
import com.chaslay.pos.domain.model.ProductVariantModel
import com.chaslay.pos.domain.model.hasSizeChoice
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
        )
    }
    var itemQty by remember(editKey) { mutableIntStateOf(state.initialQuantity.coerceAtLeast(1)) }
    var userNotes by remember(editKey) { mutableStateOf(state.initialNotes.orEmpty()) }
    var showNotes by remember(editKey) { mutableStateOf(!state.initialNotes.isNullOrBlank()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
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
    val modifierQty = remember(editKey) {
        mutableStateMapOf<Long, Int>().apply {
            state.modifierGroups.filter { !it.isSingleSelect }.forEach { group ->
                group.options.forEach { opt ->
                    state.initialModifiers.find { it.name == opt.name }?.let { put(opt.id, it.quantity) }
                }
            }
            if (state.editingItemId == null) {
                state.modifierGroups.filter { it.isSingleSelect }.forEach { group ->
                    if (singleModifier[group.id] == null) {
                        group.options.firstOrNull { it.isDefault && it.inStock }?.let { opt ->
                            singleModifier[group.id] = opt.id
                            put(opt.id, 1)
                        }
                    }
                }
                state.modifierGroups.filter { !it.isSingleSelect }.forEach { group ->
                    group.options.filter { it.isDefault && it.inStock }.forEach { opt ->
                        if (!containsKey(opt.id)) put(opt.id, 1)
                    }
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
            if (state.editingItemId == null) {
                state.addonGroups.forEach { group ->
                    group.options.filter { it.isDefault && it.inStock }.forEach { opt ->
                        if (!containsKey(opt.id)) put(opt.id, 1)
                    }
                }
            }
        }
    }
    val isEditing = state.editingItemId != null

    val msgChooseOptionFor = stringResource(R.string.customize_choose_option_for)
    val msgChooseSpecification = stringResource(R.string.customize_choose_specification)
    val msgTooManyModifiers = stringResource(R.string.customize_too_many_modifiers)
    val msgTooManyAddons = stringResource(R.string.customize_too_many_addons)

    val unitBase = selectedVariant?.price ?: basePrice
    val addonTotal = state.addonGroups.sumOf { group ->
        group.options.sumOf { opt -> (addonQty[opt.id] ?: 0) * opt.price }
    }
    val lineTotal = (unitBase + addonTotal) * itemQty
    val customizeGroupCount = state.addonGroups.size + state.modifierGroups.size
    val onlyOneExtraToChoose = customizeGroupCount == 1 && run {
        state.addonGroups.singleOrNull()?.options?.count { it.inStock } == 1 ||
            state.modifierGroups.singleOrNull()?.options?.count { it.inStock } == 1
    }

    fun toggleSingleModifier(group: ModifierGroupModel, optionId: Long) {
        applySingleModifierToggle(group, optionId, singleModifier, modifierQty)
    }

    fun confirmCustomize() {
        val validation = validateSelections(
            state = state,
            singleModifier = singleModifier,
            modifierQty = modifierQty,
            addonQty = addonQty,
            hasVariants = product.hasSizeChoice(),
            selectedVariant = selectedVariant,
            chooseOptionFor = msgChooseOptionFor,
            chooseSpecification = msgChooseSpecification,
            tooManyModifiers = msgTooManyModifiers,
            tooManyAddons = msgTooManyAddons
        )
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

    val mergedExtraGroups = remember(editKey, state.addonGroups, state.modifierGroups) {
        mergeProductExtraGroups(state.modifierGroups, state.addonGroups)
            .filter { it.hasCustomizableOptions() }
    }

    val includedLabel = stringResource(R.string.included)
    val selectionSummary = remember(
        selectedVariant,
        singleModifier,
        modifierQty,
        addonQty,
        state.modifierGroups,
        state.addonGroups,
    ) {
        buildSelectionSummary(
            state.modifierGroups,
            state.addonGroups,
            singleModifier,
            modifierQty,
            addonQty,
            selectedVariant?.name,
        )
    }

    val ui = posUiColors()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f),
            color = ui.surface,
            shape = PosShapes.Dialog,
            shadowElevation = 8.dp,
            tonalElevation = 0.dp,
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ui.surfaceSubtle)
                        .padding(horizontal = PosDimens.Space4, vertical = PosDimens.Space3),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            product.name,
                            color = ui.textPrimary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        if (selectionSummary.isNotBlank()) {
                            Text(
                                selectionSummary,
                                color = ui.textSecondary,
                                fontSize = 13.sp,
                                maxLines = 2,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            Icons.Default.Close,
                            contentDescription = stringResource(R.string.discard),
                            tint = ui.textSecondary,
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        if (product.hasSizeChoice()) {
                            CustomizeGroupSection(
                                groupLabel = stringResource(R.string.size),
                                required = true,
                            ) {
                                product.variants.forEach { variant ->
                                    val delta = variant.price - basePrice
                                    val selected = selectedVariant?.id == variant.id
                                    CustomizeOptionTile(
                                        label = variant.name,
                                        topLabel = formatExtraPriceLabel(delta, currencySymbol, includedLabel),
                                        selected = selected,
                                        modifier = Modifier.width(100.dp),
                                        onClick = {
                                            selectedVariant =
                                                if (selectedVariant?.id == variant.id) null else variant
                                        }
                                    )
                                }
                            }
                        }
                        mergedExtraGroups.forEach { unified ->
                            when (unified) {
                                is UnifiedExtraGroup.Addon -> {
                                    val group = unified.group
                                    CustomizeGroupSection(
                                        groupLabel = group.name,
                                        required = group.required,
                                    ) {
                                        group.options.filter { it.inStock }.forEach { option ->
                                            val qty = addonQty[option.id] ?: 0
                                            CustomizeOptionTile(
                                                label = option.name,
                                                topLabel = formatExtraPriceLabel(
                                                    option.price,
                                                    currencySymbol,
                                                    includedLabel
                                                ),
                                                selected = qty > 0,
                                                modifier = Modifier.width(100.dp),
                                                onClick = {
                                                    if (group.limitQuantity <= 1) {
                                                        applySingleAddonToggle(group, option.id, addonQty)
                                                        maybeAutoReturn()
                                                        return@CustomizeOptionTile
                                                    }
                                                    val current = addonQty[option.id] ?: 0
                                                    if (current > 0) {
                                                        addonQty.remove(option.id)
                                                        maybeAutoReturn()
                                                        return@CustomizeOptionTile
                                                    }
                                                    val total = group.options.sumOf { addonQty[it.id] ?: 0 }
                                                    if (total < group.limitQuantity) {
                                                        addonQty[option.id] = 1
                                                        maybeAutoReturn()
                                                    }
                                                }
                                            )
                                        }
                                    }
                                }
                                is UnifiedExtraGroup.Modifier -> {
                                    val group = unified.group
                                    CustomizeGroupSection(
                                        groupLabel = group.name,
                                        required = group.required,
                                    ) {
                                        group.options.filter { it.inStock }.forEach { option ->
                                            val qty = modifierQty[option.id] ?: 0
                                            val selected = if (group.isSingleSelect) {
                                                singleModifier[group.id] == option.id
                                            } else {
                                                qty > 0
                                            }
                                            CustomizeOptionTile(
                                                label = option.name,
                                                topLabel = includedLabel,
                                                selected = selected,
                                                modifier = Modifier.width(100.dp),
                                                onClick = {
                                                    if (group.isSingleSelect) {
                                                        toggleSingleModifier(group, option.id)
                                                        maybeAutoReturn()
                                                    } else {
                                                        if (qty > 0) {
                                                            modifierQty.remove(option.id)
                                                        } else {
                                                            val total =
                                                                group.options.sumOf { modifierQty[it.id] ?: 0 }
                                                            if (total < group.limitQuantity) {
                                                                modifierQty[option.id] = 1
                                                            }
                                                        }
                                                        maybeAutoReturn()
                                                    }
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(ui.surfaceSubtle)
                        .border(1.dp, ui.border)
                ) {
                    errorMessage?.let { msg ->
                        Text(
                            msg,
                            color = PosColors.Danger,
                            fontSize = 12.sp,
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(ui.dangerSubtle)
                                .padding(horizontal = PosDimens.Space4, vertical = PosDimens.Space2)
                        )
                    }

                    if (showNotes) {
                        OutlinedTextField(
                            value = userNotes,
                            onValueChange = { userNotes = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            minLines = 2,
                            placeholder = { Text(stringResource(R.string.item_notes)) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = PosColors.Primary,
                                unfocusedBorderColor = ui.border,
                            )
                        )
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .border(1.dp, ui.border, PosShapes.Medium)
                                .clip(PosShapes.Medium)
                                .background(ui.surface)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(PosDimens.ControlHeightMd)
                                    .clickable(enabled = itemQty > 1) { if (itemQty > 1) itemQty-- },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Remove,
                                    contentDescription = null,
                                    tint = if (itemQty > 1) ui.textPrimary else ui.border,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Text(
                                itemQty.toString(),
                                color = ui.textPrimary,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                modifier = Modifier.width(40.dp),
                                textAlign = TextAlign.Center
                            )
                            Box(
                                modifier = Modifier
                                    .size(PosDimens.ControlHeightMd)
                                    .clickable { itemQty++ },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Add,
                                    contentDescription = null,
                                    tint = ui.textPrimary,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }

                        TextButton(
                            onClick = { showNotes = !showNotes },
                            colors = ButtonDefaults.textButtonColors(
                                contentColor = if (showNotes || userNotes.isNotBlank()) {
                                    PosColors.Primary
                                } else {
                                    ui.textPrimary
                                }
                            ),
                            modifier = Modifier
                                .border(
                                    1.dp,
                                    if (showNotes || userNotes.isNotBlank()) PosColors.Primary else ui.border,
                                    PosShapes.Medium
                                )
                                .background(
                                    if (showNotes || userNotes.isNotBlank()) ui.primarySubtle else ui.surface,
                                    PosShapes.Medium
                                )
                        ) {
                            Icon(
                                Icons.Outlined.ChatBubbleOutline,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                if (userNotes.isBlank()) {
                                    stringResource(R.string.add_note)
                                } else {
                                    stringResource(R.string.edit_notes)
                                },
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                        }
                    }

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                    ) {
                        Button(
                            onClick = { confirmCustomize() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(PosDimens.ControlHeightMd),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PosColors.Primary,
                                contentColor = PosColors.TextOnPrimary,
                            ),
                            shape = PosShapes.Medium
                        ) {
                            Icon(
                                Icons.Default.Check,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                if (isEditing) {
                                    stringResource(
                                        R.string.customize_save_with_total,
                                        "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}"
                                    )
                                } else {
                                    stringResource(
                                        R.string.customize_add_with_total,
                                        "$currencySymbol ${"%.2f".format(Locale.getDefault(), lineTotal)}"
                                    )
                                },
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CustomizeGroupSection(
    groupLabel: String,
    required: Boolean,
    content: @Composable () -> Unit,
) {
    val ui = posUiColors()
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    groupLabel,
                    color = ui.textPrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp,
                )
                if (required) {
                    Text(
                        "*",
                        color = PosColors.Danger,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        modifier = Modifier.padding(start = 2.dp),
                    )
                }
            }
            if (required) {
                Text(
                    stringResource(R.string.required),
                    color = PosColors.Primary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            content()
        }
    }
}

@Composable
private fun CustomizeOptionTile(
    label: String,
    topLabel: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    Box(
        modifier = modifier
            .heightIn(min = 64.dp)
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = if (selected) PosColors.Primary else ui.border,
                shape = PosShapes.Small,
            )
            .background(
                if (selected) ui.surfaceSelected else ui.surface,
                PosShapes.Small,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 5.dp),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.Center)
                .padding(end = if (selected) 14.dp else 0.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                topLabel,
                color = if (selected) PosColors.Primary else ui.textMuted,
                fontSize = 9.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                textAlign = TextAlign.Center,
            )
            Text(
                label,
                color = ui.textPrimary,
                fontSize = 12.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                textAlign = TextAlign.Center,
                maxLines = 2,
                lineHeight = 14.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        if (selected) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(PosColors.Primary),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Check,
                    contentDescription = null,
                    tint = PosColors.TextOnPrimary,
                    modifier = Modifier.size(11.dp),
                )
            }
        }
    }
}

private fun formatExtraPriceLabel(delta: Double, currencySymbol: String, includedLabel: String): String {
    if (delta <= 0.0001) return includedLabel
    return "+$currencySymbol ${"%.2f".format(Locale.getDefault(), delta)}"
}

private fun buildSelectionSummary(
    modifierGroups: List<ModifierGroupModel>,
    addonGroups: List<AddonGroupModel>,
    singleModifier: Map<Long, Long>,
    modifierQty: Map<Long, Int>,
    addonQty: Map<Long, Int>,
    selectedVariantName: String? = null,
): String {
    val names = mutableListOf<String>()
    selectedVariantName?.takeIf { it.isNotBlank() }?.let { names.add(it) }
    modifierGroups.forEach { group ->
        if (group.isSingleSelect) {
            singleModifier[group.id]?.let { optId ->
                group.options.find { it.id == optId }?.name?.let { names.add(it) }
            }
        } else {
            group.options.forEach { opt ->
                val q = modifierQty[opt.id] ?: 0
                if (q > 0) {
                    repeat(q) { names.add(opt.name) }
                }
            }
        }
    }
    addonGroups.forEach { group ->
        group.options.forEach { opt ->
            val q = addonQty[opt.id] ?: 0
            if (q > 0) {
                repeat(q) { names.add(opt.name) }
            }
        }
    }
    return names.joinToString(" / ")
}

internal fun applySingleModifierToggle(
    group: ModifierGroupModel,
    optionId: Long,
    singleModifier: MutableMap<Long, Long>,
    modifierQty: MutableMap<Long, Int>,
) {
    if (!group.isSingleSelect) return
    if (singleModifier[group.id] == optionId) {
        singleModifier.remove(group.id)
        group.options.forEach { modifierQty.remove(it.id) }
    } else {
        singleModifier[group.id] = optionId
        group.options.forEach { modifierQty.remove(it.id) }
        modifierQty[optionId] = 1
    }
}

internal fun applySingleAddonToggle(
    group: AddonGroupModel,
    optionId: Long,
    addonQty: MutableMap<Long, Int>,
): Boolean {
    if (group.limitQuantity > 1) return false
    val current = addonQty[optionId] ?: 0
    if (current > 0) {
        addonQty.remove(optionId)
        return true
    }
    group.options.forEach { addonQty.remove(it.id) }
    addonQty[optionId] = 1
    return true
}

internal fun validateSelections(
    state: ProductCustomizeState,
    singleModifier: Map<Long, Long>,
    modifierQty: Map<Long, Int>,
    addonQty: Map<Long, Int>,
    hasVariants: Boolean,
    selectedVariant: ProductVariantModel?,
    chooseOptionFor: String,
    chooseSpecification: String,
    tooManyModifiers: String,
    tooManyAddons: String
): String? {
    if (hasVariants && selectedVariant == null) return chooseSpecification
    state.modifierGroups.forEach { group ->
        val count = if (group.isSingleSelect) {
            if (singleModifier[group.id] != null) 1 else 0
        } else {
            group.options.sumOf { modifierQty[it.id] ?: 0 }
        }
        if (group.required && count == 0) return chooseOptionFor.format(group.name)
        if (count > group.limitQuantity) return tooManyModifiers.format(group.name)
    }
    state.addonGroups.forEach { group ->
        val count = group.options.sumOf { addonQty[it.id] ?: 0 }
        if (group.required && count == 0) return chooseOptionFor.format(group.name)
        if (count > group.limitQuantity) return tooManyAddons.format(group.name)
    }
    return null
}

internal fun buildModifiers(
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

internal fun buildAddons(
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

/** Unified extra groups (shared by combo-level extras). */
@Composable
internal fun ProductExtraGroupsInlineEditor(
    modifierGroups: List<ModifierGroupModel>,
    addonGroups: List<AddonGroupModel>,
    currencySymbol: String,
    singleModifier: androidx.compose.runtime.snapshots.SnapshotStateMap<Long, Long>,
    modifierQty: androidx.compose.runtime.snapshots.SnapshotStateMap<Long, Int>,
    addonQty: androidx.compose.runtime.snapshots.SnapshotStateMap<Long, Int>,
    onSelectionChanged: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val extraGroups = remember(modifierGroups, addonGroups) {
        mergeProductExtraGroups(modifierGroups, addonGroups)
            .filter { it.hasCustomizableOptions() }
    }
    if (extraGroups.isEmpty()) return

    val ui = posUiColors()
    val includedLabel = stringResource(R.string.included)

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = ui.surface,
        shape = PosShapes.Card,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
        border = BorderStroke(1.dp, ui.border)
    ) {
        Column(
            modifier = Modifier.padding(PosDimens.Space3),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            extraGroups.forEach { unified ->
                when (unified) {
                    is UnifiedExtraGroup.Addon -> {
                        val group = unified.group
                        CustomizeGroupSection(
                            groupLabel = group.name,
                            required = group.required,
                        ) {
                            group.options.filter { it.inStock }.forEach { option ->
                                val qty = addonQty[option.id] ?: 0
                                CustomizeOptionTile(
                                    label = option.name,
                                    topLabel = formatExtraPriceLabel(
                                        option.price,
                                        currencySymbol,
                                        includedLabel
                                    ),
                                    selected = qty > 0,
                                    modifier = Modifier.width(100.dp),
                                    onClick = {
                                        if (group.limitQuantity <= 1) {
                                            applySingleAddonToggle(group, option.id, addonQty)
                                            onSelectionChanged()
                                            return@CustomizeOptionTile
                                        }
                                        val current = addonQty[option.id] ?: 0
                                        if (current > 0) {
                                            addonQty.remove(option.id)
                                            onSelectionChanged()
                                            return@CustomizeOptionTile
                                        }
                                        val total = group.options.sumOf { addonQty[it.id] ?: 0 }
                                        if (total < group.limitQuantity) {
                                            addonQty[option.id] = 1
                                            onSelectionChanged()
                                        }
                                    }
                                )
                            }
                        }
                    }
                    is UnifiedExtraGroup.Modifier -> {
                        val group = unified.group
                        CustomizeGroupSection(
                            groupLabel = group.name,
                            required = group.required,
                        ) {
                            group.options.filter { it.inStock }.forEach { option ->
                                val qty = modifierQty[option.id] ?: 0
                                val selected = if (group.isSingleSelect) {
                                    singleModifier[group.id] == option.id
                                } else {
                                    qty > 0
                                }
                                CustomizeOptionTile(
                                    label = option.name,
                                    topLabel = includedLabel,
                                    selected = selected,
                                    modifier = Modifier.width(100.dp),
                                    onClick = {
                                        if (group.isSingleSelect) {
                                            applySingleModifierToggle(
                                                group,
                                                option.id,
                                                singleModifier,
                                                modifierQty
                                            )
                                        } else if (qty > 0) {
                                            modifierQty.remove(option.id)
                                        } else {
                                            val total = group.options.sumOf { modifierQty[it.id] ?: 0 }
                                            if (total < group.limitQuantity) {
                                                modifierQty[option.id] = 1
                                            }
                                        }
                                        onSelectionChanged()
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
