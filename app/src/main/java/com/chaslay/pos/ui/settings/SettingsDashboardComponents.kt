package com.chaslay.pos.ui.settings
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.chaslay.pos.R
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Icon

@Composable
internal fun SettingsPageHeader(title: String, subtitle: String? = null) {
    val ui = posUiColors()
    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)) {
        Text(
            title,
            color = ui.textPrimary,
            fontSize = 22.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        subtitle?.let {
            Text(
                it,
                color = ui.textSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
internal fun SettingsReadOnlyRow(label: String, value: String) {
    val ui = posUiColors()
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            label,
            color = ui.textSecondary,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            value,
            color = ui.textPrimary,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(top = 2.dp),
        )
    }
}

@Composable
internal fun SettingsSectionCard(
    title: String,
    icon: ImageVector? = null,
    subtitle: String? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val ui = posUiColors()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(PosShapes.Large)
            .background(ui.surface)
            .border(1.dp, ui.border, PosShapes.Large)
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = PosColors.Primary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
            }
            Text(
                title,
                color = ui.textPrimary,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold,
            )
        }
        subtitle?.let {
            Text(
                it,
                color = ui.textSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(Modifier.size(12.dp))
        content()
    }
}

@Composable
internal fun SettingsShellHeader(
    onCancel: () -> Unit,
    onSave: () -> Unit,
) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            stringResource(R.string.nav_settings),
            color = ui.textPrimary,
            fontSize = 20.sp,
            fontWeight = FontWeight.ExtraBold,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onCancel, shape = PosShapes.Large) {
                Text(stringResource(R.string.cancel), fontSize = 13.sp)
            }
            Button(
                onClick = onSave,
                shape = PosShapes.Large,
                colors = ButtonDefaults.buttonColors(containerColor = PosColors.Primary),
            ) {
                Text(stringResource(R.string.save), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
internal fun SettingsSaveTopBar(onSave: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Button(
            onClick = onSave,
            shape = PosShapes.Large,
            colors = ButtonDefaults.buttonColors(containerColor = PosColors.Primary),
        ) {
            Text(stringResource(R.string.save), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
internal fun SettingsSwitchRow(
    title: String,
    subtitle: String? = null,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(
                title,
                color = if (enabled) ui.textPrimary else ui.textMuted,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            subtitle?.let {
                Text(
                    it,
                    color = ui.textSecondary,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        com.chaslay.pos.ui.theme.PosSwitch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            showStateLabel = true,
        )
    }
}

@Composable
internal fun SettingsSegmentedTwoChoice(
    optionA: String,
    optionB: String,
    selectedA: Boolean,
    onSelectA: () -> Unit,
    onSelectB: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(PosShapes.Large)
            .background(ui.surfaceMuted)
            .border(1.dp, ui.border, PosShapes.Large)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        listOf(
            optionA to onSelectA,
            optionB to onSelectB,
        ).forEachIndexed { index, (label, action) ->
            val selected = if (index == 0) selectedA else !selectedA
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(PosShapes.Medium)
                    .background(if (selected) PosColors.Primary else ui.surface)
                    .clickable(onClick = action)
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (selected) PosColors.TextOnPrimary else ui.textPrimary,
                    fontSize = 13.sp,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun SettingsPrinterRow(
    name: String,
    connectionLine: String,
    statusLabel: String,
    statusColor: androidx.compose.ui.graphics.Color,
    assignmentLabels: List<String>,
    isPrimary: Boolean,
    testEnabled: Boolean,
    onTest: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    val scheme = MaterialTheme.colorScheme
    var menuOpen by remember { mutableStateOf(false) }
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(PosShapes.ExtraLarge)
            .background(ui.surface)
            .border(1.dp, if (isPrimary) ui.primaryBorder else ui.border, PosShapes.ExtraLarge)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(PosShapes.Medium)
                    .background(ui.primarySubtle),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Outlined.Print, contentDescription = null, tint = PosColors.Primary, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.size(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(RoundedCornerShape(50))
                            .background(statusColor)
                    )
                    Text(statusLabel, color = statusColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Text(name, color = ui.textPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                Text(connectionLine, color = ui.textSecondary, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Button(
                    onClick = onTest,
                    enabled = testEnabled,
                    shape = PosShapes.Medium,
                    colors = ButtonDefaults.buttonColors(containerColor = PosColors.Primary),
                ) {
                    Text(stringResource(R.string.test_print), fontSize = 12.sp)
                }
                OutlinedButton(onClick = onEdit, shape = PosShapes.Medium) {
                    Text(stringResource(R.string.edit), fontSize = 12.sp, color = ui.textPrimary)
                }
                Box {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = null, tint = ui.textSecondary)
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.delete), color = PosColors.Danger) },
                            onClick = {
                                menuOpen = false
                                onDelete()
                            }
                        )
                    }
                }
            }
        }
        if (assignmentLabels.isNotEmpty()) {
            Spacer(Modifier.size(10.dp))
            Text(
                stringResource(R.string.printer_prints_for),
                color = ui.textSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.size(6.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                assignmentLabels.forEach { label ->
                    Text(
                        label,
                        modifier = Modifier
                            .clip(PosShapes.Pill)
                            .background(ui.primarySubtle)
                            .border(1.dp, ui.primaryBorder, PosShapes.Pill)
                            .padding(horizontal = 10.dp, vertical = 4.dp),
                        color = scheme.onPrimaryContainer,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
    }
}
