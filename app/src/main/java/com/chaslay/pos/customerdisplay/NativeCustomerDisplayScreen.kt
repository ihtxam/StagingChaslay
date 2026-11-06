package com.chaslay.pos.customerdisplay

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.chaslay.pos.domain.model.formatMoneyAmount
import kotlinx.coroutines.flow.StateFlow

private val CdsTeal = Color(0xFF079B8F)
private val CdsGradientTop = Color(0xFF0D4D4A)
private val CdsGradientBottom = Color(0xFF051A18)

@Composable
fun NativeCustomerDisplayScreen(
    stateFlow: StateFlow<CustomerDisplayState>,
    brandingFlow: StateFlow<CustomerDisplayBranding>,
) {
    val state = stateFlow.collectAsState().value
    val branding = brandingFlow.collectAsState().value
    NativeCustomerDisplayScreenContent(state = state, branding = branding)
}

@Composable
fun NativeCustomerDisplayScreenContent(
    state: CustomerDisplayState,
    branding: CustomerDisplayBranding,
) {
    val locale = state.locale?.lowercase().orEmpty()
    val labels = cdsLabels(locale)
    val merchantName = branding.merchantName.ifBlank { state.merchantName.orEmpty() }
    val showOrderPanel = state.phase != CustomerDisplayPhase.idle &&
        (state.lines.isNotEmpty() || state.phase == CustomerDisplayPhase.payment)

    if (state.phase == CustomerDisplayPhase.thankyou) {
        ThankYouPanel(state, branding, labels, merchantName)
        return
    }

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF1F5F9)),
    ) {
        if (showOrderPanel) {
            OrderPanel(
                modifier = Modifier
                    .weight(0.62f)
                    .fillMaxHeight(),
                state = state,
                labels = labels,
            )
        }
        BrandingPanel(
            modifier = Modifier
                .weight(if (showOrderPanel) 0.38f else 1f)
                .fillMaxHeight(),
            branding = branding,
            merchantName = merchantName,
            compact = showOrderPanel,
        )
    }
}

@Composable
private fun BrandingPanel(
    modifier: Modifier,
    branding: CustomerDisplayBranding,
    merchantName: String,
    compact: Boolean,
) {
    Box(
        modifier = modifier
            .padding(if (compact) 12.dp else 20.dp)
            .fillMaxSize(),
    ) {
        val imageUrl = branding.promoImageUrl?.takeIf { it.isNotBlank() }
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(CdsGradientTop, CdsGradientBottom),
                        ),
                    ),
            )
        }
        Column(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(24.dp),
        ) {
            branding.logoUrl?.takeIf { it.isNotBlank() }?.let { logo ->
                AsyncImage(
                    model = logo,
                    contentDescription = null,
                    modifier = Modifier
                        .height(if (compact) 36.dp else 48.dp)
                        .padding(bottom = 12.dp),
                    contentScale = ContentScale.Fit,
                )
            }
            Text(
                text = merchantName,
                color = Color.White,
                fontSize = if (compact) 22.sp else 28.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = branding.thankYouSubtitle,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 16.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun OrderPanel(
    modifier: Modifier,
    state: CustomerDisplayState,
    labels: CdsLabels,
) {
    Column(
        modifier = modifier
            .padding(start = 12.dp, top = 12.dp, bottom = 12.dp, end = 4.dp)
            .background(Color.White, MaterialTheme.shapes.large)
            .padding(horizontal = 20.dp),
    ) {
        Text(
            text = when (state.phase) {
                CustomerDisplayPhase.payment -> labels.paymentTitle
                else -> labels.yourOrder
            },
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 20.dp, bottom = 12.dp),
        )
        HorizontalDivider()
        val listState = rememberLazyListState()
        LaunchedEffect(state.lines.size, state.updatedAt) {
            if (state.lines.isNotEmpty()) {
                listState.animateScrollToItem(state.lines.lastIndex)
            }
        }
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            itemsIndexed(state.lines) { _, line ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${formatQty(line.qty)}× ${line.name}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        line.modifiers?.takeIf { it.isNotBlank() }?.let { mods ->
                            Text(
                                text = mods,
                                fontSize = 14.sp,
                                color = Color.Gray,
                            )
                        }
                    }
                    Text(
                        text = formatMoney(state.currency, line.lineTotal),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                HorizontalDivider(color = Color(0xFFE2E8F0))
            }
        }
        TotalsFooter(state, labels)
    }
}

