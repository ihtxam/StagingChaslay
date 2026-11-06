package com.chaslay.pos.ui.menu

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.posUiColors
import java.util.Locale

private enum class ExtrasListFilter { ALL, FREE, PAID, REQUIRED, OPTIONAL }

private sealed interface ExtraGroupListEntry {
    val sortName: String
    val required: Boolean
    val isActive: Boolean
    val isPaid: Boolean
    val limitQuantity: Int

    data class Modifier(val group: ModifierGroupEntity) : ExtraGroupListEntry {
        override val sortName: String get() = group.name
        override val required: Boolean get() = group.required
        override val isActive: Boolean get() = group.isActive
        override val isPaid: Boolean get() = false
        override val limitQuantity: Int get() = group.limitQuantity
    }

    data class Addon(val group: AddonGroupEntity, override val isPaid: Boolean) : ExtraGroupListEntry {
        override val sortName: String get() = group.name
        override val required: Boolean get() = group.required
        override val isActive: Boolean get() = group.isActive
        override val limitQuantity: Int get() = group.limitQuantity
    }
}

private val PaidPriceBadgeBg = Color(0xFFE0F2FE)
private val PaidPriceBadgeFg = Color(0xFF0369A1)
private val FreePriceBadgeBg = PosColors.PrimarySubtle

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ExtrasAndNosListSection(
    modifierGroups: List<ModifierGroupEntity>,
    addonGroups: List<AddonGroupEntity>,
    viewModel: MenuViewModel,
) {
    var showModifierEditor by remember { mutableStateOf(false) }
    var showAddonEditor by remember { mutableStateOf(false) }
    var editingModifier by remember { mutableStateOf<ModifierGroupEntity?>(null) }
    var editingAddon by remember { mutableStateOf<AddonGroupEntity?>(null) }
    var query by remember { mutableStateOf("") }
    var listFilter by remember { mutableStateOf(ExtrasListFilter.ALL) }
    var paidFlags by remember { mutableStateOf<Map<Long, Boolean>>(emptyMap()) }

    LaunchedEffect(addonGroups) {
        val flags = mutableMapOf<Long, Boolean>()
        addonGroups.forEach { group ->
            if (group.id > 0) {
                val detail = viewModel.loadAddonGroup(group.id)
                val paid = detail?.options?.any { it.price > 0.001 } == true
                flags[group.id] = paid
            }
        }
        paidFlags = flags
    }

    val entries = remember(modifierGroups, addonGroups, query, listFilter, paidFlags) {
        val combined = modifierGroups.map { ExtraGroupListEntry.Modifier(it) } +
            addonGroups.map { group ->
                ExtraGroupListEntry.Addon(group, paidFlags[group.id] == true)
            }
        combined
            .filter { query.isBlank() || it.sortName.contains(query, ignoreCase = true) }
            .filter { entry ->
                when (listFilter) {
                    ExtrasListFilter.ALL -> true
                    ExtrasListFilter.FREE -> !entry.isPaid
                    ExtrasListFilter.PAID -> entry.isPaid
                    ExtrasListFilter.REQUIRED -> entry.required
                    ExtrasListFilter.OPTIONAL -> !entry.required
                }
            }
            .sortedBy { it.sortName.lowercase(Locale.getDefault()) }
    }

    val filterCounts = remember(modifierGroups, addonGroups, paidFlags) {
        val all = modifierGroups.size + addonGroups.size
        ExtrasListFilter.entries.associateWith { filter ->
            when (filter) {
                ExtrasListFilter.ALL -> all
                ExtrasListFilter.FREE -> modifierGroups.size +
                    addonGroups.count { paidFlags[it.id] != true }
                ExtrasListFilter.PAID -> addonGroups.count { paidFlags[it.id] == true }
                ExtrasListFilter.REQUIRED ->
                    modifierGroups.count { it.required } + addonGroups.count { it.required }
                ExtrasListFilter.OPTIONAL ->
                    modifierGroups.count { !it.required } + addonGroups.count { !it.required }
            }
        }
    }

    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = PosDimens.PagePaddingCompact, vertical = PosDimens.Space3),
    ) {
        val compact = maxWidth < 720.dp
        val colors = posUiColors()
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            MenuListHeader(
                title = stringResource(R.string.pos_extras_and_nos),
                hint = stringResource(R.string.extras_nos_page_hint),
                addLabel = stringResource(R.string.add_new_group),
                onAdd = {
                    editingModifier = null
                    showModifierEditor = true
                },
            )
            MenuSearchField(
                query = query,
                onQueryChange = { query = it },
                placeholder = stringResource(R.string.menu_search_modifier_groups_placeholder),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ExtrasListFilter.entries.forEach { filter ->
                    val count = filterCounts[filter] ?: 0
                    val selected = listFilter == filter
                    FilterChip(
                        selected = selected,
                        onClick = { listFilter = filter },
                        label = {
                            Text(
                                "${extrasFilterLabel(filter)} ($count)",
                                fontSize = 12.sp,
                                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                            )
                        },
                        shape = PosShapes.Pill,
                        border = FilterChipDefaults.filterChipBorder(
                            enabled = true,
                            selected = selected,
                            borderColor = if (selected) Color.Transparent else colors.border,
                        ),
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MenuTeal,
                            selectedLabelColor = Color.White,
                            containerColor = colors.surface,
                            labelColor = colors.textPrimary,
                        ),
                    )
                }
            }

            if (entries.isEmpty()) {
                MenuEmptyState(
                    title = stringResource(R.string.menu_no_groups_yet),
                    hint = stringResource(R.string.extras_nos_page_hint),
                    onAdd = {
                        editingModifier = null
                        showModifierEditor = true
                    },
                )
            } else if (compact) {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    itemsIndexed(
                        items = entries,
                        key = { _, entry ->
                            when (entry) {
                                is ExtraGroupListEntry.Modifier -> "m-${entry.group.id}"
                                is ExtraGroupListEntry.Addon -> "a-${entry.group.id}"
                            }
                        },
                    ) { _, entry ->
                        ExtrasGroupCardRow(
                            entry = entry,
                            viewModel = viewModel,
                            onEdit = {
                                when (entry) {
                                    is ExtraGroupListEntry.Modifier -> {
                                        editingModifier = entry.group
                                        showModifierEditor = true
                                    }
                                    is ExtraGroupListEntry.Addon -> {
                                        editingAddon = entry.group
                                        showAddonEditor = true
                                    }
                                }
                            },
                        )
                    }
                }
            } else {
                Surface(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    shape = PosShapes.Large,
                    color = colors.surface,
                    border = BorderStroke(1.dp, colors.border),
                ) {
                    LazyColumn(modifier = Modifier.fillMaxWidth()) {
                        item { ExtrasTableHeaderRow() }
                        itemsIndexed(
                            items = entries,
                            key = { _, entry ->
                                when (entry) {
                                    is ExtraGroupListEntry.Modifier -> "m-${entry.group.id}"
                                    is ExtraGroupListEntry.Addon -> "a-${entry.group.id}"
                                }
                            },
                        ) { index, entry ->
                            ExtrasGroupTableRow(
                                entry = entry,
                                viewModel = viewModel,
                                onEdit = {
                                    when (entry) {
                                        is ExtraGroupListEntry.Modifier -> {
                                            editingModifier = entry.group
                                            showModifierEditor = true
                                        }
                                        is ExtraGroupListEntry.Addon -> {
                                            editingAddon = entry.group
                                            showAddonEditor = true
                                        }
                                    }
                                },
                            )
                            if (index < entries.lastIndex) {
                                HorizontalDivider(
                                    thickness = 1.dp,
                                    color = colors.border.copy(alpha = 0.75f),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showModifierEditor) {
        ModifierEditorDialog(
            group = editingModifier,
            viewModel = viewModel,
            onDismiss = { showModifierEditor = false },
            onSaved = { showModifierEditor = false },
            presentation = MenuEditorPresentation.END_DRAWER,
        )
    }
    if (showAddonEditor) {
        AddonEditorDialog(
            group = editingAddon,
            viewModel = viewModel,
            onDismiss = { showAddonEditor = false },
            onSaved = { showAddonEditor = false },
            presentation = MenuEditorPresentation.END_DRAWER,
        )
    }
}

@Composable
private fun extrasFilterLabel(filter: ExtrasListFilter): String = when (filter) {
    ExtrasListFilter.ALL -> stringResource(R.string.extras_filter_all)
    ExtrasListFilter.FREE -> stringResource(R.string.extras_filter_free)
    ExtrasListFilter.PAID -> stringResource(R.string.extras_filter_paid)
    ExtrasListFilter.REQUIRED -> stringResource(R.string.extras_filter_required)
    ExtrasListFilter.OPTIONAL -> stringResource(R.string.extras_filter_optional)
}

@Composable
private fun ExtrasTableHeaderRow() {
    val colors = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surfaceSubtle)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_group), 2f)
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_price), 0.9f)
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_rule), 1.15f)
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_options), 0.65f)
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_products), 0.75f)
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_status), 0.85f)
        ExtrasTableHeaderCell(stringResource(R.string.extras_col_actions), 0.75f)
    }
}

