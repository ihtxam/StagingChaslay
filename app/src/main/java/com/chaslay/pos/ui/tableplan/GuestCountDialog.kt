package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material.icons.outlined.TableRestaurant
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.posUiColors

@Composable
fun GuestCountDialog(
    tableName: String,
    seatCapacity: Int,
    initialCount: Int,
    useModernVisuals: Boolean = false,
    onConfirm: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    if (useModernVisuals) {
        ModernGuestCountDialog(
            tableName = tableName,
            seatCapacity = seatCapacity,
            initialCount = initialCount,
            onConfirm = onConfirm,
            onDismiss = onDismiss,
        )
    } else {
        ClassicGuestCountDialog(
            tableName = tableName,
            seatCapacity = seatCapacity,
            initialCount = initialCount,
            onConfirm = onConfirm,
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun ClassicGuestCountDialog(
    tableName: String,
    seatCapacity: Int,
    initialCount: Int,
    onConfirm: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    var countText by remember(initialCount) { mutableStateOf(initialCount.toString()) }
    val presets = remember(seatCapacity) {
        (1..seatCapacity.coerceAtLeast(1)).toList()
    }
    val maxGuests = seatCapacity.coerceAtLeast(1)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.guest_count_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    stringResource(R.string.guest_count_body, tableName, seatCapacity),
                    fontWeight = FontWeight.Medium,
                )
                OutlinedTextField(
                    value = countText,
                    onValueChange = { countText = it.filter { ch -> ch.isDigit() }.take(2) },
                    label = { Text(stringResource(R.string.guest_count_label)) },
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    presets.take(8).forEach { n ->
                        FilterChip(
                            selected = countText == n.toString(),
                            onClick = { countText = n.toString() },
                            label = { Text(n.toString()) },
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val count = countText.toIntOrNull()?.coerceIn(1, maxGuests)
                        ?: initialCount.coerceIn(1, maxGuests)
                    onConfirm(count)
                },
            ) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        },
    )
}

@Composable
private fun ModernGuestCountDialog(
    tableName: String,
    seatCapacity: Int,
    initialCount: Int,
    onConfirm: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    val ui = posUiColors()
    val maxGuests = seatCapacity.coerceAtLeast(1)
    var count by remember(initialCount, maxGuests) {
        mutableIntStateOf(initialCount.coerceIn(1, maxGuests))
    }
    val quickPicks = remember(maxGuests) {
        (1..minOf(6, maxGuests)).toList()
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .widthIn(max = 440.dp),
            shape = PosShapes.Dialog,
            tonalElevation = 6.dp,
            color = ui.surface,
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(ui.primarySubtle),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Outlined.TableRestaurant,
                            contentDescription = null,
                            tint = PosColors.Primary,
                            modifier = Modifier.size(24.dp),
                        )
                    }
                    Text(
                        text = stringResource(R.string.guest_count_title),
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = ui.textPrimary,
                    )
                    IconButton(onClick = onDismiss) {
                        Icon(
                            Icons.Outlined.Close,
                            contentDescription = stringResource(R.string.cancel),
                            tint = ui.textSecondary,
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(PosShapes.Pill)
                        .background(ui.surfaceMuted)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Icon(
                        Icons.Outlined.TableRestaurant,
                        contentDescription = null,
                        tint = ui.textSecondary,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = stringResource(R.string.guest_count_body, tableName, seatCapacity),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = ui.textPrimary,
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.guest_count_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = ui.textSecondary,
                )

                Spacer(modifier = Modifier.height(16.dp))

                if (quickPicks.isNotEmpty()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        quickPicks.forEach { n ->
                            val selected = count == n
                            FilterChip(
                                selected = selected,
                                onClick = { count = n.coerceIn(1, maxGuests) },
                                label = {
                                    Text(
                                        n.toString(),
                                        modifier = Modifier.fillMaxWidth(),
                                        textAlign = TextAlign.Center,
                                    )
                                },
                                modifier = Modifier.weight(1f),
                                shape = PosShapes.Medium,
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = PosColors.Primary,
                                    selectedLabelColor = Color.White,
                                    containerColor = ui.surface,
                                    labelColor = ui.textPrimary,
                                ),
                                border = FilterChipDefaults.filterChipBorder(
                                    enabled = true,
                                    selected = selected,
                                    borderColor = ui.border,
                                    selectedBorderColor = PosColors.Primary,
                                ),
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                Text(
                    text = stringResource(R.string.guest_count_label),
                    style = MaterialTheme.typography.labelLarge,
                    color = ui.textSecondary,
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    GuestCountStepperButton(
                        icon = Icons.Outlined.Remove,
                        onClick = { count = (count - 1).coerceAtLeast(1) },
                        enabled = count > 1,
                    )
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 52.dp)
                            .clip(PosShapes.Medium)
                            .border(1.dp, ui.border, PosShapes.Medium)
                            .background(ui.surfaceSubtle),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = count.toString(),
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            color = ui.textPrimary,
                            textAlign = TextAlign.Center,
                        )
                    }
                    GuestCountStepperButton(
                        icon = Icons.Outlined.Add,
                        onClick = { count = (count + 1).coerceAtMost(maxGuests) },
                        enabled = count < maxGuests,
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.guest_count_capacity_footer, maxGuests),
                    style = MaterialTheme.typography.bodySmall,
                    color = ui.textMuted,
                )

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End),
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp),
                        shape = PosShapes.Medium,
                    ) {
                        Text(stringResource(R.string.cancel), fontWeight = FontWeight.SemiBold)
                    }
                    Button(
                        onClick = { onConfirm(count) },
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = 48.dp),
                        shape = PosShapes.Medium,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PosColors.Primary,
                            contentColor = PosColors.TextOnPrimary,
                        ),
                    ) {
                        Text(stringResource(R.string.confirm), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun GuestCountStepperButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit,
    enabled: Boolean,
) {
    val ui = posUiColors()
    Box(
        modifier = Modifier
            .size(52.dp)
            .clip(PosShapes.Medium)
            .border(1.dp, ui.border, PosShapes.Medium)
            .background(if (enabled) ui.surfaceSubtle else ui.surfaceMuted)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (enabled) ui.textPrimary else ui.textMuted,
        )
    }
}
