package com.chaslay.pos.ui.license

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Info
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.LicenseGateState
import com.chaslay.pos.ui.settings.SettingsPageHeader
import com.chaslay.pos.ui.settings.SettingsReadOnlyRow
import com.chaslay.pos.ui.settings.SettingsRichHtmlBlock
import com.chaslay.pos.ui.settings.SettingsSectionCard
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.posBrandHeroBackground
import com.chaslay.pos.ui.theme.posUiColors

@Composable
fun LicenseSettingsSection(
    platformAboutHtml: String = "",
    viewModel: LicenseViewModel = hiltViewModel(),
) {
    val license by viewModel.licenseState.collectAsStateWithLifecycle()
    val form by viewModel.formState.collectAsStateWithLifecycle()
    val dateFmt = remember { java.text.SimpleDateFormat("dd.MM.yyyy", java.util.Locale.getDefault()) }

    SettingsPageHeader(
        title = stringResource(R.string.license_settings_title),
        subtitle = stringResource(R.string.license_settings_subtitle),
    )
    Spacer(modifier = Modifier.height(4.dp))

    val bannerBg = when (license.gateState) {
        LicenseGateState.TRIAL -> posUiColors().warningSubtle
        LicenseGateState.ALLOWED -> posUiColors().successSubtle
        else -> posUiColors().dangerSubtle
    }
    val bannerFg = when (license.gateState) {
        LicenseGateState.TRIAL -> PosColors.Warning
        LicenseGateState.ALLOWED -> PosColors.Success
        else -> PosColors.Danger
    }
    val statusText = when (license.gateState) {
        LicenseGateState.TRIAL -> stringResource(R.string.license_status_trial, license.trialDaysRemaining)
        LicenseGateState.ALLOWED -> {
            val expiry = license.snapshot.expiresAt.takeIf { it > 0L }?.let { dateFmt.format(java.util.Date(it)) } ?: "-"
            stringResource(R.string.license_status_active, expiry)
        }
        LicenseGateState.EXPIRED, LicenseGateState.NEEDS_ACTIVATION -> stringResource(R.string.license_status_expired)
        LicenseGateState.LOADING -> "..."
    }
    SettingsSectionCard(title = stringResource(R.string.license_settings_title)) {
        Text(
            text = statusText,
            modifier = Modifier
                .fillMaxWidth()
                .background(bannerBg, RoundedCornerShape(10.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            color = bannerFg,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
        )
        if (license.gateState == LicenseGateState.TRIAL && BuildConfig.TRIAL_DAYS > 0) {
            Spacer(modifier = Modifier.height(8.dp))
            val progress = (license.trialDaysRemaining.toFloat() / BuildConfig.TRIAL_DAYS.toFloat())
                .coerceIn(0f, 1f)
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth(),
                color = PosColors.Primary,
            )
            Text(
                text = "${license.trialDaysRemaining}/${BuildConfig.TRIAL_DAYS}",
                style = MaterialTheme.typography.bodySmall,
                color = posUiColors().textSecondary,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.license_activate_early_body),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
    Spacer(modifier = Modifier.height(12.dp))
    SettingsSectionCard(title = stringResource(R.string.license_activation_code)) {
    LicenseActivationForm(
        activationCode = form.activationCode,
        deviceId = form.liveDeviceId.ifBlank { license.snapshot.deviceId },
        isActivating = form.isActivating,
        errorMessage = form.errorMessage,
        merchantName = form.lookedUpMerchantName ?: license.snapshot.customerName,
        isLookingUpMerchant = form.isLookingUpMerchant,
        onCodeChange = viewModel::updateActivationCode,
        onActivate = viewModel::activate
    )
    }
    Spacer(modifier = Modifier.height(12.dp))
    SettingsSectionCard(
        title = stringResource(R.string.license_app_info_title),
        icon = Icons.Outlined.Info,
    ) {
        SettingsReadOnlyRow(
            label = stringResource(R.string.app_version),
            value = stringResource(
                R.string.app_version_format,
                BuildConfig.VERSION_NAME,
                BuildConfig.VERSION_CODE,
            ),
        )
    }
    Spacer(modifier = Modifier.height(12.dp))
    SettingsSectionCard(
        title = stringResource(R.string.license_company_info_title),
        icon = Icons.Outlined.Info,
    ) {
        SettingsRichHtmlBlock(html = platformAboutHtml)
    }
}

@Composable
private fun LicenseActivationForm(
    activationCode: String,
    deviceId: String,
    isActivating: Boolean,
    errorMessage: String?,
    onCodeChange: (String) -> Unit,
    onActivate: () -> Unit,
    modifier: Modifier = Modifier,
    merchantName: String? = null,
    isLookingUpMerchant: Boolean = false
) {
    val context = LocalContext.current
    var copiedDeviceId by remember { mutableStateOf(false) }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = activationCode,
            onValueChange = onCodeChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.license_activation_code)) },
            singleLine = true,
            enabled = !isActivating
        )
        val shopName = merchantName?.trim().orEmpty()
        when {
            shopName.isNotEmpty() -> {
                Text(
                    text = stringResource(R.string.license_merchant_label, shopName),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            isLookingUpMerchant -> {
                Text(
                    text = stringResource(R.string.license_looking_up_merchant),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        Text(
            text = stringResource(R.string.license_device_id_label),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = deviceId.ifBlank { "..." },
                modifier = Modifier.weight(1f),
                fontFamily = FontFamily.Monospace,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            OutlinedButton(
                onClick = {
                    if (deviceId.isBlank()) return@OutlinedButton
                    copyToClipboard(context, deviceId)
                    copiedDeviceId = true
                },
                enabled = deviceId.isNotBlank() && !isActivating
            ) {
                Text(
                    if (copiedDeviceId) stringResource(R.string.license_copied)
                    else stringResource(R.string.license_copy_device_id)
                )
            }
        }
        Text(
            text = stringResource(R.string.license_device_id_help),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        errorMessage?.let { error ->
            Text(text = error, color = MaterialTheme.colorScheme.error)
        }
        Button(
            onClick = onActivate,
            modifier = Modifier.fillMaxWidth(),
            enabled = activationCode.isNotBlank() && !isActivating,
            colors = ButtonDefaults.buttonColors(
                containerColor = PosColors.Primary,
                contentColor = PosColors.TextOnPrimary
            )
        ) {
            if (isActivating) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = PosColors.TextOnPrimary,
                    strokeWidth = 2.dp,
                )
            } else {
                Text(stringResource(R.string.license_activate_button))
            }
        }
    }
}

@Composable
fun ActivationScreen(
    viewModel: LicenseViewModel = hiltViewModel()
) {
    val license by viewModel.licenseState.collectAsStateWithLifecycle()
    val form by viewModel.formState.collectAsStateWithLifecycle()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .posBrandHeroBackground()
    ) {
        if (license.gateState == LicenseGateState.LOADING) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = PosColors.TextOnPrimary)
            }
            return
        }

        val expired = license.gateState == LicenseGateState.EXPIRED
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
            Spacer(modifier = Modifier.height(16.dp))
            Image(
                painter = painterResource(R.drawable.reborn_logo_white),
                contentDescription = stringResource(R.string.app_name),
                modifier = Modifier.height(96.dp),
                contentScale = ContentScale.Fit
            )
            Text(
                text = stringResource(R.string.app_name),
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = PosColors.TextOnPrimary
            )
            Text(
                text = stringResource(R.string.license_brand_domain),
                fontSize = 14.sp,
                color = PosColors.TextOnPrimary.copy(alpha = 0.85f),
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(8.dp))
            Column(
                modifier = Modifier
                    .widthIn(max = 480.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(posUiColors().surface)
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = if (expired) stringResource(R.string.license_expired_title) else stringResource(R.string.license_activate_title),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = posUiColors().textPrimary
                )
                Text(
                    text = if (expired) stringResource(R.string.license_expired_body) else stringResource(R.string.license_activate_body),
                    color = posUiColors().textSecondary
                )
                LicenseActivationForm(
                    activationCode = form.activationCode,
                    deviceId = form.liveDeviceId.ifBlank { license.snapshot.deviceId },
                    isActivating = form.isActivating,
                    errorMessage = form.errorMessage,
                    merchantName = form.lookedUpMerchantName ?: license.snapshot.customerName,
                    isLookingUpMerchant = form.isLookingUpMerchant,
                    onCodeChange = viewModel::updateActivationCode,
                    onActivate = viewModel::activate
                )
            }
            }
        }
    }
}

private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    clipboard.setPrimaryClip(ClipData.newPlainText("device_id", text))
}

@Composable
fun LicenseRenewalBanner(
    licenseState: com.chaslay.pos.domain.model.LicenseUiState,
    modifier: Modifier = Modifier
) {
    when {
        licenseState.gateState == LicenseGateState.TRIAL -> {
            LicenseBanner(
                text = stringResource(R.string.license_trial_banner, licenseState.trialDaysRemaining),
                modifier = modifier,
                accent = MaterialTheme.colorScheme.primaryContainer
            )
        }
        licenseState.showRenewalWarning && licenseState.daysUntilExpiry != null -> {
            LicenseBanner(
                text = stringResource(R.string.license_renewal_banner, licenseState.daysUntilExpiry!!),
                modifier = modifier,
                accent = MaterialTheme.colorScheme.errorContainer
            )
        }
    }
}

@Composable
private fun LicenseBanner(
    text: String,
    modifier: Modifier = Modifier,
    accent: androidx.compose.ui.graphics.Color
) {
    Text(
        text = text,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        color = MaterialTheme.colorScheme.onSurface,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium
    )
}
