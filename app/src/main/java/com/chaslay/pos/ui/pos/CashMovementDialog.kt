package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.chaslay.pos.R

enum class CashMovementTab { IN, OUT }

@Composable
fun CashMovementDialog(
    busy: Boolean,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onConfirm: (type: CashMovementTab, amount: Double, reason: String) -> Unit
) {
    var tab by remember { mutableStateOf(CashMovementTab.IN) }
    var amountText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(12.dp), color = Color(0xFF2A2A2A)) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    stringResource(R.string.cash_movement_title),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                TabRow(
                    selectedTabIndex = if (tab == CashMovementTab.IN) 0 else 1,
                    containerColor = Color(0xFF1E1E1E),
                    contentColor = Color.White
                ) {
                    Tab(
                        selected = tab == CashMovementTab.IN,
                        onClick = { tab = CashMovementTab.IN },
                        text = { Text(stringResource(R.string.cash_in)) }
                    )
                    Tab(
                        selected = tab == CashMovementTab.OUT,
                        onClick = { tab = CashMovementTab.OUT },
                        text = { Text(stringResource(R.string.cash_out)) }
                    )
                }
                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it.filter { ch -> ch.isDigit() || ch == '.' } },
                    label = { Text(stringResource(R.string.cash_amount)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text(stringResource(R.string.cash_reason)) },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
                errorMessage?.let {
                    Text(it, color = Color(0xFFE57373), fontSize = 12.sp)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.discard))
                    }
                    Button(
                        onClick = {
                            val amount = amountText.toDoubleOrNull() ?: 0.0
                            onConfirm(tab, amount, reason.trim())
                        },
                        enabled = !busy && (amountText.toDoubleOrNull() ?: 0.0) > 0,
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B))
                    ) {
                        Text(stringResource(R.string.confirm))
                    }
                }
            }
        }
    }
}
