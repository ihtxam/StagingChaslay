package com.chaslay.pos.ui.menu

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.repository.MenuRepository
import com.chaslay.pos.ui.theme.categoryColor
import kotlinx.coroutines.launch

private data class ComboSlotDraftUi(
    val name: String,
    val minPick: String,
    val maxPick: String,
    val selectedProductIds: MutableList<Long>
)

@Composable
fun CombosSection(
    combos: List<ProductEntity>,
    categories: List<CategoryEntity>,
    viewModel: MenuViewModel,
    onRefresh: suspend () -> Unit = {}
) {
    var showDialog by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ProductEntity?>(null) }
    var query by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    val filtered = combos.filter {
        query.isBlank() || it.name.contains(query, ignoreCase = true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        MenuListHeader(
            title = stringResource(R.string.combos),
            hint = stringResource(R.string.combos_hint),
            addLabel = stringResource(R.string.add_combo),
            onAdd = { editing = null; showDialog = true }
        )
        MenuSearchField(
            query = query,
            onQueryChange = { query = it },
            placeholder = stringResource(R.string.search_products)
        )
        if (filtered.isEmpty()) {
            MenuEmptyState(
                title = stringResource(R.string.menu_no_combos_yet),
                hint = stringResource(R.string.menu_no_combos_hint),
                onAdd = { editing = null; showDialog = true }
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(filtered, key = { it.id }) { combo ->
                    ComboListCard(
                        combo = combo,
                        categories = categories,
                        viewModel = viewModel,
                        onEdit = { editing = combo; showDialog = true },
                        onDelete = {
                            viewModel.deleteCombo(combo.id) {
                                scope.launch { onRefresh() }
                            }
                        }
                    )
                }
            }
        }
    }

    if (showDialog) {
        ComboEditDialog(
            combo = editing,
            categories = categories,
            viewModel = viewModel,
            onDismiss = { showDialog = false },
            onSaved = {
                scope.launch { onRefresh() }
                showDialog = false
            }
        )
    }
}

@Composable
private fun ComboListCard(
    combo: ProductEntity,
    categories: List<CategoryEntity>,
    viewModel: MenuViewModel,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var slotCount by remember { mutableStateOf(0) }
    var slotPreview by remember { mutableStateOf("") }

    LaunchedEffect(combo.id) {
        val meal = viewModel.loadComboMeal(combo.id)
        slotCount = meal?.slots?.size ?: 0
        slotPreview = meal?.slots?.joinToString(" · ") { it.name }.orEmpty()
    }

    val categoryName = categories.find { it.id == combo.categoryId }?.name
        ?: stringResource(R.string.category)
    val badges = buildList {
        add(categoryName)
        add(stringResource(R.string.combo_slots_badge, slotCount))
        add(stringResource(R.string.combo_price_format, combo.price))
    }
    val preview = slotPreview.ifBlank { stringResource(R.string.menu_no_options) }

    MenuGroupCard(
        title = combo.name,
        badges = badges,
        preview = preview,
        onEdit = onEdit,
        onDelete = onDelete
    )
}

