package com.chaslay.pos.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Save
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.posUiColors
import java.io.File

private const val RECEIPT_TEXT_MAX = 500
private val RECEIPT_TEMPLATE_OPTIONS = listOf("Default")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReceiptSettingsSection(
    state: SettingsUiState,
    viewModel: SettingsViewModel,
    modifier: Modifier = Modifier,
) {
    val ui = posUiColors()
    val configuration = LocalConfiguration.current
    val isWideLayout = configuration.screenWidthDp >= 720
    var templateExpanded by remember { mutableStateOf(false) }

    val receiptPreviewText = remember(
        state.receiptHeader,
        state.receiptFooter,
        state.receiptShowVatTable,
        state.receiptShowStaffLine,
        state.receiptShowQrCode,
        state.receiptDeliveryDirectionsQr,
        state.businessName,
        state.logoUri,
        state.vatNumber,
        state.address,
        state.phone,
        state.email,
        state.website,
        state.currencySymbol,
        state.vatIncludedInPrice,
    ) {
        runCatching { viewModel.previewReceiptText() }.getOrElse { "" }
    }
    val logoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent(),
    ) { uri -> uri?.let(viewModel::importLogo) }

    @Composable
    fun ReceiptFormColumn(modifier: Modifier = Modifier) {
        Column(
            modifier = modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            ReceiptLogoCard(
                logoPath = state.logoUri,
                onPickLogo = { logoPicker.launch("image/*") },
                onClearLogo = viewModel::clearLogo,
            )
            ReceiptTextFieldCard(
                label = stringResource(R.string.receipt_header),
                value = state.receiptHeader,
                onValueChange = viewModel::updateReceiptHeader,
                minLines = 4,
            )
            ReceiptTextFieldCard(
                label = stringResource(R.string.receipt_footer),
                value = state.receiptFooter,
                onValueChange = viewModel::updateReceiptFooter,
                minLines = 3,
            )
            if (state.posMode == PosMode.RESTAURANT) {
                ReceiptTextFieldCard(
                    label = stringResource(R.string.kitchen_header),
                    value = state.kitchenTicketHeader,
                    onValueChange = viewModel::updateKitchenHeader,
                    minLines = 2,
                )
                ReceiptTextFieldCard(
                    label = stringResource(R.string.kitchen_footer),
                    value = state.kitchenTicketFooter,
                    onValueChange = viewModel::updateKitchenFooter,
                    minLines = 2,
                )
            }
            SettingsSectionCard(title = stringResource(R.string.receipt_template)) {
                ExposedDropdownMenuBox(
                    expanded = templateExpanded,
                    onExpandedChange = { templateExpanded = it },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    OutlinedTextField(
                        value = state.receiptTemplateName.ifBlank { RECEIPT_TEMPLATE_OPTIONS.first() },
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.receipt_template)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = templateExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                    )
                    DropdownMenu(
                        expanded = templateExpanded,
                        onDismissRequest = { templateExpanded = false },
                    ) {
                        RECEIPT_TEMPLATE_OPTIONS.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(option) },
                                onClick = {
                                    viewModel.updateReceiptTemplateName(option)
                                    templateExpanded = false
                                },
                            )
                        }
                    }
                }
            }
            SettingsSectionCard(title = stringResource(R.string.receipt_display_options)) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    ReceiptCheckboxRow(
                        checked = state.receiptShowVatTable,
                        onCheckedChange = viewModel::updateReceiptShowVatTable,
                        label = stringResource(R.string.receipt_show_vat),
                    )
                    ReceiptCheckboxRow(
                        checked = state.receiptShowStaffLine,
                        onCheckedChange = viewModel::updateReceiptShowStaffLine,
                        label = stringResource(R.string.receipt_show_staff),
                    )
                    ReceiptCheckboxRow(
                        checked = state.receiptShowQrCode,
                        onCheckedChange = viewModel::updateReceiptShowQrCode,
                        label = stringResource(R.string.receipt_show_qr),
                    )
                    ReceiptCheckboxRow(
                        checked = state.receiptDeliveryDirectionsQr,
                        onCheckedChange = viewModel::updateReceiptDeliveryDirectionsQr,
                        label = stringResource(R.string.receipt_delivery_directions_qr),
                    )
                }
            }
            SettingsSectionCard(title = stringResource(R.string.receipt_options)) {
                ReceiptCheckboxRow(
                    checked = state.autoPrintReceipt,
                    onCheckedChange = viewModel::updateAutoPrintReceipt,
                    label = stringResource(R.string.auto_print_receipt),
                    hint = stringResource(R.string.auto_print_receipt_hint),
                )
                if (state.posMode == PosMode.RESTAURANT) {
                    ReceiptCheckboxRow(
                        checked = state.autoPrintKitchen,
                        onCheckedChange = viewModel::updateAutoPrintKitchen,
                        label = stringResource(R.string.auto_print_kitchen),
                        hint = stringResource(R.string.auto_print_kitchen_hint),
                    )
                }
                ReceiptCheckboxRow(
                    checked = state.adyenReceiptDigitalOnly,
                    onCheckedChange = viewModel::updateAdyenReceiptDigitalOnly,
                    label = "Adyen card receipt: digital only (QR)",
                )
            }
            if (state.posMode == PosMode.RESTAURANT) {
                SettingsSectionCard(title = stringResource(R.string.kitchen_text_size)) {
                    Text(
                        stringResource(R.string.kitchen_item_text_size),
                        style = MaterialTheme.typography.bodySmall,
                        color = ui.textSecondary,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(1 to R.string.kitchen_text_normal, 2 to R.string.kitchen_text_large, 3 to R.string.kitchen_text_extra)
                            .forEach { (scale, labelRes) ->
                                FilterChip(
                                    selected = state.kitchenItemTextScale == scale,
                                    onClick = { viewModel.updateKitchenItemTextScale(scale) },
                                    label = { Text(stringResource(labelRes)) },
                                )
                            }
                    }
                    Text(
                        stringResource(R.string.kitchen_header_text_size),
                        style = MaterialTheme.typography.bodySmall,
                        color = ui.textSecondary,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(1 to R.string.kitchen_text_normal, 2 to R.string.kitchen_text_large, 3 to R.string.kitchen_text_extra)
                            .forEach { (scale, labelRes) ->
                                FilterChip(
                                    selected = state.kitchenHeaderTextScale == scale,
                                    onClick = { viewModel.updateKitchenHeaderTextScale(scale) },
                                    label = { Text(stringResource(labelRes)) },
                                )
                            }
                    }
                }
            }
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.fillMaxWidth(if (isWideLayout) 0.68f else 1f)) {
                Text(
                    text = stringResource(R.string.receipt_design),
                    color = ui.textPrimary,
                    fontSize = MaterialTheme.typography.headlineSmall.fontSize,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = stringResource(R.string.receipt_logo_help),
                    color = ui.textSecondary,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (isWideLayout) {
                Button(
                    onClick = viewModel::saveSettings,
                    shape = PosShapes.Large,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PosColors.Primary,
                        contentColor = PosColors.TextOnPrimary,
                    ),
                ) {
                    Icon(Icons.Outlined.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text(
                        text = stringResource(R.string.save),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
        }

        if (!isWideLayout) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Button(
                    onClick = viewModel::saveSettings,
                    shape = PosShapes.Large,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PosColors.Primary,
                        contentColor = PosColors.TextOnPrimary,
                    ),
                ) {
                    Icon(Icons.Outlined.Save, contentDescription = null, modifier = Modifier.size(18.dp))
                    Text(
                        text = stringResource(R.string.save),
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
        }

        if (isWideLayout) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                ReceiptFormColumn(modifier = Modifier.fillMaxWidth(0.56f))
                ReceiptThermalPreview(
                    previewText = receiptPreviewText,
                    modifier = Modifier.fillMaxWidth(0.44f),
                )
            }
        } else {
            ReceiptFormColumn()
            HorizontalDivider(color = ui.border)
            ReceiptThermalPreview(
                previewText = receiptPreviewText,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun ReceiptLogoCard(
    logoPath: String?,
    onPickLogo: () -> Unit,
    onClearLogo: () -> Unit,
) {
    val ui = posUiColors()
    val hasLogo = !logoPath.isNullOrBlank()
    SettingsSectionCard(title = stringResource(R.string.receipt_logo_title)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .heightIn(min = 140.dp)
                    .clip(PosShapes.Large)
                    .drawBehind {
                        drawRoundRect(
                            color = ui.border,
                            cornerRadius = CornerRadius(12.dp.toPx()),
                            style = Stroke(
                                width = 1.5.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f), 0f),
                            ),
                        )
                    }
                    .background(ui.surfaceSubtle, PosShapes.Large)
                    .clickable(onClick = onPickLogo)
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Icon(
                    Icons.Outlined.CloudUpload,
                    contentDescription = null,
                    tint = PosColors.Primary,
                    modifier = Modifier.size(28.dp),
                )
                Text(
                    text = stringResource(R.string.receipt_logo_drop_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = ui.textSecondary,
                    modifier = Modifier.padding(top = 8.dp, bottom = 12.dp),
                )
                OutlinedButton(onClick = onPickLogo, shape = PosShapes.Medium) {
                    Text(stringResource(R.string.choose_receipt_logo))
                }
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .heightIn(min = 140.dp)
                    .clip(PosShapes.Large)
                    .border(1.dp, ui.border, PosShapes.Large)
                    .background(ui.surface, PosShapes.Large)
                    .padding(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.receipt_logo_preview),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = ui.textPrimary,
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .heightIn(min = 96.dp)
                        .clip(PosShapes.Medium)
                        .background(ui.surfaceSubtle, PosShapes.Medium)
                        .border(1.dp, ui.border, PosShapes.Medium),
                    contentAlignment = Alignment.Center,
                ) {
                    if (hasLogo) {
                        AsyncImage(
                            model = File(logoPath!!),
                            contentDescription = stringResource(R.string.receipt_logo_preview),
                            modifier = Modifier
                                .size(88.dp)
                                .clip(PosShapes.Medium),
                        )
                        IconButton(
                            onClick = onClearLogo,
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(32.dp),
                        ) {
                            Icon(
                                Icons.Default.Close,
                                contentDescription = stringResource(R.string.remove_receipt_logo),
                                tint = ui.textSecondary,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                Icons.Outlined.Image,
                                contentDescription = null,
                                tint = ui.textMuted,
                                modifier = Modifier.size(32.dp),
                            )
                            Text(
                                text = stringResource(R.string.receipt_logo_empty_preview),
                                style = MaterialTheme.typography.bodySmall,
                                color = ui.textMuted,
                                modifier = Modifier.padding(top = 6.dp),
                            )
                        }
                    }
                }
            }
        }
        if (hasLogo) {
            Text(
                stringResource(R.string.receipt_logo_set),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun ReceiptTextFieldCard(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    minLines: Int,
) {
    val ui = posUiColors()
    SettingsSectionCard(title = label) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            minLines = minLines,
            shape = PosShapes.Medium,
            supportingText = {
                Text(
                    text = stringResource(R.string.receipt_char_count, value.length, RECEIPT_TEXT_MAX),
                    modifier = Modifier.fillMaxWidth(),
                    color = ui.textSecondary,
                    textAlign = androidx.compose.ui.text.style.TextAlign.End,
                )
            },
        )
    }
}

@Composable
private fun ReceiptCheckboxRow(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    label: String,
    hint: String? = null,
) {
    val ui = posUiColors()
    Row(verticalAlignment = Alignment.Top) {
        Checkbox(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = CheckboxDefaults.colors(
                checkedColor = PosColors.Primary,
                checkmarkColor = PosColors.TextOnPrimary,
            ),
        )
        Column(modifier = Modifier.padding(top = 12.dp)) {
            Text(label, color = ui.textPrimary, style = MaterialTheme.typography.bodyMedium)
            hint?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = ui.textSecondary)
            }
        }
    }
}
