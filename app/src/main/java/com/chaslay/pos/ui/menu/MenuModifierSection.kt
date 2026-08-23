package com.chaslay.pos.ui.menu

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Checkbox
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField

@Composable
fun ModifierListSection(groups: List<ModifierGroupEntity>, viewModel: MenuViewModel) {
    var showEditor by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<ModifierGroupEntity?>(null) }
    var query by remember { mutableStateOf("") }

    val filtered = groups.filter {
        query.isBlank() || it.name.contains(query, ignoreCase = true)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        MenuListHeader(
            title = stringResource(R.string.modifiers),
            hint = stringResource(R.string.modifiers_hint),
            addLabel = stringResource(R.string.add_new_group),
            onAdd = { editing = null; showEditor = true }
        )
        MenuSearchField(
            query = query,
            onQueryChange = { query = it },
            placeholder = stringResource(R.string.menu_search_groups)
        )
        if (filtered.isEmpty()) {
            MenuEmptyState(
                title = stringResource(R.string.menu_no_groups_yet),
                hint = stringResource(R.string.menu_no_groups_hint),
                onAdd = { editing = null; showEditor = true }
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(filtered, key = { it.id }) { group ->
                    ModifierGroupCard(
                        group = group,
                        viewModel = viewModel,
                        onEdit = { editing = group; showEditor = true },
                        onDelete = { viewModel.deleteModifierGroup(group.id) }
                    )
                }
            }
        }
    }

    if (showEditor) {
        ModifierEditorDialog(
            group = editing,
            viewModel = viewModel,
            onDismiss = { showEditor = false },
            onSaved = { showEditor = false }
        )
    }
}

@Composable
private fun ModifierGroupCard(
    group: ModifierGroupEntity,
    viewModel: MenuViewModel,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    var optionNames by remember { mutableStateOf<List<String>>(emptyList()) }
    var linkedCount by remember { mutableStateOf(0) }

    LaunchedEffect(group.id) {
        val detail = viewModel.loadModifierGroup(group.id)
        optionNames = detail?.options?.map { it.name }.orEmpty()
        linkedCount = detail?.linkedProductIds?.size ?: 0
    }

    val badges = buildList {
        add(stringResource(R.string.menu_free_choice))
        add(
            if (group.required) stringResource(R.string.required_option)
            else stringResource(R.string.optional_option)
        )
        add(stringResource(R.string.menu_pick_limit, group.limitQuantity))
        add(stringResource(R.string.menu_options_count, optionNames.size))
        add(stringResource(R.string.menu_products_count, linkedCount))
    }
    val preview = optionNames.joinToString(" · ").ifBlank { stringResource(R.string.menu_no_options) }

    MenuGroupCard(
        title = group.name,
        badges = badges,
        preview = preview,
        onEdit = onEdit,
        onDelete = onDelete
    )
}

@Composable
private fun ModifierEditorDialog(
    group: ModifierGroupEntity?,
    viewModel: MenuViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit
) {
    var name by remember(group) { mutableStateOf(group?.name ?: "") }
    var limitQty by remember(group) { mutableStateOf((group?.limitQuantity ?: 1).coerceAtLeast(1)) }
    var required by remember(group) { mutableStateOf(group?.required ?: false) }
    val options = remember(group) { mutableStateListOf<String>() }
    val optionInStock = remember(group) { mutableStateListOf<Boolean>() }
    val linkedProducts = remember(group) { mutableStateListOf<Long>() }
    var allProducts by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }
    var productQuery by remember { mutableStateOf("") }

    LaunchedEffect(group?.id) {
        allProducts = viewModel.getAllProducts()
        options.clear()
        optionInStock.clear()
        linkedProducts.clear()
        if (group != null && group.id > 0) {
            val detail = viewModel.loadModifierGroup(group.id)
            detail?.options?.forEach {
                options.add(it.name)
                optionInStock.add(it.inStock)
            }
            linkedProducts.addAll(detail?.linkedProductIds.orEmpty())
        } else if (options.isEmpty()) {
            options.add("")
            optionInStock.add(true)
        }
    }

    MenuEditorDialog(
        title = if (group == null) stringResource(R.string.add_modifier) else stringResource(R.string.edit_modifier),
        onDismiss = onDismiss,
        onSave = {
            val entity = ModifierGroupEntity(
                id = group?.id ?: 0,
                remoteId = group?.remoteId,
                name = name.trim(),
                limitQuantity = limitQty.coerceAtLeast(1),
                required = required
            )
            viewModel.saveModifierGroup(
                entity,
                options.mapIndexed { index, value -> value to optionInStock.getOrElse(index) { true } },
                linkedProducts.toList()
            )
            onSaved()
        }
    ) {
        MenuSectionCard {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        MenuSectionCard(title = stringResource(R.string.menu_selection_rules)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RadioButton(selected = !required, onClick = { required = false })
                Text(stringResource(R.string.optional_option))
                RadioButton(selected = required, onClick = { required = true })
                Text(stringResource(R.string.required_option))
            }
            MenuQuantityStepper(
                label = stringResource(R.string.limit_quantity),
                value = limitQty,
                min = 1,
                onChange = { limitQty = it }
            )
        }
        MenuSectionCard(title = stringResource(R.string.sub_options)) {
            options.forEachIndexed { index, opt ->
                MenuOptionEditorRow(
                    name = opt,
                    onNameChange = { options[index] = it },
                    inStock = optionInStock.getOrElse(index) { true },
                    onInStockChange = { optionInStock[index] = it },
                    onDelete = {
                        if (options.size > 1) {
                            options.removeAt(index)
                            if (index < optionInStock.size) optionInStock.removeAt(index)
                        }
                    },
                    canDelete = options.size > 1
                )
            }
            TextButton(onClick = { options.add(""); optionInStock.add(true) }) {
                Text(stringResource(R.string.menu_add_option))
            }
        }
        MenuSectionCard(title = stringResource(R.string.link_products)) {
            OutlinedTextField(
                value = productQuery,
                onValueChange = { productQuery = it },
                placeholder = { Text(stringResource(R.string.search_products)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            allProducts
                .filter { productQuery.isBlank() || it.name.contains(productQuery, ignoreCase = true) }
                .forEach { product ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = product.id in linkedProducts,
                            onCheckedChange = { checked ->
                                if (checked) linkedProducts.add(product.id) else linkedProducts.remove(product.id)
                            }
                        )
                        Text(product.name, fontSize = 13.sp)
                    }
                }
        }
    }
}
