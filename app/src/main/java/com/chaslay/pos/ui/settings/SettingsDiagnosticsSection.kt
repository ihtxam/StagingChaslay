package com.chaslay.pos.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.PosColors

@Composable
fun SettingsDiagnosticsSection(
    state: SettingsUiState,
    onUpload: () -> Unit,
    onShare: () -> Unit,
    onClearCrashFiles: () -> Unit,
    onSelectCrashLog: (String) -> Unit,
    showPageHeader: Boolean = true,
) {
    if (showPageHeader) {
        SettingsPageHeader(
            title = stringResource(R.string.settings_section_diagnostics),
            subtitle = stringResource(R.string.diagnostics_page_subtitle),
        )
    }

    SettingsSectionCard(
        title = stringResource(R.string.diagnostics_last_upload),
        icon = Icons.Outlined.BugReport,
    ) {
        Text(
            state.diagnosticsApiHostLabel,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            state.diagnosticsLastUploadLabel,
            modifier = Modifier.fillMaxWidth(),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
        )
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = onUpload,
                enabled = !state.diagnosticsUploadInProgress,
                modifier = Modifier.fillMaxWidth(),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary,
                ),
            ) {
                if (state.diagnosticsUploadInProgress) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = PosColors.TextOnPrimary,
                        )
                        Text(stringResource(R.string.diagnostics_uploading))
                    }
                } else {
                    Text(stringResource(R.string.diagnostics_upload_to_support))
                }
            }
            OutlinedButton(onClick = onShare, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.diagnostics_share_logs))
            }
        }
    }

    SettingsSectionCard(title = stringResource(R.string.diagnostics_session_log)) {
        Text(
            state.diagnosticsSessionPreview.ifBlank { "—" },
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            lineHeight = 14.sp,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 220.dp)
                .verticalScroll(rememberScrollState()),
        )
    }

    if (state.crashLogs.isNotEmpty()) {
        SettingsSectionCard(title = stringResource(R.string.diagnostics_crash_files)) {
            state.crashLogs.take(12).forEach { entry ->
                OutlinedButton(
                    onClick = { onSelectCrashLog(entry.fileName) },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(entry.fileName, fontSize = 12.sp)
                }
            }
            if (state.selectedCrashLog != null && state.crashLogContent.isNotBlank()) {
                Text(
                    state.crashLogContent.take(4_000),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp)
                        .verticalScroll(rememberScrollState()),
                )
            }
            OutlinedButton(onClick = onClearCrashFiles, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.diagnostics_clear_local_logs))
            }
        }
    }
}
