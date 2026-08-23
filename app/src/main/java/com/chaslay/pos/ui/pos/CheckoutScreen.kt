package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.LocalAtm
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.composed
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
import com.chaslay.pos.domain.cartMerchandiseBase
import com.chaslay.pos.domain.resolveBillDiscountAmount
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.DiscountPreset
import com.chaslay.pos.domain.model.LoyaltyMath
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.applyCashRounding
import com.chaslay.pos.ui.theme.VectronColors
import com.chaslay.pos.ui.theme.vectronColors
import java.util.Locale
import kotlin.math.ceil

private val CheckoutTeal = Color(0xFF0D9488)

data class CheckoutState(
    val method: PaymentMethod? = PaymentMethod.CASH,
    /** Pay Later: intended later collection (cash / card / terminal). */
    val payLaterTender: PaymentMethod? = null,
    val tipAmount: Double = 0.0,
    val tipPercent: Double = 0.0,
    val discountPercent: Double = 0.0,
    val discountAmount: Double = 0.0,
    val roundingStep: Double = 0.05,
    val tenderAmount: Double = 0.0,
    val cardTenderAmount: Double = 0.0,
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
    redeemThresholdPoints: Int = LoyaltyMath.REDEEM_THRESHOLD_POINTS,
    onBack: () -> Unit,
    onSelectMethod: (PaymentMethod) -> Unit,
    onDeselectMethod: () -> Unit = {},
    onApplyCardRemainder: (Double) -> Unit = {},
    onTipAmount: (Double) -> Unit,
    onTipPercent: (Double) -> Unit,
    onDiscountPercent: (Double) -> Unit,
    onDiscountAmount: (Double) -> Unit = {},
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
    var showTipDialog by remember { mutableStateOf(false) }
    var showDiscountDialog by remember { mutableStateOf(false) }
    var tenderBuffer by remember { mutableStateOf("") }
    val typedTender = tenderBuffer.toDoubleOrNull()
    val cashApplied = when {
        typedTender != null && typedTender > 0 -> typedTender
        checkoutState.tenderAmount > 0 -> checkoutState.tenderAmount
        else -> 0.0
    }
    val cardApplied = checkoutState.cardTenderAmount
    val covered = cashApplied + cardApplied
    val remaining = (totals.roundedTotal - covered).coerceAtLeast(0.0)
    val changeDue = if (cardApplied < 0.001 && cashApplied > totals.roundedTotal) {
        cashApplied - totals.roundedTotal
    } else {
        0.0
    }
    val checkoutOrderRef = com.chaslay.pos.util.OrderNumberFormat.formatCheckoutOrderRef(
        cart.orderNumber,
        null
    )
    val exactCash = checkoutState.method == PaymentMethod.CASH && cashApplied < 0.001 && cardApplied < 0.001
    val methodChargesRemaining = checkoutState.method == PaymentMethod.CARD ||
        checkoutState.method == PaymentMethod.ADYEN_TERMINAL ||
        checkoutState.method == PaymentMethod.TAP_TO_PAY ||
        checkoutState.method == PaymentMethod.PAY_LATER ||
        checkoutState.method == PaymentMethod.INVOICE
    val canComplete = !isProcessing && cart.items.isNotEmpty() &&
        (remaining <= 0.001 || exactCash || methodChargesRemaining)

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

    fun selectCardOrSplit() {
        if (cashApplied > 0.001 && remaining > 0.001) {
            onApplyCardRemainder(remaining)
        } else {
            tenderBuffer = ""
            onTenderAmount(0.0)
            onSelectMethod(PaymentMethod.CARD)
        }
    }

    if (showTipDialog && tipsEnabled) {
        TipDiscountDialog(
            title = stringResource(R.string.tip),
            currencySymbol = currencySymbol,
            baseAmount = totals.preTipTotal,
            presetsPercent = tipPresetsPercent.filter { it > 0 },
            allowPercent = true,
            allowAmount = allowCustomTip,
            initialMode = if (checkoutState.tipPercent > 0) AmountPercentMode.PERCENT else AmountPercentMode.AMOUNT,
            initialValue = if (checkoutState.tipPercent > 0) checkoutState.tipPercent else checkoutState.tipAmount,
            onConfirm = { amount, percent, mode ->
                if (mode == AmountPercentMode.PERCENT && percent > 0) {
                    onTipPercent(percent)
                    onTipAmount(amount)
                } else {
                    onTipPercent(if (amount > 0) -1.0 else 0.0)
                    onTipAmount(amount)
                }
                showTipDialog = false
            },
            onDismiss = { showTipDialog = false }
        )
    }

    if (showDiscountDialog && discountsEnabled) {
        val presetPercents = discountPresets.map { it.percent }.filter { it > 0 }
        TipDiscountDialog(
            title = stringResource(R.string.discount),
            currencySymbol = currencySymbol,
            baseAmount = cartMerchandiseBase(cart),
            presetsPercent = presetPercents.ifEmpty { listOf(5.0, 10.0, 15.0) },
            allowPercent = true,
            allowAmount = true,
            initialMode = if (checkoutState.discountPercent > 0) AmountPercentMode.PERCENT else AmountPercentMode.AMOUNT,
            initialValue = if (checkoutState.discountPercent > 0) checkoutState.discountPercent else checkoutState.discountAmount,
            onConfirm = { amount, percent, mode ->
                if (mode == AmountPercentMode.PERCENT && percent > 0) {
                    onDiscountAmount(0.0)
                    onDiscountPercent(percent)
                } else {
                    onDiscountPercent(0.0)
                    onDiscountAmount(amount)
                }
                showDiscountDialog = false
            },
            onDismiss = { showDiscountDialog = false }
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
                .clickableWithoutRipple { onDeselectMethod() }
                .padding(12.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                stringResource(R.string.checkout_title),
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = vc.textPrimary
            )

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
                    onClick = { selectCardOrSplit() }
                )
            }
            if (terminalEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.adyen_terminal),
                    icon = Icons.Default.PointOfSale,
                    selected = checkoutState.method == PaymentMethod.ADYEN_TERMINAL,
                    accent = Color(0xFF8B5CF6),
                    onClick = {
                        if (cashApplied > 0.001 && remaining > 0.001) {
                            onApplyCardRemainder(remaining)
                            onSelectMethod(PaymentMethod.ADYEN_TERMINAL)
                        } else {
                            tenderBuffer = ""
                            onTenderAmount(0.0)
                            onSelectMethod(PaymentMethod.ADYEN_TERMINAL)
                        }
                    }
                )
            }
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
            CheckoutMethodButton(
                title = stringResource(R.string.invoice),
                icon = Icons.Default.Description,
                selected = checkoutState.method == PaymentMethod.INVOICE,
                accent = Color(0xFF0EA5E9),
                onClick = {
                    tenderBuffer = ""
                    onTenderAmount(0.0)
                    onSelectMethod(PaymentMethod.INVOICE)
                }
            )

            if (discountsEnabled || tipsEnabled) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    if (discountsEnabled) {
                        CheckoutActionChip(
                            icon = Icons.Default.Sell,
                            label = stringResource(R.string.discount),
                            selected = checkoutState.discountPercent > 0 || checkoutState.discountAmount > 0,
                            onClick = { showDiscountDialog = true },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    if (tipsEnabled) {
                        CheckoutActionChip(
                            icon = Icons.Default.Payments,
                            label = stringResource(R.string.tip),
                            selected = checkoutState.tipAmount > 0,
                            onClick = { showTipDialog = true },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
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

            if ((membershipPointsBalance ?: 0) >= redeemThresholdPoints) {
                CheckoutActionChip(
                    icon = Icons.Default.Payments,
                    label = stringResource(R.string.checkout_pay_with_points, membershipPointsBalance ?: 0),
                    selected = checkoutState.payWithPoints,
                    onClick = { onTogglePayWithPoints(!checkoutState.payWithPoints) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            if (giftCardsEnabled && (membershipGiftBalance ?: 0.0) > 0.0) {
                CheckoutActionChip(
                    icon = Icons.Default.CreditCard,
                    label = stringResource(
                        R.string.checkout_pay_with_gift_card,
                        formatMoney(membershipGiftBalance ?: 0.0, currencySymbol)
                    ),
                    selected = checkoutState.payWithGiftCard,
                    onClick = { onTogglePayWithGiftCard(!checkoutState.payWithGiftCard) },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            if (quickCashEnabled) {
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
                                .border(1.dp, Color(0xFFD4D4D8), RoundedCornerShape(12.dp))
                                .clickable { applyTender(amount) }
                                .padding(horizontal = 12.dp, vertical = 10.dp)
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

            if (cashEnabled) {
                CheckoutTenderKeypad(
                    buffer = tenderBuffer,
                    currencySymbol = currencySymbol,
                    onKey = ::appendTenderKey,
                    onClear = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                    },
                    onEnter = {
                        val amount = tenderBuffer.toDoubleOrNull() ?: 0.0
                        if (amount > 0) applyTender(amount) else onSelectMethod(PaymentMethod.CASH)
                    }
                )
            }
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .clickableWithoutRipple { onDeselectMethod() }
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
                if (checkoutOrderRef.isNotEmpty()) {
                    Text(
                        checkoutOrderRef,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = vc.textPrimary
                    )
                }
                if (cashApplied > 0.001) {
                    Text(
                        stringResource(R.string.checkout_cash_applied, formatMoney(cashApplied, currencySymbol)),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF15803D)
                    )
                }
                if (cardApplied > 0.001) {
                    Text(
                        stringResource(R.string.checkout_card_applied, formatMoney(cardApplied, currencySymbol)),
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

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onBack,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.height(56.dp)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.checkout_back), color = vc.textPrimary, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = onComplete,
                    enabled = canComplete,
                    modifier = Modifier
                        .weight(1f)
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
}

@Composable
private fun CheckoutMethodButton(
    title: String,
    icon: ImageVector,
    selected: Boolean,
    accent: Color,
    onClick: () -> Unit
) {
    val border = if (selected) accent else Color(0xFFD4D4D8)
    val bg = if (selected) accent.copy(alpha = 0.10f) else Color(0xFFF8FAFC)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(1.5.dp, border, RoundedCornerShape(12.dp))
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
    Row(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) CheckoutTeal.copy(alpha = 0.12f) else Color(0xFFF8FAFC))
            .border(1.5.dp, if (selected) CheckoutTeal else Color(0xFFD4D4D8), RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = if (selected) CheckoutTeal else Color(0xFF64748B),
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = if (selected) CheckoutTeal else Color(0xFF334155)
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
            .border(1.5.dp, Color(0xFFD4D4D8), RoundedCornerShape(12.dp))
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
    onClear: () -> Unit,
    onEnter: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.5.dp, Color(0xFF9CA3AF), RoundedCornerShape(12.dp))
                .background(Color.White, RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Text(
                text = if (buffer.isEmpty()) "$currencySymbol 0.00" else "$currencySymbol $buffer",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.End,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp
            )
        }
        listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9")
        ).forEach { row ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { key ->
                    CheckoutKey(label = key, modifier = Modifier.weight(1f), onClick = { onKey(key) })
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CheckoutKey(
                label = stringResource(R.string.keypad_clear),
                modifier = Modifier.weight(1f),
                tone = KeyTone.Clear,
                onClick = onClear
            )
            CheckoutKey(label = "0", modifier = Modifier.weight(1f), onClick = { onKey("0") })
            CheckoutKey(label = ".", modifier = Modifier.weight(1f), onClick = { onKey(".") })
        }
        CheckoutKey(
            label = stringResource(R.string.keypad_enter),
            modifier = Modifier.fillMaxWidth(),
            tone = KeyTone.Enter,
            onClick = onEnter
        )
    }
}

private enum class KeyTone { Normal, Clear, Enter }

@Composable
private fun CheckoutKey(
    label: String,
    modifier: Modifier = Modifier,
    tone: KeyTone = KeyTone.Normal,
    onClick: () -> Unit
) {
    val bg = when (tone) {
        KeyTone.Enter -> CheckoutTeal
        KeyTone.Clear -> Color(0xFFFEE2E2)
        KeyTone.Normal -> Color(0xFFF4F4F5)
    }
    val fg = when (tone) {
        KeyTone.Enter -> Color.White
        KeyTone.Clear -> Color(0xFFB91C1C)
        KeyTone.Normal -> Color(0xFF18181B)
    }
    Box(
        modifier = modifier
            .height(56.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(
                1.dp,
                if (tone == KeyTone.Normal) Color(0xFFD4D4D8) else bg,
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(label, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = fg)
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
    val cartDiscount = resolveBillDiscountAmount(
        cart,
        checkoutState.discountPercent,
        checkoutState.discountAmount
    ).let { if (checkoutState.discountPercent <= 0 && checkoutState.discountAmount <= 0) cart.discountValue else it }
    val preTipTotal = cart.merchandiseTotal(checkoutState.discountPercent, checkoutState.discountAmount)
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

private fun Modifier.clickableWithoutRipple(onClick: () -> Unit): Modifier = composed {
    clickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        onClick = onClick
    )
}
