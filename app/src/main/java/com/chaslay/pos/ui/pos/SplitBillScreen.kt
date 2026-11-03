package com.chaslay.pos.ui.pos
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import java.util.Locale

@Composable
fun SplitBillScreen(
    cart: CartSummary,
    currencySymbol: String,
    selectedItemIds: Set<String>,
    onBack: () -> Unit,
    onToggleItem: (String) -> Unit,
    onMoveToCheck: (Int) -> Unit,
    onMoveToNewBill: () -> Unit,
    onReset: () -> Unit,
    onSplitBySeats: () -> Unit,
    onSplitEvenly: (Int) -> Unit,
    onPayCheck: (Int, PaymentMethod) -> Unit,
    onDone: () -> Unit
) {
    var showEvenSplitDialog by remember { mutableStateOf(false) }
    val showSeatSplit = cart.tableId != null && (cart.guestCount ?: 0) >= 2
    val billChecks = (1..cart.splitCount.coerceAtLeast(1)).toList()
    val itemsByCheck = billChecks.associateWith { check ->
        cart.items.filter { it.splitCheck == check }
    }
    val selectedItems = remember(cart.items, selectedItemIds) {
        cart.items.filter { it.id in selectedItemIds }
    }
    val config = LocalConfiguration.current
    val columnWidth = (config.screenWidthDp * 0.42f).coerceIn(300f, 420f).dp

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(posUiColors().canvas)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(posUiColors().surface)
                .padding(horizontal = PosDimens.Space2, vertical = PosDimens.Space2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = null,
                    tint = posUiColors().textPrimary
                )
            }
            OutlinedButton(
                onClick = { },
                modifier = Modifier.height(PosDimens.ControlHeightMd),
                shape = PosShapes.Medium,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = posUiColors().textPrimary),
                border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.CallSplit,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = posUiColors().textSecondary
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    stringResource(R.string.split_product),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
            }
            OutlinedButton(
                onClick = { showEvenSplitDialog = true },
                modifier = Modifier.height(PosDimens.ControlHeightMd),
                shape = PosShapes.Medium,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = posUiColors().textPrimary),
                border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.CallSplit,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = posUiColors().textSecondary
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    stringResource(R.string.split_equal),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1
                )
            }
            if (showSeatSplit) {
                OutlinedButton(
                    onClick = onSplitBySeats,
                    modifier = Modifier.height(PosDimens.ControlHeightMd),
                    shape = PosShapes.Medium,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = posUiColors().textPrimary),
                    border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
                ) {
                    Text(
                        stringResource(R.string.split_by_seat),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        maxLines = 1
                    )
                }
            }
            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.height(PosDimens.ControlHeightMd),
                shape = PosShapes.Medium,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = posUiColors().textPrimary),
                border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
            ) {
                Icon(
                    Icons.Default.Refresh,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = posUiColors().textSecondary
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    stringResource(R.string.split_reset),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = onDone,
                modifier = Modifier.height(PosDimens.ControlHeightMd),
                shape = PosShapes.Medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary
                )
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    stringResource(R.string.done),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        LazyRow(
            modifier = Modifier
                .fillMaxSize()
                .padding(PosDimens.PagePaddingCompact),
            horizontalArrangement = Arrangement.spacedBy(PosDimens.GridGap),
            contentPadding = PaddingValues(horizontal = 4.dp)
        ) {
            items(billChecks, key = { it }) { check ->
                val canAddHere = selectedItems.isNotEmpty() &&
                    selectedItems.any { it.splitCheck != check }
                SplitBillColumn(
                    title = stringResource(R.string.bill_n, check),
                    items = itemsByCheck[check].orEmpty(),
                    currencySymbol = currencySymbol,
                    selectedItemIds = selectedItemIds,
                    showAddToHere = canAddHere,
                    onAddToHere = { onMoveToCheck(check) },
                    onToggleItem = onToggleItem,
                    onPay = { onPayCheck(check, PaymentMethod.CASH) },
                    modifier = Modifier
                        .width(columnWidth)
                        .fillMaxHeight()
                )
            }
            item(key = "new_bill") {
                AddNewBillDropZone(
                    onClick = {
                        if (selectedItemIds.isNotEmpty()) {
                            onMoveToNewBill()
                        }
                    },
                    enabled = selectedItemIds.isNotEmpty(),
                    modifier = Modifier
                        .width(columnWidth)
                        .fillMaxHeight()
                )
            }
        }
    }

    if (showEvenSplitDialog) {
        PriceKeypadDialog(
            title = stringResource(R.string.split_equal),
            subtitle = stringResource(R.string.split_parts),
            currencySymbol = "×",
            initialValue = "2",
            confirmLabel = stringResource(R.string.confirm),
            onConfirm = { value ->
                onSplitEvenly(value.toInt().coerceIn(2, 8))
                showEvenSplitDialog = false
            },
            onDismiss = { showEvenSplitDialog = false }
        )
    }
}

