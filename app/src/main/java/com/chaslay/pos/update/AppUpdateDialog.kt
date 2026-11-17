package com.chaslay.pos.update

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.PosColors

@Composable
fun AppUpdateDialog(
    state: AppUpdateDialogState?,
    onUpdateNow: () -> Unit,
    onLater: () -> Unit,
    onDismissError: () -> Unit,
    onOpenInstallPermission: () -> Unit,
    onRetryInstallPermission: () -> Unit,
) {
    when (state) {
        null -> Unit
        is AppUpdateDialogState.Offer -> AlertDialog(
            onDismissRequest = onLater,
            title = { Text(stringResource(R.string.app_update_title)) },
            text = {
                Text(
                    stringResource(
                        R.string.app_update_offer_body,
                        state.offer.versionName,
                        state.offer.versionCode,
                    ),
                )
            },
            confirmButton = {
                TextButton(onClick = onUpdateNow) {
                    Text(stringResource(R.string.app_update_now), fontWeight = FontWeight.SemiBold)
                }
            },
            dismissButton = {
                TextButton(onClick = onLater) {
                    Text(stringResource(R.string.app_update_later))
                }
            },
        )
        is AppUpdateDialogState.Downloading -> AlertDialog(
            onDismissRequest = { /* block dismiss while downloading */ },
            title = { Text(stringResource(R.string.app_update_downloading)) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    val total = state.contentLength
                    if (total != null && total > 0L) {
                        val progress = (state.bytesRead.toFloat() / total.toFloat()).coerceIn(0f, 1f)
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier.fillMaxWidth(),
                            color = PosColors.Primary,
                        )
                        Text(
                            text = stringResource(
                                R.string.app_update_download_progress,
                                formatMegabytes(state.bytesRead),
                                formatMegabytes(total),
                            ),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    } else {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth(), color = PosColors.Primary)
                        Text(
                            text = stringResource(
                                R.string.app_update_download_progress_indeterminate,
                                formatMegabytes(state.bytesRead),
                            ),
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            },
            confirmButton = {},
        )
        AppUpdateDialogState.InstallPermissionRequired -> AlertDialog(
            onDismissRequest = onDismissError,
            title = { Text(stringResource(R.string.app_update_install_permission_title)) },
            text = { Text(stringResource(R.string.app_update_install_permission_body)) },
            confirmButton = {
                TextButton(onClick = onOpenInstallPermission) {
                    Text(stringResource(R.string.app_update_open_settings))
                }
            },
            dismissButton = {
                TextButton(onClick = onRetryInstallPermission) {
                    Text(stringResource(R.string.app_update_retry))
                }
            },
        )
        is AppUpdateDialogState.Error -> AlertDialog(
            onDismissRequest = onDismissError,
            title = { Text(stringResource(R.string.app_update_title)) },
            text = { Text(state.message) },
            confirmButton = {
                TextButton(onClick = onDismissError) {
                    Text(stringResource(R.string.close))
                }
            },
        )
    }
}

private fun formatMegabytes(bytes: Long): String {
    val mb = bytes / (1024.0 * 1024.0)
    return String.format("%.1f MB", mb)
}
