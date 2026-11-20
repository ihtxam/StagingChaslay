package com.chaslay.pos.ui.appupdate

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.BuildConfig
import com.chaslay.pos.R
import com.chaslay.pos.ui.settings.SettingsPageHeader
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.posUiColors
import com.chaslay.pos.ui.theme.vectronColors
import com.chaslay.pos.update.AppUpdateCoordinator
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class AppUpdateViewModel @Inject constructor(
    private val appUpdateCoordinator: AppUpdateCoordinator,
) : ViewModel() {
    val isChecking = appUpdateCoordinator.isChecking

    fun checkForUpdate() {
        appUpdateCoordinator.checkForUpdate(manual = true)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppUpdateScreen(
    onBack: () -> Unit,
    viewModel: AppUpdateViewModel = hiltViewModel(),
) {
    val isChecking by viewModel.isChecking.collectAsStateWithLifecycle()
    val colors = vectronColors()
    val ui = posUiColors()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_update)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back),
                        )
                    }
                },
            )
        },
        containerColor = colors.background,
    ) { padding ->
        AppUpdatePanel(
            isChecking = isChecking,
            onCheckForUpdate = viewModel::checkForUpdate,
            showBackToPos = true,
            onBack = onBack,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp, vertical = 16.dp),
        )
    }
}

@Composable
fun AppUpdatePanel(
    isChecking: Boolean,
    onCheckForUpdate: () -> Unit,
    modifier: Modifier = Modifier,
    showBackToPos: Boolean = false,
    onBack: () -> Unit = {},
) {
    val ui = posUiColors()
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        SettingsPageHeader(
            title = stringResource(R.string.settings_section_update),
            subtitle = stringResource(R.string.app_update_screen_hint),
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(ui.surface, shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                stringResource(R.string.app_update_installed_version),
                fontWeight = FontWeight.SemiBold,
                color = ui.textPrimary,
            )
            Text(
                stringResource(
                    R.string.app_version_format,
                    BuildConfig.VERSION_NAME,
                    BuildConfig.VERSION_CODE,
                ),
                color = ui.textSecondary,
            )
        }
        if (isChecking) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator(color = PosColors.Primary)
                Text(
                    stringResource(R.string.app_update_checking),
                    modifier = Modifier.padding(top = 12.dp),
                    color = ui.textSecondary,
                )
            }
        } else {
            Button(
                onClick = onCheckForUpdate,
                modifier = Modifier.fillMaxWidth(),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = PosColors.Primary,
                    contentColor = PosColors.TextOnPrimary,
                ),
            ) {
                Icon(Icons.Default.SystemUpdate, contentDescription = null)
                Text(
                    stringResource(R.string.app_update_check),
                    modifier = Modifier.padding(start = 8.dp),
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (showBackToPos) {
                OutlinedButton(
                    onClick = onBack,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.back_to_pos))
                }
            }
        }
    }
}