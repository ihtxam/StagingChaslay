package com.chaslay.pos.ui.pos

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.automirrored.filled.KeyboardReturn
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Backspace
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.LocalAtm
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.DiscountPreset
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.domain.model.LoyaltyMath
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.applyCashRounding
import com.chaslay.pos.ui.theme.VectronColors
import com.chaslay.pos.ui.theme.vectronColors
import java.util.Locale
import kotlin.math.ceil

data class CheckoutState(
    val method: PaymentMethod = PaymentMethod.CASH,
    val tipAmount: Double = 0.0,
    val tipPercent: Double = 0.0,
    val discountPercent: Double = 0.0,
    val roundingStep: Double = 0.05,
    val tenderAmount: Double = 0.0,
    val printReceipt: Boolean = false,
    val showTipPanel: Boolean = false,
    val showDiscountPanel: Boolean = false,
    val payWithPoints: Boolean = false,
    val pointsRedeemed: Int = 0,
    val pointsDiscount: Double = 0.0,
    val payWithGiftCard: Boolean = false,
    val giftCardRedeemAmount: Double = 0.0
)

@Composable
fun CheckoutScreen(
    cart: CartSummary,
    currencySymbol: String,
    discountPresets: List<DiscountPreset>,
    checkoutState: CheckoutState,
    isProcessing: Boolean,
    cashEnabled: Boolean = true,
    cardEnabled: Boolean = true,
    terminalEnabled: Boolean = true,
    tipsEnabled: Boolean = true,
    allowCustomTip: Boolean = true,
    tipPresetsPercent: List<Double> = listOf(0.0, 5.0, 10.0, 15.0),
    discountsEnabled: Boolean = true,
    quickCashEnabled: Boolean = true,
    quickCashDenominations: List<Double> = listOf(10.0, 20.0, 50.0, 100.0),
    splitBillsEnabled: Boolean = true,
    splitBillIndex: Int? = null,
    splitBillCount: Int? = null,
    isEqualSplit: Boolean = false,
    equalSplitPaidCount: Int = 0,
    membershipPointsBalance: Int? = null,
    membershipGiftBalance: Double? = null,
    giftCardsEnabled: Boolean = false,
    onBack: () -> Unit,
    onSelectMethod: (PaymentMethod) -> Unit,
    onTipAmount: (Double) -> Unit,
    onTipPercent: (Double) -> Unit,
    onDiscountPercent: (Double) -> Unit,
    onToggleTipPanel: () -> Unit,
    onToggleDiscountPanel: () -> Unit,
    onSplitClick: () -> Unit,
    onOpenCashDrawer: () -> Unit,
    onPrintReceipt: () -> Unit = {},
    onTenderAmount: (Double) -> Unit = {},
    onComplete: () -> Unit,
    onPrevSplitBill: () -> Unit = {},
    onNextSplitBill: () -> Unit = {},
    onScanBarcode: () -> Unit = {},
    onTogglePayWithPoints: (Boolean) -> Unit = {},
    onTogglePayWithGiftCard: (Boolean) -> Unit = {}
) {
    val equalSplitCount = if (isEqualSplit) splitBillCount ?: 1 else 1
    val totals = rememberCheckoutTotals(cart, checkoutState, equalSplitCount)
    val vc = vectronColors()
    val showSplitNav = splitBillIndex != null && splitBillCount != null && splitBillCount > 1
    var showTipKeypad by remember { mutableStateOf(false) }
    var tenderBuffer by remember { mutableStateOf("") }
    val typedTender = tenderBuffer.toDoubleOrNull()
    val cashTender = when {
        checkoutState.method != PaymentMethod.CASH -> totals.roundedTotal
        typedTender != null && typedTender > 0 -> typedTender
        checkoutState.tenderAmount > 0 -> checkoutState.tenderAmount
        else -> totals.roundedTotal
    }
    val changeDue = if (checkoutState.method == PaymentMethod.CASH) {
        (cashTender - totals.roundedTotal).coerceAtLeast(0.0)
    } else {
        0.0
    }
    val remaining = if (checkoutState.method == PaymentMethod.CASH) {
        (totals.roundedTotal - cashTender).coerceAtLeast(0.0)
    } else {
        0.0
    }

    fun applyTender(amount: Double) {
        tenderBuffer = formatTenderBuffer(amount)
        onSelectMethod(PaymentMethod.CASH)
        onTenderAmount(amount)
    }

    fun appendTenderKey(key: String) {
        tenderBuffer = when (key) {
            "00" -> if (tenderBuffer.isEmpty()) "0" else tenderBuffer + "00"
            "." -> when {
                tenderBuffer.contains(".") -> tenderBuffer
                tenderBuffer.isEmpty() -> "0."
                else -> tenderBuffer + "."
            }
            else -> if (tenderBuffer == "0") key else tenderBuffer + key
        }.take(10)
        tenderBuffer.toDoubleOrNull()?.let { amount ->
            onSelectMethod(PaymentMethod.CASH)
            onTenderAmount(amount)
        }
    }

    if (showTipKeypad) {
        PriceKeypadDialog(
            title = stringResource(R.string.tip),
            subtitle = stringResource(R.string.enter_tip_amount),
            currencySymbol = currencySymbol,
            initialValue = if (checkoutState.tipAmount > 0) {
                String.format(Locale.US, "%.2f", checkoutState.tipAmount)
            } else {
                ""
            },
            confirmLabel = stringResource(R.string.confirm),
            onConfirm = { amount ->
                onTipPercent(-1.0)
                onTipAmount(amount.coerceAtLeast(0.0))
                showTipKeypad = false
            },
            onDismiss = { showTipKeypad = false }
        )
    }

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(vc.background)
    ) {
        Column(
            modifier = Modifier
                .width(360.dp)
                .fillMaxHeight()
                .background(vc.panelDark)
                .padding(12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onBack,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.height(48.dp)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.checkout_back), color = vc.textPrimary)
                }
                Text(
                    stringResource(R.string.checkout_title),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = vc.textPrimary,
                    modifier = Modifier.weight(1f)
                )
            }

            if (cashEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.cash),
                    icon = Icons.Default.AttachMoney,
                    selected = checkoutState.method == PaymentMethod.CASH,
                    accent = Color(0xFF22C55E),
                    onClick = { onSelectMethod(PaymentMethod.CASH) }
                )
            }
            if (cardEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.card),
                    icon = Icons.Default.CreditCard,
                    selected = checkoutState.method == PaymentMethod.CARD,
                    accent = Color(0xFF3B82F6),
                    onClick = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                        onSelectMethod(PaymentMethod.CARD)
                    }
                )
            }
            if (terminalEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.adyen_terminal),
                    icon = Icons.Default.PointOfSale,
                    selected = checkoutState.method == PaymentMethod.ADYEN_TERMINAL,
                    accent = Color(0xFF8B5CF6),
                    onClick = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                        onSelectMethod(PaymentMethod.ADYEN_TERMINAL)
                    }
                )
            }
            if (cart.pickupTimeMs != null ||
                cart.fulfillmentType == FulfillmentType.PICKUP ||
                cart.fulfillmentType == FulfillmentType.DELIVERY
            ) {
                CheckoutMethodButton(
                    title = stringResource(R.string.pay_later),
                    icon = Icons.Default.Schedule,
                    selected = checkoutState.method == PaymentMethod.PAY_LATER,
                    accent = Color(0xFFF59E0B),
                    onClick = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                        onSelectMethod(PaymentMethod.PAY_LATER)
                    }
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (discountsEnabled) {
                    CheckoutActionChip(
                        icon = Icons.Default.Sell,
                        label = stringResource(R.string.discount),
                        selected = checkoutState.showDiscountPanel || checkoutState.discountPercent > 0,
                        onClick = onToggleDiscountPanel,
                        modifier = Modifier.weight(1f)
                    )
                }
                if (tipsEnabled) {
                    CheckoutActionChip(
                        icon = Icons.Default.Payments,
                        label = stringResource(R.string.tip),
                        selected = checkoutState.showTipPanel || checkoutState.tipAmount > 0,
                        onClick = onToggleTipPanel,
                        modifier = Modifier.weight(1f)
                    )
                }
                if (splitBillsEnabled) {
                    CheckoutActionChip(
                        icon = Icons.AutoMirrored.Filled.CallSplit,
                        label = stringResource(R.string.split_bill),
                        selected = showSplitNav,
                        onClick = onSplitClick,
                        modifier = Modifier.weight(1f)
                    )
                }
                CheckoutIconChip(icon = Icons.Default.QrCodeScanner, onClick = onScanBarcode)
                CheckoutIconChip(icon = Icons.Default.Print, onClick = onPrintReceipt)
                CheckoutIconChip(icon = Icons.Default.LocalAtm, onClick = onOpenCashDrawer)
            }

            if (tipsEnabled && checkoutState.showTipPanel) {
                Text(
                    stringResource(R.string.tip).uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = vc.textSecondary
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    tipPresetsPercent.ifEmpty { listOf(0.0, 5.0, 10.0, 15.0) }.forEach { pct ->
                        FilterChip(
                            selected = checkoutState.tipPercent == pct,
                            onClick = {
                                onTipPercent(pct)
                                onTipAmount(totals.preTipTotal * (pct / 100.0))
                            },
                            label = { Text(if (pct == 0.0) "0%" else "${pct.toInt()}%") }
                        )
                    }
                    if (allowCustomTip) {
                        FilterChip(
                            selected = checkoutState.tipPercent < 0 && checkoutState.tipAmount > 0,
                            onClick = { showTipKeypad = true },
                            label = { Text(stringResource(R.string.custom_tip)) }
                        )
                    }
                }
            }

            if (discountsEnabled && checkoutState.showDiscountPanel) {
                Text(
                    stringResource(R.string.discount).uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = vc.textSecondary
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    FilterChip(
                        selected = checkoutState.discountPercent == 0.0,
                        onClick = { onDiscountPercent(0.0) },
                        label = { Text("0%") }
                    )
                    discountPresets.forEach { preset ->
                        FilterChip(
                            selected = checkoutState.discountPercent == preset.percent,
                            onClick = { onDiscountPercent(preset.percent) },
                            label = { Text("${preset.name} ${preset.percent.toInt()}%") }
                        )
                    }
                }
            }

            if ((membershipPointsBalance ?: 0) >= LoyaltyMath.REDEEM_THRESHOLD_POINTS) {
                FilterChip(
                    selected = checkoutState.payWithPoints,
                    onClick = { onTogglePayWithPoints(!checkoutState.payWithPoints) },
                    label = {
                        Text(
                            stringResource(
                                R.string.checkout_pay_with_points,
                                membershipPointsBalance ?: 0
                            )
                        )
                    }
                )
            }
            if (giftCardsEnabled && (membershipGiftBalance ?: 0.0) > 0.0) {
                FilterChip(
                    selected = checkoutState.payWithGiftCard,
                    onClick = { onTogglePayWithGiftCard(!checkoutState.payWithGiftCard) },
                    label = {
                        Text(
                            stringResource(
                                R.string.checkout_pay_with_gift_card,
                                formatMoney(membershipGiftBalance ?: 0.0, currencySymbol)
                            )
                        )
                    }
                )
            }

            if (quickCashEnabled && checkoutState.method == PaymentMethod.CASH) {
                Text(
                    stringResource(R.string.checkout_quick_cash),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = vc.textSecondary
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    buildQuickCashAmounts(totals.roundedTotal, quickCashDenominations).forEach { amount ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFF4F4F5))
                                .clickable { applyTender(amount) }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Text(
                                formatMoney(amount, currencySymbol),
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }

            if (checkoutState.method == PaymentMethod.CASH) {
                CheckoutTenderKeypad(
                    buffer = tenderBuffer,
                    currencySymbol = currencySymbol,
                    onKey = ::appendTenderKey,
                    onBackspace = {
                        tenderBuffer = tenderBuffer.dropLast(1)
                        val amount = tenderBuffer.toDoubleOrNull() ?: 0.0
                        onTenderAmount(amount)
                    },
                    onClear = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                    }
                )
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    stringResource(R.string.checkout_amount_due),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = vc.textSecondary,
                    letterSpacing = 1.sp
                )
                Text(
                    formatMoney(totals.roundedTotal, currencySymbol),
                    fontWeight = FontWeight.Light,
                    fontSize = 56.sp,
                    color = vc.textPrimary
                )
                if (typedTender != null && checkoutState.method == PaymentMethod.CASH) {
                    Text(
                        stringResource(R.string.checkout_entering, formatMoney(typedTender, currencySymbol)),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF2563EB)
                    )
                }
                if (remaining > 0.001) {
                    Text(
                        stringResource(R.string.checkout_remaining, formatMoney(remaining, currencySymbol)),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFFB45309)
                    )
                }
                if (changeDue > 0.001) {
                    Text(
                        stringResource(R.string.checkout_change_due, formatMoney(changeDue, currencySymbol)),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF15803D)
                    )
                }

                if (showSplitNav) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = onPrevSplitBill,
                            enabled = splitBillIndex!! > 1,
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Text(stringResource(R.string.prev_bill), color = vc.textPrimary, fontSize = 12.sp)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                stringResource(R.string.bill_x_of_y, splitBillIndex, splitBillCount!!),
                                fontWeight = FontWeight.Bold,
                                color = vc.textPrimary,
                                fontSize = 16.sp
                            )
                            if (isEqualSplit && equalSplitPaidCount > 0) {
                                Text(
                                    stringResource(R.string.bills_paid_count, equalSplitPaidCount, splitBillCount),
                                    fontSize = 11.sp,
                                    color = vc.textSecondary
                                )
                            }
                        }
                        OutlinedButton(
                            onClick = onNextSplitBill,
                            enabled = splitBillIndex < splitBillCount,
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Text(stringResource(R.string.next_bill), color = vc.textPrimary, fontSize = 12.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    stringResource(R.string.total_items, cart.items.size),
                    fontSize = 12.sp,
                    color = vc.textSecondary
                )
                Spacer(modifier = Modifier.height(8.dp))
                cart.items.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            item.displayQtyLabel(),
                            fontSize = 14.sp,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(formatMoney(item.lineSubtotal, currencySymbol), fontSize = 14.sp)
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
                if (!cart.vatIncludedInPrice) {
                    SummaryLine(stringResource(R.string.subtotal), formatMoney(cart.subtotal, currencySymbol))
                }
                if (cart.itemDiscountTotal > 0) {
                    SummaryLine(
                        stringResource(R.string.item_discounts),
                        "-${formatMoney(cart.itemDiscountTotal, currencySymbol)}"
                    )
                }
                val taxShare = if (equalSplitCount > 1) cart.taxTotal / equalSplitCount else cart.taxTotal
                val taxLabel = if (cart.vatIncludedInPrice) {
                    stringResource(R.string.tax_included_in_total)
                } else {
                    stringResource(R.string.tax)
                }
                SummaryLine(taxLabel, formatMoney(taxShare, currencySymbol))
                if (totals.cartDiscount > 0) {
                    SummaryLine(stringResource(R.string.discount), "-${formatMoney(totals.cartDiscount, currencySymbol)}")
                }
                if (checkoutState.tipAmount > 0) {
                    SummaryLine(stringResource(R.string.tip), formatMoney(checkoutState.tipAmount, currencySymbol))
                }
                if (checkoutState.pointsDiscount > 0) {
                    SummaryLine(
                        stringResource(R.string.checkout_points_applied, checkoutState.pointsRedeemed),
                        "-${formatMoney(checkoutState.pointsDiscount, currencySymbol)}"
                    )
                }
                if (checkoutState.payWithGiftCard && checkoutState.giftCardRedeemAmount > 0) {
                    SummaryLine(
                        stringResource(R.string.checkout_gift_card_applied, formatMoney(checkoutState.giftCardRedeemAmount, currencySymbol)),
                        "-${formatMoney(checkoutState.giftCardRedeemAmount, currencySymbol)}"
                    )
                }
            }

            Button(
                onClick = {
                    if (checkoutState.method == PaymentMethod.CASH) {
                        onTenderAmount(cashTender)
                    }
                    onComplete()
                },
                enabled = !isProcessing && cart.items.isNotEmpty() && remaining <= 0.001,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
            ) {
                val label = if (changeDue > 0.001) {
                    stringResource(
                        R.string.checkout_complete_with_change,
                        formatMoney(changeDue, currencySymbol)
                    )
                } else {
                    stringResource(R.string.checkout_complete)
                }
                Text(label, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
            }
        }
    }
}

