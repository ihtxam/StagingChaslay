package com.chaslay.pos.ui.pos.compact

import android.app.Activity
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.outlined.CreditCard
import androidx.compose.material.icons.filled.TableRestaurant
import androidx.compose.material.icons.outlined.AccountBalanceWallet
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.Note
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.data.local.entity.isAdyenTerminalCheckoutEnabled
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.domain.model.UserAccess
import com.chaslay.pos.ui.components.PosVectorIcon
import com.chaslay.pos.ui.components.posCategoryIconRes
import com.chaslay.pos.ui.navigation.AppRoute
import com.chaslay.pos.ui.pos.PosUiState
import com.chaslay.pos.ui.pos.PosViewModel
import com.chaslay.pos.ui.theme.categoryColor
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class CompactSheet {
    NONE,
    CART,
    MORE,
}

private enum class CompactPosRoute {
    SALE,
    TABLES,
}

@Composable
fun CompactPosScreen(
    state: PosUiState,
    loggedInUserName: String?,
    userAccess: UserAccess,
    viewModel: PosViewModel,
    onNavigate: (String) -> Unit,
    onOrderHistory: () -> Unit,
) {
    val context = LocalContext.current
    val activity = context as? Activity
    var sheet by remember { mutableStateOf(CompactSheet.NONE) }
    var route by remember { mutableStateOf(CompactPosRoute.SALE) }
    val cart = state.cart
    val total = cart.displayTotal
    val currency = state.currencySymbol
    val paymentEnabled = cart.isEmpty.not() && !state.isProcessingPayment
    val isRestaurantMode = state.settings.posMode == PosMode.RESTAURANT
    val isTableService = state.settings.tablesEnabled &&
        (isRestaurantMode || state.settings.retailDineInEnabled)
    val isTableMode = isTableService && state.activeTableName != null
    val hasUnsentItems = cart.items.any { !it.sentToKitchen }
    val showKitchenSend = isRestaurantMode && isTableMode && hasUnsentItems
    val sendKitchenEnabled = hasUnsentItems && cart.isEmpty.not() && !state.isProcessingPayment
    val terminalEnabled = state.settings.isAdyenTerminalCheckoutEnabled()
    val cardDockEnabled = state.settings.cardEnabled || terminalEnabled
    val cartQtyByProduct = remember(cart.items) {
        cart.items.groupBy { it.productId }.mapValues { (_, lines) -> lines.sumOf { it.quantity } }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(CompactPosColors.Bg)
    ) {
        when (route) {
            CompactPosRoute.TABLES -> {
                CompactPosTablesScreen(
                    tables = state.tables,
                    tableFloors = state.tableFloors,
                    currencySymbol = currency,
                    activeTableName = state.activeTableName,
                    cartTotal = total,
                    onBack = { route = CompactPosRoute.SALE },
                    onSelectTable = { id ->
                        viewModel.openTable(id)
                        route = CompactPosRoute.SALE
                    },
                    onContinue = {
                        route = CompactPosRoute.SALE
                    },
                )
            }
            CompactPosRoute.SALE -> {
                Column(modifier = Modifier.fillMaxSize()) {
                    val canOpenSettings = userAccess.canAccessSettings() ||
                        userAccess.canManageProducts() ||
                        userAccess.canAccessReports()
                    CompactPosHeader(
                        businessName = state.settings.businessName ?: stringResource(R.string.nav_settings),
                        staffName = loggedInUserName ?: stringResource(R.string.pos_register),
                        showTables = isTableService,
                        showHistory = userAccess.canViewOrderHistory(),
                        canOpenSettings = canOpenSettings,
                        onTables = { route = CompactPosRoute.TABLES },
                        onHistory = onOrderHistory,
                        onOpenSettings = { onNavigate(AppRoute.Admin.route) },
                    )
                    CompactOrderTypeBlock(
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 10.dp),
                        activeTableName = state.activeTableName,
                        fulfillmentType = cart.fulfillmentType,
                        retailDeliveryEnabled = state.settings.retailDeliveryEnabled,
                        isRestaurantMode = isRestaurantMode,
                        onTakeaway = viewModel::switchToRetailTakeawayFromMenu,
                        onDelivery = viewModel::showDeliveryOrderDialog,
                        onReleaseTable = viewModel::releaseTableForTakeaway,
                    )
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        CompactCategoryRail(
                            categories = state.displayCategories,
                            selectedId = state.selectedCategoryId,
                            onSelect = viewModel::selectCategory,
                            modifier = Modifier.width(164.dp),
                        )
                        CompactProductGrid(
                            products = state.products,
                            categories = state.displayCategories,
                            currencySymbol = currency,
                            quantities = cartQtyByProduct,
                            onProductClick = viewModel::onProductClick,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (sheet != CompactSheet.CART) {
                        CompactMinimizedCartBar(
                            cart = cart,
                            currencySymbol = currency,
                            modifier = Modifier
                                .padding(horizontal = 16.dp)
                                .alpha(if (sheet == CompactSheet.CART) 0f else 1f),
                            onExpand = { sheet = CompactSheet.CART },
                        )
                    }
                    CompactPaymentDock(
                        total = total,
                        currencySymbol = currency,
                        paymentEnabled = paymentEnabled,
                        showKitchenSend = showKitchenSend,
                        sendKitchenEnabled = sendKitchenEnabled,
                        cashEnabled = state.settings.cashEnabled,
                        cardEnabled = cardDockEnabled,
                        moreOpen = sheet == CompactSheet.MORE,
                        onSendKitchen = viewModel::sendAllCoursesToKitchen,
                        onCash = { viewModel.initiateCashPayment(activity) },
                        onCard = {
                            if (terminalEnabled) {
                                viewModel.initiateTerminalPayment(activity)
                            } else {
                                viewModel.initiateCardPayment(activity)
                            }
                        },
                        onToggleMore = {
                            sheet = if (sheet == CompactSheet.MORE) CompactSheet.NONE else CompactSheet.MORE
                        },
                    )
                }
            }
        }

        if (sheet != CompactSheet.NONE && route == CompactPosRoute.SALE) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(bottom = 114.dp)
                    .background(CompactPosColors.DimOverlay)
                    .clickable { sheet = CompactSheet.NONE }
            )
        }

        if (sheet == CompactSheet.MORE && route == CompactPosRoute.SALE) {
            CompactMoreActionsSheet(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(start = 16.dp, end = 16.dp, bottom = 202.dp),
                onDismiss = { sheet = CompactSheet.NONE },
                onDiscount = { viewModel.showDiscountDialog(); sheet = CompactSheet.NONE },
                onSplit = { viewModel.openSplitBillScreen(); sheet = CompactSheet.NONE },
                onVoucher = { viewModel.showGiftCardOpsMenu(); sheet = CompactSheet.NONE },
                onPark = { viewModel.holdOrder(false); sheet = CompactSheet.NONE },
                onNote = { viewModel.showKitchenMessageDialog(); sheet = CompactSheet.NONE },
                onCancel = { viewModel.showCartCancelDialog(); sheet = CompactSheet.NONE },
            )
        }

        if (sheet == CompactSheet.CART && route == CompactPosRoute.SALE) {
            CompactCartSheet(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(start = 16.dp, end = 16.dp, bottom = 114.dp),
                cart = cart,
                currencySymbol = currency,
                tableName = state.activeTableName,
                vatIncluded = state.settings.vatIncludedInPrice,
                showKitchenSend = showKitchenSend,
                sendKitchenEnabled = sendKitchenEnabled,
                onSendKitchen = viewModel::sendAllCoursesToKitchen,
                onDismiss = { sheet = CompactSheet.NONE },
                onIncrement = viewModel::incrementItemQuantity,
                onDecrement = viewModel::decrementItemQuantity,
            )
        }
    }
}

