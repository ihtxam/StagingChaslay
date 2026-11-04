package com.chaslay.pos.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.ExpressPayPlacement
import com.chaslay.pos.payment.taptopay.TapToPayReadiness
import com.chaslay.pos.ui.theme.posUiColors

@Composable
internal fun SettingsPaymentsSection(
    state: SettingsUiState,
    viewModel: SettingsViewModel,
) {
    val ui = posUiColors()

    SettingsPageHeader(
        title = stringResource(R.string.settings_payments_terminals_title),
        subtitle = stringResource(R.string.settings_payments_terminals_subtitle),
    )

    SettingsSectionCard(
        title = stringResource(R.string.payment_methods_manage_locally),
        subtitle = stringResource(R.string.payment_methods_manage_locally_hint),
    ) {
        SettingsSwitchRow(
            title = stringResource(R.string.payment_methods_manage_locally),
            subtitle = stringResource(R.string.payment_device_management_hint),
            checked = !state.paymentMethodsManagedByCloud,
            onCheckedChange = viewModel::updatePaymentMethodsLocalOverride,
        )
    }

    SettingsSectionCard(title = stringResource(R.string.default_rounding)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("0" to "None", "0.05" to "0.05", "0.10" to "0.10", "0.50" to "0.50", "1.00" to "1.00").forEach { (value, label) ->
                FilterChip(
                    selected = state.roundingStep == value,
                    onClick = { viewModel.updateRoundingStep(value) },
                    label = { Text(label) },
                )
            }
        }
    }

    SettingsSectionCard(title = stringResource(R.string.tap_to_pay_enabled)) {
        SettingsSwitchRow(
            title = stringResource(R.string.tap_to_pay_enabled),
            subtitle = stringResource(R.string.tap_to_pay_help),
            checked = state.tapToPayEnabled,
            onCheckedChange = viewModel::updateTapToPay,
            enabled = !state.paymentMethodsManagedByCloud,
        )
        if (state.paymentMethodsManagedByCloud) {
            Text(
                stringResource(R.string.tap_to_pay_managed_by_panel),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary,
            )
        }
        if (state.tapToPayEnabled) {
            LaunchedEffect(state.tapToPayEnabled) { viewModel.refreshTapToPayReadiness() }
            val readiness = state.tapToPayReadiness
            val statusText = when {
                state.isActivatingTapToPay -> stringResource(R.string.tap_to_pay_activating)
                readiness == TapToPayReadiness.NO_SDK -> stringResource(R.string.tap_to_pay_status_no_sdk)
                readiness == TapToPayReadiness.OS_TOO_OLD -> stringResource(R.string.tap_to_pay_status_os_too_old)
                readiness == TapToPayReadiness.NO_NFC -> stringResource(R.string.tap_to_pay_status_no_nfc)
                readiness == TapToPayReadiness.NOT_SIGNED_IN -> stringResource(R.string.tap_to_pay_status_not_signed_in)
                readiness == TapToPayReadiness.NOT_REGISTERED -> stringResource(R.string.tap_to_pay_status_not_registered)
                else -> stringResource(R.string.tap_to_pay_status_ready)
            }
            Text(statusText, style = MaterialTheme.typography.bodySmall, color = ui.textSecondary)
            val canActivate = readiness == TapToPayReadiness.NOT_REGISTERED || readiness == TapToPayReadiness.READY
            OutlinedButton(
                onClick = viewModel::activateTapToPay,
                enabled = canActivate && !state.isActivatingTapToPay,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    when {
                        state.isActivatingTapToPay -> stringResource(R.string.tap_to_pay_activating)
                        readiness == TapToPayReadiness.READY -> stringResource(R.string.tap_to_pay_reactivate)
                        else -> stringResource(R.string.tap_to_pay_activate)
                    },
                )
            }
        }
    }

    SettingsSectionCard(title = stringResource(R.string.adyen_terminal)) {
        SettingsSwitchRow(
            title = stringResource(R.string.adyen_terminal),
            subtitle = stringResource(R.string.adyen_setup_help),
            checked = state.adyenTerminalEnabled,
            onCheckedChange = viewModel::updateAdyenEnabled,
        )
        if (state.adyenTerminalEnabled) {
            OutlinedTextField(
                value = state.adyenApiKey,
                onValueChange = viewModel::updateAdyenApiKey,
                label = { Text(stringResource(R.string.adyen_api_key)) },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.adyenMerchantAccount,
                onValueChange = viewModel::updateAdyenMerchantAccount,
                label = { Text(stringResource(R.string.adyen_merchant_account)) },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.adyenTerminalId,
                onValueChange = viewModel::updateAdyenTerminalId,
                label = { Text(stringResource(R.string.adyen_terminal_id)) },
                supportingText = { Text(stringResource(R.string.adyen_terminal_id_help)) },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.adyenClientId,
                onValueChange = viewModel::updateAdyenClientId,
                label = { Text(stringResource(R.string.adyen_sale_id)) },
                supportingText = { Text(stringResource(R.string.adyen_sale_id_help)) },
                modifier = Modifier.fillMaxWidth(),
            )
            SettingsSwitchRow(
                title = stringResource(R.string.adyen_live_environment),
                checked = state.adyenLiveEnvironment,
                onCheckedChange = viewModel::updateAdyenLiveEnvironment,
            )
            if (state.adyenLiveEnvironment) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("EU", "US", "AU", "APSE").forEach { region ->
                        FilterChip(
                            selected = state.adyenLiveRegion.equals(region, ignoreCase = true),
                            onClick = { viewModel.updateAdyenLiveRegion(region) },
                            label = { Text(region) },
                        )
                    }
                }
            }
            SettingsSwitchRow(
                title = stringResource(R.string.adyen_use_legacy),
                checked = state.adyenUseLegacyEndpoint,
                onCheckedChange = viewModel::updateAdyenUseLegacyEndpoint,
            )
            OutlinedButton(
                onClick = viewModel::testAdyenConnection,
                enabled = !state.isTestingAdyen,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    if (state.isTestingAdyen) stringResource(R.string.testing_adyen)
                    else stringResource(R.string.test_adyen_connection),
                )
            }
        }
    }

    Spacer(Modifier.height(8.dp))
    HorizontalDivider(color = ui.border)
    Spacer(Modifier.height(8.dp))

    SettingsPageHeader(
        title = stringResource(R.string.payment_settings),
        subtitle = stringResource(R.string.payment_settings_page_subtitle),
    )

    SettingsSectionCard(
        title = stringResource(R.string.payment_methods),
        subtitle = stringResource(R.string.payment_methods_card_subtitle),
    ) {
        SettingsSwitchRow(
            title = stringResource(R.string.payment_cash),
            subtitle = stringResource(R.string.payment_cash_hint),
            checked = state.cashEnabled,
            onCheckedChange = viewModel::updateCashEnabled,
        )
        SettingsSwitchRow(
            title = stringResource(R.string.payment_card),
            subtitle = stringResource(R.string.payment_card_hint),
            checked = state.cardEnabled,
            onCheckedChange = viewModel::updateCardEnabled,
        )
        SettingsSwitchRow(
            title = stringResource(R.string.payment_terminal),
            subtitle = stringResource(R.string.payment_terminal_hint),
            checked = state.terminalEnabled,
            onCheckedChange = viewModel::updateTerminalEnabled,
        )
    }

    SettingsSectionCard(
        title = stringResource(R.string.payment_express),
        subtitle = stringResource(R.string.express_pay_placement_hint),
    ) {
        SettingsSwitchRow(
            title = stringResource(R.string.payment_express),
            checked = state.expressEnabled,
            onCheckedChange = viewModel::updateExpressEnabled,
        )
        Text(
            stringResource(R.string.express_pay_placement),
            fontWeight = FontWeight.SemiBold,
            color = ui.textPrimary,
            modifier = Modifier.padding(top = 8.dp),
        )
        SettingsSegmentedTwoChoice(
            optionA = stringResource(R.string.express_pay_placement_grid),
            optionB = stringResource(R.string.express_pay_placement_cart),
            selectedA = state.expressPayPlacement == ExpressPayPlacement.PRODUCT_GRID,
            onSelectA = { viewModel.updateExpressPayPlacement(ExpressPayPlacement.PRODUCT_GRID) },
            onSelectB = { viewModel.updateExpressPayPlacement(ExpressPayPlacement.CART) },
            modifier = Modifier.padding(top = 8.dp),
        )
    }

    SettingsSectionCard(
        title = stringResource(R.string.after_sale_destination),
        subtitle = stringResource(R.string.after_sale_destination_hint),
    ) {
        SettingsSegmentedTwoChoice(
            optionA = stringResource(R.string.pos_register),
            optionB = stringResource(R.string.pos_orders),
            selectedA = !state.afterSaleGoToOrders,
            onSelectA = { viewModel.updateAfterSaleGoToOrders(false) },
            onSelectB = { viewModel.updateAfterSaleGoToOrders(true) },
        )
    }

    SettingsSectionCard(
        title = stringResource(R.string.payment_retail_options),
        subtitle = stringResource(R.string.payment_retail_options_subtitle),
    ) {
        SettingsSwitchRow(
            title = stringResource(R.string.retail_cash_tender_dialog),
            subtitle = stringResource(R.string.retail_cash_tender_dialog_hint),
            checked = state.retailCashTenderDialogEnabled,
            onCheckedChange = viewModel::updateRetailCashTenderDialogEnabled,
        )
        SettingsSwitchRow(
            title = stringResource(R.string.payment_gift_cards),
            subtitle = stringResource(R.string.payment_gift_cards_hint),
            checked = state.giftCardsEnabled,
            onCheckedChange = viewModel::updateGiftCardsEnabled,
        )
        SettingsSwitchRow(
            title = stringResource(R.string.payment_invoice),
            subtitle = stringResource(R.string.payment_invoice_hint),
            checked = state.invoiceEnabled,
            onCheckedChange = viewModel::updateInvoiceEnabled,
            enabled = !state.paymentMethodsManagedByCloud,
        )
        if (state.paymentMethodsManagedByCloud) {
            Text(
                stringResource(R.string.payment_methods_managed_by_panel),
                style = MaterialTheme.typography.bodySmall,
                color = ui.textSecondary,
            )
        }
    }

    Spacer(Modifier.height(8.dp))
}