@Composable
private fun ComboEditDialog(
    combo: ProductEntity?,
    categories: List<CategoryEntity>,
    viewModel: MenuViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    var name by remember(combo) { mutableStateOf(combo?.name ?: "") }
    var price by remember(combo) { mutableStateOf(combo?.price?.toString() ?: "") }
    var tax by remember(combo) { mutableStateOf(combo?.taxRate?.toString() ?: "2.6") }
    var selectedCategoryId by remember(combo) { mutableStateOf(combo?.categoryId ?: categories.firstOrNull()?.id) }
    val slots = remember(combo) { mutableStateListOf<ComboSlotDraftUi>() }
    var catalogProducts by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }
    var productQuery by remember { mutableStateOf("") }

    LaunchedEffect(combo?.id) {
        catalogProducts = viewModel.getCatalogProductsForCombos()
        slots.clear()
        if (combo != null && combo.id > 0) {
            val meal = viewModel.loadComboMeal(combo.id)
            meal?.slots?.forEach { slot ->
                slots.add(
                    ComboSlotDraftUi(
                        name = slot.name,
                        minPick = slot.minPick.toString(),
                        maxPick = slot.maxPick.toString(),
                        selectedProductIds = slot.options.map { it.productId }.toMutableList()
                    )
                )
            }
        }
        if (slots.isEmpty()) {
            slots.addAll(defaultComboSlots())
        }
    }

    MenuEditorDialog(
        title = if (combo == null) stringResource(R.string.add_combo) else stringResource(R.string.edit_combo),
        onDismiss = onDismiss,
        onSave = {
            val drafts = slots.mapNotNull { slot ->
                val slotName = slot.name.trim()
                if (slotName.isBlank()) return@mapNotNull null
                MenuRepository.ComboSlotDraft(
                    name = slotName,
                    minPick = slot.minPick.toIntOrNull()?.coerceAtLeast(0) ?: 0,
                    maxPick = slot.maxPick.toIntOrNull()?.coerceAtLeast(1) ?: 1,
                    productIds = slot.selectedProductIds.distinct()
                )
            }
            viewModel.saveCombo(
                name = name.trim(),
                price = price.toDoubleOrNull() ?: 0.0,
                taxRate = tax.toDoubleOrNull() ?: 2.6,
                categoryId = selectedCategoryId,
                slots = drafts,
                productId = combo?.id ?: 0L,
                onDone = onSaved
            )
        }
    ) {
        MenuSectionCard {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.combo_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = price,
                onValueChange = { price = it },
                label = { Text(stringResource(R.string.combo_fixed_price)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = tax,
                onValueChange = { tax = it },
                label = { Text(stringResource(R.string.tax_rate)) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        MenuSectionCard(title = stringResource(R.string.category)) {
            categories.forEach { category ->
                val selected = selectedCategoryId == category.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { selectedCategoryId = category.id }
                        .padding(vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    androidx.compose.material3.RadioButton(selected = selected, onClick = { selectedCategoryId = category.id })
                    Text(
                        category.name,
                        modifier = Modifier
                            .padding(start = 4.dp)
                            .weight(1f),
                        color = if (selected) categoryColor(category.colorHex) else Color.Unspecified
                    )
                }
            }
        }
        MenuSectionCard(title = stringResource(R.string.combo_slots)) {
            slots.forEachIndexed { index, slot ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = slot.name,
                            onValueChange = { slots[index] = slot.copy(name = it) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.slot_name)) },
                            singleLine = true
                        )
                        IconButton(onClick = { if (slots.size > 1) slots.removeAt(index) }) {
                            Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFFDC2626))
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedTextField(
                            value = slot.minPick,
                            onValueChange = { slots[index] = slot.copy(minPick = it) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.min_pick)) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = slot.maxPick,
                            onValueChange = { slots[index] = slot.copy(maxPick = it) },
                            modifier = Modifier.weight(1f),
                            label = { Text(stringResource(R.string.max_pick)) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }
                    OutlinedTextField(
                        value = productQuery,
                        onValueChange = { productQuery = it },
                        placeholder = { Text(stringResource(R.string.search_products)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    catalogProducts
                        .filter { !it.isCombo }
                        .filter { productQuery.isBlank() || it.name.contains(productQuery, ignoreCase = true) }
                        .forEach { product ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                androidx.compose.material3.Checkbox(
                                    checked = product.id in slot.selectedProductIds,
                                    onCheckedChange = { checked ->
                                        if (checked) slot.selectedProductIds.add(product.id)
                                        else slot.selectedProductIds.remove(product.id)
                                    }
                                )
                                Text(product.name, fontSize = 13.sp)
                            }
                        }
                }
            }
            val newSlotLabel = stringResource(R.string.add_slot)
            TextButton(onClick = {
                slots.add(ComboSlotDraftUi(newSlotLabel, "1", "1", mutableListOf()))
            }) {
                Text(stringResource(R.string.add_slot))
            }
        }
    }
}

private fun defaultComboSlots(): List<ComboSlotDraftUi> = listOf(
    ComboSlotDraftUi("Starter", "1", "1", mutableListOf()),
    ComboSlotDraftUi("Main", "1", "1", mutableListOf()),
    ComboSlotDraftUi("Extras", "0", "2", mutableListOf()),
    ComboSlotDraftUi("Drinks", "1", "1", mutableListOf()),
    ComboSlotDraftUi("Dessert", "0", "1", mutableListOf())
)
