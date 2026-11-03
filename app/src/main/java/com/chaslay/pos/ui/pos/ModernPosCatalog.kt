package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import coil.size.Size
import com.chaslay.pos.R
import com.chaslay.pos.ui.components.ExpandableOrdersSearch
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.domain.model.PosMenuDesign
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.categoryColor
import com.chaslay.pos.ui.theme.posUiColors
import java.util.Locale

@Composable
fun ModernPosCatalogPane(
    design: PosMenuDesign,
    categories: List<CategoryEntity>,
    selectedCategoryId: Long?,
    products: List<ProductEntity>,
    currencySymbol: String,
    gridColumns: Int,
    sortAlpha: Boolean,
    sortBestseller: Boolean,
    showProductImagesPref: Boolean,
    isGiftCardCategory: Boolean,
    membershipEnabled: Boolean,
    highlightedProductId: Long?,
    showScanButton: Boolean,
    emptyCatalogHint: String?,
    paymentEnabled: Boolean,
    cashEnabled: Boolean,
    cardEnabled: Boolean,
    terminalEnabled: Boolean,
    expressEnabled: Boolean,
    onCategorySelected: (Long?) -> Unit,
    onProductClick: (Long) -> Unit,
    onMiscClick: () -> Unit,
    onScanBarcode: () -> Unit,
    onSellGiftCard: () -> Unit,
    onSellMembership: () -> Unit,
    onToggleShowImages: () -> Unit,
    onToggleSortAlpha: () -> Unit,
    onToggleSortBestseller: () -> Unit,
    onCycleGridColumns: () -> Unit,
    onCash: () -> Unit,
    onCard: () -> Unit,
    onTerminal: () -> Unit,
    onOpenCheckout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    var searchQuery by remember { mutableStateOf("") }
    val filteredProducts = remember(products, searchQuery) {
        val q = searchQuery.trim()
        if (q.isEmpty()) products
        else products.filter { it.name.contains(q, ignoreCase = true) }
    }
    val showImages = showProductImagesPref

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(ui.canvas),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            ExpandableOrdersSearch(
                query = searchQuery,
                onQueryChange = { searchQuery = it },
                placeholderRes = R.string.pos_catalog_search_hint,
                modifier = Modifier
                    .weight(1f)
                    .widthIn(min = 40.dp),
                expandedMinWidth = 180.dp,
                expandedMaxWidth = 720.dp,
                searchContentDescriptionRes = R.string.pos_catalog_search_hint,
            )
            ModernPosCatalogFilters(
                showProductImages = showProductImagesPref,
                sortAlpha = sortAlpha,
                sortBestseller = sortBestseller,
                gridColumns = gridColumns,
                onToggleShowImages = onToggleShowImages,
                onToggleSortAlpha = onToggleSortAlpha,
                onToggleSortBestseller = onToggleSortBestseller,
                onCycleGridColumns = onCycleGridColumns,
            )
        }

        Row(modifier = Modifier.weight(1f).fillMaxWidth()) {
            if (design == PosMenuDesign.MODERN_SIDE) {
                ModernPosSideCategoryColumn(
                    categories = categories,
                    selectedCategoryId = selectedCategoryId,
                    emptyCatalogHint = emptyCatalogHint,
                    onCategorySelected = onCategorySelected,
                    modifier = Modifier
                        .width(132.dp)
                        .fillMaxHeight(),
                )
            }

            Column(modifier = Modifier.weight(1f).fillMaxHeight()) {
                if (design == PosMenuDesign.MODERN_TOP) {
                    ModernPosTopCategoryRow(
                        categories = categories,
                        selectedCategoryId = selectedCategoryId,
                        onCategorySelected = onCategorySelected,
                    )
                }
                ModernPosProductGrid(
                    products = filteredProducts,
                    currencySymbol = currencySymbol,
                    gridColumns = gridColumns,
                    showImages = showImages,
                    isGiftCardCategory = isGiftCardCategory,
                    membershipEnabled = membershipEnabled,
                    highlightedProductId = highlightedProductId,
                    showScanButton = showScanButton,
                    onProductClick = onProductClick,
                    onMiscClick = onMiscClick,
                    onScanBarcode = onScanBarcode,
                    onSellGiftCard = onSellGiftCard,
                    onSellMembership = onSellMembership,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        CartExpressCheckoutRow(
            paymentEnabled = paymentEnabled,
            cashEnabled = cashEnabled,
            cardEnabled = cardEnabled,
            terminalEnabled = terminalEnabled,
            expressEnabled = expressEnabled,
            onCash = onCash,
            onCard = onCard,
            onTerminal = onTerminal,
            onOpenCheckout = onOpenCheckout,
            modifier = Modifier.background(ui.surfaceSubtle).padding(8.dp),
        )
    }
}

@Composable
private fun ModernPosCatalogFilters(
    showProductImages: Boolean,
    sortAlpha: Boolean,
    sortBestseller: Boolean,
    gridColumns: Int,
    onToggleShowImages: () -> Unit,
    onToggleSortAlpha: () -> Unit,
    onToggleSortBestseller: () -> Unit,
    onCycleGridColumns: () -> Unit,
) {
    val ui = posUiColors()
    var expanded by remember { mutableStateOf(false) }
    val activeFilters = listOf(showProductImages, sortAlpha, sortBestseller).count { it }
    Box {
        IconButton(
            onClick = { expanded = true },
            modifier = Modifier
                .size(40.dp)
                .border(1.dp, if (activeFilters > 0) PosColors.Primary else ui.border, PosShapes.Medium)
                .background(ui.surface, PosShapes.Medium),
        ) {
            Icon(
                Icons.Default.FilterList,
                contentDescription = stringResource(R.string.pos_catalog_filters),
                tint = if (activeFilters > 0) PosColors.Primary else ui.textPrimary,
                modifier = Modifier.size(20.dp),
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = {
                    Text(
                        stringResource(R.string.product_grid_images) +
                            if (showProductImages) " ✓" else "",
                    )
                },
                onClick = {
                    expanded = false
                    onToggleShowImages()
                },
                leadingIcon = {
                    Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(18.dp))
                },
            )
            DropdownMenuItem(
                text = {
                    Text(
                        stringResource(R.string.product_grid_sort_alpha) +
                            if (sortAlpha) " ✓" else "",
                    )
                },
                onClick = {
                    expanded = false
                    onToggleSortAlpha()
                },
            )
            DropdownMenuItem(
                text = {
                    Text(
                        stringResource(R.string.product_grid_sort_top) +
                            if (sortBestseller) " ✓" else "",
                    )
                },
                onClick = {
                    expanded = false
                    onToggleSortBestseller()
                },
            )
            DropdownMenuItem(
                text = {
                    Text(stringResource(R.string.product_grid_columns, gridColumns))
                },
                onClick = {
                    expanded = false
                    onCycleGridColumns()
                },
            )
        }
    }
}