@Composable
private fun TotalsFooter(state: CustomerDisplayState, labels: CdsLabels) {
    HorizontalDivider(modifier = Modifier.padding(top = 8.dp))
    Column(modifier = Modifier.padding(vertical = 16.dp)) {
        if (state.discount > 0.001) {
            TotalRow(labels.discount, "−${formatMoney(state.currency, state.discount)}", muted = true)
        }
        TotalRow(labels.subtotal, formatMoney(state.currency, state.subtotal), muted = true)
        if (state.tax > 0.001) {
            TotalRow(labels.tax, formatMoney(state.currency, state.tax), muted = true)
        }
        Spacer(modifier = Modifier.height(8.dp))
        HorizontalDivider()
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = labels.total, fontSize = 22.sp, fontWeight = FontWeight.Bold)
            Text(
                text = formatMoney(state.currency, state.total),
                fontSize = 32.sp,
                fontWeight = FontWeight.Black,
                color = CdsTeal,
            )
        }
    }
}

@Composable
private fun TotalRow(label: String, value: String, muted: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            fontSize = 16.sp,
            color = if (muted) Color.Gray else Color.Unspecified,
        )
        Text(
            text = value,
            fontSize = 16.sp,
            color = if (muted) Color.Gray else Color.Unspecified,
        )
    }
}

@Composable
private fun ThankYouPanel(
    state: CustomerDisplayState,
    branding: CustomerDisplayBranding,
    labels: CdsLabels,
    merchantName: String,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF1F5F9))
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text(text = labels.thankYou, fontSize = 32.sp, fontWeight = FontWeight.Bold)
        Text(
            text = merchantName,
            fontSize = 18.sp,
            color = Color.Gray,
            modifier = Modifier.padding(top = 8.dp),
        )
        if (state.total > 0.001) {
            Text(
                text = formatMoney(state.currency, state.total),
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = CdsTeal,
                modifier = Modifier.padding(top = 24.dp),
            )
        }
    }
}

private data class CdsLabels(
    val yourOrder: String,
    val paymentTitle: String,
    val subtotal: String,
    val tax: String,
    val total: String,
    val discount: String,
    val thankYou: String,
)

private fun cdsLabels(locale: String): CdsLabels = when (locale) {
    "fr" -> CdsLabels(
        yourOrder = "Votre commande",
        paymentTitle = "Paiement",
        subtotal = "Sous-total",
        tax = "TVA",
        total = "Total",
        discount = "Remise",
        thankYou = "Merci",
    )
    "de" -> CdsLabels(
        yourOrder = "Ihre Bestellung",
        paymentTitle = "Zahlung",
        subtotal = "Zwischensumme",
        tax = "MwSt.",
        total = "Total",
        discount = "Rabatt",
        thankYou = "Danke",
    )
    else -> CdsLabels(
        yourOrder = "Your order",
        paymentTitle = "Payment",
        subtotal = "Subtotal",
        tax = "Tax",
        total = "Total",
        discount = "Discount",
        thankYou = "Thank you",
    )
}

private fun formatMoney(currency: String, amount: Double): String =
    formatMoneyAmount(amount, if (currency.isBlank()) "CHF" else currency)

private fun formatQty(qty: Double): String =
    if (qty == qty.toLong().toDouble()) qty.toLong().toString() else String.format("%.2f", qty)
