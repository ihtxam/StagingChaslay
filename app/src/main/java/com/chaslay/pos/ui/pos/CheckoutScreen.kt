package com.chaslay.pos.ui.pos
import com.chaslay.pos.ui.theme.posUiColors

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.CallSplit
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Contactless
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.LocalAtm
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.PointOfSale
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Sell
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Redeem
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
import com.chaslay.pos.domain.model.CartItem
import com.chaslay.pos.domain.model.CartSummary
import com.chaslay.pos.domain.model.DiscountPreset
import com.chaslay.pos.domain.model.LoyaltyMath
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.domain.model.PosMenuDesign
import com.chaslay.pos.domain.model.applyCashRounding
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.util.suggestQuickCashTenderAmounts
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.round

private val CheckoutTeal = PosColors.Primary

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
    tapToPayEnabled: Boolean = false,
    tapToPayReady: Boolean = true,
    tapToPayStatus: String? = null,
    tipsEnabled: Boolean = true,
    allowCustomTip: Boolean = true,
    tipPresetsPercent: List<Double> = listOf(0.0, 5.0, 10.0, 15.0),
    discountsEnabled: Boolean = true,
    quickCashEnabled: Boolean = true,
    quickCashDenominations: List<Double> = listOf(10.0, 20.0, 50.0, 100.0),
    checkoutEurDisplayEnabled: Boolean = false,
    checkoutChfToEurRate: Double = 0.0,
    currencyCode: String = "CHF",
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
    onTogglePayWithGiftCard: (Boolean) -> Unit = {},
    onGiftCardPay: () -> Unit = {},
    posMenuDesign: PosMenuDesign = PosMenuDesign.CLASSIC,
    checkoutContextLine: String? = null,
    activeTableName: String? = null,
) {
    val isModernCheckout = posMenuDesign.isModern
    val showCartThumbnails = isModernCheckout
    val equalSplitCount = if (isEqualSplit) splitBillCount ?: 1 else 1
    val totals = rememberCheckoutTotals(cart, checkoutState, equalSplitCount)
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
    val kitchenRefLabel = stringResource(R.string.checkout_kitchen_ref_label)
    val checkoutOrderRef = com.chaslay.pos.util.OrderNumberFormat.formatCheckoutOrderRef(
        cart.orderNumber,
        null,
        null,
        kitchenRefLabel
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

    if (isModernCheckout) {
        ModernCheckoutBody(
            cart = cart,
            currencySymbol = currencySymbol,
            checkoutState = checkoutState,
            totals = totals,
            checkoutOrderRef = checkoutOrderRef,
            checkoutContextLine = checkoutContextLine,
            activeTableName = activeTableName,
            cashEnabled = cashEnabled,
            cardEnabled = cardEnabled,
            terminalEnabled = terminalEnabled,
            tapToPayEnabled = tapToPayEnabled,
            tapToPayReady = tapToPayReady,
            tapToPayStatus = tapToPayStatus,
            tipsEnabled = tipsEnabled,
            discountsEnabled = discountsEnabled,
            quickCashEnabled = quickCashEnabled,
            currencyCode = currencyCode,
            splitBillsEnabled = splitBillsEnabled,
            showSplitNav = showSplitNav,
            splitBillIndex = splitBillIndex,
            splitBillCount = splitBillCount,
            isEqualSplit = isEqualSplit,
            equalSplitPaidCount = equalSplitPaidCount,
            equalSplitCount = equalSplitCount,
            giftCardsEnabled = giftCardsEnabled,
            membershipPointsBalance = membershipPointsBalance,
            membershipGiftBalance = membershipGiftBalance,
            redeemThresholdPoints = redeemThresholdPoints,
            checkoutEurDisplayEnabled = checkoutEurDisplayEnabled,
            checkoutChfToEurRate = checkoutChfToEurRate,
            tenderBuffer = tenderBuffer,
            cashApplied = cashApplied,
            cardApplied = cardApplied,
            remaining = remaining,
            changeDue = changeDue,
            canComplete = canComplete,
            onBack = onBack,
            onSelectMethod = onSelectMethod,
            onDeselectMethod = onDeselectMethod,
            onApplyCardRemainder = onApplyCardRemainder,
            onTenderAmount = onTenderAmount,
            onComplete = onComplete,
            onSplitClick = onSplitClick,
            onOpenCashDrawer = onOpenCashDrawer,
            onPrintReceipt = onPrintReceipt,
            onScanBarcode = onScanBarcode,
            onGiftCardPay = onGiftCardPay,
            onTogglePayWithPoints = onTogglePayWithPoints,
            onTogglePayWithGiftCard = onTogglePayWithGiftCard,
            onPrevSplitBill = onPrevSplitBill,
            onNextSplitBill = onNextSplitBill,
            onShowTipDialog = { showTipDialog = true },
            onShowDiscountDialog = { showDiscountDialog = true },
            applyTender = ::applyTender,
            appendTenderKey = ::appendTenderKey,
            selectCardOrSplit = ::selectCardOrSplit,
            clearTender = {
                tenderBuffer = ""
                onTenderAmount(0.0)
            },
        )
        return
    }

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(posUiColors().canvas)
    ) {
        Column(
            modifier = Modifier
                .width(300.dp)
                .fillMaxHeight()
                .background(posUiColors().surface)
                .border(1.dp, posUiColors().border)
                .clickableWithoutRipple { onDeselectMethod() }
                .padding(PosDimens.PagePaddingCompact)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                stringResource(
                    if (isModernCheckout) R.string.checkout_payment_methods else R.string.checkout_title
                ),
                fontSize = if (isModernCheckout) 16.sp else 20.sp,
                fontWeight = FontWeight.Bold,
                color = posUiColors().textPrimary
            )

            if (cashEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.cash),
                    icon = Icons.Default.AttachMoney,
                    selected = checkoutState.method == PaymentMethod.CASH,
                    onClick = { onSelectMethod(PaymentMethod.CASH) }
                )
            }
            if (cardEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.card),
                    icon = Icons.Default.CreditCard,
                    selected = checkoutState.method == PaymentMethod.CARD,
                    onClick = { selectCardOrSplit() }
                )
            }
            if (tapToPayEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.tap_to_pay_method),
                    icon = Icons.Default.Contactless,
                    selected = checkoutState.method == PaymentMethod.TAP_TO_PAY,
                    enabled = tapToPayReady,
                    subtitle = tapToPayStatus?.takeIf { !tapToPayReady },
                    onClick = {
                        if (cashApplied > 0.001 && remaining > 0.001) {
                            onApplyCardRemainder(remaining)
                            onSelectMethod(PaymentMethod.TAP_TO_PAY)
                        } else {
                            tenderBuffer = ""
                            onTenderAmount(0.0)
                            onSelectMethod(PaymentMethod.TAP_TO_PAY)
                        }
                    }
                )
            }
            if (terminalEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.adyen_terminal),
                    icon = Icons.Default.PointOfSale,
                    selected = checkoutState.method == PaymentMethod.ADYEN_TERMINAL,
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
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                CheckoutMethodButton(
                    title = stringResource(R.string.pay_later),
                    icon = Icons.Default.Schedule,
                    selected = checkoutState.method == PaymentMethod.PAY_LATER,
                    onClick = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                        onSelectMethod(PaymentMethod.PAY_LATER)
                    },
                    modifier = Modifier.weight(1f)
                )
                CheckoutMethodButton(
                    title = stringResource(R.string.invoice),
                    icon = Icons.Default.Description,
                    selected = checkoutState.method == PaymentMethod.INVOICE,
                    onClick = {
                        tenderBuffer = ""
                        onTenderAmount(0.0)
                        onSelectMethod(PaymentMethod.INVOICE)
                    },
                    modifier = Modifier.weight(1f)
                )
            }
            if (giftCardsEnabled) {
                CheckoutMethodButton(
                    title = stringResource(R.string.gift_card_pay),
                    icon = Icons.Default.Redeem,
                    selected = checkoutState.payWithGiftCard && checkoutState.giftCardRedeemAmount > 0.001,
                    onClick = onGiftCardPay,
                    modifier = Modifier.fillMaxWidth()
                )
            }

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
            if (giftCardsEnabled && (membershipGiftBalance ?: 0.0) > 0.0 && !checkoutState.payWithGiftCard) {
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
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .padding(PosDimens.PagePaddingCompact)
                .clickableWithoutRipple { onDeselectMethod() }
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .clip(PosShapes.ExtraLarge)
                    .background(posUiColors().surface)
                    .border(1.dp, posUiColors().border, PosShapes.ExtraLarge)
                    .padding(PosDimens.PagePaddingCompact)
                    .verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (!isModernCheckout) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            if (checkoutOrderRef.isNotEmpty()) {
                                Text(
                                    checkoutOrderRef,
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = posUiColors().textPrimary
                                )
                            }
                            Text(
                                stringResource(R.string.total_items, cart.items.size),
                                fontSize = 12.sp,
                                color = posUiColors().textSecondary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(PosShapes.Large)
                        .background(posUiColors().surfaceSubtle)
                        .padding(vertical = 16.dp, horizontal = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        stringResource(R.string.checkout_amount_due),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = posUiColors().textSecondary,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        formatMoney(totals.roundedTotal, currencySymbol),
                        fontWeight = FontWeight.Bold,
                        fontSize = 44.sp,
                        color = posUiColors().textPrimary
                    )
                    if (checkoutEurDisplayEnabled) {
                        chfTotalToEur(totals.roundedTotal, checkoutChfToEurRate)?.let { eur ->
                            Text(
                                stringResource(
                                    R.string.checkout_eur_equivalent,
                                    String.format(Locale.FRENCH, "%,.2f", eur)
                                ),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = posUiColors().textSecondary,
                                modifier = Modifier.padding(top = 6.dp)
                            )
                        }
                    }
                }

                if (cashApplied > 0.001) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.checkout_cash_applied, formatMoney(cashApplied, currencySymbol)),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PosColors.Success
                    )
                }
                if (cardApplied > 0.001) {
                    Text(
                        stringResource(R.string.checkout_card_applied, formatMoney(cardApplied, currencySymbol)),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PosColors.Info
                    )
                }
                if (remaining > 0.001) {
                    Text(
                        stringResource(R.string.checkout_remaining, formatMoney(remaining, currencySymbol)),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PosColors.Warning
                    )
                }

                if (showSplitNav) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(PosShapes.Card)
                            .background(posUiColors().surfaceSubtle)
                            .border(1.dp, posUiColors().border, PosShapes.Card)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = onPrevSplitBill,
                            enabled = splitBillIndex!! > 1,
                            shape = PosShapes.Medium,
                            border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
                        ) {
                            Text(stringResource(R.string.prev_bill), color = posUiColors().textPrimary, fontSize = 12.sp)
                        }
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                stringResource(R.string.bill_x_of_y, splitBillIndex, splitBillCount!!),
                                fontWeight = FontWeight.Bold,
                                color = PosColors.Primary,
                                fontSize = 16.sp
                            )
                            if (isEqualSplit && equalSplitPaidCount > 0) {
                                Text(
                                    stringResource(R.string.bills_paid_count, equalSplitPaidCount, splitBillCount),
                                    fontSize = 11.sp,
                                    color = posUiColors().textSecondary
                                )
                            }
                        }
                        OutlinedButton(
                            onClick = onNextSplitBill,
                            enabled = splitBillIndex < splitBillCount,
                            shape = PosShapes.Medium,
                            border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
                        ) {
                            Text(stringResource(R.string.next_bill), color = posUiColors().textPrimary, fontSize = 12.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
                cart.items.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            if (showCartThumbnails) {
                                ModernPosCartLineThumbnail(
                                    imageUri = item.imageUri,
                                    modifier = Modifier.padding(end = 8.dp),
                                )
                            }
                            Text(
                                item.displayQtyLabel(),
                                fontSize = 14.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                                color = posUiColors().textPrimary,
                            )
                        }
                        Text(
                            formatMoney(item.lineSubtotal, currencySymbol),
                            fontSize = 14.sp,
                            color = posUiColors().textPrimary,
                        )
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
        }

        Column(
            modifier = Modifier
                .width(320.dp)
                .fillMaxHeight()
                .background(posUiColors().surface)
                .border(1.dp, posUiColors().border)
                .clickableWithoutRipple { onDeselectMethod() }
                .padding(PosDimens.PagePaddingCompact)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (isModernCheckout) {
                Text(
                    stringResource(R.string.checkout_settlement),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = posUiColors().textPrimary,
                )
            }
            if (cashEnabled) {
                Text(
                    stringResource(R.string.checkout_amount_received),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = posUiColors().textSecondary
                )
            }

            if (quickCashEnabled && cashEnabled) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    buildQuickCashAmounts(totals.roundedTotal, currencyCode).forEach { amount ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .heightIn(min = 44.dp)
                                .clip(PosShapes.Card)
                                .background(posUiColors().surfaceSubtle)
                                .border(1.dp, posUiColors().border, PosShapes.Card)
                                .clickable { applyTender(amount) }
                                .padding(horizontal = 4.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                formatQuickCashAmount(amount, currencySymbol),
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = posUiColors().textPrimary,
                                maxLines = 2,
                                textAlign = TextAlign.Center,
                                lineHeight = 16.sp
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

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PosShapes.Large)
                    .background(posUiColors().warningSubtle)
                    .border(1.dp, PosColors.Warning.copy(alpha = 0.35f), PosShapes.Large)
                    .padding(horizontal = 14.dp, vertical = 12.dp)
            ) {
                Text(
                    stringResource(R.string.checkout_change_due_label),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PosColors.Warning
                )
                Text(
                    formatMoney(changeDue, currencySymbol),
                    fontSize = 26.sp,
                    fontWeight = FontWeight.Bold,
                    color = PosColors.Warning
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedButton(
                    onClick = onBack,
                    shape = PosShapes.Large,
                    modifier = Modifier.height(52.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, posUiColors().border)
                ) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(18.dp), tint = posUiColors().textPrimary)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(stringResource(R.string.checkout_back), color = posUiColors().textPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Button(
                    onClick = onComplete,
                    enabled = canComplete,
                    modifier = Modifier
                        .weight(1f)
                        .height(52.dp),
                    shape = PosShapes.Large,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PosColors.Primary,
                        contentColor = PosColors.TextOnPrimary,
                        disabledContainerColor = posUiColors().surfaceMuted,
                        disabledContentColor = posUiColors().textMuted,
                    )
                ) {
                    val label = if (changeDue > 0.001) {
                        stringResource(
                            R.string.checkout_complete_with_change,
                            formatMoney(changeDue, currencySymbol)
                        )
                    } else {
                        stringResource(R.string.checkout_complete)
                    }
                    Text(label, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
    onClick: () -> Unit,
    enabled: Boolean = true,
    subtitle: String? = null,
    modifier: Modifier = Modifier
) {
    val border = when {
        !enabled -> posUiColors().border
        selected -> CheckoutTeal
        else -> posUiColors().border
    }
    val bg = when {
        !enabled -> posUiColors().surfaceMuted
        selected -> posUiColors().primarySubtle
        else -> posUiColors().surface
    }
    val iconTint = when {
        !enabled -> posUiColors().textMuted
        selected -> CheckoutTeal
        else -> posUiColors().textSecondary
    }
    val contentAlpha = if (enabled) 1f else 0.45f
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .clip(PosShapes.Card)
            .background(bg)
            .border(1.5.dp, border, PosShapes.Card)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = iconTint.copy(alpha = contentAlpha),
            modifier = Modifier.size(22.dp)
        )
        Column {
            Text(
                title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = posUiColors().textPrimary.copy(alpha = contentAlpha)
            )
            subtitle?.let {
                Text(it, fontSize = 12.sp, color = posUiColors().textMuted)
            }
        }
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
            .clip(PosShapes.Card)
            .background(if (selected) CheckoutTeal.copy(alpha = 0.12f) else posUiColors().surface)
            .border(1.5.dp, if (selected) CheckoutTeal else posUiColors().border, PosShapes.Card)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = if (selected) CheckoutTeal else posUiColors().textSecondary,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = if (selected) CheckoutTeal else posUiColors().textPrimary
        )
    }
}

