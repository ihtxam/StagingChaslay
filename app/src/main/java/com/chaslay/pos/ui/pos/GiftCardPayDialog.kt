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
import androidx.compose.runtime.LaunchedEffect
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
import com.chaslay.pos.ui.components.RfidScanField
import java.util.Locale
import kotlin.math.min

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GiftCardPayDialog(
    amountDue: Double,
    currencySymbol: String,
    busy: Boolean,
    lookupError: String?,
    lookedUpCard: GiftCardDto?,
    onDismiss: () -> Unit,
    onLookup: (String, String) -> Unit,
    onConfirm: (amount: Double, card: GiftCardDto) -> Unit
) {
    var media by remember { mutableStateOf<String?>(null) }
    var code by remember { mutableStateOf("") }
    var amountText by remember(lookedUpCard?.id, amountDue) {
        val default = lookedUpCard?.balanceAmount?.let { balance ->
            min(balance, amountDue.coerceAtLeast(0.0))
        } ?: amountDue.coerceAtLeast(0.0)
        mutableStateOf(
            if (default > 0.001) String.format(Locale.US, "%.2f", default) else ""
        )
    }

    LaunchedEffect(lookedUpCard?.id, amountDue) {
        lookedUpCard?.let { card ->
            val apply = min(card.balanceAmount, amountDue.coerceAtLeast(0.0))
            if (apply > 0.001) {
                amountText = String.format(Locale.US, "%.2f", apply)
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.gift_card_pay)) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                if (media == null) {
                    Text(
                        stringResource(R.string.gift_card_choose_media),
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = false,
                            onClick = { media = "physical" },
                            label = { Text(stringResource(R.string.gift_card_physical)) }
                        )
                        FilterChip(
                            selected = false,
                            onClick = { media = "e_card" },
                            label = { Text(stringResource(R.string.gift_card_ecard)) }
                        )
                    }
                } else {
                    RfidScanField(
                        value = code,
                        onValueChange = { code = it },
                        onScanComplete = { scanned ->
                            code = scanned
                            onLookup(scanned, media ?: "physical")
                        },
                        autoFocus = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { onLookup(code, media ?: "physical") },
                        enabled = !busy && code.trim().isNotEmpty(),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(stringResource(R.string.membership_lookup))
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
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedTextField(
                            value = amountText,
                            onValueChange = { amountText = it },
                            label = { Text(stringResource(R.string.gift_card_pay_amount)) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (amountDue > card.balanceAmount + 0.001) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                stringResource(
                                    R.string.checkout_gift_card_remainder,
                                    String.format(Locale.getDefault(), "%s %.2f", currencySymbol, amountDue - card.balanceAmount)
                                ),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.tertiary
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (media != null) {
                Button(
                    onClick = {
                        val card = lookedUpCard ?: return@Button
                        val amount = amountText.toDoubleOrNull() ?: return@Button
                        if (amount > 0.001) onConfirm(amount, card)
                    },
                    enabled = !busy && lookedUpCard != null && (amountText.toDoubleOrNull() ?: 0.0) > 0.001
                ) {
                    Text(stringResource(R.string.gift_card_apply_payment))
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
