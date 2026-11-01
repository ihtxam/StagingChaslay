package com.chaslay.pos.ui.pos

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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
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
import com.chaslay.pos.ui.theme.VectronColors
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
    val columnWidth = ((config.screenWidthDp - 36) / 2.35f).dp

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF1A1A1A))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF111111))
                .padding(horizontal = 4.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, tint = Color.White)
            }
            OutlinedButton(
                onClick = { },
                modifier = Modifier.height(36.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = VectronColors.CashGreen)
            ) {
                Text(stringResource(R.string.split_product), fontSize = 11.sp, maxLines = 1)
            }
            OutlinedButton(
                onClick = { showEvenSplitDialog = true },
                modifier = Modifier.height(36.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.CallSplit, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.split_equal), fontSize = 11.sp, maxLines = 1)
            }
            if (showSeatSplit) {
                OutlinedButton(
                    onClick = onSplitBySeats,
                    modifier = Modifier.height(36.dp)
                ) {
                    Text(stringResource(R.string.split_by_seat), fontSize = 11.sp, maxLines = 1)
                }
            }
            OutlinedButton(
                onClick = onReset,
                modifier = Modifier.height(36.dp)
            ) {
                Text(stringResource(R.string.split_reset), fontSize = 11.sp)
            }
            Spacer(modifier = Modifier.weight(1f))
            Button(
                onClick = onDone,
                modifier = Modifier.height(36.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
            ) {
                Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.done), color = Color.White, fontSize = 12.sp)
            }
        }

        LazyRow(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
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
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF2A2A2A))
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text(formatMoney(total, currencySymbol), color = VectronColors.CashGreen, fontWeight = FontWeight.Bold)
        }
        if (showAddToHere) {
            Spacer(modifier = Modifier.height(6.dp))
            Button(
                onClick = onAddToHere,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CardBlue)
            ) {
                Text(stringResource(R.string.add_to_here), fontSize = 12.sp)
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            if (items.isEmpty()) {
                item(key = "empty") {
                    Text(
                        stringResource(R.string.split_bill_empty),
                        color = Color(0xFF777777),
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp)
                    )
                }
            } else {
                items(items, key = { it.id }) { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(
                                if (item.id in selectedItemIds) Color(0xFF3D4F5A)
                                else Color(0xFF333333)
                            )
                            .clickable { onToggleItem(item.id) }
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Checkbox(
                            checked = item.id in selectedItemIds,
                            onCheckedChange = { onToggleItem(item.id) }
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.productName, color = Color.White, fontSize = 13.sp, maxLines = 2)
                            item.variantName?.let {
                                Text(it, color = Color(0xFFAAAAAA), fontSize = 11.sp, maxLines = 1)
                            }
                        }
                        Text("${item.quantity}", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        if (items.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onPay, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.pay_bill))
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
    val borderColor = if (enabled) VectronColors.CashGreen else Color(0xFF666666)
    val contentColor = if (enabled) Color.White else Color(0xFFAAAAAA)
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .border(2.dp, borderColor, RoundedCornerShape(12.dp))
            .background(if (enabled) Color(0xFF2A3A2A) else Color(0xFF252525))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Add, contentDescription = null, tint = contentColor, modifier = Modifier.size(32.dp))
            Text(
                stringResource(R.string.add_to_new_bill),
                color = contentColor,
                textAlign = TextAlign.Center,
                fontSize = 14.sp
            )
        }
    }
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)
