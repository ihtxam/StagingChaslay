package com.chaslay.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R
import com.chaslay.pos.data.remote.dto.GiftCardDto
import com.chaslay.pos.data.remote.dto.GiftCardSettingsDto
import com.chaslay.pos.domain.model.GiftCardOp
import com.chaslay.pos.ui.components.RfidScanField
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GiftCardOpsDialog(
    mode: GiftCardOp,
    settings: GiftCardSettingsDto?,
    currencySymbol: String,
    busy: Boolean,
    lookupError: String?,
    lookedUpCard: GiftCardDto?,
    onDismiss: () -> Unit,
    onLookup: (String) -> Unit,
    onAddToCart: (
        amount: Double,
        cardNumber: String,
        cardId: String?,
        holderName: String?,
        mediaType: String,
        ecardEmail: String?,
        deliveryMethod: String?
    ) -> Unit
) {
    var code by remember { mutableStateOf("") }
    var holderName by remember { mutableStateOf("") }
    var ecardEmail by remember { mutableStateOf("") }
    var sellMedia by remember { mutableStateOf<String?>(null) }
    var deliveryMethod by remember { mutableStateOf("print") }
    var selectedAmount by remember(lookedUpCard?.id) { mutableStateOf<Double?>(null) }
    var showCustomKeypad by remember { mutableStateOf(false) }

    val title = when (mode) {
        GiftCardOp.SELL -> stringResource(R.string.gift_card_sell)
        GiftCardOp.RELOAD -> stringResource(R.string.gift_card_reload)
    }
    val presets = settings?.presetDenominations.orEmpty()
    val minAmount = settings?.minAmount ?: 5.0
    val maxAmount = settings?.maxAmount ?: 500.0
    val customEnabled = settings?.customAmountEnabled != false
    val resolvedAmount = selectedAmount
    val isEcardSell = mode == GiftCardOp.SELL && sellMedia == "e_card"
    val mediaResolved = if (mode == GiftCardOp.SELL) sellMedia else "physical"

    if (showCustomKeypad) {
        PriceKeypadDialog(
            title = stringResource(R.string.gift_card_amount),
            subtitle = stringResource(R.string.gift_card_enter_amount, minAmount, maxAmount),
            currencySymbol = currencySymbol,
            initialValue = resolvedAmount?.let { String.format(Locale.US, "%.2f", it) }.orEmpty(),
            confirmLabel = stringResource(R.string.confirm),
            onConfirm = { amount ->
                if (amount in minAmount..maxAmount) {
                    selectedAmount = amount
                    showCustomKeypad = false
                }
            },
            onDismiss = { showCustomKeypad = false }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                if (mode == GiftCardOp.SELL && sellMedia == null) {
                    Text(
                        stringResource(R.string.gift_card_sell_choose_media),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = false,
                            onClick = { sellMedia = "physical" },
                            label = { Text(stringResource(R.string.gift_card_physical)) }
                        )
                        FilterChip(
                            selected = false,
                            onClick = { sellMedia = "e_card" },
                            label = { Text(stringResource(R.string.gift_card_ecard)) }
                        )
                    }
                } else {
                    Text(
                        when {
                            isEcardSell -> stringResource(R.string.gift_card_ecard_sell_hint)
                            mode == GiftCardOp.SELL -> stringResource(R.string.gift_card_sell_hint)
                            else -> stringResource(R.string.gift_card_reload_hint)
                        },
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    if (isEcardSell) {
                        Text(
                            stringResource(R.string.gift_card_ecard_delivery),
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf(
                                "print" to R.string.gift_card_ecard_delivery_print,
                                "email" to R.string.gift_card_ecard_delivery_email,
                                "both" to R.string.gift_card_ecard_delivery_both
                            ).forEach { (key, labelRes) ->
                                FilterChip(
                                    selected = deliveryMethod == key,
                                    onClick = { deliveryMethod = key },
                                    label = { Text(stringResource(labelRes)) }
                                )
                            }
                        }
                        if (deliveryMethod == "email" || deliveryMethod == "both") {
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedTextField(
                                value = ecardEmail,
                                onValueChange = { ecardEmail = it },
                                label = { Text(stringResource(R.string.gift_card_ecard_recipient_email)) },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    } else {
                        RfidScanField(
                            value = code,
                            onValueChange = { code = it },
                            onScanComplete = { scanned ->
                                code = scanned
                                if (mode == GiftCardOp.RELOAD) onLookup(scanned)
                            },
                            autoFocus = true
                        )
                        if (mode == GiftCardOp.RELOAD) {
                            Spacer(modifier = Modifier.height(8.dp))
                            OutlinedButton(
                                onClick = { onLookup(code) },
                                enabled = !busy && code.trim().isNotEmpty(),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(stringResource(R.string.membership_lookup))
                            }
                        }
                    }

                    if (mode == GiftCardOp.SELL && !isEcardSell) {
                        Spacer(modifier = Modifier.height(8.dp))
                        OutlinedTextField(
                            value = holderName,
                            onValueChange = { holderName = it },
                            label = { Text(stringResource(R.string.gift_card_holder_optional)) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (busy) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                    lookupError?.takeIf { it.isNotBlank() }?.let { error ->
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                    }
                    lookedUpCard?.let { card ->
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            card.displayName ?: card.cardNumber.orEmpty(),
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            stringResource(
                                R.string.membership_gift_balance,
                                currencySymbol,
                                String.format(Locale.getDefault(), "%.2f", card.balanceAmount)
                            ),
                            style = MaterialTheme.typography.bodySmall
                        )
                    }

                    if (presets.isNotEmpty() || customEnabled) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            stringResource(R.string.gift_card_amount),
                            fontWeight = FontWeight.SemiBold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            presets.forEach { preset ->
                                FilterChip(
                                    selected = resolvedAmount == preset,
                                    onClick = { selectedAmount = preset },
                                    label = {
                                        Text(
                                            String.format(
                                                Locale.getDefault(),
                                                "%s %.0f",
                                                currencySymbol,
                                                preset
                                            )
                                        )
                                    }
                                )
                            }
                            if (customEnabled) {
                                FilterChip(
                                    selected = resolvedAmount != null && resolvedAmount !in presets,
                                    onClick = { showCustomKeypad = true },
                                    label = { Text(stringResource(R.string.gift_card_custom_amount)) }
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (mode != GiftCardOp.SELL || sellMedia != null) {
                Button(
                    onClick = {
                        val amount = resolvedAmount ?: return@Button
                        val email = ecardEmail.trim()
                        if (isEcardSell && (deliveryMethod == "email" || deliveryMethod == "both") && !email.contains("@")) {
                            return@Button
                        }
                        val cardNumber = lookedUpCard?.cardNumber?.takeIf { it.isNotBlank() }
                            ?: code.trim()
                        onAddToCart(
                            amount,
                            if (isEcardSell) "" else cardNumber,
                            lookedUpCard?.id,
                            holderName.trim().takeIf { it.isNotBlank() },
                            mediaResolved ?: "physical",
                            if (isEcardSell) email.takeIf { it.isNotBlank() } else null,
                            if (isEcardSell) deliveryMethod else null
                        )
                    },
                    enabled = !busy &&
                        resolvedAmount != null &&
                        when {
                            isEcardSell -> true
                            mode == GiftCardOp.SELL -> code.trim().isNotEmpty()
                            else -> lookedUpCard != null
                        }
                ) {
                    Text(stringResource(R.string.gift_card_add_to_cart))
                }
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss) {
                Text(stringResource(R.string.close))
            }
        }
    )
}