@Composable
private fun CompactPosHeader(
    businessName: String,
    staffName: String,
    showTables: Boolean,
    showHistory: Boolean,
    canOpenSettings: Boolean,
    onTables: () -> Unit,
    onHistory: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val now = remember { System.currentTimeMillis() }
    val time = remember(now) { SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(now)) }
    val date = remember(now) { SimpleDateFormat("EEE d MMM", Locale.getDefault()).format(Date(now)) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.weight(1f),
        ) {
            if (showTables) {
                CompactHeaderNavButton(
                    label = stringResource(R.string.tables),
                    icon = Icons.Default.TableRestaurant,
                    onClick = onTables,
                )
            }
            if (showHistory) {
                CompactHeaderNavButton(
                    label = stringResource(R.string.compact_pos_history_short),
                    icon = Icons.Default.History,
                    onClick = onHistory,
                )
            }
        }
        Column(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.End,
        ) {
            Text(
                businessName,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = CompactPosColors.Ink,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                staffName,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = CompactPosColors.Muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (canOpenSettings) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .shadow(2.dp, RoundedCornerShape(14.dp))
                    .clip(RoundedCornerShape(14.dp))
                    .background(CompactPosColors.Surface)
                    .clickable(onClick = onOpenSettings),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Default.Settings,
                    contentDescription = stringResource(R.string.settings),
                    tint = CompactPosColors.Ink2,
                    modifier = Modifier.size(22.dp),
                )
            }
        }
        Column(horizontalAlignment = Alignment.End, modifier = Modifier.padding(start = 4.dp)) {
            Text(time, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = CompactPosColors.Ink)
            Text(date, fontSize = 11.5.sp, color = CompactPosColors.Muted, maxLines = 1)
        }
    }
}