@Composable
private fun RowScope.ExtrasTableHeaderCell(text: String, weight: Float) {
    Text(
        text,
        modifier = Modifier.weight(weight),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = posUiColors().textMuted,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun ExtrasGroupTableRow(
    entry: ExtraGroupListEntry,
    viewModel: MenuViewModel,
    onEdit: () -> Unit,
) {
    var optionCount by remember { mutableStateOf(0) }
    var linkedCount by remember { mutableStateOf(0) }
    var optionPreview by remember { mutableStateOf("") }
    var priceLabel by remember { mutableStateOf<String?>(null) }
    val currencyChf = stringResource(R.string.currency_chf)

    LaunchedEffect(entry, currencyChf) {
        when (entry) {
            is ExtraGroupListEntry.Modifier -> {
                val detail = viewModel.loadModifierGroup(entry.group.id)
                optionCount = detail?.options?.size ?: 0
                linkedCount = detail?.linkedProductIds?.size ?: 0
                optionPreview = detail?.options?.take(3)?.joinToString(" • ") { it.name }.orEmpty()
                priceLabel = null
            }
            is ExtraGroupListEntry.Addon -> {
                val detail = viewModel.loadAddonGroup(entry.group.id)
                optionCount = detail?.options?.size ?: 0
                linkedCount = detail?.linkedProductIds?.size ?: 0
                optionPreview = detail?.options?.take(3)?.joinToString(" • ") { it.name }.orEmpty()
                val maxPrice = detail?.options?.maxOfOrNull { it.price } ?: 0.0
                priceLabel = if (maxPrice > 0.001) {
                    String.format(Locale.getDefault(), "%s %.2f", currencyChf, maxPrice)
                } else {
                    null
                }
            }
        }
    }

    val colors = posUiColors()
    val minSel = if (entry.required) 1 else 0
    val maxSel = entry.limitQuantity.coerceAtLeast(minSel)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surface)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(2f)) {
            Text(
                entry.sortName,
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = colors.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (optionPreview.isNotBlank()) {
                Text(
                    optionPreview,
                    fontSize = 11.sp,
                    color = colors.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Box(
            modifier = Modifier.weight(0.9f),
            contentAlignment = Alignment.CenterStart,
        ) {
            ExtrasPriceBadge(priceLabel)
        }
        Column(modifier = Modifier.weight(1.15f)) {
            ExtrasSelectionRuleChip(entry.required)
            Text(
                stringResource(R.string.extras_rule_min_max, minSel, maxSel),
                fontSize = 10.sp,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Text(
            optionCount.toString(),
            modifier = Modifier.weight(0.65f),
            fontSize = 13.sp,
            color = colors.textPrimary,
        )
        Text(
            linkedCount.toString(),
            modifier = Modifier.weight(0.75f),
            fontSize = 13.sp,
            color = colors.textPrimary,
        )
        Row(
            modifier = Modifier.weight(0.85f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(if (entry.isActive) PosColors.Success else PosColors.Warning),
            )
            Text(
                if (entry.isActive) {
                    stringResource(R.string.extras_status_active)
                } else {
                    stringResource(R.string.user_status_inactive)
                },
                fontSize = 11.sp,
                color = colors.textPrimary,
            )
        }
        OutlinedButton(
            onClick = onEdit,
            modifier = Modifier.weight(0.75f),
            shape = PosShapes.Small,
            border = BorderStroke(1.dp, colors.border),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.textPrimary),
        ) {
            Icon(
                Icons.Outlined.Edit,
                contentDescription = null,
                modifier = Modifier.size(16.dp),
            )
            Text(
                stringResource(R.string.edit),
                fontSize = 12.sp,
                modifier = Modifier.padding(start = 4.dp),
            )
        }
    }
}

@Composable
private fun ExtrasGroupCardRow(
    entry: ExtraGroupListEntry,
    viewModel: MenuViewModel,
    onEdit: () -> Unit,
) {
    var optionCount by remember { mutableStateOf(0) }
    var linkedCount by remember { mutableStateOf(0) }
    var optionPreview by remember { mutableStateOf("") }
    var priceLabel by remember { mutableStateOf<String?>(null) }
    val currencyChf = stringResource(R.string.currency_chf)

    LaunchedEffect(entry, currencyChf) {
        when (entry) {
            is ExtraGroupListEntry.Modifier -> {
                val detail = viewModel.loadModifierGroup(entry.group.id)
                optionCount = detail?.options?.size ?: 0
                linkedCount = detail?.linkedProductIds?.size ?: 0
                optionPreview = detail?.options?.take(4)?.joinToString(" • ") { it.name }.orEmpty()
                priceLabel = null
            }
            is ExtraGroupListEntry.Addon -> {
                val detail = viewModel.loadAddonGroup(entry.group.id)
                optionCount = detail?.options?.size ?: 0
                linkedCount = detail?.linkedProductIds?.size ?: 0
                optionPreview = detail?.options?.take(4)?.joinToString(" • ") { it.name }.orEmpty()
                val maxPrice = detail?.options?.maxOfOrNull { it.price } ?: 0.0
                priceLabel = if (maxPrice > 0.001) {
                    String.format(Locale.getDefault(), "%s %.2f", currencyChf, maxPrice)
                } else {
                    null
                }
            }
        }
    }

    val colors = posUiColors()
    val minSel = if (entry.required) 1 else 0
    val maxSel = entry.limitQuantity.coerceAtLeast(minSel)

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = PosShapes.Large,
        color = colors.surface,
        border = BorderStroke(1.dp, colors.border),
        tonalElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                    Text(
                        entry.sortName,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp,
                        color = colors.textPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (optionPreview.isNotBlank()) {
                        Text(
                            optionPreview,
                            fontSize = 12.sp,
                            color = colors.textMuted,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                }
                ExtrasPriceBadge(priceLabel)
            }
            FlowRowCompat(horizontal = 8.dp, vertical = 8.dp) {
                ExtrasSelectionRuleChip(entry.required)
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(if (entry.isActive) PosColors.Success else PosColors.Warning),
                    )
                    Text(
                        if (entry.isActive) {
                            stringResource(R.string.extras_status_active)
                        } else {
                            stringResource(R.string.user_status_inactive)
                        },
                        fontSize = 12.sp,
                        color = colors.textPrimary,
                    )
                }
            }
            Text(
                stringResource(R.string.extras_rule_min_max, minSel, maxSel),
                fontSize = 11.sp,
                color = colors.textSecondary,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(
                        R.string.extras_card_counts_line,
                        optionCount,
                        linkedCount,
                    ),
                    fontSize = 12.sp,
                    color = colors.textSecondary,
                )
                OutlinedButton(
                    onClick = onEdit,
                    shape = PosShapes.Small,
                    border = BorderStroke(1.dp, colors.border),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = MenuTeal),
                ) {
                    Text(stringResource(R.string.edit), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FlowRowCompat(
    horizontal: androidx.compose.ui.unit.Dp,
    vertical: androidx.compose.ui.unit.Dp,
    content: @Composable () -> Unit,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(horizontal),
        verticalArrangement = Arrangement.spacedBy(vertical),
    ) {
        content()
    }
}

@Composable
private fun ExtrasPriceBadge(priceLabel: String?) {
    val isFree = priceLabel == null
    val label = priceLabel ?: stringResource(R.string.extras_price_free)
    Text(
        label,
        modifier = Modifier
            .clip(PosShapes.Pill)
            .background(if (isFree) FreePriceBadgeBg else PaidPriceBadgeBg)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        color = if (isFree) MenuTeal else PaidPriceBadgeFg,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun ExtrasSelectionRuleChip(required: Boolean) {
    val colors = posUiColors()
    val label = if (required) {
        stringResource(R.string.required_option)
    } else {
        stringResource(R.string.optional_option)
    }
    Text(
        label,
        modifier = Modifier
            .clip(PosShapes.Small)
            .background(colors.surfaceMuted)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        color = colors.textPrimary,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}