@Composable
private fun SplitBillColumn(
    title: String,
    items: List<CartItem>,
    currencySymbol: String,
    selectedItemIds: Set<String>,
    showAddToHere: Boolean,
    onAddToHere: () -> Unit,
    onToggleItem: (String) -> Unit,
    onPay: () -> Unit,
    modifier: Modifier = Modifier
) {
    val total = CartSummary(items = items).total
    Column(
        modifier = modifier
            .clip(PosShapes.Card)
            .background(posUiColors().surface)
            .border(1.dp, posUiColors().border, PosShapes.Card)
            .padding(PosDimens.Space4)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                title,
                color = posUiColors().textPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Text(
                formatMoney(total, currencySymbol),
                color = PosColors.Primary,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        }
        if (showAddToHere) {
            Spacer(modifier = Modifier.height(PosDimens.Space2))
            OutlinedButton(
                onClick = onAddToHere,
                modifier = Modifier.fillMaxWidth(),
                shape = PosShapes.Medium,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = PosColors.Primary),
                border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().primaryBorder)
            ) {
                Text(stringResource(R.string.add_to_here), fontSize = 13.sp)
            }
        }
        Spacer(modifier = Modifier.height(PosDimens.Space3))
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (items.isEmpty()) {
                item(key = "empty") {
                    Text(
                        stringResource(R.string.split_bill_empty),
                        color = posUiColors().textMuted,
                        fontSize = 13.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp)
                    )
                }
            } else {
                items(items, key = { it.id }) { item ->
                    val selected = item.id in selectedItemIds
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(PosShapes.Small)
                            .background(
                                if (selected) posUiColors().surfaceSelected else Color.Transparent
                            )
                            .clickable { onToggleItem(item.id) }
                            .padding(horizontal = 4.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = selected,
                            onCheckedChange = { onToggleItem(item.id) },
                            colors = CheckboxDefaults.colors(
                                checkedColor = PosColors.Primary,
                                uncheckedColor = posUiColors().borderStrong,
                                checkmarkColor = PosColors.TextOnPrimary
                            )
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                item.productName,
                                color = posUiColors().textPrimary,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Medium,
                                maxLines = 2
                            )
                            item.variantName?.let {
                                Text(
                                    it,
                                    color = posUiColors().textSecondary,
                                    fontSize = 12.sp,
                                    maxLines = 1
                                )
                            }
                        }
                        Text(
                            "${item.quantity}",
                            color = posUiColors().textPrimary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                    HorizontalDivider(color = posUiColors().border.copy(alpha = 0.6f))
                }
            }
        }
        if (items.isNotEmpty()) {
            Spacer(modifier = Modifier.height(PosDimens.Space3))
            Button(
                onClick = onPay,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(PosDimens.ControlHeightLg),
                shape = PosShapes.Medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary
                )
            ) {
                Text(
                    stringResource(R.string.pay_bill),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

@Composable
private fun AddNewBillDropZone(
    onClick: () -> Unit,
    enabled: Boolean,
    modifier: Modifier = Modifier
) {
    val borderColor = if (enabled) posUiColors().primaryBorder else posUiColors().border
    val contentColor = if (enabled) PosColors.Primary else posUiColors().textMuted
    Box(
        modifier = modifier
            .clip(PosShapes.Card)
            .border(2.dp, borderColor, PosShapes.Card)
            .background(if (enabled) posUiColors().primarySubtle else posUiColors().surfaceSubtle)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(PosDimens.Space4),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Add, contentDescription = null, tint = contentColor, modifier = Modifier.size(32.dp))
            Text(
                stringResource(R.string.add_to_new_bill),
                color = contentColor,
                textAlign = TextAlign.Center,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
