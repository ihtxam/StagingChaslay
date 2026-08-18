package com.chaslay.pos.ui.catalog

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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material3.Surface
import androidx.compose.foundation.rememberScrollState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.ui.scanner.BarcodeScannerDialog
import com.chaslay.pos.ui.theme.categoryColor

private val CatalogTeal = Color(0xFF0D9488)
private val CatalogBorder = Color(0xFF9CA3AF)

@Composable
fun CatalogScreen(viewModel: CatalogViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var tab by remember { mutableIntStateOf(0) }
    var showCategoryDialog by remember { mutableStateOf(false) }
    var showProductDialog by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<CategoryEntity?>(null) }
    var editingProduct by remember { mutableStateOf<ProductEntity?>(null) }
    var selectedCategoryId by remember { mutableStateOf<Long?>(null) }
    var productQuery by remember { mutableStateOf("") }

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
            TabRow(
                selectedTabIndex = tab,
                containerColor = Color(0xFFF3F4F6),
                contentColor = CatalogTeal
            ) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text(stringResource(R.string.categories)) })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text(stringResource(R.string.products)) })
            }
            when (tab) {
                0 -> CategoryList(
                    categories = state.categories,
                    onAdd = { editingCategory = null; showCategoryDialog = true },
                    onEdit = { editingCategory = it; showCategoryDialog = true },
                    onDelete = viewModel::deleteCategory
                )
                1 -> ProductCatalogPane(
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
                    onDelete = viewModel::deleteProduct
                )
            }
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

    state.message?.let { msg ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = { TextButton(onClick = viewModel::clearMessage) { Text("OK") } },
            text = { Text(msg) }
        )
    }
}

