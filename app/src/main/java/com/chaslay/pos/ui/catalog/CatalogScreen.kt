package com.chaslay.pos.ui.catalog

import android.widget.Toast
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.ui.scanner.BarcodeScannerDialog
import com.chaslay.pos.ui.theme.categoryColor
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

private val CatalogTeal = Color(0xFF0D9488)
private val CatalogBorder = Color(0xFF9CA3AF)
private val CatalogMuted = Color(0xFF6B7280)
private val CatalogSurface = Color(0xFFF9FAFB)

private fun digitsOnly(input: String) = input.filter { it.isDigit() }

@Composable
fun CatalogScreen(viewModel: CatalogViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showCategoryDialog by remember { mutableStateOf(false) }
    var showProductDialog by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<CategoryEntity?>(null) }
    var editingProduct by remember { mutableStateOf<ProductEntity?>(null) }
    var selectedCategoryId by remember { mutableStateOf<Long?>(null) }
    var productQuery by remember { mutableStateOf("") }

    LaunchedEffect(state.messageRes) {
        state.messageRes?.let { resId ->
            Toast.makeText(context, context.getString(resId), Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    Scaffold { padding ->
        Column(modifier = Modifier.padding(padding).fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CatalogTeal)
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.catalog_title),
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = Color.White
                )
            }
            ProductCatalogPane(
                categories = state.categories,
                products = state.products,
                selectedCategoryId = selectedCategoryId,
                query = productQuery,
                onQueryChange = { productQuery = it },
                onSelectCategory = { selectedCategoryId = it },
                onAddCategory = { editingCategory = null; showCategoryDialog = true },
                onEditCategory = { editingCategory = it; showCategoryDialog = true },
                onAddProduct = { editingProduct = null; showProductDialog = true },
                onEdit = { editingProduct = it; showProductDialog = true },
                onDelete = viewModel::deleteProduct,
                onReorderCategories = viewModel::reorderCategories,
                onReorderProducts = viewModel::reorderProducts
            )
        }
    }

    if (showCategoryDialog) {
        CategoryDialog(
            category = editingCategory,
            onDismiss = { showCategoryDialog = false },
            onSave = { name, color, order ->
                viewModel.saveCategory(name, color, order, editingCategory?.id ?: 0)
                showCategoryDialog = false
            }
        )
    }

    if (showProductDialog) {
        ProductDialog(
            product = editingProduct,
            categories = state.categories,
            modifierGroups = state.modifierGroups,
            addonGroups = state.addonGroups,
            viewModel = viewModel,
            onDismiss = { showProductDialog = false },
            onSave = { name, price, categoryId, tax, openPrice, isWeighed, sortOrder, variants, modIds, addonIds, barcode, sku, stockQty, lowStock ->
                viewModel.saveProduct(
                    name, price, categoryId, tax, openPrice, isWeighed, sortOrder,
                    variants, modIds, addonIds, barcode, sku, stockQty, lowStock, editingProduct?.id ?: 0
                )
                showProductDialog = false
            }
        )
    }
}

