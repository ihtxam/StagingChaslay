package com.chaslay.pos.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FloorConnectionMode
import com.chaslay.pos.domain.model.FloorDeviceRole
import com.chaslay.pos.ui.theme.posUiColors

@Composable
internal fun SettingsFloorDevicesSection(
    state: SettingsUiState,
    viewModel: SettingsViewModel,
) {
    val ui = posUiColors()

    SettingsPageHeader(
        title = stringResource(R.string.floor_sync_settings),
        subtitle = stringResource(R.string.floor_sync_help),
    )
    SettingsSaveTopBar(onSave = viewModel::saveSettings)

    SettingsSectionCard(
        title = stringResource(R.string.floor_sync_settings),
        subtitle = stringResource(R.string.floor_sync_help),
    ) {
        SettingsSwitchRow(
            title = stringResource(R.string.floor_sync_enabled),
            checked = state.floorSyncEnabled,
            onCheckedChange = viewModel::updateFloorSyncEnabled,
        )
        if (state.floorSyncEnabled) {
            Text(
                stringResource(R.string.floor_device_role),
                fontWeight = FontWeight.SemiBold,
                color = ui.textPrimary,
                modifier = Modifier.padding(top = 8.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FloorDeviceRole.entries.forEach { role ->
                    FilterChip(
                        selected = state.floorDeviceRole == role,
                        onClick = { viewModel.updateFloorDeviceRole(role) },
                        label = {
                            Text(
                                when (role) {
                                    FloorDeviceRole.MAIN_POS -> stringResource(R.string.floor_role_main_pos)
                                    FloorDeviceRole.WAITER -> stringResource(R.string.floor_role_waiter)
                                    FloorDeviceRole.STANDARD -> stringResource(R.string.floor_role_standard)
                                },
                            )
                        },
                    )
                }
            }
            if (state.floorDeviceRole == FloorDeviceRole.MAIN_POS) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(stringResource(R.string.local_lan_url), fontWeight = FontWeight.SemiBold)
                Text(
                    state.localLanUrl ?: stringResource(R.string.local_lan_url_unknown),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                )
                Text(stringResource(R.string.local_lan_url_help), style = MaterialTheme.typography.bodySmall)
                TextButton(onClick = viewModel::refreshLocalLanUrl) {
                    Text(stringResource(R.string.refresh_lan_address))
                }
            }
            if (state.floorDeviceRole == FloorDeviceRole.WAITER) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(stringResource(R.string.floor_connection_mode), fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FloorConnectionMode.entries.forEach { mode ->
                        FilterChip(
                            selected = state.floorConnectionMode == mode,
                            onClick = { viewModel.updateFloorConnectionMode(mode) },
                            label = {
                                Text(
                                    when (mode) {
                                        FloorConnectionMode.AUTO -> stringResource(R.string.floor_connection_auto)
                                        FloorConnectionMode.LAN_ONLY -> stringResource(R.string.floor_connection_lan)
                                        FloorConnectionMode.CLOUD_ONLY -> stringResource(R.string.floor_connection_cloud)
                                    },
                                )
                            },
                        )
                    }
                }
                Text(stringResource(R.string.floor_connection_mode_help), style = MaterialTheme.typography.bodySmall)
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = state.mainPosLanUrl,
                    onValueChange = viewModel::updateMainPosLanUrl,
                    label = { Text(stringResource(R.string.main_pos_lan_url)) },
                    placeholder = { Text("http://192.168.1.50:8787") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { viewModel.commitMainPosLanUrl() }),
                )
                Text(stringResource(R.string.main_pos_lan_url_help), style = MaterialTheme.typography.bodySmall)
                OutlinedButton(
                    onClick = viewModel::commitMainPosLanUrl,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.save))
                }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    OutlinedButton(
                        onClick = viewModel::discoverMainPos,
                        enabled = !state.isDiscoveringMainPos,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(
                            if (state.isDiscoveringMainPos) {
                                stringResource(R.string.discovering_main_pos)
                            } else {
                                stringResource(R.string.discover_main_pos)
                            },
                        )
                    }
                    OutlinedButton(
                        onClick = viewModel::testMainPosConnection,
                        enabled = !state.isTestingMainPos,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(
                            if (state.isTestingMainPos) {
                                stringResource(R.string.testing_connection)
                            } else {
                                stringResource(R.string.test_main_pos_connection)
                            },
                        )
                    }
                }
            }
        }
    }
    Spacer(Modifier.height(8.dp))
}
