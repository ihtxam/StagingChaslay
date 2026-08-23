package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
    val isTerminalState = phase == TerminalPaymentPhase.CANCELLED || phase == TerminalPaymentPhase.FAILED

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
                .fillMaxWidth(0.94f)
                .widthIn(min = 360.dp)
                .border(1.dp, Color(0xFFE5E7EB), RoundedCornerShape(20.dp)),
            shape = RoundedCornerShape(20.dp),
            color = Color.White
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 36.dp, vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                val iconBackground = when (phase) {
                    TerminalPaymentPhase.PROCESSING -> Color(0xFFCCFBF1)
                    TerminalPaymentPhase.CANCELLED -> Color(0xFFFEF3C7)
                    TerminalPaymentPhase.FAILED -> Color(0xFFFEE2E2)
                }
                val iconTint = when (phase) {
                    TerminalPaymentPhase.PROCESSING -> Color(0xFF0F766E)
                    TerminalPaymentPhase.CANCELLED -> Color(0xFFB45309)
                    TerminalPaymentPhase.FAILED -> Color(0xFFB91C1C)
                }

                Box(
                    modifier = Modifier
                        .size(96.dp)
                        .background(iconBackground, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    when (phase) {
                        TerminalPaymentPhase.PROCESSING -> {
                            CircularProgressIndicator(
                                modifier = Modifier.size(48.dp),
                                color = iconTint,
                                strokeWidth = 4.dp
                            )
                        }
                        TerminalPaymentPhase.CANCELLED -> {
                            Icon(
                                Icons.Default.Cancel,
                                contentDescription = null,
                                tint = iconTint,
                                modifier = Modifier.size(48.dp)
                            )
                        }
                        TerminalPaymentPhase.FAILED -> {
                            Icon(
                                Icons.Default.ErrorOutline,
                                contentDescription = null,
                                tint = iconTint,
                                modifier = Modifier.size(48.dp)
                            )
                        }
                    }
                }

                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    lineHeight = 30.sp,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF111827)
                )
                Text(
                    text = amountLabel,
                    fontWeight = FontWeight.Bold,
                    fontSize = 34.sp,
                    lineHeight = 40.sp,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF111827)
                )
                Text(
                    text = message?.takeIf { it.isNotBlank() } ?: defaultMessage,
                    fontSize = 16.sp,
                    lineHeight = 24.sp,
                    color = Color(0xFF6B7280),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    if (phase == TerminalPaymentPhase.PROCESSING) {
                        OutlinedButton(
                            onClick = onCancel,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.cancel),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                    if (isTerminalState) {
                        OutlinedButton(
                            onClick = onRetry,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text(
                                text = stringResource(R.string.terminal_pay_retry),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Button(
                            onClick = onClose,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(56.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = VectronColors.CashGreen)
                        ) {
                            Text(
                                text = stringResource(R.string.confirm),
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