@Composable
private fun CheckoutMethodButton(
    title: String,
    icon: ImageVector,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit
) {
    val border = if (selected) accent else Color(0xFFE5E7EB)
    val bg = if (selected) accent.copy(alpha = 0.10f) else Color(0xFFF8FAFC)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(icon, contentDescription = null, tint = accent, modifier = Modifier.size(22.dp))
        Text(title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
    }
}

@Composable
private fun CheckoutActionChip(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) Color(0xFFEFF6FF) else Color(0xFFF8FAFC))
            .border(1.dp, if (selected) Color(0xFF3B82F6) else Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = if (selected) Color(0xFF2563EB) else Color(0xFF64748B),
            modifier = Modifier.size(18.dp)
        )
        Text(
            label,
            fontSize = 10.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = if (selected) Color(0xFF2563EB) else Color(0xFF64748B)
        )
    }
}

@Composable
private fun CheckoutIconChip(icon: ImageVector, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF8FAFC))
            .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = Color(0xFF64748B), modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun CheckoutTenderKeypad(
    buffer: String,
    currencySymbol: String,
    onKey: (String) -> Unit,
    onBackspace: () -> Unit,
    onClear: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = if (buffer.isEmpty()) "$currencySymbol 0.00" else "$currencySymbol $buffer",
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
            fontWeight = FontWeight.Bold,
            fontSize = 22.sp
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(listOf("7", "8", "9"), listOf("4", "5", "6"), listOf("1", "2", "3"), listOf("0", "00", ".")).forEach { row ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        row.forEach { key ->
                            CheckoutKey(label = key, modifier = Modifier.weight(1f), onClick = { onKey(key) })
                        }
                    }
                }
            }
            Column(modifier = Modifier.width(64.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                CheckoutKey(label = "", icon = Icons.Default.Backspace, onClick = onBackspace)
                CheckoutKey(label = stringResource(R.string.keypad_clear), onClick = onClear)
                CheckoutKey(
                    label = "",
                    icon = Icons.AutoMirrored.Filled.KeyboardReturn,
                    highlight = true,
                    modifier = Modifier.height(92.dp),
                    onClick = { /* tender is applied on each key; confirm is the main button */ }
                )
            }
        }
    }
}

