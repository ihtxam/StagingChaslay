package com.chaslay.pos.ui.pos

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.data.remote.dto.GiftCardMembershipPlanDto
import com.chaslay.pos.domain.model.LoyaltyMath
import com.chaslay.pos.ui.components.RfidScanField
import java.util.Locale

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

    val selected = activePlans.find { it.id == planId } ?: activePlans.firstOrNull()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .imePadding(),
            shape = MaterialTheme.shapes.large,
            tonalElevation = 6.dp
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    stringResource(R.string.membership_sell_title),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(12.dp))
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .heightIn(max = 520.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    if (activePlans.isEmpty()) {
                        Text(
                            stringResource(R.string.membership_sell_no_plans),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Column(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    stringResource(R.string.membership_plan),
                                    style = MaterialTheme.typography.labelLarge
                                )
                                activePlans.forEach { plan ->
                                    val isSelected = plan.id == selected?.id
                                    Card(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable(enabled = !busy) { planId = plan.id },
                                        colors = CardDefaults.cardColors(
                                            containerColor = if (isSelected) {
                                                MaterialTheme.colorScheme.primaryContainer
                                            } else {
                                                MaterialTheme.colorScheme.surface
                                            }
                                        ),
                                        border = BorderStroke(
                                            width = 1.dp,
                                            color = if (isSelected) {
                                                MaterialTheme.colorScheme.primary
                                            } else {
                                                MaterialTheme.colorScheme.outlineVariant
                                            }
                                        )
                                    ) {
                                        Column(modifier = Modifier.padding(12.dp)) {
                                            Text(
                                                plan.label,
                                                style = MaterialTheme.typography.titleSmall,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                            val subtitle = planSubtitle(plan)
                                            if (subtitle.isNotBlank()) {
                                                Text(
                                                    subtitle,
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                                )
                                            }
                                            Text(
                                                planPriceLabel(plan),
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.padding(top = 4.dp)
                                            )
                                        }
                                    }
                                }
                            }
                            Column(
                                modifier = Modifier.weight(1.1f),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    stringResource(R.string.membership_customer_details),
                                    style = MaterialTheme.typography.labelLarge
                                )
                                OutlinedTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    label = { Text(stringResource(R.string.name)) },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    label = { Text(stringResource(R.string.email)) },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                OutlinedTextField(
                                    value = phone,
                                    onValueChange = { phone = it },
                                    label = { Text(stringResource(R.string.phone)) },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Text(
                                    stringResource(R.string.membership_scan_card),
                                    style = MaterialTheme.typography.labelMedium
                                )
                                RfidScanField(
                                    value = cardNumber,
                                    onValueChange = { cardNumber = it },
                                    onScanComplete = { scanned ->
                                        cardNumber = LoyaltyMath.normalizeRfidUid(scanned)
                                    },
                                    autoFocus = false
                                )
                                if (selected?.type == "stamp_card") {
                                    Text(
                                        stringResource(R.string.membership_stamp_hint),
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
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
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)
                ) {
                    OutlinedButton(onClick = onDismiss, enabled = !busy) {
                        Text(stringResource(R.string.cancel))
                    }
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
                }
            }
        }
    }
}

@Composable
private fun planSubtitle(plan: GiftCardMembershipPlanDto): String {
    return when (plan.type) {
        "discount" -> plan.discountPercent?.let { pct ->
            "${pct.toInt()}% ${stringResource(R.string.membership_off)}"
        } ?: ""
        "stamp_card" -> plan.stampsRequired?.let { stamps ->
            "$stamps ${stringResource(R.string.membership_stamps)}"
        } ?: ""
        else -> ""
    }
}

@Composable
private fun planPriceLabel(plan: GiftCardMembershipPlanDto): String {
    val price = plan.sellPrice ?: 0.0
    return if (price > 0.0) {
        "CHF ${String.format(Locale.US, "%.2f", price)}"
    } else {
        stringResource(R.string.membership_plan_free)
    }
}
