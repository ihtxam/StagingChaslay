package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.VectronColors

enum class TerminalPaymentPhase {
    PROCESSING,
    CANCELLED,
    FAILED
}

@Composable
fun TerminalPaymentDialog(
    phase: TerminalPaymentPhase,
    amountLabel: String,
    message: String?,
    onCancel: () -> Unit,
    onRetry: () -> Unit,
    onClose: () -> Unit
) {
    val title = when (phase) {
        TerminalPaymentPhase.PROCESSING -> stringResource(R.string.terminal_pay_processing)
        TerminalPaymentPhase.CANCELLED -> stringResource(R.string.terminal_pay_cancelled)
        TerminalPaymentPhase.FAILED -> stringResource(R.string.terminal_pay_failed)
    }
    val defaultMessage = when (phase) {
        TerminalPaymentPhase.PROCESSING -> stringResource(R.string.terminal_pay_sent)
        TerminalPaymentPhase.CANCELLED -> stringResource(R.string.terminal_pay_cancelled_msg)
        TerminalPaymentPhase.FAILED -> stringResource(R.string.terminal_pay_failed_msg)
    }

    Dialog(
        onDismissRequest = {
            if (phase != TerminalPaymentPhase.PROCESSING) onClose()
        },
        properties = DialogProperties(
            dismissOnBackPress = phase != TerminalPaymentPhase.PROCESSING,
            dismissOnClickOutside = phase != TerminalPaymentPhase.PROCESSING
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.88f)
                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(16.dp)),
            shape = RoundedCornerShape(16.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .background(
                            if (phase == TerminalPaymentPhase.PROCESSING) Color(0xFFCCFBF1) else Color(0xFFF5F5F4),
                            CircleShape
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    if (phase == TerminalPaymentPhase.PROCESSING) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(32.dp),
                            color = Color(0xFF0F766E),
                            strokeWidth = 3.dp
                        )
                    } else {
                        Icon(
                            Icons.Default.CreditCard,
                            contentDescription = null,
                            tint = Color(0xFF57534E),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                Text(text = title, fontWeight = FontWeight.Bold, fontSize = 18.sp, textAlign = TextAlign.Center)
                Text(
                    text = amountLabel,
                    fontWeight = FontWeight.Bold,
                    fontSize = 26.sp,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = message?.takeIf { it.isNotBlank() } ?: defaultMessage,
                    fontSize = 14.sp,
                    color = Color(0xFF6B7280),
                    textAlign = TextAlign.Center
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (phase == TerminalPaymentPhase.PROCESSING) {
                        OutlinedButton(
                            onClick = onCancel,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(stringResource(R.string.cancel))
                        }
                    }
                    if (phase == TerminalPaymentPhase.CANCELLED || phase == TerminalPaymentPhase.FAILED) {
                        Button(
                            onClick = onRetry,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                        ) {
                            Text(stringResource(R.string.terminal_pay_retry))
                        }
                        TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
                            Text(stringResource(R.string.close))
                        }
                    }
                }
            }
        }
    }
}