@Composable
private fun CheckoutKey(
    label: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    highlight: Boolean = false,
    onClick: () -> Unit
) {
    val bg = if (highlight) VectronColors.CashGreen else VectronColors.KeypadButton
    Box(
        modifier = modifier
            .height(44.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = if (highlight) Color.White else VectronColors.TextPrimary)
        } else {
            Text(label, fontWeight = FontWeight.Bold, color = if (highlight) Color.White else VectronColors.TextPrimary)
        }
    }
}

@Composable
private fun SummaryLine(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 13.sp, color = Color.Gray)
        Text(value, fontSize = 13.sp)
    }
}

private data class CheckoutTotals(
    val subtotal: Double,
    val itemDiscountTotal: Double,
    val cartDiscount: Double,
    val preTipTotal: Double,
    val roundedTotal: Double,
    val roundingAdj: Double
)

@Composable
private fun rememberCheckoutTotals(
    cart: CartSummary,
    checkoutState: CheckoutState,
    equalSplitCount: Int = 1
): CheckoutTotals {
    val netSubtotal = cart.subtotal - cart.itemDiscountTotal
    val cartDiscount = if (checkoutState.discountPercent > 0) {
        netSubtotal * (checkoutState.discountPercent / 100.0)
    } else {
        cart.discountValue
    }
    val preTipTotal = cart.merchandiseTotal(checkoutState.discountPercent)
    val shareTotal = if (equalSplitCount > 1) preTipTotal / equalSplitCount else preTipTotal
    val afterPoints = (shareTotal + checkoutState.tipAmount - checkoutState.pointsDiscount).coerceAtLeast(0.0)
    val giftApplied = if (checkoutState.payWithGiftCard) checkoutState.giftCardRedeemAmount else 0.0
    val afterGiftCard = (afterPoints - giftApplied).coerceAtLeast(0.0)
    val roundedTotal = applyCashRounding(afterGiftCard, checkoutState.roundingStep)
    val roundingAdj = roundedTotal - afterGiftCard
    return CheckoutTotals(netSubtotal, cart.itemDiscountTotal, cartDiscount, preTipTotal, roundedTotal, roundingAdj)
}

private fun buildQuickCashAmounts(total: Double, denominations: List<Double>): List<Double> {
    val exact = if (total > 0) listOf(total) else emptyList()
    val dens = denominations.filter { it >= total && it > 0 }.sorted()
    val rounded5 = if (total <= 0) 0.0 else ceil(total / 0.05) * 0.05
    val extras = listOf(rounded5).filter { it > total }
    return (exact + dens + extras).distinct().filter { it > 0 }.take(6)
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatTenderBuffer(amount: Double): String =
    if (amount == kotlin.math.floor(amount)) {
        amount.toInt().toString()
    } else {
        String.format(Locale.US, "%.2f", amount)
    }
