package com.chaslay.pos

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.chaslay.pos.data.preferences.SessionManager
import com.chaslay.pos.data.repository.LicenseRepository
import com.chaslay.pos.payment.taptopay.TapToPayEngine
import com.chaslay.pos.domain.model.LicenseGateState
import com.chaslay.pos.domain.model.PosThemeMode
import com.chaslay.pos.sync.FloorSyncCoordinator
import com.chaslay.pos.sync.PosSessionRepository
import com.chaslay.pos.sync.SyncService
import com.chaslay.pos.ui.license.ActivationScreen
import com.chaslay.pos.ui.navigation.ChaslayNavHost
import com.chaslay.pos.ui.scanner.BarcodeWedgeHub
import com.chaslay.pos.ui.theme.ChaslayPosTheme
import com.chaslay.pos.ui.theme.ProvideVectronTheme
import com.chaslay.pos.ui.theme.ChaslayBrand
import com.chaslay.pos.ui.theme.rebornLoginBackground
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    @Inject lateinit var sessionManager: SessionManager
    @Inject lateinit var syncService: SyncService
    @Inject lateinit var licenseRepository: LicenseRepository
    @Inject lateinit var floorSyncCoordinator: FloorSyncCoordinator
    @Inject lateinit var posSessionRepository: PosSessionRepository
    @Inject lateinit var tapToPayEngine: TapToPayEngine

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* alerts enabled when granted */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        requestNotificationPermissionIfNeeded()

        // Register the Tap to Pay result listener before this activity reaches
        // RESUMED, because sale results are delivered through it. Inert in builds
        // without the Adyen SDK.
        tapToPayEngine.registerForPaymentResult(this)

        // The Adyen SDK can only bind its service from the foreground, so finish
        // initialization once this activity is RESUMED rather than at app startup.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.RESUMED) {
                tapToPayEngine.initializeWhileVisible(this@MainActivity)
            }
        }

        lifecycleScope.launch {
            runCatching { licenseRepository.ensureInitialized() }
            runCatching { syncService.syncAll(force = false) }
        }

        floorSyncCoordinator.start(lifecycleScope)
        posSessionRepository.startHeartbeat(lifecycleScope)

        setContent {
            val userAccess by sessionManager.currentUserAccess.collectAsStateWithLifecycle(initialValue = null)
            val themeMode by sessionManager.posThemeMode.collectAsStateWithLifecycle(initialValue = PosThemeMode.LIGHT)
            val licenseState by licenseRepository.uiState.collectAsStateWithLifecycle(
                initialValue = com.chaslay.pos.domain.model.LicenseUiState()
            )
            val darkTheme = themeMode == PosThemeMode.DARK

            ChaslayPosTheme(darkTheme = darkTheme) {
                ProvideVectronTheme(darkTheme = darkTheme) {
                    // Keep keypad / checkout / PIN controls above the Android nav bar on all screens.
                    Box(modifier = Modifier.fillMaxSize().systemBarsPadding()) {
                        when (licenseState.gateState) {
                            LicenseGateState.LOADING -> {
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .rebornLoginBackground(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = ChaslayBrand.WarmWhite)
                                }
                            }
                            LicenseGateState.NEEDS_ACTIVATION, LicenseGateState.EXPIRED -> {
                                ActivationScreen()
                            }
                            else -> {
                                if (userAccess == null) {
                                    com.chaslay.pos.ui.auth.LoginScreen(
                                        onLoggedIn = { /* reactive via session flow */ }
                                    )
                                } else {
                                    ChaslayNavHost(
                                        userAccess = userAccess
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (BarcodeWedgeHub.dispatch(event, currentFocus)) return true
        return super.dispatchKeyEvent(event)
    }

    override fun onDestroy() {
        floorSyncCoordinator.stop()
        super.onDestroy()
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}