@Composable
private fun ProductCatalogPane(
    categories: List<CategoryEntity>,
    products: List<ProductEntity>,
    selectedCategoryId: Long?,
    query: String,
    onQueryChange: (String) -> Unit,
    onSelectCategory: (Long?) -> Unit,
    onAddCategory: () -> Unit,
    onEditCategory: (CategoryEntity) -> Unit,
    onAddProduct: () -> Unit,
    onEdit: (ProductEntity) -> Unit,
    onDelete: (Long) -> Unit,
    onReorderCategories: (Long, Long) -> Unit,
    onReorderProducts: (Long, Long, Long) -> Unit
) {
    val filtered = products.filter { product ->
        val matchesCat = selectedCategoryId == null || product.categoryId == selectedCategoryId
        val matchesQuery = query.isBlank() || product.name.contains(query, ignoreCase = true)
        matchesCat && matchesQuery
    }
    val canReorderProducts = selectedCategoryId != null && query.isBlank()
    val categoryProducts = remember(products, selectedCategoryId) {
        if (selectedCategoryId == null) emptyList()
        else products.filter { it.categoryId == selectedCategoryId }.sortedBy { it.sortOrder }
    }
    val displayProducts = if (canReorderProducts) categoryProducts else filtered

    val categoryListState = rememberLazyListState()
    val reorderableCategoryState = rememberReorderableLazyListState(categoryListState) { from, to ->
        val fromId = from.key as? Long ?: return@rememberReorderableLazyListState
        val toId = to.key as? Long ?: return@rememberReorderableLazyListState
        onReorderCategories(fromId, toId)
    }

    val productListState = rememberLazyListState()
    val reorderableProductState = rememberReorderableLazyListState(productListState) { from, to ->
        val catId = selectedCategoryId ?: return@rememberReorderableLazyListState
        val fromId = from.key as? Long ?: return@rememberReorderableLazyListState
        val toId = to.key as? Long ?: return@rememberReorderableLazyListState
        onReorderProducts(catId, fromId, toId)
    }

    Row(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .width(260.dp)
                .fillMaxSize()
                .background(Color(0xFFF3F4F6))
                .padding(12.dp)
        ) {
            Text(stringResource(R.string.categories), fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Button(
                onClick = onAddCategory,
                modifier = Modifier.padding(vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(containerColor = CatalogTeal),
                shape = RoundedCornerShape(8.dp)
            ) { Text(stringResource(R.string.add_category), color = Color.White) }
            Text(
                stringResource(R.string.drag_to_reorder),
                fontSize = 11.sp,
                color = CatalogMuted,
                modifier = Modifier.padding(bottom = 4.dp)
            )
            LazyColumn(
                state = categoryListState,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                item(key = "all_categories") {
                    val allSelected = selectedCategoryId == null
                    Text(
                        stringResource(R.string.all_categories),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (allSelected) Color(0xFFCCFBF1) else Color.Transparent)
                            .clickable { onSelectCategory(null) }
                            .padding(10.dp),
                        color = if (allSelected) CatalogTeal else Color(0xFF1F2937),
                        fontWeight = if (allSelected) FontWeight.Bold else FontWeight.Normal
                    )
                }
                items(categories, key = { it.id }) { category ->
                    ReorderableItem(reorderableCategoryState, key = category.id) { reorderScope ->
                        val selected = selectedCategoryId == category.id
                        val count = products.count { it.categoryId == category.id }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (selected) Color(0xFFCCFBF1) else Color.Transparent)
                                .padding(horizontal = 4.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.DragHandle,
                                contentDescription = stringResource(R.string.drag_to_reorder),
                                tint = CatalogMuted,
                                modifier = Modifier
                                    .size(28.dp)
                                    .then(with(reorderScope) { Modifier.draggableHandle() })
                            )
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { onSelectCategory(category.id) }
                                    .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "${category.name} ($count)",
                                    modifier = Modifier.weight(1f),
                                    color = if (selected) CatalogTeal else Color(0xFF1F2937),
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                                )
                                IconButton(onClick = { onEditCategory(category) }, modifier = Modifier.size(32.dp)) {
                                    Icon(Icons.Default.Edit, contentDescription = null, tint = CatalogMuted, modifier = Modifier.size(16.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxSize()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(stringResource(R.string.products), fontWeight = FontWeight.Bold, fontSize = 18.sp)
                CatalogField(
                    value = query,
                    onValueChange = onQueryChange,
                    label = stringResource(R.string.search_products),
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = onAddProduct,
                    colors = ButtonDefaults.buttonColors(containerColor = CatalogTeal),
                    shape = RoundedCornerShape(8.dp)
                ) { Text(stringResource(R.string.add_new_product), color = Color.White) }
            }
            if (canReorderProducts) {
                Text(
                    stringResource(R.string.drag_to_reorder),
                    fontSize = 11.sp,
                    color = CatalogMuted,
                    modifier = Modifier.padding(top = 4.dp, bottom = 8.dp)
                )
            } else {
                Spacer(modifier = Modifier.height(12.dp))
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF3F4F6), RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                if (canReorderProducts) Spacer(modifier = Modifier.width(28.dp))
                Text("#", modifier = Modifier.width(36.dp), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.products), modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.price), modifier = Modifier.width(90.dp), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.in_stock), modifier = Modifier.width(90.dp), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Spacer(modifier = Modifier.width(48.dp))
            }
            LazyColumn(
                state = productListState,
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                items(displayProducts, key = { it.id }) { product ->
                    val index = displayProducts.indexOf(product) + 1
                    if (canReorderProducts) {
                        ReorderableItem(reorderableProductState, key = product.id) { reorderScope ->
                            ProductRow(
                                index = index,
                                product = product,
                                showDragHandle = true,
                                onEdit = onEdit,
                                onDelete = onDelete,
                                dragModifier = with(reorderScope) { Modifier.draggableHandle() }
                            )
                        }
                    } else {
                        ProductRow(
                            index = index,
                            product = product,
                            showDragHandle = false,
                            onEdit = onEdit,
                            onDelete = onDelete
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ProductRow(
    index: Int,
    product: ProductEntity,
    showDragHandle: Boolean,
    onEdit: (ProductEntity) -> Unit,
    onDelete: (Long) -> Unit,
    dragModifier: Modifier = Modifier
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onEdit(product) }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (showDragHandle) {
            Icon(
                Icons.Default.DragHandle,
                contentDescription = stringResource(R.string.drag_to_reorder),
                tint = CatalogMuted,
                modifier = dragModifier.size(28.dp)
            )
        }
        Text(index.toString(), modifier = Modifier.width(36.dp), fontSize = 13.sp)
        Text(product.name, modifier = Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
        Text(
            when {
                product.isWeighed -> "${product.price}/kg"
                product.isOpenPrice -> "Open"
                else -> "CHF ${"%.2f".format(product.price)}"
            },
            modifier = Modifier.width(90.dp),
            fontSize = 13.sp
        )
        Text(stringResource(R.string.in_stock), modifier = Modifier.width(90.dp), fontSize = 12.sp, color = CatalogTeal)
        IconButton(onClick = { onDelete(product.id) }) {
            Icon(Icons.Default.Delete, contentDescription = null)
        }
    }
}

@Composable
private fun CatalogField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = singleLine,
        keyboardOptions = keyboardOptions,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = CatalogTeal,
            unfocusedBorderColor = CatalogBorder,
            focusedLabelColor = CatalogTeal,
            unfocusedLabelColor = Color(0xFF4B5563)
        )
    )
}

@Composable
private fun CatalogToggleRow(
    label: String,
    help: String? = null,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, CatalogBorder),
        color = CatalogSurface,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                Text(label, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                if (!help.isNullOrBlank()) {
                    Text(help, fontSize = 11.sp, color = CatalogMuted)
                }
            }
            Switch(checked = checked, onCheckedChange = onCheckedChange)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CategoryDialog(
    category: CategoryEntity?,
    onDismiss: () -> Unit,
    onSave: (String, String, Int) -> Unit
) {
    var name by remember(category) { mutableStateOf(category?.name ?: "") }
    var sortOrder by remember(category) { mutableStateOf((category?.sortOrder ?: 0).toString()) }
    var selectedColor by remember(category) { mutableStateOf(category?.colorHex ?: CategoryColorPresets.first().first) }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.5f),
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            shadowElevation = 8.dp
        ) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    if (category == null) stringResource(R.string.add_category) else stringResource(R.string.edit_category),
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
                CatalogField(value = name, onValueChange = { name = it }, label = stringResource(R.string.category))
                CatalogField(
                    value = sortOrder,
                    onValueChange = { sortOrder = it },
                    label = stringResource(R.string.sort_order),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                Text(stringResource(R.string.catalog_button_color), fontWeight = FontWeight.SemiBold)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CategoryColorPresets.forEach { (hex, _) ->
                        val selected = selectedColor == hex
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(categoryColor(hex))
                                .border(if (selected) 3.dp else 0.dp, Color.White, CircleShape)
                                .clickable { selectedColor = hex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (selected) Text("✓", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSave(name, selectedColor, sortOrder.toIntOrNull() ?: 0) },
                        colors = ButtonDefaults.buttonColors(containerColor = CatalogTeal)
                    ) { Text(stringResource(R.string.save), color = Color.White) }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun ProductDialog(
    product: ProductEntity?,
    categories: List<CategoryEntity>,
    modifierGroups: List<ModifierGroupEntity>,
    addonGroups: List<AddonGroupEntity>,
    viewModel: CatalogViewModel,
    onDismiss: () -> Unit,
    onSave: (
        String, Double, Long?, Double, Boolean, Boolean, Int,
        List<ProductVariantDraft>, List<Long>, List<Long>,
        String?, String?, Int?, Int?
    ) -> Unit
) {
    var name by remember(product) { mutableStateOf(product?.name ?: "") }
    var barcode by remember(product) { mutableStateOf(product?.barcode.orEmpty()) }
    var sku by remember(product) { mutableStateOf(product?.sku.orEmpty()) }
    var stockQuantity by remember(product) { mutableStateOf(product?.stockQuantity?.toString().orEmpty()) }
    var lowStockThreshold by remember(product) { mutableStateOf(product?.lowStockThreshold?.toString().orEmpty()) }
    var showScanner by remember { mutableStateOf(false) }
    var price by remember(product) { mutableStateOf(product?.price?.toString() ?: "") }
    var tax by remember(product) { mutableStateOf(product?.taxRate?.toString() ?: "2.6") }
    var sortOrder by remember(product) { mutableStateOf((product?.sortOrder ?: 0).toString()) }
    var openPrice by remember(product) { mutableStateOf(product?.isOpenPrice ?: false) }
    var isWeighed by remember(product) { mutableStateOf(product?.isWeighed ?: false) }
    var selectedCategoryId by remember(product) { mutableStateOf(product?.categoryId ?: categories.firstOrNull()?.id) }
    var categoryExpanded by remember { mutableStateOf(false) }
    var moreOpen by remember { mutableStateOf(false) }
    val variantNames = remember(product) { mutableStateListOf<String>() }
    val variantPrices = remember(product) { mutableStateListOf<String>() }
    val selectedModifierIds = remember(product) { mutableStateListOf<Long>() }
    val selectedAddonIds = remember(product) { mutableStateListOf<Long>() }

    LaunchedEffect(product?.id) {
        variantNames.clear()
        variantPrices.clear()
        selectedModifierIds.clear()
        selectedAddonIds.clear()
        if (product != null && product.id > 0) {
            viewModel.loadProductVariants(product.id).forEach {
                variantNames.add(it.name)
                variantPrices.add(it.price.toString())
            }
            selectedModifierIds.addAll(viewModel.loadProductModifierIds(product.id))
            selectedAddonIds.addAll(viewModel.loadProductAddonIds(product.id))
        }
    }

    val selectedCategory = categories.find { it.id == selectedCategoryId }

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.72f)
                .fillMaxHeight(0.88f),
            shape = RoundedCornerShape(16.dp),
            color = Color.White,
            shadowElevation = 8.dp
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    if (product == null) stringResource(R.string.add_product) else stringResource(R.string.edit_product),
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
                Spacer(modifier = Modifier.height(12.dp))
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    CatalogField(value = name, onValueChange = { name = it }, label = stringResource(R.string.product_name))

                    ExposedDropdownMenuBox(
                        expanded = categoryExpanded,
                        onExpandedChange = { categoryExpanded = it },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = selectedCategory?.name.orEmpty(),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(stringResource(R.string.category)) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = CatalogTeal,
                                unfocusedBorderColor = CatalogBorder,
                                focusedLabelColor = CatalogTeal
                            )
                        )
                        ExposedDropdownMenu(
                            expanded = categoryExpanded,
                            onDismissRequest = { categoryExpanded = false }
                        ) {
                            categories.forEach { category ->
                                DropdownMenuItem(
                                    text = { Text(category.name) },
                                    onClick = {
                                        selectedCategoryId = category.id
                                        categoryExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    CatalogToggleRow(
                        label = stringResource(R.string.open_price),
                        checked = openPrice,
                        onCheckedChange = {
                            openPrice = it
                            if (it) isWeighed = false
                        }
                    )
                    CatalogToggleRow(
                        label = stringResource(R.string.sold_by_weight),
                        help = stringResource(R.string.sold_by_weight_help),
                        checked = isWeighed,
                        onCheckedChange = {
                            isWeighed = it
                            if (it) openPrice = false
                        }
                    )

                    if (isWeighed) {
                        CatalogField(
                            value = price,
                            onValueChange = { price = it },
                            label = stringResource(R.string.price_per_kg),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                        )
                    }
                    if (!openPrice && !isWeighed) {
                        CatalogField(
                            value = price,
                            onValueChange = { price = it },
                            label = stringResource(R.string.price),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                        )
                    }
                    CatalogField(
                        value = tax,
                        onValueChange = { tax = it },
                        label = stringResource(R.string.tax_rate),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)
                    )

                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, CatalogBorder),
                        color = CatalogSurface,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(stringResource(R.string.variations), fontWeight = FontWeight.SemiBold)
                                    Text(stringResource(R.string.catalog_sizes_hint), fontSize = 11.sp, color = CatalogMuted)
                                }
                                TextButton(onClick = { variantNames.add(""); variantPrices.add("0") }) {
                                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(stringResource(R.string.add_variation))
                                }
                            }
                            variantNames.forEachIndexed { index, vName ->
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    OutlinedTextField(
                                        value = vName,
                                        onValueChange = { variantNames[index] = it },
                                        modifier = Modifier.weight(1f),
                                        label = { Text(stringResource(R.string.size)) },
                                        singleLine = true
                                    )
                                    OutlinedTextField(
                                        value = variantPrices.getOrElse(index) { "0" },
                                        onValueChange = { if (index < variantPrices.size) variantPrices[index] = it },
                                        modifier = Modifier.width(90.dp),
                                        label = { Text("CHF") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                        singleLine = true
                                    )
                                }
                            }
                        }
                    }

                    Surface(
                        onClick = { moreOpen = !moreOpen },
                        shape = RoundedCornerShape(8.dp),
                        border = BorderStroke(1.dp, CatalogBorder),
                        color = CatalogSurface,
                        modifier = Modifier
                            .fillMaxWidth()
                            .animateContentSize()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(stringResource(R.string.more_options), fontWeight = FontWeight.SemiBold)
                                    if (!moreOpen) {
                                        Text(
                                            stringResource(R.string.more_options_hint),
                                            fontSize = 11.sp,
                                            color = CatalogMuted
                                        )
                                    }
                                }
                                Icon(
                                    if (moreOpen) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                    contentDescription = null,
                                    tint = CatalogMuted
                                )
                            }
                            if (moreOpen) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    OutlinedTextField(
                                        value = barcode,
                                        onValueChange = { barcode = digitsOnly(it) },
                                        label = { Text(stringResource(R.string.barcode)) },
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                                        modifier = Modifier.weight(1f)
                                    )
                                    IconButton(onClick = { showScanner = true }) {
                                        Icon(Icons.Default.QrCodeScanner, contentDescription = stringResource(R.string.scan_barcode))
                                    }
                                }
                                CatalogField(value = sku, onValueChange = { sku = it }, label = stringResource(R.string.sku))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    CatalogField(
                                        value = stockQuantity,
                                        onValueChange = { stockQuantity = it },
                                        label = stringResource(R.string.stock_quantity),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f)
                                    )
                                    CatalogField(
                                        value = lowStockThreshold,
                                        onValueChange = { lowStockThreshold = it },
                                        label = stringResource(R.string.low_stock_threshold),
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                CatalogField(
                                    value = sortOrder,
                                    onValueChange = { sortOrder = it },
                                    label = stringResource(R.string.sort_order),
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                                )

                                if (modifierGroups.isNotEmpty()) {
                                    Text(stringResource(R.string.modifiers), fontWeight = FontWeight.SemiBold)
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        modifierGroups.forEach { group ->
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                border = BorderStroke(
                                                    1.dp,
                                                    if (group.id in selectedModifierIds) CatalogTeal else CatalogBorder
                                                ),
                                                color = if (group.id in selectedModifierIds) Color(0xFFCCFBF1) else Color.White,
                                                modifier = Modifier
                                                    .width(160.dp)
                                                    .clickable {
                                                        if (group.id in selectedModifierIds) {
                                                            selectedModifierIds.remove(group.id)
                                                        } else {
                                                            selectedModifierIds.add(group.id)
                                                        }
                                                    }
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Checkbox(
                                                        checked = group.id in selectedModifierIds,
                                                        onCheckedChange = null,
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                    Text(group.name, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp))
                                                }
                                            }
                                        }
                                    }
                                }
                                if (addonGroups.isNotEmpty()) {
                                    Text(stringResource(R.string.addons), fontWeight = FontWeight.SemiBold)
                                    FlowRow(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalArrangement = Arrangement.spacedBy(4.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        addonGroups.forEach { group ->
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                border = BorderStroke(
                                                    1.dp,
                                                    if (group.id in selectedAddonIds) CatalogTeal else CatalogBorder
                                                ),
                                                color = if (group.id in selectedAddonIds) Color(0xFFCCFBF1) else Color.White,
                                                modifier = Modifier
                                                    .width(160.dp)
                                                    .clickable {
                                                        if (group.id in selectedAddonIds) {
                                                            selectedAddonIds.remove(group.id)
                                                        } else {
                                                            selectedAddonIds.add(group.id)
                                                        }
                                                    }
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    Checkbox(
                                                        checked = group.id in selectedAddonIds,
                                                        onCheckedChange = null,
                                                        modifier = Modifier.size(20.dp)
                                                    )
                                                    Text(group.name, fontSize = 12.sp, modifier = Modifier.padding(start = 4.dp))
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val variants = variantNames.indices.mapNotNull { i ->
                                val vName = variantNames[i].trim()
                                if (vName.isBlank()) null else ProductVariantDraft(vName, variantPrices.getOrElse(i) { "0" }.toDoubleOrNull() ?: 0.0)
                            }
                            onSave(
                                name,
                                price.toDoubleOrNull() ?: 0.0,
                                selectedCategoryId,
                                tax.toDoubleOrNull() ?: 0.0,
                                openPrice,
                                isWeighed,
                                sortOrder.toIntOrNull() ?: 0,
                                variants,
                                selectedModifierIds.toList(),
                                selectedAddonIds.toList(),
                                barcode.takeIf { it.isNotBlank() },
                                sku,
                                stockQuantity.toIntOrNull(),
                                lowStockThreshold.toIntOrNull()
                            )
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = CatalogTeal)
                    ) { Text(stringResource(R.string.save), color = Color.White) }
                }
            }
        }
    }

    if (showScanner) {
        BarcodeScannerDialog(
            onBarcode = { code ->
                barcode = digitsOnly(code)
                showScanner = false
            },
            onDismiss = { showScanner = false }
        )
    }
}
