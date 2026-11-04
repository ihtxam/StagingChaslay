package com.chaslay.pos.ui.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import com.chaslay.pos.ui.theme.posUiColors
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import java.util.Locale

private enum class ExtrasListFilter { ALL, FREE, PAID, REQUIRED, OPTIONAL }

private sealed interface ExtraGroupListEntry {
    val sortName: String
    val required: Boolean
    val isActive: Boolean
    val isPaid: Boolean

    data class Modifier(val group: ModifierGroupEntity) : ExtraGroupListEntry {
        override val sortName: String get() = group.name
        override val required: Boolean get() = group.required
        override val isActive: Boolean get() = group.isActive
        override val isPaid: Boolean get() = false
    }

    data class Addon(val group: AddonGroupEntity, override val isPaid: Boolean) : ExtraGroupListEntry {
        override val sortName: String get() = group.name
        override val required: Boolean get() = group.required
        override val isActive: Boolean get() = group.isActive
    }
}

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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
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
            placeholder = stringResource(R.string.menu_search_groups),
        )
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
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            val chipColors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = MenuTeal,
                selectedLabelColor = Color.White,
            )
            ExtrasListFilter.entries.forEach { filter ->
                val count = filterCounts[filter] ?: 0
                FilterChip(
                    selected = listFilter == filter,
                    onClick = { listFilter = filter },
                    label = {
                        Text(
                            "${extrasFilterLabel(filter)} ($count)",
                            fontSize = 12.sp,
                        )
                    },
                    colors = chipColors,
                )
            }
        }

        ExtrasTableHeaderRow()

        if (entries.isEmpty()) {
            MenuEmptyState(
                title = stringResource(R.string.menu_no_groups_yet),
                hint = stringResource(R.string.extras_nos_page_hint),
                onAdd = {
                    editingModifier = null
                    showModifierEditor = true
                },
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                items(entries, key = {
                    when (it) {
                        is ExtraGroupListEntry.Modifier -> "m-${it.group.id}"
                        is ExtraGroupListEntry.Addon -> "a-${it.group.id}"
                    }
                }) { entry ->
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
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color(0xFFF8FAFA),
        shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_group), 2f)
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_price), 0.9f)
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_rule), 1.2f)
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_options), 0.7f)
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_products), 0.9f)
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_status), 0.8f)
            ExtrasTableHeaderCell(stringResource(R.string.extras_col_actions), 0.9f)
        }
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

    LaunchedEffect(entry) {
        when (entry) {
            is ExtraGroupListEntry.Modifier -> {
                val detail = viewModel.loadModifierGroup(entry.group.id)
                optionCount = detail?.options?.size ?: 0
                linkedCount = detail?.linkedProductIds?.size ?: 0
                optionPreview = detail?.options?.take(3)?.joinToString(" · ") { it.name }.orEmpty()
                priceLabel = null
            }
            is ExtraGroupListEntry.Addon -> {
                val detail = viewModel.loadAddonGroup(entry.group.id)
                optionCount = detail?.options?.size ?: 0
                linkedCount = detail?.linkedProductIds?.size ?: 0
                optionPreview = detail?.options?.take(3)?.joinToString(" · ") { it.name }.orEmpty()
                val maxPrice = detail?.options?.maxOfOrNull { it.price } ?: 0.0
                priceLabel = if (maxPrice > 0.001) {
                    String.format(Locale.getDefault(), "CHF %.2f", maxPrice)
                } else {
                    null
                }
            }
        }
    }

    val colors = posUiColors()
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = Color.White,
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(2f)) {
                Text(entry.sortName, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (optionPreview.isNotBlank()) {
                    Text(optionPreview, fontSize = 11.sp, color = colors.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Box(modifier = Modifier.weight(0.9f)) {
                val label = priceLabel ?: stringResource(R.string.extras_price_free)
                Text(
                    label,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (priceLabel == null) Color(0xFFE6F7F5) else Color(0xFFE0F2FE))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    color = if (priceLabel == null) MenuTeal else Color(0xFF0369A1),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            Column(modifier = Modifier.weight(1.2f)) {
                Text(
                    if (entry.required) stringResource(R.string.required_option) else stringResource(R.string.optional_option),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
            Text(
                optionCount.toString(),
                modifier = Modifier.weight(0.7f),
                fontSize = 13.sp,
            )
            Text(
                linkedCount.toString(),
                modifier = Modifier.weight(0.9f),
                fontSize = 13.sp,
            )
            Row(
                modifier = Modifier.weight(0.8f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (entry.isActive) Color(0xFF18A957) else Color(0xFFD99017)),
                )
                Text(
                    if (entry.isActive) stringResource(R.string.extras_status_active) else stringResource(R.string.user_status_inactive),
                    fontSize = 11.sp,
                )
            }
            OutlinedButton(
                onClick = onEdit,
                modifier = Modifier.weight(0.9f),
                shape = RoundedCornerShape(8.dp),
            ) {
                Text(stringResource(R.string.edit), fontSize = 12.sp)
            }
        }
    }
}