@Composable
private fun CheckoutIconChip(icon: ImageVector, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(PosShapes.Card)
            .background(posUiColors().surface)
            .border(1.5.dp, posUiColors().border, PosShapes.Card)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = posUiColors().textSecondary, modifier = Modifier.size(20.dp))
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
                .border(1.5.dp, posUiColors().borderStrong, PosShapes.Card)
                .background(posUiColors().surface, PosShapes.Card)
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Text(
                text = if (buffer.isEmpty()) "$currencySymbol 0.00" else "$currencySymbol $buffer",
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.End,
                fontWeight = FontWeight.Bold,
                fontSize = 24.sp,
                color = posUiColors().textPrimary
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
        KeyTone.Clear -> posUiColors().dangerSubtle
        KeyTone.Normal -> posUiColors().surfaceSubtle
    }
    val fg = when (tone) {
        KeyTone.Enter -> PosColors.TextOnPrimary
        KeyTone.Clear -> PosColors.Danger
        KeyTone.Normal -> posUiColors().textPrimary
    }
    Box(
        modifier = modifier
            .height(56.dp)
            .clip(PosShapes.Card)
            .background(bg)
            .border(
                1.dp,
                if (tone == KeyTone.Normal) posUiColors().border else bg,
                PosShapes.Card
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
        Text(label, fontSize = 13.sp, color = posUiColors().textSecondary)
        Text(value, fontSize = 13.sp, color = posUiColors().textPrimary)
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

private fun buildQuickCashAmounts(total: Double, currencyCode: String): List<Double> =
    suggestQuickCashTenderAmounts(total, currencyCode)

private fun chfTotalToEur(chfTotal: Double, rate: Double): Double? {
    if (rate <= 0.001 || chfTotal < 0) return null
    val raw = chfTotal * rate
    return round(raw * 20.0) / 20.0
}

private fun formatMoney(amount: Double, symbol: String): String =
    String.format(Locale.getDefault(), "%s %.2f", symbol, amount)

private fun formatQuickCashAmount(amount: Double, symbol: String): String =
    if (amount == kotlin.math.floor(amount)) {
        String.format(Locale.getDefault(), "%d %s", amount.toInt(), symbol)
    } else {
        formatMoney(amount, symbol)
    }

@Composable
private fun ModernCheckoutBody(
    cart: CartSummary,
    currencySymbol: String,
    checkoutState: CheckoutState,
    totals: CheckoutTotals,
    checkoutOrderRef: String,
    checkoutContextLine: String?,
    activeTableName: String?,
    cashEnabled: Boolean,
    cardEnabled: Boolean,
    terminalEnabled: Boolean,
    tapToPayEnabled: Boolean,
    tapToPayReady: Boolean,
    tapToPayStatus: String?,
    tipsEnabled: Boolean,
    discountsEnabled: Boolean,
    quickCashEnabled: Boolean,
    currencyCode: String,
    splitBillsEnabled: Boolean,
    showSplitNav: Boolean,
    splitBillIndex: Int?,
    splitBillCount: Int?,
    isEqualSplit: Boolean,
    equalSplitPaidCount: Int,
    equalSplitCount: Int,
    giftCardsEnabled: Boolean,
    membershipPointsBalance: Int?,
    membershipGiftBalance: Double?,
    redeemThresholdPoints: Int,
    checkoutEurDisplayEnabled: Boolean,
    checkoutChfToEurRate: Double,
    tenderBuffer: String,
    cashApplied: Double,
    cardApplied: Double,
    remaining: Double,
    changeDue: Double,
    canComplete: Boolean,
    onBack: () -> Unit,
    onSelectMethod: (PaymentMethod) -> Unit,
    onDeselectMethod: () -> Unit,
    onApplyCardRemainder: (Double) -> Unit,
    onTenderAmount: (Double) -> Unit,
    onComplete: () -> Unit,
    onSplitClick: () -> Unit,
    onOpenCashDrawer: () -> Unit,
    onPrintReceipt: () -> Unit,
    onScanBarcode: () -> Unit,
    onGiftCardPay: () -> Unit,
    onTogglePayWithPoints: (Boolean) -> Unit,
    onTogglePayWithGiftCard: (Boolean) -> Unit,
    onPrevSplitBill: () -> Unit,
    onNextSplitBill: () -> Unit,
    onShowTipDialog: () -> Unit,
    onShowDiscountDialog: () -> Unit,
    applyTender: (Double) -> Unit,
    appendTenderKey: (String) -> Unit,
    selectCardOrSplit: () -> Unit,
    clearTender: () -> Unit,
) {
    val ui = posUiColors()
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(ui.canvas),
    ) {
        Row(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier
                    .width(280.dp)
                    .fillMaxHeight()
                    .background(ui.surface)
                    .border(1.dp, ui.border)
                    .clickableWithoutRipple { onDeselectMethod() }
                    .padding(PosDimens.PagePaddingCompact)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    stringResource(R.string.checkout_payment_methods),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ui.textPrimary,
                )
                if (cashEnabled) {
                    ModernCheckoutMethodCard(
                        title = stringResource(R.string.cash),
                        icon = Icons.Default.AttachMoney,
                        selected = checkoutState.method == PaymentMethod.CASH,
                        onClick = { onSelectMethod(PaymentMethod.CASH) },
                    )
                }
                if (cardEnabled) {
                    ModernCheckoutMethodCard(
                        title = stringResource(R.string.card),
                        icon = Icons.Default.CreditCard,
                        selected = checkoutState.method == PaymentMethod.CARD,
                        onClick = selectCardOrSplit,
                    )
                }
                if (terminalEnabled) {
                    ModernCheckoutMethodCard(
                        title = stringResource(R.string.adyen_terminal),
                        icon = Icons.Default.PointOfSale,
                        selected = checkoutState.method == PaymentMethod.ADYEN_TERMINAL,
                        onClick = {
                            if (cashApplied > 0.001 && remaining > 0.001) {
                                onApplyCardRemainder(remaining)
                                onSelectMethod(PaymentMethod.ADYEN_TERMINAL)
                            } else {
                                clearTender()
                                onSelectMethod(PaymentMethod.ADYEN_TERMINAL)
                            }
                        },
                    )
                }
                if (tapToPayEnabled) {
                    ModernCheckoutMethodCard(
                        title = stringResource(R.string.tap_to_pay_method),
                        icon = Icons.Default.Contactless,
                        selected = checkoutState.method == PaymentMethod.TAP_TO_PAY,
                        enabled = tapToPayReady,
                        subtitle = tapToPayStatus?.takeIf { !tapToPayReady },
                        onClick = {
                            if (cashApplied > 0.001 && remaining > 0.001) {
                                onApplyCardRemainder(remaining)
                                onSelectMethod(PaymentMethod.TAP_TO_PAY)
                            } else {
                                clearTender()
                                onSelectMethod(PaymentMethod.TAP_TO_PAY)
                            }
                        },
                    )
                }
                ModernCheckoutMethodCard(
                    title = stringResource(R.string.checkout_deferred_payment),
                    subtitle = stringResource(R.string.checkout_deferred_account),
                    icon = Icons.Default.Schedule,
                    selected = checkoutState.method == PaymentMethod.PAY_LATER,
                    onClick = {
                        clearTender()
                        onSelectMethod(PaymentMethod.PAY_LATER)
                    },
                )
                ModernCheckoutMethodCard(
                    title = stringResource(R.string.invoice),
                    icon = Icons.Default.Description,
                    selected = checkoutState.method == PaymentMethod.INVOICE,
                    onClick = {
                        clearTender()
                        onSelectMethod(PaymentMethod.INVOICE)
                    },
                )
                if (giftCardsEnabled) {
                    ModernCheckoutMethodCard(
                        title = stringResource(R.string.gift_card_pay),
                        icon = Icons.Default.Redeem,
                        selected = checkoutState.payWithGiftCard && checkoutState.giftCardRedeemAmount > 0.001,
                        onClick = onGiftCardPay,
                    )
                }
                if (discountsEnabled || tipsEnabled || splitBillsEnabled) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        if (discountsEnabled) {
                            CheckoutActionChip(
                                icon = Icons.Default.Sell,
                                label = stringResource(R.string.discount),
                                selected = checkoutState.discountPercent > 0 || checkoutState.discountAmount > 0,
                                onClick = onShowDiscountDialog,
                                modifier = Modifier.weight(1f),
                            )
                        }
                        if (tipsEnabled) {
                            CheckoutActionChip(
                                icon = Icons.Default.Payments,
                                label = stringResource(R.string.tip),
                                selected = checkoutState.tipAmount > 0,
                                onClick = onShowTipDialog,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
                if (splitBillsEnabled) {
                    CheckoutActionChip(
                        icon = Icons.AutoMirrored.Filled.CallSplit,
                        label = stringResource(R.string.split_bill),
                        selected = showSplitNav,
                        onClick = onSplitClick,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    CheckoutIconChip(icon = Icons.Default.QrCodeScanner, onClick = onScanBarcode)
                    CheckoutIconChip(icon = Icons.Default.Print, onClick = onPrintReceipt)
                    CheckoutIconChip(icon = Icons.Default.LocalAtm, onClick = onOpenCashDrawer)
                }
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .padding(PosDimens.PagePaddingCompact)
                    .clickableWithoutRipple { onDeselectMethod() },
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(PosShapes.ExtraLarge)
                        .background(ui.surface)
                        .border(1.dp, ui.border, PosShapes.ExtraLarge)
                        .padding(PosDimens.PagePaddingCompact),
                ) {
                    ModernCheckoutOrderHeader(
                        orderRef = checkoutOrderRef,
                        contextLine = checkoutContextLine,
                        tableName = activeTableName,
                    )
                    if (showSplitNav && splitBillIndex != null && splitBillCount != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(PosShapes.Card)
                                .background(ui.surfaceSubtle)
                                .border(1.dp, ui.border, PosShapes.Card)
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            OutlinedButton(
                                onClick = onPrevSplitBill,
                                enabled = splitBillIndex > 1,
                                shape = PosShapes.Medium,
                                border = androidx.compose.foundation.BorderStroke(1.dp, ui.border),
                            ) {
                                Text(stringResource(R.string.prev_bill), color = ui.textPrimary, fontSize = 12.sp)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    stringResource(R.string.bill_x_of_y, splitBillIndex, splitBillCount),
                                    fontWeight = FontWeight.Bold,
                                    color = PosColors.Primary,
                                    fontSize = 16.sp,
                                )
                                if (isEqualSplit && equalSplitPaidCount > 0) {
                                    Text(
                                        stringResource(R.string.bills_paid_count, equalSplitPaidCount, splitBillCount),
                                        fontSize = 11.sp,
                                        color = ui.textSecondary,
                                    )
                                }
                            }
                            OutlinedButton(
                                onClick = onNextSplitBill,
                                enabled = splitBillIndex < splitBillCount,
                                shape = PosShapes.Medium,
                                border = androidx.compose.foundation.BorderStroke(1.dp, ui.border),
                            ) {
                                Text(stringResource(R.string.next_bill), color = ui.textPrimary, fontSize = 12.sp)
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    LazyColumn(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(cart.items, key = { it.id }) { item ->
                            ModernCheckoutLineItem(item = item, currencySymbol = currencySymbol)
                        }
                    }
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        if (!cart.vatIncludedInPrice) {
                            SummaryLine(stringResource(R.string.subtotal), formatMoney(cart.subtotal, currencySymbol))
                        }
                        if (totals.cartDiscount > 0) {
                            SummaryLine(stringResource(R.string.discount), "-${formatMoney(totals.cartDiscount, currencySymbol)}")
                        }
                        val taxShare = if (equalSplitCount > 1) cart.taxTotal / equalSplitCount else cart.taxTotal
                        val taxLabel = if (cart.vatIncludedInPrice) {
                            stringResource(R.string.tax_included_in_total)
                        } else {
                            stringResource(R.string.tax)
                        }
                        SummaryLine(taxLabel, formatMoney(taxShare, currencySymbol))
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                stringResource(R.string.total),
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = ui.textPrimary,
                            )
                            Text(
                                formatMoney(totals.roundedTotal, currencySymbol),
                                fontWeight = FontWeight.Bold,
                                fontSize = 22.sp,
                                color = ui.textPrimary,
                            )
                        }
                        if (checkoutEurDisplayEnabled) {
                            chfTotalToEur(totals.roundedTotal, checkoutChfToEurRate)?.let { eur ->
                                Text(
                                    stringResource(
                                        R.string.checkout_eur_equivalent,
                                        String.format(Locale.FRENCH, "%,.2f", eur),
                                    ),
                                    fontSize = 13.sp,
                                    color = ui.textSecondary,
                                    modifier = Modifier.align(Alignment.End),
                                )
                            }
                        }
                    }
                }
            }

            Column(
                modifier = Modifier
                    .width(320.dp)
                    .fillMaxHeight()
                    .background(ui.surface)
                    .border(1.dp, ui.border)
                    .clickableWithoutRipple { onDeselectMethod() }
                    .padding(PosDimens.PagePaddingCompact)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(
                    stringResource(R.string.checkout_settlement),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = ui.textPrimary,
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(PosShapes.Large)
                        .background(PosColors.Primary.copy(alpha = 0.08f))
                        .border(1.dp, PosColors.Primary.copy(alpha = 0.25f), PosShapes.Large)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                ) {
                    Text(
                        stringResource(R.string.checkout_amount_due),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = ui.textSecondary,
                    )
                    Text(
                        formatMoney(totals.roundedTotal, currencySymbol),
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = ui.textPrimary,
                    )
                }
                if (cashEnabled) {
                    Text(
                        stringResource(R.string.checkout_amount_received),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = ui.textSecondary,
                    )
                }
                if (quickCashEnabled && cashEnabled) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        buildQuickCashAmounts(totals.roundedTotal, currencyCode).forEach { amount ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .heightIn(min = 44.dp)
                                    .clip(PosShapes.Card)
                                    .background(ui.surfaceSubtle)
                                    .border(1.dp, ui.border, PosShapes.Card)
                                    .clickable { applyTender(amount) }
                                    .padding(horizontal = 4.dp, vertical = 8.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    formatQuickCashAmount(amount, currencySymbol),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = ui.textPrimary,
                                    maxLines = 2,
                                    textAlign = TextAlign.Center,
                                    lineHeight = 15.sp,
                                )
                            }
                        }
                    }
                }
                if (cashEnabled) {
                    CheckoutTenderKeypad(
                        buffer = tenderBuffer,
                        currencySymbol = currencySymbol,
                        onKey = appendTenderKey,
                        onClear = clearTender,
                        onEnter = {
                            val amount = tenderBuffer.toDoubleOrNull() ?: 0.0
                            if (amount > 0) applyTender(amount) else onSelectMethod(PaymentMethod.CASH)
                        },
                    )
                }
                if (changeDue > 0.001) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(PosShapes.Large)
                            .background(ui.warningSubtle)
                            .border(1.dp, PosColors.Warning.copy(alpha = 0.35f), PosShapes.Large)
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                    ) {
                        Text(
                            stringResource(R.string.checkout_change_due_label),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PosColors.Warning,
                        )
                        Text(
                            formatMoney(changeDue, currencySymbol),
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold,
                            color = PosColors.Warning,
                        )
                    }
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ui.surface)
                .border(1.dp, ui.border)
                .padding(horizontal = PosDimens.PagePaddingCompact, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(
                onClick = onBack,
                shape = PosShapes.Large,
                modifier = Modifier.height(52.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, ui.border),
            ) {
                Text(
                    stringResource(R.string.checkout_back),
                    color = ui.textPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            OutlinedButton(
                onClick = onBack,
                shape = PosShapes.Large,
                modifier = Modifier.height(52.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, ui.border),
            ) {
                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(18.dp), tint = ui.textPrimary)
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    stringResource(R.string.checkout_edit_order),
                    color = ui.textPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                )
            }
            Button(
                onClick = onComplete,
                enabled = canComplete,
                modifier = Modifier
                    .weight(1f)
                    .height(52.dp),
                shape = PosShapes.Large,
                colors = ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary,
                    disabledContainerColor = ui.surfaceMuted,
                    disabledContentColor = ui.textMuted,
                ),
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    stringResource(
                        R.string.checkout_confirm_payment_amount,
                        formatMoney(totals.roundedTotal, currencySymbol),
                    ),
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun ModernCheckoutMethodCard(
    title: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    enabled: Boolean = true,
    subtitle: String? = null,
) {
    val ui = posUiColors()
    val border = when {
        !enabled -> ui.border
        selected -> CheckoutTeal
        else -> ui.border
    }
    val bg = when {
        !enabled -> ui.surfaceMuted
        selected -> ui.primarySubtle
        else -> ui.surface
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 58.dp)
            .clip(PosShapes.Card)
            .background(bg)
            .border(if (selected) 2.dp else 1.dp, border, PosShapes.Card)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (selected) CheckoutTeal else ui.textSecondary,
            modifier = Modifier.size(24.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = ui.textPrimary)
            subtitle?.let {
                Text(it, fontSize = 12.sp, color = ui.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (selected) {
            Icon(Icons.Default.Check, contentDescription = null, tint = CheckoutTeal, modifier = Modifier.size(20.dp))
        }
    }
}

@Composable
private fun ModernCheckoutLineItem(item: CartItem, currencySymbol: String) {
    val ui = posUiColors()
    val subline = item.modifierSummary().takeIf { it.isNotBlank() }
        ?: item.optionNotes()?.lineSequence()?.firstOrNull()?.takeIf { it.isNotBlank() }
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
    ) {
        ModernPosCartLineThumbnail(imageUri = item.imageUri, modifier = Modifier.padding(end = 10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "${item.quantity}x ${item.productName}",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = ui.textPrimary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            subline?.let {
                Text(it, fontSize = 12.sp, color = ui.textSecondary, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        Text(
            formatMoney(item.lineSubtotal, currencySymbol),
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = ui.textPrimary,
        )
    }
}

@Composable
private fun ModernCheckoutMetaPill(text: String) {
    val ui = posUiColors()
    Text(
        text,
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(ui.surfaceSubtle)
            .border(1.dp, ui.border, RoundedCornerShape(999.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        color = ui.textSecondary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun ModernCheckoutOrderHeader(
    orderRef: String,
    contextLine: String?,
    tableName: String?,
) {
    val ui = posUiColors()
    val timeLabel = remember {
        SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
    }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (orderRef.isNotBlank()) {
                    stringResource(R.string.checkout_order_heading, orderRef)
                } else {
                    stringResource(R.string.checkout_title)
                },
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = ui.textPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(PosColors.Success),
                )
                Text(
                    stringResource(R.string.checkout_status_unpaid),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PosColors.Success,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            contextLine?.takeIf { it.isNotBlank() }?.let { ModernCheckoutMetaPill(it) }
            tableName?.takeIf { it.isNotBlank() }?.let { ModernCheckoutMetaPill(it) }
            ModernCheckoutMetaPill(timeLabel)
        }
    }
}

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