@Composable
private fun ModernPosTopCategoryRow(
    categories: List<CategoryEntity>,
    selectedCategoryId: Long?,
    onCategorySelected: (Long?) -> Unit,
) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 10.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        categories.forEach { category ->
            val selected = selectedCategoryId == category.id
            ModernPosCategoryChip(
                label = category.name,
                accent = categoryColor(category.colorHex),
                selected = selected,
                onClick = { onCategorySelected(category.id) },
            )
        }
    }
    Spacer(modifier = Modifier.height(4.dp))
}

@Composable
private fun ModernPosSideCategoryColumn(
    categories: List<CategoryEntity>,
    selectedCategoryId: Long?,
    emptyCatalogHint: String?,
    onCategorySelected: (Long?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    Column(
        modifier = modifier
            .background(ui.surfaceSubtle)
            .verticalScroll(rememberScrollState())
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        categories.forEach { category ->
            val selected = selectedCategoryId == category.id
            val accent = categoryColor(category.colorHex)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (selected) ui.primarySubtle else ui.surface)
                    .border(
                        width = if (selected) 2.dp else 1.dp,
                        color = if (selected) PosColors.Primary else ui.border,
                        shape = RoundedCornerShape(10.dp),
                    )
                    .clickable { onCategorySelected(category.id) }
                    .padding(horizontal = 8.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ModernPosCategoryIcon(accent = accent)
                Text(
                    category.name,
                    color = ui.textPrimary,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                    fontSize = 12.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        if (!emptyCatalogHint.isNullOrBlank()) {
            Text(
                emptyCatalogHint,
                color = ui.textSecondary,
                fontSize = 11.sp,
                lineHeight = 14.sp,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun ModernPosCategoryChip(
    label: String,
    accent: Color,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(if (selected) ui.primarySubtle else ui.surface)
            .border(
                1.dp,
                if (selected) PosColors.Primary else ui.border,
                RoundedCornerShape(20.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        ModernPosCategoryIcon(accent = accent, small = true)
        Text(
            label,
            color = if (selected) PosColors.Primary else ui.textPrimary,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun ModernPosCategoryIcon(accent: Color, small: Boolean = false) {
    val size = if (small) 22.dp else 28.dp
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(accent.copy(alpha = 0.2f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Default.Category,
            contentDescription = null,
            tint = accent,
            modifier = Modifier.size(if (small) 14.dp else 16.dp),
        )
    }
}

@Composable
private fun ModernPosProductGrid(
    products: List<ProductEntity>,
    currencySymbol: String,
    gridColumns: Int,
    showImages: Boolean,
    isGiftCardCategory: Boolean,
    membershipEnabled: Boolean,
    highlightedProductId: Long?,
    showScanButton: Boolean,
    onProductClick: (Long) -> Unit,
    onMiscClick: () -> Unit,
    onScanBarcode: () -> Unit,
    onSellGiftCard: () -> Unit,
    onSellMembership: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    if (isGiftCardCategory) {
        Column(
            modifier = modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Button(
                onClick = onSellGiftCard,
                modifier = Modifier.fillMaxWidth().height(120.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = PosColors.Primary),
            ) {
                Text(
                    stringResource(R.string.gift_card_sell),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            if (membershipEnabled) {
                Button(
                    onClick = onSellMembership,
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5)),
                ) {
                    Text(
                        stringResource(R.string.membership_sell_title),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        return
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(gridColumns.coerceIn(2, 6)),
        modifier = modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(bottom = 8.dp),
    ) {
        if (showScanButton) {
            item(key = "scan") {
                ModernPosUtilityTile(
                    label = stringResource(R.string.scan_barcode),
                    icon = Icons.Default.QrCodeScanner,
                    onClick = onScanBarcode,
                )
            }
        }
        item(key = "misc") {
            ModernPosUtilityTile(
                label = stringResource(R.string.misc_item),
                icon = Icons.Default.Menu,
                onClick = onMiscClick,
            )
        }
        items(products, key = { it.id }) { product ->
            ModernPosProductTile(
                product = product,
                currencySymbol = currencySymbol,
                showImage = showImages,
                highlighted = product.id == highlightedProductId,
                onClick = { onProductClick(product.id) },
            )
        }
    }
}

@Composable
private fun ModernPosUtilityTile(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
) {
    val ui = posUiColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(132.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(ui.surface)
            .border(1.dp, ui.border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = PosColors.Primary, modifier = Modifier.size(32.dp))
        Spacer(modifier = Modifier.height(8.dp))
        Text(label, color = ui.textPrimary, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, fontSize = 13.sp)
    }
}

@Composable
private fun ModernPosProductTile(
    product: ProductEntity,
    currencySymbol: String,
    showImage: Boolean,
    highlighted: Boolean,
    onClick: () -> Unit,
) {
    val ui = posUiColors()
    val context = LocalContext.current
    val thumbSize = remember { Size(256, 256) }
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(132.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(ui.surface)
            .border(
                width = if (highlighted) 2.dp else 1.dp,
                color = if (highlighted) PosColors.Primary else ui.border,
                shape = RoundedCornerShape(12.dp),
            )
            .clickable(onClick = onClick)
            .padding(8.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(8.dp))
                .background(ui.surfaceMuted),
            contentAlignment = Alignment.Center,
        ) {
            if (showImage && !product.imageUri.isNullOrBlank()) {
                AsyncImage(
                    model = ImageRequest.Builder(context)
                        .data(product.imageUri)
                        .size(thumbSize)
                        .crossfade(true)
                        .build(),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Icon(Icons.Default.Image, contentDescription = null, tint = ui.textMuted, modifier = Modifier.size(28.dp))
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            product.name,
            color = ui.textPrimary,
            fontWeight = FontWeight.SemiBold,
            fontSize = 12.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (!product.isOpenPrice) {
            Text(
                modernFormatMoney(product.price, currencySymbol),
                color = PosColors.Primary,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
            )
        }
    }
}

@Composable
internal fun ModernPosCartLineThumbnail(imageUri: String?, modifier: Modifier = Modifier) {
    val ui = posUiColors()
    val context = LocalContext.current
    val thumbSize = remember { Size(80, 80) }
    Box(
        modifier = modifier
            .size(40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(ui.surfaceMuted)
            .border(1.dp, ui.border, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (!imageUri.isNullOrBlank()) {
            AsyncImage(
                model = ImageRequest.Builder(context)
                    .data(imageUri)
                    .size(thumbSize)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Icon(Icons.Default.Image, contentDescription = null, tint = ui.textMuted, modifier = Modifier.size(18.dp))
        }
    }
}

private fun modernFormatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
