package com.chaslay.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R
import com.chaslay.pos.data.remote.dto.GiftCardMembershipPlanDto
import com.chaslay.pos.domain.model.LoyaltyMath
import com.chaslay.pos.ui.components.RfidScanField

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MembershipSellDialog(
    plans: List<GiftCardMembershipPlanDto>,
    busy: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSubmit: (planId: String, name: String, email: String?, phone: String?, cardNumber: String) -> Unit
) {
    val activePlans = remember(plans) { plans.filter { it.active } }
    var planId by remember(activePlans) { mutableStateOf(activePlans.firstOrNull()?.id.orEmpty()) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var cardNumber by remember { mutableStateOf("") }
    var planExpanded by remember { mutableStateOf(false) }

    val selected = activePlans.find { it.id == planId } ?: activePlans.firstOrNull()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.membership_sell_title)) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                if (activePlans.isEmpty()) {
                    Text(
                        stringResource(R.string.membership_sell_no_plans),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                } else {
                    Text(
                        stringResource(R.string.membership_plan),
                        style = MaterialTheme.typography.labelMedium
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    ExposedDropdownMenuBox(
                        expanded = planExpanded,
                        onExpandedChange = { planExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = selected?.let { planLabel(it) }.orEmpty(),
                            onValueChange = {},
                            readOnly = true,
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth(),
                            trailingIcon = {
                                ExposedDropdownMenuDefaults.TrailingIcon(expanded = planExpanded)
                            }
                        )
                        DropdownMenu(
                            expanded = planExpanded,
                            onDismissRequest = { planExpanded = false }
                        ) {
                            activePlans.forEach { plan ->
                                DropdownMenuItem(
                                    text = { Text(planLabel(plan)) },
                                    onClick = {
                                        planId = plan.id
                                        planExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(stringResource(R.string.name)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text(stringResource(R.string.email)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text(stringResource(R.string.phone)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    stringResource(R.string.membership_scan_card),
                    style = MaterialTheme.typography.labelMedium
                )
                Spacer(modifier = Modifier.height(4.dp))
                RfidScanField(
                    value = cardNumber,
                    onValueChange = { cardNumber = it },
                    onScanComplete = { scanned ->
                        cardNumber = LoyaltyMath.normalizeRfidUid(scanned)
                    },
                    autoFocus = false
                )
                if (selected?.type == "stamp_card") {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        stringResource(R.string.membership_stamp_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
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
                error?.takeIf { it.isNotBlank() }?.let { message ->
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        message,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSubmit(
                        planId,
                        name.trim(),
                        email.trim().takeIf { it.isNotBlank() },
                        phone.trim().takeIf { it.isNotBlank() },
                        cardNumber
                    )
                },
                enabled = !busy && activePlans.isNotEmpty()
            ) {
                Text(
                    if (busy) {
                        stringResource(R.string.membership_sell_saving)
                    } else {
                        stringResource(R.string.membership_register_card)
                    }
                )
            }
        },
        dismissButton = {
            OutlinedButton(onClick = onDismiss, enabled = !busy) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun planLabel(plan: GiftCardMembershipPlanDto): String {
    val base = plan.label
    return when (plan.type) {
        "discount" -> plan.discountPercent?.let { pct ->
            "$base (${pct.toInt()}% ${stringResource(R.string.membership_off)})"
        } ?: base
        "stamp_card" -> plan.stampsRequired?.let { stamps ->
            "$base ($stamps ${stringResource(R.string.membership_stamps)})"
        } ?: base
        else -> base
    }
}
