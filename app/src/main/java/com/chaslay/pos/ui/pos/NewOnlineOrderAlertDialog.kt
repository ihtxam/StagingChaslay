package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FulfillmentType
import com.chaslay.pos.sync.ImportedOnlineOrderAlert
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun NewOnlineOrderAlertDialog(
    alert: ImportedOnlineOrderAlert,
    queueCount: Int,
    currencySymbol: String,
    onOpen: () -> Unit,
    onOk: () -> Unit
) {
    Dialog(
        onDismissRequest = { /* blocking — must use Open or OK */ },
        properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false)
    ) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            tonalElevation = 8.dp,
            shadowElevation = 12.dp
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Surface(
                        modifier = Modifier.size(48.dp),
                        shape = CircleShape,
                        color = Color(0xFFEDE9FE)
                    ) {
                        Icon(
                            Icons.Default.Notifications,
                            contentDescription = null,
                            tint = Color(0xFF6D28D9),
                            modifier = Modifier
                                .padding(12.dp)
                                .fillMaxWidth()
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            stringResource(R.string.new_online_order_alert_title),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        if (queueCount > 1) {
                            Text(
                                stringResource(R.string.new_online_order_alert_queue, queueCount),
                                color = Color(0xFF6D28D9),
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp)
                        .background(Color(0xFFF5F3FF), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.Top
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "#${alert.orderNumber}",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Text(
                                "${fulfillmentLabel(alert.fulfillmentType)} · $currencySymbol ${"%.2f".format(Locale.US, alert.total)}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            val customerLine = listOfNotNull(
                                alert.customerName?.takeIf { it.isNotBlank() },
                                alert.customerPhone?.takeIf { it.isNotBlank() }
                            ).joinToString(" · ")
                            if (customerLine.isNotBlank()) {
                                Text(customerLine, style = MaterialTheme.typography.bodySmall)
                            }
                            Text(
                                alert.pickupTimeMs?.let {
                                    SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(Date(it))
                                } ?: stringResource(R.string.new_online_order_asap),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Icon(
                            Icons.Default.ShoppingBag,
                            contentDescription = null,
                            tint = Color(0xFF6D28D9)
                        )
                    }
                    alert.itemPreview.take(4).forEach { line ->
                        Text(
                            "${line.quantity}× ${line.productName}",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                    val extra = alert.itemCount - alert.itemPreview.size
                    if (extra > 0) {
                        Text(
                            stringResource(R.string.new_online_order_alert_more_items, extra),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                Text(
                    stringResource(R.string.new_online_order_alert_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp)
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(onClick = onOk, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.new_online_order_alert_ok))
                    }
                    Button(onClick = onOpen, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.new_online_order_alert_open))
                    }
                }
            }
        }
    }
}

@Composable
private fun fulfillmentLabel(type: FulfillmentType): String = when (type) {
    FulfillmentType.DELIVERY -> stringResource(R.string.delivery)
    FulfillmentType.DINE_IN -> stringResource(R.string.dine_in)
    FulfillmentType.PICKUP -> stringResource(R.string.pickup)
    FulfillmentType.WALK_IN -> stringResource(R.string.pickup)
}
