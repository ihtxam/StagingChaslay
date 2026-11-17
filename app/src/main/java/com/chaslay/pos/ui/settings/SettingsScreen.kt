package com.chaslay.pos.ui.settings
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import com.chaslay.pos.domain.model.ExpressPayPlacement
import com.chaslay.pos.domain.model.FloorConnectionMode
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.domain.model.CourseSendMode
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.domain.model.PosCompactLayoutPreference
import com.chaslay.pos.domain.model.PosMenuDesign
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.domain.model.UserAccess
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.material3.FilterChip
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.TextButton
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.R
import com.chaslay.pos.payment.taptopay.TapToPayReadiness
import com.chaslay.pos.domain.model.AppLanguage
import com.chaslay.pos.domain.model.CategoryPrintSetting
import com.chaslay.pos.domain.model.PrintTarget
import com.chaslay.pos.domain.model.SupportedCurrency
import com.chaslay.pos.printer.DiscoveredPrinter
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Business
import androidx.compose.material.icons.outlined.Cloud
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.MonitorWeight
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Settings
import com.chaslay.pos.ui.license.LicenseSettingsSection
import com.chaslay.pos.ui.components.PosVectorIcon
import com.chaslay.pos.ui.components.settingsSectionIconRes
import com.chaslay.pos.ui.components.settingsSectionMaterialIcon
import com.chaslay.pos.ui.tableplan.TablePlanDesignerContent
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosSwitch
import com.chaslay.pos.ui.theme.PosShapes
import androidx.compose.foundation.BorderStroke

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    userAccess: UserAccess = UserAccess.FULL_ACCESS,
    onCancel: () -> Unit = {},
    useCompactNav: Boolean = false,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var compactSectionOpen by remember { mutableStateOf(!useCompactNav) }
    val ui = posUiColors()
    val scheme = MaterialTheme.colorScheme
    val context = LocalContext.current
    var currencyExpanded by remember { mutableStateOf(false) }
    var languageExpanded by remember { mutableStateOf(false) }
    var printerExpanded by remember { mutableStateOf(false) }
    var kitchenPrinterExpanded by remember { mutableStateOf(false) }
    var hasBluetoothPermission by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                    PackageManager.PERMISSION_GRANTED
            } else {
                true
            }
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        hasBluetoothPermission = grants.values.all { it }
        viewModel.discoverPrinters(hasBluetoothPermission)
    }

    LaunchedEffect(state.message) {
        state.message?.let { msg ->
            val duration = if (msg.length > 72 || msg.contains('\n')) {
                android.widget.Toast.LENGTH_LONG
            } else {
                android.widget.Toast.LENGTH_SHORT
            }
            android.widget.Toast.makeText(context, msg, duration).show()
            viewModel.clearMessage()
        }
    }

    LaunchedEffect(Unit) {
        viewModel.launchOnlineSettingsIntent.collect { intent ->
            context.startActivity(intent)
        }
    }

    LaunchedEffect(Unit) {
        viewModel.shareDiagnosticsIntent.collect { intent ->
            context.startActivity(intent)
        }
    }

    LaunchedEffect(state.selectedSection) {
        when (state.selectedSection) {
            SettingsSection.PRINTERS -> viewModel.refreshPrinterConnectionState()
            SettingsSection.SCALE -> viewModel.refreshScaleConnectionState()
            SettingsSection.GENERAL -> viewModel.refreshPlatformAboutFromCloud()
            SettingsSection.DIAGNOSTICS -> viewModel.refreshDiagnosticsPanel()
            else -> Unit
        }
    }

    val showTablesDesigner =
        state.selectedSection == SettingsSection.TABLES && state.posMode == PosMode.RESTAURANT

    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(ui.canvas)
    ) {
        if (!useCompactNav || !compactSectionOpen) {
        Column(
            modifier = Modifier
                .then(
                    if (useCompactNav) Modifier.fillMaxWidth().fillMaxHeight()
                    else Modifier.width(248.dp).fillMaxHeight()
                )
                .background(posUiColors().surface)
                .border(1.dp, posUiColors().border)
                .padding(8.dp)
        ) {
            Text(
                stringResource(R.string.nav_settings),
                fontWeight = FontWeight.Bold,
                color = ui.textPrimary,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp)
            )
            val navScroll = rememberScrollState()
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(navScroll),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
            SettingsSection.visibleNavSections(
                canManageUsers = userAccess.canManageUsers(),
                restaurantMode = state.posMode == PosMode.RESTAURANT,
            ).forEach { section ->
                val selected = state.selectedSection == section
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(PosShapes.Medium)
                        .background(if (selected) posUiColors().primarySubtle else Color.Transparent)
                        .border(
                            width = if (selected) 1.dp else 0.dp,
                            color = if (selected) posUiColors().primaryBorder else Color.Transparent,
                            shape = PosShapes.Medium,
                        )
                        .clickable {
                            viewModel.selectSection(section)
                            if (useCompactNav) compactSectionOpen = true
                        }
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val navIconTint = if (selected) PosColors.Primary else ui.textPrimary
                        if (state.posMenuDesign.isModern) {
                            settingsSectionIconRes(section)?.let { iconRes ->
                                PosVectorIcon(
                                    resId = iconRes,
                                    contentDescription = null,
                                    tint = navIconTint,
                                    modifier = Modifier.size(16.dp),
                                )
                            }
                        } else {
                            settingsSectionMaterialIcon(section)?.let { icon ->
                                Icon(
                                    imageVector = icon,
                                    contentDescription = null,
                                    tint = navIconTint,
                                    modifier = Modifier.size(16.dp),
                                )
                            }
                        }
                        Text(
                            stringResource(section.titleRes),
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            color = if (selected) {
                                MaterialTheme.colorScheme.onPrimaryContainer
                            } else {
                                ui.textPrimary
                            },
                            fontSize = 13.sp
                        )
                    }
                }
            }
            }
        }
        }
        }
        if (!useCompactNav || compactSectionOpen) {
        if (showTablesDesigner) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .imePadding()
                    .padding(horizontal = PosDimens.Space3, vertical = PosDimens.Space2)
            ) {
                SettingsPageHeader(
                    title = stringResource(R.string.settings_section_tables),
                    subtitle = stringResource(R.string.settings_tables_page_subtitle),
                )
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = PosDimens.Space3),
                    shape = PosShapes.Large,
                    colors = CardDefaults.cardColors(containerColor = ui.surface),
                    border = BorderStroke(1.dp, ui.border),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                            Text(
                                stringResource(R.string.track_covers_seating_plan),
                                color = ui.textPrimary,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                stringResource(R.string.track_covers_help),
                                color = ui.textSecondary,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        PosSwitch(
                            checked = state.trackCoversFromSeatingPlan,
                            onCheckedChange = {
                                viewModel.updateTrackCoversFromSeatingPlan(it)
                                viewModel.saveSettings()
                            }
                        )
                    }
                }
                TablePlanDesignerContent(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                )
            }
        } else {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
                .imePadding()
        ) {
            if (useCompactNav && compactSectionOpen) {
                TextButton(
                    onClick = { compactSectionOpen = false },
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                ) {
                    Text(stringResource(R.string.compact_pos_settings_back), fontWeight = FontWeight.SemiBold)
                }
            }
            SettingsShellHeader(
                onCancel = onCancel,
                onSave = viewModel::saveSettings,
            )
            HorizontalDivider(color = posUiColors().border)
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
        if (state.selectedSection == SettingsSection.GENERAL) {
        SettingsPageHeader(
            title = stringResource(R.string.general_settings),
            subtitle = stringResource(R.string.general_settings_subtitle),
        )

        val session = state.posSession
        if (
            session.staffName != null ||
            session.merchantAccountEmail != null ||
            session.merchantShopName != null
        ) {
            SettingsSectionCard(
                title = stringResource(R.string.settings_signed_in_title),
                icon = Icons.Outlined.Person
            ) {
                session.merchantShopName?.let { shop ->
                    SettingsReadOnlyRow(
                        label = stringResource(R.string.settings_signed_in_shop),
                        value = shop
                    )
                }
                session.merchantAccountEmail?.let { email ->
                    SettingsReadOnlyRow(
                        label = stringResource(R.string.settings_signed_in_merchant_account),
                        value = email
                    )
                }
                session.staffName?.let { name ->
                    SettingsReadOnlyRow(
                        label = stringResource(R.string.settings_signed_in_staff),
                        value = buildString {
                            append(name)
                            session.staffRole?.let { role ->
                                append(" · ")
                                append(role)
                            }
                        }
                    )
                }
                session.staffEmail?.takeIf { it != session.merchantAccountEmail }?.let { email ->
                    SettingsReadOnlyRow(
                        label = stringResource(R.string.settings_signed_in_staff_email),
                        value = email
                    )
                }
                when {
                    session.isSyncedStaffAccount && session.merchantLinked -> {
                        Text(
                            stringResource(R.string.settings_signed_in_cloud_staff),
                            style = MaterialTheme.typography.bodySmall,
                            color = ui.textSecondary
                        )
                    }
                    !session.merchantLinked -> {
                        Text(
                            stringResource(R.string.settings_signed_in_offline_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = ui.textSecondary
                        )
                    }
                    session.dashboardSignedIn && session.staffEmail == null -> {
                        Text(
                            stringResource(R.string.settings_signed_in_panel_session),
                            style = MaterialTheme.typography.bodySmall,
                            color = ui.textSecondary
                        )
                    }
                }
            }
        }

        SettingsSectionCard(title = stringResource(R.string.business_name), icon = Icons.Outlined.Business) {
        OutlinedTextField(
            value = state.businessName,
            onValueChange = viewModel::updateBusinessName,
            label = { Text(stringResource(R.string.business_name)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.vatNumber,
            onValueChange = viewModel::updateVatNumber,
            label = { Text(stringResource(R.string.vat_number)) },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = state.address,
            onValueChange = viewModel::updateAddress,
            label = { Text(stringResource(R.string.address)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.phone,
            onValueChange = viewModel::updatePhone,
            label = { Text(stringResource(R.string.phone)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.email,
            onValueChange = viewModel::updateEmail,
            label = { Text(stringResource(R.string.email)) },
            modifier = Modifier.fillMaxWidth()
        )
        }

        SettingsSectionCard(title = stringResource(R.string.pos_mode), icon = Icons.Outlined.Settings) {
        Text(stringResource(R.string.pos_mode_help), style = MaterialTheme.typography.bodySmall, color = ui.textSecondary)
        if (state.posModeManagedByCloud) {
            Text(
                when (state.posMode) {
                    PosMode.RETAIL -> stringResource(R.string.pos_mode_retail)
                    PosMode.RESTAURANT -> stringResource(R.string.pos_mode_restaurant)
                },
                style = MaterialTheme.typography.titleMedium,
                color = ui.textPrimary
            )
            Text(
                stringResource(R.string.pos_mode_cloud_synced),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary
            )
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PosMode.entries.forEach { mode ->
                    FilterChip(
                        selected = state.posMode == mode,
                        onClick = { viewModel.updatePosMode(mode) },
                        label = {
                            Text(
                                when (mode) {
                                    PosMode.RETAIL -> stringResource(R.string.pos_mode_retail)
                                    PosMode.RESTAURANT -> stringResource(R.string.pos_mode_restaurant)
                                }
                            )
                        }
                    )
                }
            }
        }

        if (state.posMode == PosMode.RESTAURANT) {
            Spacer(modifier = Modifier.height(8.dp))
            SettingSwitch(
                stringResource(R.string.enable_courses),
                state.coursesEnabled,
                viewModel::updateCoursesEnabled
            )
            Text(
                stringResource(R.string.enable_courses_help),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            SettingSwitch(
                stringResource(R.string.settings_reservations_enabled),
                state.reservationsEnabled,
                viewModel::updateReservationsEnabled,
                enabled = state.merchantCloudLinked && !state.reservationsToggleSaving
            )
            Text(
                stringResource(
                    if (state.merchantCloudLinked) {
                        R.string.settings_reservations_enabled_hint
                    } else {
                        R.string.settings_reservations_cloud_required
                    }
                ),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary
            )
            if (state.reservationsToggleSaving) {
                Text(
                    stringResource(R.string.settings_reservations_saving),
                    style = MaterialTheme.typography.bodySmall,
                    color = ui.textSecondary
                )
            }
            if (state.coursesEnabled) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    stringResource(R.string.course_send_mode),
                    style = MaterialTheme.typography.titleSmall,
                    color = ui.textPrimary
                )
                Text(
                    stringResource(R.string.course_send_mode_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = ui.textSecondary
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CourseSendMode.entries.forEach { mode ->
                        FilterChip(
                            selected = state.courseSendMode == mode,
                            onClick = { viewModel.updateCourseSendMode(mode) },
                            label = {
                                Text(
                                    when (mode) {
                                        CourseSendMode.FIRE_PER_COURSE ->
                                            stringResource(R.string.course_send_mode_fire_per_course)
                                        CourseSendMode.SEND_ALL_ONCE ->
                                            stringResource(R.string.course_send_mode_send_all_once)
                                    }
                                )
                            }
                        )
                    }
                }
            }
        } else {
            Spacer(modifier = Modifier.height(8.dp))
            SettingSwitch(
                stringResource(R.string.pos_retail_dine_in),
                state.retailDineInEnabled,
                viewModel::updateRetailDineInEnabled
            )
            Text(
                stringResource(R.string.pos_retail_dine_in_hint),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary
            )
            SettingSwitch(
                stringResource(R.string.pos_retail_takeaway),
                state.retailTakeawayEnabled,
                viewModel::updateRetailTakeawayEnabled
            )
            SettingSwitch(
                stringResource(R.string.pos_retail_delivery),
                state.retailDeliveryEnabled,
                viewModel::updateRetailDeliveryEnabled
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        SettingSwitch(
            stringResource(R.string.pos_tables_enabled),
            state.tablesEnabled,
            viewModel::updateTablesEnabled
        )
        Text(
            stringResource(
                if (state.posMode == PosMode.RESTAURANT) {
                    R.string.pos_tables_enabled_hint
                } else {
                    R.string.pos_tables_enabled_retail_hint
                }
            ),
            style = MaterialTheme.typography.bodySmall,
            color = ui.textSecondary
        )
        Spacer(modifier = Modifier.height(8.dp))
        SettingSwitch(
            stringResource(R.string.pos_require_table_dine_in),
            state.requireTableForDineIn,
            viewModel::updateRequireTableForDineIn
        )
        Text(
            stringResource(R.string.pos_require_table_dine_in_hint),
            style = MaterialTheme.typography.bodySmall,
            color = ui.textSecondary
        )
        }

        SettingsSectionCard(title = stringResource(R.string.business_hours), icon = Icons.Outlined.Schedule) {
        Text(stringResource(R.string.business_hours_help), style = MaterialTheme.typography.bodySmall, color = ui.textSecondary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = state.openHour,
                onValueChange = viewModel::updateOpenHour,
                label = { Text(stringResource(R.string.open_hour)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            OutlinedTextField(
                value = state.openMinute,
                onValueChange = viewModel::updateOpenMinute,
                label = { Text(stringResource(R.string.open_minute)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(
                value = state.closeHour,
                onValueChange = viewModel::updateCloseHour,
                label = { Text(stringResource(R.string.close_hour)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            OutlinedTextField(
                value = state.closeMinute,
                onValueChange = viewModel::updateCloseMinute,
                label = { Text(stringResource(R.string.close_minute)) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
        }
        }

        SettingsSectionCard(title = stringResource(R.string.currency_settings), icon = Icons.Outlined.Language) {
        Text(stringResource(R.string.language_settings), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        ExposedDropdownMenuBox(expanded = currencyExpanded, onExpandedChange = { currencyExpanded = it }) {
            OutlinedTextField(
                value = state.defaultCurrency,
                onValueChange = {},
                readOnly = true,
                label = { Text(stringResource(R.string.default_currency)) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = currencyExpanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )
            DropdownMenu(expanded = currencyExpanded, onDismissRequest = { currencyExpanded = false }) {
                SupportedCurrency.entries.forEach { currency ->
                    DropdownMenuItem(
                        text = { Text("${currency.code} (${currency.symbol})") },
                        onClick = {
                            viewModel.updateCurrency(currency)
                            currencyExpanded = false
                        }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))
        ExposedDropdownMenuBox(expanded = languageExpanded, onExpandedChange = { languageExpanded = it }) {
            OutlinedTextField(
                value = state.language.displayName,
                onValueChange = {},
                readOnly = true,
                label = { Text(stringResource(R.string.language_settings)) },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = languageExpanded) },
                modifier = Modifier
                    .menuAnchor()
                    .fillMaxWidth()
            )
            DropdownMenu(expanded = languageExpanded, onDismissRequest = { languageExpanded = false }) {
                AppLanguage.supportedInSettings.forEach { language ->
                    DropdownMenuItem(
                        text = { Text(language.displayName) },
                        onClick = {
                            viewModel.updateLanguage(language)
                            languageExpanded = false
                        }
                    )
                }
            }
        }
        }

        SettingsSectionCard(title = stringResource(R.string.discount_presets), icon = Icons.Outlined.LocalOffer) {
        state.discountPresets.forEach { preset ->
            Text("• ${preset.name}: ${preset.percent.toInt()}%", style = MaterialTheme.typography.bodySmall)
        }
        OutlinedTextField(
            value = state.newPresetName,
            onValueChange = viewModel::updateNewPresetName,
            label = { Text(stringResource(R.string.preset_name)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.newPresetPercent,
            onValueChange = viewModel::updateNewPresetPercent,
            label = { Text(stringResource(R.string.discount_percent)) },
            modifier = Modifier.fillMaxWidth()
        )
        Button(onClick = viewModel::addDiscountPreset) {
            Text(stringResource(R.string.add_preset))
        }
        }
        }

        if (state.selectedSection == SettingsSection.VAT) {
        SettingsPageHeader(title = stringResource(R.string.vat_settings))
        SettingsSectionCard(title = stringResource(R.string.vat_settings), icon = Icons.Outlined.LocalOffer) {
        OutlinedTextField(
            value = state.dineInVatRate,
            onValueChange = viewModel::updateDineInVatRate,
            label = { Text(stringResource(R.string.dine_in_vat)) },
            modifier = Modifier.fillMaxWidth()
        )
        OutlinedTextField(
            value = state.takeawayVatRate,
            onValueChange = viewModel::updateTakeawayVatRate,
            label = { Text(stringResource(R.string.takeaway_vat)) },
            modifier = Modifier.fillMaxWidth()
        )
        Text(stringResource(R.string.vat_pricing_mode), fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = !state.vatIncludedInPrice,
                onClick = { viewModel.updateVatIncludedInPrice(false) },
                label = { Text(stringResource(R.string.vat_excluded_in_price)) }
            )
            FilterChip(
                selected = state.vatIncludedInPrice,
                onClick = { viewModel.updateVatIncludedInPrice(true) },
                label = { Text(stringResource(R.string.vat_included_in_price)) }
            )
        }
        Text(
            if (state.vatIncludedInPrice) {
                stringResource(R.string.vat_included_hint)
            } else {
                stringResource(R.string.vat_excluded_hint)
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        }
        }

        if (state.selectedSection == SettingsSection.PAYMENTS) {
            SettingsPaymentsSection(state = state, viewModel = viewModel)
        }

        if (state.selectedSection == SettingsSection.PRINTERS) {
        SettingsPageHeader(
            title = stringResource(R.string.printers),
            subtitle = stringResource(R.string.printers_page_help)
        )
        Text(stringResource(R.string.printers_help), style = MaterialTheme.typography.bodySmall, color = posUiColors().textSecondary)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Button(
                onClick = viewModel::showAddPrinterDialog,
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary
                ),
                shape = PosShapes.Large,
            ) {
                Text(stringResource(R.string.add_printer))
            }
        }

        val selectedAddress = state.selectedPrinter?.address
        val connectedPrinter = state.savedPrinters.firstOrNull { printer ->
            selectedAddress != null && printer.address.equals(selectedAddress, ignoreCase = true)
        } ?: state.savedPrinters.firstOrNull { it.printOrderReceipts && it.isEnabled }
            ?: state.savedPrinters.firstOrNull()
        val otherPrinters = state.savedPrinters.filter { it.id != connectedPrinter?.id }

        @Composable
        fun printerStatusUi(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity): Pair<String, Color> {
            if (!printer.isEnabled) {
                return stringResource(R.string.printer_attention) to PosColors.Warning
            }
            val reachable = state.printerReachability[viewModel.printerReachabilityKey(printer)] == true
            return if (reachable) {
                stringResource(R.string.printer_connected) to PosColors.Success
            } else {
                stringResource(R.string.printer_disconnected) to PosColors.Warning
            }
        }

        connectedPrinter?.let { printer ->
            val (statusLabel, statusColor) = printerStatusUi(printer)
            SettingsPrinterRow(
                name = printer.name,
                connectionLine = "${printer.connectionType} · ${viewModel.displayPrinterAddress(printer)}",
                statusLabel = statusLabel,
                statusColor = statusColor,
                assignmentLabels = printerAssignmentLabels(printer),
                isPrimary = true,
                testEnabled = !state.isPrinterBusy,
                onTest = { viewModel.testSavedPrinter(printer) },
                onEdit = { viewModel.editPrinter(printer) },
                onDelete = { viewModel.deleteSavedPrinter(printer.id) },
                modifier = Modifier.padding(vertical = 6.dp)
            )
        }

        otherPrinters.forEach { printer ->
            val (statusLabel, statusColor) = printerStatusUi(printer)
            SettingsPrinterRow(
                name = printer.name,
                connectionLine = "${printer.connectionType} · ${viewModel.displayPrinterAddress(printer)}",
                statusLabel = statusLabel,
                statusColor = statusColor,
                assignmentLabels = printerAssignmentLabels(printer),
                isPrimary = false,
                testEnabled = !state.isPrinterBusy,
                onTest = { viewModel.testSavedPrinter(printer) },
                onEdit = { viewModel.editPrinter(printer) },
                onDelete = { viewModel.deleteSavedPrinter(printer.id) },
                modifier = Modifier.padding(vertical = 6.dp)
            )
        }
        }

        if (state.selectedSection == SettingsSection.SCALE) {
        SettingsPageHeader(
            title = stringResource(R.string.scale_section),
            subtitle = stringResource(R.string.scale_page_help)
        )
        Text(stringResource(R.string.scale_help), fontSize = 12.sp, color = posUiColors().textSecondary)
        Text(
            stringResource(R.string.app_version_format, BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE),
            fontSize = 11.sp,
            color = posUiColors().textMuted
        )
        if (state.posMode == PosMode.RETAIL) {
            SettingSwitch(
                stringResource(R.string.pos_retail_weighed_custom_entry),
                state.retailWeighedCustomEntryEnabled,
                viewModel::updateRetailWeighedCustomEntryEnabled
            )
            Text(
                stringResource(R.string.pos_retail_weighed_custom_entry_hint),
                fontSize = 12.sp,
                color = posUiColors().textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
        }
        if (state.posMode == PosMode.RESTAURANT) {
            SettingSwitch(
                stringResource(R.string.pos_restaurant_weighed_custom_entry),
                state.restaurantWeighedCustomEntryEnabled,
                viewModel::updateRestaurantWeighedCustomEntryEnabled
            )
            Text(
                stringResource(R.string.pos_restaurant_weighed_custom_entry_hint),
                fontSize = 12.sp,
                color = posUiColors().textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
        }
        SettingSwitch(stringResource(R.string.scale_enabled), state.scaleEnabled, viewModel::updateScaleEnabled)
        state.scaleUsbAddress?.trim()?.takeIf { it.isNotEmpty() }?.let { selectedAddress ->
            val needsPermission = state.scaleUsbDeviceAttached && !state.scaleUsbHasPermission
            val liveConnected = state.scaleReachability == true
            val liveDisconnected = state.scaleReachability == false
            val cardBg = when {
                state.isProbingScale -> posUiColors().surfaceMuted
                liveConnected -> posUiColors().successSubtle
                needsPermission -> posUiColors().warningSubtle
                liveDisconnected || !state.scaleUsbDeviceAttached -> posUiColors().surfaceMuted
                else -> posUiColors().surfaceMuted
            }
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = cardBg),
                shape = PosShapes.Large,
                border = BorderStroke(
                    1.dp,
                    when {
                        liveConnected -> PosColors.Success.copy(alpha = 0.35f)
                        needsPermission -> PosColors.Warning.copy(alpha = 0.35f)
                        liveDisconnected -> PosColors.Warning.copy(alpha = 0.25f)
                        else -> posUiColors().border
                    }
                ),
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(10.dp)
                                    .clip(RoundedCornerShape(50))
                                    .background(
                                        when {
                                            state.isProbingScale -> posUiColors().textMuted
                                            liveConnected -> PosColors.Success
                                            needsPermission -> PosColors.Warning
                                            liveDisconnected || !state.scaleUsbDeviceAttached -> PosColors.Warning
                                            else -> posUiColors().textMuted
                                        }
                                    )
                            )
                            Text(
                                when {
                                    state.isProbingScale -> stringResource(R.string.scale_status_checking)
                                    liveConnected -> stringResource(R.string.scale_connected)
                                    needsPermission -> stringResource(R.string.scale_tap_to_allow_usb)
                                    !state.scaleUsbDeviceAttached -> stringResource(R.string.scale_not_found)
                                    liveDisconnected -> stringResource(R.string.scale_disconnected)
                                    else -> stringResource(R.string.scale_status_unknown)
                                },
                                color = when {
                                    liveConnected -> PosColors.Teal700
                                    needsPermission || liveDisconnected -> PosColors.Warning
                                    else -> posUiColors().textSecondary
                                },
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                        OutlinedButton(
                            onClick = viewModel::refreshScaleConnectionState,
                            enabled = !state.isProbingScale,
                            modifier = Modifier.height(32.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 0.dp)
                        ) {
                            Icon(
                                Icons.Outlined.Refresh,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                            )
                            Spacer(modifier = Modifier.size(4.dp))
                            Text(stringResource(R.string.scale_refresh_status), fontSize = 11.sp)
                        }
                    }
                    Text(
                        viewModel.displayScaleUsbAddress(selectedAddress),
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        color = posUiColors().textPrimary
                    )
                    Text(
                        selectedAddress,
                        style = MaterialTheme.typography.bodySmall,
                        color = posUiColors().textSecondary
                    )
                    state.scaleLastProbeAtMs?.let { probedAt ->
                        Text(
                            stringResource(
                                R.string.scale_last_checked,
                                java.text.DateFormat.getTimeInstance(java.text.DateFormat.SHORT)
                                    .format(java.util.Date(probedAt))
                            ),
                            fontSize = 11.sp,
                            color = posUiColors().textMuted
                        )
                    }
                    Text(
                        when {
                            liveConnected -> stringResource(R.string.scale_selected_help)
                            needsPermission -> stringResource(R.string.scale_usb_permission_required)
                            else -> stringResource(R.string.scale_replug_hint)
                        },
                        fontSize = 12.sp,
                        color = posUiColors().textSecondary
                    )
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = viewModel::scanScaleUsbDevices) {
                Text(stringResource(R.string.scale_scan_usb))
            }
            OutlinedButton(
                onClick = viewModel::testScaleReading,
                enabled = state.scaleEnabled && !state.scaleUsbAddress.isNullOrBlank()
            ) {
                Text(stringResource(R.string.scale_test_reading))
            }
        }
        state.scaleTestReading?.let { reading ->
            Text(reading, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PosColors.Primary)
        }
        val otherScaleDevices = state.scaleDevices.filter { it.stableAddress != state.scaleUsbAddress }
        if (otherScaleDevices.isNotEmpty()) {
            Text(stringResource(R.string.scale_select_usb), fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = posUiColors().textPrimary)
        }
        otherScaleDevices.forEach { device ->
            val isSelected = device.stableAddress == state.scaleUsbAddress
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
                    .clickable { viewModel.selectScaleDeviceAndSave(device.stableAddress) },
                colors = CardDefaults.cardColors(
                    containerColor = if (isSelected) {
                        posUiColors().primarySubtle
                    } else {
                        posUiColors().surface
                    }
                ),
                shape = PosShapes.Large,
                border = BorderStroke(
                    1.dp,
                    if (isSelected) posUiColors().primaryBorder else posUiColors().border
                ),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(device.displayName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = posUiColors().textPrimary)
                    Text(
                        when {
                            isSelected -> stringResource(R.string.scale_selected)
                            device.hasPermission -> stringResource(R.string.scale_usb_ready)
                            else -> stringResource(R.string.scale_tap_to_connect)
                        },
                        fontSize = 11.sp,
                        color = when {
                            isSelected -> PosColors.Teal700
                            device.hasPermission -> posUiColors().textSecondary
                            else -> PosColors.Primary
                        },
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
            }
        }
        }

        if (state.selectedSection == SettingsSection.RECEIPTS) {
            ReceiptSettingsSection(state = state, viewModel = viewModel)
        }

        if (state.selectedSection == SettingsSection.FLOOR_DEVICES &&
            state.posMode == PosMode.RESTAURANT
        ) {
            SettingsFloorDevicesSection(state = state, viewModel = viewModel)
        }

        if (state.selectedSection == SettingsSection.USERS_ACCOUNTS) {
            UsersRolesSection(
                canManageRoles = userAccess.canManageRoles(),
                useModernVisuals = state.posMenuDesign.isModern,
            )
        }

        if (state.selectedSection == SettingsSection.APPEARANCE) {
            SettingsPageHeader(
                title = stringResource(R.string.appearance_settings),
                subtitle = stringResource(R.string.pos_menu_design_help),
            )
            SettingsSectionCard(
                title = stringResource(R.string.appearance_settings),
                subtitle = stringResource(R.string.theme_help),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = state.posThemeMode == PosThemeMode.LIGHT,
                        onClick = { viewModel.updatePosThemeMode(PosThemeMode.LIGHT) },
                        label = { Text(stringResource(R.string.theme_light)) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = scheme.primaryContainer,
                            selectedLabelColor = scheme.onPrimaryContainer,
                            containerColor = ui.surfaceMuted,
                            labelColor = ui.textPrimary,
                        ),
                    )
                    FilterChip(
                        selected = state.posThemeMode == PosThemeMode.DARK,
                        onClick = { viewModel.updatePosThemeMode(PosThemeMode.DARK) },
                        label = { Text(stringResource(R.string.theme_dark)) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = scheme.primaryContainer,
                            selectedLabelColor = scheme.onPrimaryContainer,
                            containerColor = ui.surfaceMuted,
                            labelColor = ui.textPrimary,
                        ),
                    )
                }
            }
            SettingsSectionCard(
                title = stringResource(R.string.pos_menu_design_title),
                subtitle = stringResource(R.string.pos_menu_design_help),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = state.posMenuDesign == PosMenuDesign.CLASSIC,
                        onClick = { viewModel.updatePosMenuDesign(PosMenuDesign.CLASSIC) },
                        label = { Text(stringResource(R.string.pos_menu_design_classic)) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = scheme.primaryContainer,
                            selectedLabelColor = scheme.onPrimaryContainer,
                            containerColor = ui.surfaceMuted,
                            labelColor = ui.textPrimary,
                        ),
                    )
                    FilterChip(
                        selected = state.posMenuDesign == PosMenuDesign.MODERN_TOP,
                        onClick = { viewModel.updatePosMenuDesign(PosMenuDesign.MODERN_TOP) },
                        label = { Text(stringResource(R.string.pos_menu_design_modern_top)) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = scheme.primaryContainer,
                            selectedLabelColor = scheme.onPrimaryContainer,
                            containerColor = ui.surfaceMuted,
                            labelColor = ui.textPrimary,
                        ),
                    )
                    FilterChip(
                        selected = state.posMenuDesign == PosMenuDesign.MODERN_SIDE,
                        onClick = { viewModel.updatePosMenuDesign(PosMenuDesign.MODERN_SIDE) },
                        label = { Text(stringResource(R.string.pos_menu_design_modern_side)) },
                        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
                            selectedContainerColor = scheme.primaryContainer,
                            selectedLabelColor = scheme.onPrimaryContainer,
                            containerColor = ui.surfaceMuted,
                            labelColor = ui.textPrimary,
                        ),
                    )
                }
            }
            SettingsSectionCard(
                title = stringResource(R.string.compact_pos_layout_title),
                subtitle = stringResource(R.string.compact_pos_layout_help),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = state.posCompactLayoutPreference == PosCompactLayoutPreference.AUTO,
                        onClick = { viewModel.updatePosCompactLayoutPreference(PosCompactLayoutPreference.AUTO) },
                        label = { Text(stringResource(R.string.compact_pos_layout_auto)) },
                    )
                    FilterChip(
                        selected = state.posCompactLayoutPreference == PosCompactLayoutPreference.ON,
                        onClick = { viewModel.updatePosCompactLayoutPreference(PosCompactLayoutPreference.ON) },
                        label = { Text(stringResource(R.string.compact_pos_layout_on)) },
                    )
                    FilterChip(
                        selected = state.posCompactLayoutPreference == PosCompactLayoutPreference.OFF,
                        onClick = { viewModel.updatePosCompactLayoutPreference(PosCompactLayoutPreference.OFF) },
                        label = { Text(stringResource(R.string.compact_pos_layout_off)) },
                    )
                }
            }
            SettingsSectionCard(title = stringResource(R.string.pos_display_scale_title)) {
                AppearanceScaleRow(
                    title = stringResource(R.string.pos_display_scale_title),
                    hint = stringResource(R.string.pos_display_scale_hint),
                    valueLabel = "${(state.posDisplayScale * 100).toInt()}%",
                    onDecrease = {
                        viewModel.updatePosDisplayScale(
                            state.posDisplayScale - com.chaslay.pos.ui.theme.PosAppearanceLimits.DISPLAY_STEP
                        )
                    },
                    onIncrease = {
                        viewModel.updatePosDisplayScale(
                            state.posDisplayScale + com.chaslay.pos.ui.theme.PosAppearanceLimits.DISPLAY_STEP
                        )
                    },
                    decreaseEnabled = state.posDisplayScale > com.chaslay.pos.ui.theme.PosAppearanceLimits.DISPLAY_MIN + 0.001f,
                    increaseEnabled = state.posDisplayScale < com.chaslay.pos.ui.theme.PosAppearanceLimits.DISPLAY_MAX - 0.001f,
                )
                AppearanceScaleRow(
                    title = stringResource(R.string.pos_text_scale_title),
                    hint = stringResource(R.string.pos_text_scale_hint),
                    valueLabel = "${(state.posTextScale * 100).toInt()}%",
                    onDecrease = {
                        viewModel.updatePosTextScale(
                            state.posTextScale - com.chaslay.pos.ui.theme.PosAppearanceLimits.TEXT_STEP
                        )
                    },
                    onIncrease = {
                        viewModel.updatePosTextScale(
                            state.posTextScale + com.chaslay.pos.ui.theme.PosAppearanceLimits.TEXT_STEP
                        )
                    },
                    decreaseEnabled = state.posTextScale > com.chaslay.pos.ui.theme.PosAppearanceLimits.TEXT_MIN + 0.001f,
                    increaseEnabled = state.posTextScale < com.chaslay.pos.ui.theme.PosAppearanceLimits.TEXT_MAX - 0.001f,
                )
            }
            SettingsSectionCard(title = stringResource(R.string.kiosk_fullscreen_title)) {
                SettingsSwitchRow(
                    title = stringResource(R.string.kiosk_fullscreen_title),
                    subtitle = stringResource(R.string.kiosk_fullscreen_help),
                    checked = state.kioskFullscreenEnabled,
                    onCheckedChange = viewModel::updateKioskFullscreenEnabled,
                )
            }
        }

        if (state.selectedSection == SettingsSection.LICENSE) {
            val appUpdateChecking by viewModel.appUpdateChecking.collectAsStateWithLifecycle()
            LicenseSettingsSection(
                platformAboutHtml = state.platformAboutHtml,
                onCheckForAppUpdate = viewModel::checkForAppUpdate,
                isCheckingForAppUpdate = appUpdateChecking,
            )
        }

        if (state.selectedSection == SettingsSection.DIAGNOSTICS) {
            SettingsDiagnosticsSection(
                state = state,
                onUpload = viewModel::uploadDiagnosticsToSupport,
                onShare = viewModel::shareDiagnosticsLogs,
                onClearCrashFiles = viewModel::clearCrashLogs,
                onSelectCrashLog = viewModel::selectCrashLog,
            )
        }

        if (state.selectedSection == SettingsSection.GENERAL) {
            // Extra space so last fields aren't covered by sticky Save.
            Spacer(modifier = Modifier.height(8.dp))
        }
        } // end scrollable content
        }

        // Sticky Save — always visible (not under system nav / not lost in scroll).
        if (state.selectedSection != SettingsSection.LICENSE &&
            state.selectedSection != SettingsSection.DIAGNOSTICS &&
            state.selectedSection != SettingsSection.PRINTERS &&
            state.selectedSection != SettingsSection.RECEIPTS &&
            state.selectedSection != SettingsSection.PAYMENTS &&
            state.selectedSection != SettingsSection.FLOOR_DEVICES &&
            state.selectedSection != SettingsSection.GENERAL
        ) {
            HorizontalDivider()
            Button(
                onClick = viewModel::saveSettings,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary,
                )
            ) {
                Text(stringResource(R.string.save), fontWeight = FontWeight.SemiBold)
            }
        }
        }
        } // end non-tables content
        }
    }

    if (state.showCloudLoginDialog) {
        AlertDialog(
            onDismissRequest = viewModel::dismissCloudLoginDialog,
            title = { Text(stringResource(R.string.online_settings_login_title)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(stringResource(R.string.online_settings_login_body))
                    OutlinedTextField(
                        value = state.cloudLoginEmail,
                        onValueChange = viewModel::updateCloudLoginEmail,
                        label = { Text(stringResource(R.string.email)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.cloudLoginPassword,
                        onValueChange = viewModel::updateCloudLoginPassword,
                        label = { Text(stringResource(R.string.password)) },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        modifier = Modifier.fillMaxWidth()
                    )
                    state.cloudLoginError?.let { error ->
                        Text(
                            error,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::submitCloudLoginForOnlineSettings,
                    enabled = !state.isCloudLoggingIn
                ) {
                    Text(
                        if (state.isCloudLoggingIn) {
                            stringResource(R.string.online_settings_opening)
                        } else {
                            stringResource(R.string.login)
                        }
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissCloudLoginDialog) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (state.showAddPrinterDialog) {
        AddPrinterDialog(
            discoveredPrinters = state.printers,
            networkPrinters = state.networkPrinters,
            usbDevices = state.usbDevices,
            linkCategories = state.linkCategories,
            initialForm = state.editingPrinter?.toForm(),
            editingPrinterId = state.editingPrinter?.id,
            isEdit = state.editingPrinter != null,
            isBusy = state.isPrinterBusy,
            isScanBusy = state.isDiscoveryScanBusy,
            statusMessage = state.printerDiscoveryMessage,
            onScan = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission) {
                    permissionLauncher.launch(
                        arrayOf(
                            Manifest.permission.BLUETOOTH_CONNECT,
                            Manifest.permission.BLUETOOTH_SCAN
                        )
                    )
                } else {
                    viewModel.discoverPrinters(hasBluetoothPermission)
                }
            },
            onScanSunmi = viewModel::discoverSunmiPrinters,
            onScanUsb = viewModel::discoverUsbDevices,
            onRequestUsbPermission = viewModel::requestUsbPermission,
            onScanNetwork = viewModel::discoverNetworkPrinters,
            onVerifyNetwork = viewModel::verifyNetworkPrinterAddress,
            onTestPrint = viewModel::testAddPrinterForm,
            onSave = viewModel::addPrinter,
            onDismiss = viewModel::dismissAddPrinterDialog
        )
    }
}

@Composable
private fun SettingSwitch(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
    subtitle: String? = null,
) {
    SettingsSwitchRow(
        title = label,
        subtitle = subtitle,
        checked = checked,
        onCheckedChange = onCheckedChange,
        enabled = enabled,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PrinterPicker(
    label: String,
    selected: String,
    printers: List<DiscoveredPrinter>,
    expanded: Boolean,
    onExpandedChange: (Boolean) -> Unit,
    onSelect: (DiscoveredPrinter) -> Unit
) {
    if (printers.isEmpty()) return
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = onExpandedChange) {
        OutlinedTextField(
            value = selected,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth()
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }) {
            printers.forEach { printer ->
                DropdownMenuItem(
                    text = { Text(printer.name) },
                    onClick = {
                        onSelect(printer)
                        onExpandedChange(false)
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryPrintRow(
    category: CategoryPrintSetting,
    onTargetChange: (PrintTarget) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = "${category.name}: ${category.printTarget.displayName}",
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .menuAnchor()
                .fillMaxWidth(),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }
        )
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            PrintTarget.entries.forEach { target ->
                DropdownMenuItem(
                    text = { Text(target.displayName) },
                    onClick = {
                        onTargetChange(target)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun printerAssignmentLabels(printer: com.chaslay.pos.data.local.entity.PrinterConfigEntity): List<String> =
    buildList {
        if (printer.printOrderReceipts) add(stringResource(R.string.receipt))
        if (printer.printKitchenTickets) add(stringResource(R.string.printer_cap_kitchen))
        if (printer.printEndOfDayReports) add(stringResource(R.string.reports))
        if (printer.openCashDrawer) add(stringResource(R.string.cash_drawer))
    }

@Composable
private fun AppearanceScaleRow(
    title: String,
    hint: String,
    valueLabel: String,
    onDecrease: () -> Unit,
    onIncrease: () -> Unit,
    decreaseEnabled: Boolean,
    increaseEnabled: Boolean,
) {
    val ui = posUiColors()
    val scheme = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Medium, color = scheme.onSurface)
            Text(hint, style = MaterialTheme.typography.bodySmall, color = ui.textSecondary)
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedButton(onClick = onDecrease, enabled = decreaseEnabled) {
                Text("−", fontWeight = FontWeight.Bold)
            }
            Text(
                valueLabel,
                fontWeight = FontWeight.SemiBold,
                color = scheme.onSurface,
                modifier = Modifier.widthIn(min = 48.dp),
                textAlign = TextAlign.Center,
            )
            OutlinedButton(onClick = onIncrease, enabled = increaseEnabled) {
                Text("+", fontWeight = FontWeight.Bold)
            }
        }
    }
}