@Composable
private fun CategoryList(
    categories: List<CategoryEntity>,
    onAdd: () -> Unit,
    onEdit: (CategoryEntity) -> Unit,
    onDelete: (Long) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(stringResource(R.string.categories), fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Button(
                onClick = onAdd,
                colors = ButtonDefaults.buttonColors(containerColor = CatalogTeal),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(stringResource(R.string.add_category), color = Color.White)
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(categories, key = { it.id }) { category ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CatalogBorder, RoundedCornerShape(10.dp)),
                    onClick = { onEdit(category) },
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(categoryColor(category.colorHex))
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(category.name, fontWeight = FontWeight.SemiBold)
                            Text(category.colorHex, fontSize = 12.sp, color = Color.Gray)
                        }
                        IconButton(onClick = { onDelete(category.id) }) {
                            Icon(Icons.Default.Delete, contentDescription = null)
                        }
                    }
                }
            }
        }
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
    onDelete: (Long) -> Unit
) {
    val filtered = products.filter { product ->
        val matchesCat = selectedCategoryId == null || product.categoryId == selectedCategoryId
        val matchesQuery = query.isBlank() || product.name.contains(query, ignoreCase = true)
        matchesCat && matchesQuery
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
            LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                item {
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
                    val selected = selectedCategoryId == category.id
                    val count = products.count { it.categoryId == category.id }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (selected) Color(0xFFCCFBF1) else Color.Transparent)
                            .clickable { onSelectCategory(category.id) }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "${category.name} ($count)",
                            modifier = Modifier.weight(1f),
                            color = if (selected) CatalogTeal else Color(0xFF1F2937),
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                        )
                        IconButton(onClick = { onEditCategory(category) }, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Default.Edit, contentDescription = null, tint = Color(0xFF6B7280), modifier = Modifier.size(16.dp))
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
            Spacer(modifier = Modifier.height(12.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF3F4F6), RoundedCornerShape(8.dp))
                    .padding(horizontal = 12.dp, vertical = 8.dp)
            ) {
                Text("#", modifier = Modifier.width(36.dp), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.products), modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.price), modifier = Modifier.width(90.dp), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Text(stringResource(R.string.in_stock), modifier = Modifier.width(90.dp), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                Spacer(modifier = Modifier.width(48.dp))
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                items(filtered, key = { it.id }) { product ->
                    val index = filtered.indexOf(product) + 1
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onEdit(product) }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
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
            }
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
                    CategoryColorPresets.forEach { (hex, label) ->
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
                            if (selected) Text("?", color = Color.White, fontWeight = FontWeight.Bold)
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
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedTextField(
                        value = barcode,
                        onValueChange = { barcode = it },
                        label = { Text(stringResource(R.string.barcode)) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { showScanner = true }) {
                        Icon(Icons.Default.QrCodeScanner, contentDescription = stringResource(R.string.scan_barcode))
                    }
                }
                OutlinedTextField(
                    value = sku,
                    onValueChange = { sku = it },
                    label = { Text(stringResource(R.string.sku)) },
                    singleLine = true
                )
                OutlinedTextField(
                    value = stockQuantity,
                    onValueChange = { stockQuantity = it },
                    label = { Text(stringResource(R.string.stock_quantity)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
                OutlinedTextField(
                    value = lowStockThreshold,
                    onValueChange = { lowStockThreshold = it },
                    label = { Text(stringResource(R.string.low_stock_threshold)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true
                )
                OutlinedTextField(value = sortOrder, onValueChange = { sortOrder = it }, label = { Text(stringResource(R.string.sort_order)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.open_price))
                    Switch(checked = openPrice, onCheckedChange = {
                        openPrice = it
                        if (it) isWeighed = false
                    })
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.sold_by_weight))
                        Text(stringResource(R.string.sold_by_weight_help), fontSize = 11.sp, color = Color.Gray)
                    }
                    Switch(checked = isWeighed, onCheckedChange = {
                        isWeighed = it
                        if (it) openPrice = false
                    })
                }
                if (isWeighed) {
                    OutlinedTextField(
                        value = price,
                        onValueChange = { price = it },
                        label = { Text(stringResource(R.string.price_per_kg)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                if (!openPrice && !isWeighed) {
                    OutlinedTextField(value = price, onValueChange = { price = it }, label = { Text(stringResource(R.string.price)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true)
                }
                OutlinedTextField(value = tax, onValueChange = { tax = it }, label = { Text(stringResource(R.string.tax_rate)) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true)
                Text(stringResource(R.string.variations), fontWeight = FontWeight.SemiBold)
                variantNames.forEachIndexed { index, vName ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        OutlinedTextField(value = vName, onValueChange = { variantNames[index] = it }, modifier = Modifier.weight(1f), label = { Text("Size") }, singleLine = true)
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
                TextButton(onClick = { variantNames.add(""); variantPrices.add("0") }) {
                    Text("+ ${stringResource(R.string.add_variation)}")
                }
                Text(stringResource(R.string.category))
                categories.forEach { category ->
                    val selected = selectedCategoryId == category.id
                    Card(
                        modifier = Modifier.fillMaxWidth().clickable { selectedCategoryId = category.id },
                        colors = CardDefaults.cardColors(containerColor = if (selected) categoryColor(category.colorHex).copy(alpha = 0.4f) else Color.LightGray.copy(alpha = 0.2f))
                    ) {
                        Text(category.name, modifier = Modifier.padding(12.dp))
                    }
                }
                if (modifierGroups.isNotEmpty()) {
                    Text(stringResource(R.string.modifiers), fontWeight = FontWeight.SemiBold)
                    modifierGroups.forEach { group ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = group.id in selectedModifierIds,
                                onCheckedChange = { checked ->
                                    if (checked) selectedModifierIds.add(group.id) else selectedModifierIds.remove(group.id)
                                }
                            )
                            Text(group.name, fontSize = 13.sp)
                        }
                    }
                }
                if (addonGroups.isNotEmpty()) {
                    Text(stringResource(R.string.addons), fontWeight = FontWeight.SemiBold)
                    addonGroups.forEach { group ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = group.id in selectedAddonIds,
                                onCheckedChange = { checked ->
                                    if (checked) selectedAddonIds.add(group.id) else selectedAddonIds.remove(group.id)
                                }
                            )
                            Text(group.name, fontSize = 13.sp)
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
                                barcode,
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
                barcode = code
                showScanner = false
            },
            onDismiss = { showScanner = false }
        )
    }
}