@Composable
private fun CompactHeaderNavButton(
    label: String,
    icon: ImageVector,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .height(56.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        color = CompactPosColors.Surface,
        shadowElevation = 2.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(icon, contentDescription = null, tint = CompactPosColors.Teal, modifier = Modifier.size(22.dp))
            Text(
                label,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = CompactPosColors.Ink,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun CompactOrderTypeBlock(
    activeTableName: String?,
    fulfillmentType: FulfillmentType,
    retailDeliveryEnabled: Boolean,
    isRestaurantMode: Boolean,
    onTakeaway: () -> Unit,
    onDelivery: () -> Unit,
    onReleaseTable: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tableSelected = activeTableName != null
    Column(modifier = modifier.fillMaxWidth()) {
        if (tableSelected) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(CompactPosColors.Teal)
                    .padding(start = 16.dp, end = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        stringResource(R.string.dine_in).uppercase(Locale.getDefault()),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White.copy(alpha = 0.8f),
                    )
                    Text(
                        activeTableName,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Box(
                    modifier = Modifier
                        .width(56.dp)
                        .height(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.16f))
                        .clickable(onClick = onReleaseTable),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = stringResource(R.string.compact_pos_release_table),
                        tint = Color.White,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        } else {
            val takeawaySelected = fulfillmentType != FulfillmentType.DELIVERY
            val deliverySelected = fulfillmentType == FulfillmentType.DELIVERY
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(CompactPosColors.SegmentTrack)
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                CompactSegment(
                    modifier = Modifier.weight(1f),
                    label = stringResource(R.string.take_away),
                    icon = Icons.Default.ShoppingBag,
                    selected = takeawaySelected,
                    onClick = onTakeaway,
                )
                if (retailDeliveryEnabled || isRestaurantMode) {
                    CompactSegment(
                        modifier = Modifier.weight(1f),
                        label = stringResource(R.string.delivery),
                        icon = Icons.Default.LocalShipping,
                        selected = deliverySelected,
                        onClick = onDelivery,
                    )
                }
            }
            Text(
                stringResource(R.string.compact_pos_table_dine_in_hint),
                modifier = Modifier.padding(start = 4.dp, top = 6.dp),
                fontSize = 12.sp,
                color = CompactPosColors.Muted,
            )
        }
    }
}

@Composable
private fun CompactSegment(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val bg = if (selected) CompactPosColors.Surface else Color.Transparent
    val iconTint = if (selected) CompactPosColors.Teal else CompactPosColors.Ink2.copy(alpha = 0.7f)
    val textColor = if (selected) CompactPosColors.Ink else CompactPosColors.Ink2
    Surface(
        modifier = modifier
            .fillMaxHeight()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        color = bg,
        shadowElevation = if (selected) 2.dp else 0.dp,
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text(label, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = textColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun CompactCategoryRail(
    categories: List<CategoryEntity>,
    selectedId: Long?,
    onSelect: (Long?) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxHeight(),
        shape = RoundedCornerShape(20.dp),
        color = CompactPosColors.Surface,
        shadowElevation = 4.dp,
    ) {
        LazyColumn(
            modifier = Modifier.padding(6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(categories, key = { it.id }) { category ->
                val selected = category.id == selectedId
                val rowBg = if (selected) CompactPosColors.Navy else Color.Transparent
                val textColor = if (selected) Color.White else CompactPosColors.Ink2
                val wellBg = if (selected) Color.White.copy(alpha = 0.14f) else Color(0xFFF1F4F7)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(rowBg)
                        .clickable { onSelect(category.id) }
                        .padding(horizontal = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(wellBg),
                        contentAlignment = Alignment.Center,
                    ) {
                        posCategoryIconRes(category.name, category.remoteId)?.let { res ->
                            PosVectorIcon(
                                resId = res,
                                contentDescription = null,
                                tint = if (selected) Color.White else CompactPosColors.Ink2,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                    Text(
                        category.name,
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = textColor,
                        lineHeight = 15.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun CompactProductGrid(
    products: List<ProductEntity>,
    categories: List<CategoryEntity>,
    currencySymbol: String,
    quantities: Map<Long, Int>,
    onProductClick: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colorByCategoryId = remember(categories) {
        categories.associate { it.id to categoryColor(it.colorHex) }
    }
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = modifier.fillMaxHeight(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(products, key = { it.id }) { product ->
            val accent = colorByCategoryId[product.categoryId] ?: CompactPosColors.Teal
            val tint = accent.copy(alpha = 0.13f).compositeOver(CompactPosColors.Surface)
            val qty = quantities[product.id] ?: 0
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .shadow(2.dp, RoundedCornerShape(14.dp))
                    .clip(RoundedCornerShape(14.dp))
                    .background(tint)
                    .clickable { onProductClick(product.id) }
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(accent)
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        product.name,
                        fontSize = 14.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = CompactPosColors.Ink,
                        lineHeight = 17.sp,
                        minLines = 2,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        formatCompactMoney(product.price, currencySymbol),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = CompactPosColors.Ink,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
                if (qty > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(top = 4.dp, end = 0.dp)
                            .height(24.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(CompactPosColors.Navy)
                            .padding(horizontal = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("$qty", color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun CompactMinimizedCartBar(
    cart: CartSummary,
    currencySymbol: String,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val itemCount = cart.items.sumOf { it.quantity }
    val preview = remember(cart.items) {
        cart.items
            .groupBy { it.productName }
            .map { (name, lines) ->
                val qty = lines.sumOf { it.quantity }
                if (qty > 1) "$qty× $name" else name
            }
            .take(3)
            .joinToString(", ")
    }
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .height(72.dp)
            .clickable(onClick = onExpand),
        shape = RoundedCornerShape(18.dp),
        color = CompactPosColors.Surface,
        shadowElevation = 4.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    stringResource(R.string.compact_pos_cart_items, itemCount),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = CompactPosColors.Muted,
                )
                Text(
                    preview.ifBlank { "—" },
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = CompactPosColors.Ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    stringResource(R.string.compact_pos_total_ttc),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = CompactPosColors.Muted,
                )
                Text(
                    formatCompactMoney(cart.displayTotal, currencySymbol),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = CompactPosColors.Ink,
                )
            }
        }
    }
}

@Composable
private fun CompactPaymentDock(
    total: Double,
    currencySymbol: String,
    paymentEnabled: Boolean,
    showKitchenSend: Boolean,
    sendKitchenEnabled: Boolean,
    cashEnabled: Boolean,
    cardEnabled: Boolean,
    moreOpen: Boolean,
    onSendKitchen: () -> Unit,
    onCash: () -> Unit,
    onCard: () -> Unit,
    onToggleMore: () -> Unit,
) {
    val amount = formatCompactMoney(total, currencySymbol)
    val disabledMod = if (paymentEnabled) Modifier else Modifier.alpha(0.4f)
    val sendDisabledMod = if (sendKitchenEnabled) Modifier else Modifier.alpha(0.4f)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(CompactPosColors.Bg)
            .padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            if (showKitchenSend) {
                CompactPayButton(
                    modifier = Modifier.weight(1f).then(sendDisabledMod),
                    label = stringResource(R.string.compact_pos_send_kitchen),
                    amount = amount,
                    background = CompactPosColors.TableFreeStatus,
                    icon = Icons.Default.Send,
                    enabled = sendKitchenEnabled,
                    onClick = onSendKitchen,
                )
            } else {
                if (cardEnabled) {
                    CompactPayButton(
                        modifier = Modifier.weight(1f).then(disabledMod),
                        label = stringResource(R.string.compact_pos_pay_card),
                        amount = amount,
                        background = CompactPosColors.Navy,
                        icon = Icons.Outlined.CreditCard,
                        enabled = paymentEnabled,
                        onClick = onCard,
                    )
                }
                if (cashEnabled) {
                    CompactPayButton(
                        modifier = Modifier.weight(1f).then(disabledMod),
                        label = stringResource(R.string.compact_pos_pay_cash),
                        amount = amount,
                        background = CompactPosColors.Cash,
                        icon = Icons.Outlined.Payments,
                        enabled = paymentEnabled,
                        onClick = onCash,
                    )
                }
            }
            Surface(
                modifier = Modifier
                    .width(72.dp)
                    .height(88.dp)
                    .clickable(onClick = onToggleMore),
                shape = RoundedCornerShape(18.dp),
                color = if (moreOpen) CompactPosColors.Navy else CompactPosColors.Surface,
                shadowElevation = 4.dp,
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        if (moreOpen) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowUp,
                        contentDescription = stringResource(R.string.compact_pos_more_actions),
                        tint = if (moreOpen) Color.White else CompactPosColors.Ink2,
                        modifier = Modifier.size(28.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun CompactPayButton(
    label: String,
    amount: String,
    background: Color,
    icon: ImageVector,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .height(88.dp)
            .clickable(enabled = enabled, onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = background,
        shadowElevation = 6.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
            Column {
                Text(label, fontSize = 13.sp, color = Color.White.copy(alpha = 0.8f))
                Text(amount, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
private fun CompactCartSheet(
    cart: CartSummary,
    currencySymbol: String,
    tableName: String?,
    vatIncluded: Boolean,
    showKitchenSend: Boolean,
    sendKitchenEnabled: Boolean,
    onSendKitchen: () -> Unit,
    onDismiss: () -> Unit,
    onIncrement: (String) -> Unit,
    onDecrement: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val orderLabel = cart.orderNumber?.let { "#$it" } ?: "—"
    val subtitle = listOfNotNull(orderLabel, tableName).joinToString(" · ")
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = CompactPosColors.Surface,
        shadowElevation = 12.dp,
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
            Box(
                modifier = Modifier
                    .width(40.dp)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(Color(0xFFD5DBE3))
                    .align(Alignment.CenterHorizontally),
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.compact_pos_current_order_title), fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = CompactPosColors.Ink)
                    Text(subtitle, fontSize = 12.5.sp, color = CompactPosColors.Muted)
                }
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF1F4F7))
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.KeyboardArrowDown, contentDescription = stringResource(R.string.close), tint = CompactPosColors.Ink2)
                }
            }
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.heightIn(max = 360.dp),
            ) {
                items(cart.items, key = { it.id }) { item ->
                    CompactCartLine(
                        item = item,
                        currencySymbol = currencySymbol,
                        onIncrement = { onIncrement(item.id) },
                        onDecrement = { onDecrement(item.id) },
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(CompactPosColors.Line))
            if (showKitchenSend) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .height(64.dp)
                        .then(if (sendKitchenEnabled) Modifier else Modifier.alpha(0.4f))
                        .clickable(enabled = sendKitchenEnabled, onClick = onSendKitchen),
                    shape = RoundedCornerShape(16.dp),
                    color = CompactPosColors.TableFreeStatus,
                    shadowElevation = 4.dp,
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Icon(
                            Icons.Default.Send,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(24.dp),
                        )
                        Text(
                            stringResource(R.string.send_to_kitchen),
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                val itemCount = cart.items.sumOf { it.quantity }
                val vatHint = if (vatIncluded) stringResource(R.string.compact_pos_incl_vat, itemCount) else "$itemCount ${stringResource(R.string.order_history_articles).lowercase()}"
                Text(vatHint, fontSize = 12.5.sp, color = CompactPosColors.Muted, modifier = Modifier.weight(1f))
                Text(formatCompactMoney(cart.displayTotal, currencySymbol), fontSize = 26.sp, fontWeight = FontWeight.Bold, color = CompactPosColors.Ink)
            }
        }
    }
}

@Composable
private fun CompactCartLine(
    item: CartItem,
    currencySymbol: String,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(CompactPosColors.CartRowBg)
            .padding(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            CompactStepperButton(Icons.Default.Remove, stringResource(R.string.compact_pos_decrease), onDecrement)
            Text(
                "${item.quantity}",
                modifier = Modifier.width(36.dp),
                textAlign = TextAlign.Center,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = CompactPosColors.Ink,
            )
            CompactStepperButton(Icons.Default.Add, stringResource(R.string.compact_pos_increase), onIncrement)
        }
        Column(modifier = Modifier.weight(1f).padding(horizontal = 8.dp)) {
            Text(item.productName, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = CompactPosColors.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(
                stringResource(R.string.compact_pos_each_price, formatCompactMoney(item.unitPrice, currencySymbol)),
                fontSize = 12.5.sp,
                color = CompactPosColors.Muted,
            )
        }
        Text(
            formatCompactMoney(item.lineSubtotal, currencySymbol),
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            color = CompactPosColors.Ink,
            modifier = Modifier.padding(end = 8.dp),
        )
    }
}

@Composable
private fun CompactStepperButton(icon: ImageVector, contentDescription: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(56.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(CompactPosColors.Surface)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = contentDescription, tint = CompactPosColors.Ink2, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun CompactMoreActionsSheet(
    onDismiss: () -> Unit,
    onDiscount: () -> Unit,
    onSplit: () -> Unit,
    onVoucher: () -> Unit,
    onPark: () -> Unit,
    onNote: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val actions = listOf(
        Triple(stringResource(R.string.discount), Icons.Outlined.LocalOffer, onDiscount),
        Triple(stringResource(R.string.split_bill), Icons.AutoMirrored.Filled.CallSplit, onSplit),
        Triple(stringResource(R.string.payment_gift_card), Icons.Outlined.Payments, onVoucher),
        Triple(stringResource(R.string.hold_order), Icons.Outlined.AccountBalanceWallet, onPark),
        Triple(stringResource(R.string.add_note), Icons.Outlined.Note, onNote),
        Triple(stringResource(R.string.cancel), Icons.Default.Close, onCancel),
    )
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        color = CompactPosColors.Surface,
        shadowElevation = 12.dp,
    ) {
        Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    stringResource(R.string.compact_pos_more_actions),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = CompactPosColors.Ink,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF1F4F7))
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Default.Close, contentDescription = stringResource(R.string.close), tint = CompactPosColors.Ink2)
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                actions.chunked(3).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { (label, icon, action) ->
                            val danger = label == stringResource(R.string.cancel)
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(108.dp)
                                    .clickable(onClick = action),
                                shape = RoundedCornerShape(16.dp),
                                color = if (danger) CompactPosColors.DangerBg else CompactPosColors.ActionCellBg,
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center,
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .shadow(2.dp, RoundedCornerShape(12.dp))
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(CompactPosColors.Surface),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Icon(
                                            icon,
                                            contentDescription = null,
                                            tint = if (danger) CompactPosColors.Danger else CompactPosColors.Navy,
                                            modifier = Modifier.size(22.dp),
                                        )
                                    }
                                    Spacer(Modifier.height(8.dp))
                                    Text(
                                        label,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (danger) CompactPosColors.Danger else CompactPosColors.Ink,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }
    }
}

@Composable
fun CompactPosTablesScreen(
    tables: List<TableWithOrderInfo>,
    tableFloors: List<com.chaslay.pos.data.local.entity.TableFloorEntity>,
    currencySymbol: String,
    activeTableName: String?,
    cartTotal: Double,
    onBack: () -> Unit,
    onSelectTable: (Long) -> Unit,
    onContinue: () -> Unit,
) {
    val floorTables = remember(tables, tableFloors) {
        val floors = tableFloors.filter { it.isActive }.sortedBy { it.sortOrder }
        if (floors.isNotEmpty()) {
            floors.flatMap { floor -> tables.filter { it.floorId == floor.id } }
        } else {
            tables
        }
    }
    Column(modifier = Modifier.fillMaxSize().background(CompactPosColors.Bg)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(CompactPosColors.Surface)
                    .clickable(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back_to_pos), tint = CompactPosColors.Ink)
            }
            Text(
                stringResource(R.string.tables),
                modifier = Modifier.weight(1f).padding(horizontal = 12.dp),
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
                color = CompactPosColors.Ink,
            )
        }
        CompactTableLegend(modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp))
        LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 20.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(CompactPosColors.Surface)
                .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(floorTables, key = { it.id }) { table ->
                CompactTableCard(
                    table = table,
                    currencySymbol = currencySymbol,
                    isCurrent = table.name == activeTableName,
                    onClick = { onSelectTable(table.id) },
                )
            }
        }
        val ctaTable = activeTableName ?: stringResource(R.string.select_table)
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp)
                .height(80.dp)
                .clickable(onClick = onContinue),
            shape = RoundedCornerShape(18.dp),
            color = CompactPosColors.Navy,
            shadowElevation = 8.dp,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 22.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(stringResource(R.string.compact_pos_continue_serving), fontSize = 13.sp, color = Color.White.copy(alpha = 0.75f))
                    Text(stringResource(R.string.compact_pos_open_table, ctaTable), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
                Text(formatCompactMoney(cartTotal, currencySymbol), fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
private fun CompactTableLegend(modifier: Modifier = Modifier) {
    val items = listOf(
        CompactPosColors.TableFreeStatus to stringResource(R.string.compact_pos_table_free),
        CompactPosColors.Ink2 to stringResource(R.string.table_busy),
        CompactPosColors.TableReservedStatus to stringResource(R.string.compact_pos_table_reserved),
        CompactPosColors.Teal to stringResource(R.string.compact_pos_current_table),
    )
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        items.forEach { (color, label) ->
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(Modifier.size(10.dp).clip(CircleShape).background(color))
                Text(label, fontSize = 11.sp, color = CompactPosColors.Muted)
            }
        }
    }
}

@Composable
private fun CompactTableCard(
    table: TableWithOrderInfo,
    currencySymbol: String,
    isCurrent: Boolean,
    onClick: () -> Unit,
) {
    val style = when {
        isCurrent -> TableCardStyle(CompactPosColors.TealSoft, CompactPosColors.Teal, CompactPosColors.Teal, stringResource(R.string.compact_pos_current_table))
        table.status == TableStatus.FREE -> TableCardStyle(CompactPosColors.TableFreeBg, CompactPosColors.TableFreeBorder, CompactPosColors.TableFreeStatus, stringResource(R.string.compact_pos_table_free))
        table.status == TableStatus.OCCUPIED -> TableCardStyle(CompactPosColors.TableOccupiedBg, CompactPosColors.TableOccupiedBorder, CompactPosColors.Ink2, stringResource(R.string.table_busy))
        else -> TableCardStyle(CompactPosColors.TableReservedBg, CompactPosColors.TableReservedBorder, CompactPosColors.TableReservedStatus, stringResource(R.string.compact_pos_table_reserved))
    }
    val bg = style.background
    val border = style.border
    val statusColor = style.statusColor
    val statusText = style.statusLabel
    val borderWidth = if (isCurrent) 2.5.dp else 1.5.dp
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 88.dp)
            .clip(RoundedCornerShape(16.dp))
            .border(borderWidth, border, RoundedCornerShape(16.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(10.dp),
    ) {
        if (isCurrent) {
            Text("OPEN", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(CompactPosColors.Teal)
                .padding(horizontal = 7.dp, vertical = 2.dp))
        }
        Text(table.name, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = CompactPosColors.Ink)
        Text(stringResource(R.string.compact_pos_table_seats, table.seatCapacity), fontSize = 12.sp, color = CompactPosColors.Muted)
        Spacer(Modifier.weight(1f))
        Text(statusText, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold, color = statusColor)
        if (table.orderTotal > 0.0) {
            Text(formatCompactMoney(table.orderTotal, currencySymbol), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = CompactPosColors.Ink)
        }
    }
}

private data class TableCardStyle(
    val background: Color,
    val border: Color,
    val statusColor: Color,
    val statusLabel: String,
)

private fun formatCompactMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun Color.compositeOver(background: Color): Color {
    val alpha = this.alpha
    if (alpha >= 1f) return this
    val ir = 1f - alpha
    return Color(
        red = this.red * alpha + background.red * ir,
        green = this.green * alpha + background.green * ir,
        blue = this.blue * alpha + background.blue * ir,
        alpha = 1f,
    )
}