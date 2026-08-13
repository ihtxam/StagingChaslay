package com.chaslay.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.AttachedMembership
import com.chaslay.pos.ui.components.RfidScanField
import java.util.Locale

@Composable
fun MembershipDialog(
    attached: AttachedMembership?,
    busy: Boolean,
    lookupError: String?,
    currencySymbol: String,
    onDismiss: () -> Unit,
    onLookup: (String) -> Unit,
    onClear: () -> Unit,
    showGiftCardActions: Boolean = false,
    onSellGiftCard: () -> Unit = {},
    onReloadGiftCard: () -> Unit = {}
) {
    var code by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.membership_gift_cards)) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    stringResource(R.string.membership_scan_hint),
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(12.dp))
                RfidScanField(
                    value = code,
                    onValueChange = { code = it },
                    onScanComplete = { scanned ->
                        code = scanned
                        onLookup(scanned)
                    },
                    autoFocus = true
                )
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
                attached?.let { member ->
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        member.customerName ?: member.cardNumber,
                        fontWeight = FontWeight.SemiBold
                    )
                    if (member.membershipEnabled) {
                        Text(stringResource(R.string.membership_points_balance, member.pointsBalance))
                    }
                    if (member.giftBalance > 0.0) {
                        Text(
                            stringResource(
                                R.string.membership_gift_balance,
                                currencySymbol,
                                String.format(Locale.getDefault(), "%.2f", member.giftBalance)
                            )
                        )
                    }
                    Text(
                        stringResource(R.string.membership_card_number, member.cardNumber),
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                if (showGiftCardActions) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = onSellGiftCard,
                            enabled = !busy,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(stringResource(R.string.gift_card_sell))
                        }
                        OutlinedButton(
                            onClick = onReloadGiftCard,
                            enabled = !busy,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(stringResource(R.string.gift_card_reload))
                        }
                    }
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (attached != null) {
                    OutlinedButton(onClick = onClear, enabled = !busy) {
                        Text(stringResource(R.string.membership_detach))
                    }
                }
                Button(
                    onClick = { onLookup(code) },
                    enabled = !busy && code.trim().isNotEmpty()
                ) {
                    Text(stringResource(R.string.membership_lookup))
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
