package com.rebornsense.printbridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.widget.doAfterTextChanged
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.switchmaterial.SwitchMaterial
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.rebornsense.printbridge.print.DriverRegistry
import com.rebornsense.printbridge.print.PrinterEndpoint
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.BridgeHealthChecker
import com.rebornsense.printbridge.setup.OemSetupPreferences
import com.rebornsense.printbridge.setup.SetupWizardActivity
import com.rebornsense.printbridge.usb.UsbDeviceClassifier
import com.rebornsense.printbridge.usb.UsbHostPermissions
import com.rebornsense.printbridge.BuildConfig

class MainActivity : AppCompatActivity() {
    private val registry = DriverRegistry()
    private var pendingBluetoothTestPrint: PrinterEndpoint? = null
    private lateinit var printerAdapter: PrinterListAdapter
    private lateinit var emptyPrintersText: TextView
    private var pendingWizardLaunch = false
    private var autoWizardShownThisSession = false
    private var runtimePermissionsResolved = false
    private var notificationPermissionResolved = false
    private var printerScanInFlight = false
    private var healthProbeInFlight = false
    /** Set when resume wants a printer scan; honored by an in-flight health probe. */
    private var pendingLivePrinterScan = false
    private var suppressAutoStartListener = false
    private var crashDialog: AlertDialog? = null
    private var failureDialogFromStart = false
    private var shownPrinters: List<PrinterEndpoint> = emptyList()
    private var pendingUsbTestPrint: PrinterEndpoint? = null
    private var usbTestRetried = false
    private val serviceStatusHandler = Handler(Looper.getMainLooper())
    private val probeTasks = ArrayList<Runnable>()
    /** Invalidates in-flight Start probes when a newer status update begins. */
    private var statusEpoch = 0
    private var startInProgress = false

    private val wizardLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            pendingWizardLaunch = false
            updateTapToPayDiagnostics()
            if (result.resultCode == RESULT_OK) {
                scrollToPrinters()
            }
            refreshPrinters()
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            notificationPermissionResolved = true
            if (granted) {
                runtimePermissionsResolved = true
                BridgeSafeStart.markUiReady()
                onNotificationReadyUiOnly()
            } else {
                Toast.makeText(this, R.string.notification_permission_required, Toast.LENGTH_LONG).show()
            }
        }

    private val bluetoothPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            refreshPrintersSafely()
            val endpoint = pendingBluetoothTestPrint
            pendingBluetoothTestPrint = null
            if (endpoint != null) {
                if (hasBluetoothPermissions()) {
                    performTestPrint(endpoint)
                } else {
                    Toast.makeText(
                        this,
                        R.string.test_print_bluetooth_permission_denied,
                        Toast.LENGTH_LONG,
                    ).show()
                }
            }
        }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            // Legacy path — unused for cold start; kept for any older call sites.
            notificationPermissionResolved = true
            runtimePermissionsResolved = true
            BridgeSafeStart.markUiReady()
            onNotificationReadyUiOnly()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        OemSetupPreferences.syncInstalledVersion(this)
        runCatching {
            Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenBootstrap")
                .getMethod("register", AppCompatActivity::class.java)
                .invoke(null, this)
        }
        setContentView(R.layout.activity_main)
        applySystemBarInsets()
        updateVersionHeader()
        emptyPrintersText = findViewById(R.id.emptyPrintersText)
        printerAdapter = PrinterListAdapter(
            onSetDefault = { endpoint -> setDefaultPrinter(endpoint) },
            onTestPrint = { endpoint -> testPrint(endpoint) },
        )
        findViewById<RecyclerView>(R.id.printerRecycler).adapter = printerAdapter
        setupAutoStartSwitch()
        requestNeededPermissions()
        findViewById<MaterialButton>(R.id.refreshBtn).setOnClickListener { refreshPrinters() }
        findViewById<MaterialButton>(R.id.grantUsbBtn).setOnClickListener { requestUsbPrinterAccess() }
        findViewById<MaterialButton>(R.id.addLanBtn).setOnClickListener { showAddNetworkPrinterDialog() }
        findViewById<MaterialButton>(R.id.setupWizardBtn).setOnClickListener { openOemSetupWizard() }
        findViewById<MaterialButton>(R.id.startBridgeBtn).setOnClickListener { startBridgeManually() }
        handleUsbAttachIntent(intent)
        showLanPrintersNow()
        window.decorView.post {
            if (!isFinishing && !isDestroyed) showSavedCrashIfAny()
        }
    }

    /** After notifications are allowed: status text only — no USB/BT scan, no FGS. */
    private fun onNotificationReadyUiOnly() {
        if (isFinishing || isDestroyed) return
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_service_checking)
        findViewById<TextView>(R.id.hintText).text = getString(R.string.tap_start_bridge_hint)
        if (lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.RESUMED)) {
            refreshServiceStatusReadOnly()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleUsbAttachIntent(intent)
        consumeRefreshPrintersExtra(intent)
    }

    private fun consumeRefreshPrintersExtra(intent: Intent?) {
        if (intent?.getBooleanExtra(EXTRA_REFRESH_PRINTERS, false) != true) return
        intent.removeExtra(EXTRA_REFRESH_PRINTERS)
        refreshPrintersSafely()
    }

    /** Legacy extra from older builds; USB attach is handled by [UsbPrinterAttachActivity]. */
    private fun handleUsbAttachIntent(intent: Intent?) {
        if (!runtimePermissionsResolved) return
        val deviceId = intent?.getIntExtra(EXTRA_USB_DEVICE_ID, -1) ?: -1
        if (deviceId < 0) return
        intent?.removeExtra(EXTRA_USB_DEVICE_ID)
        val usb = getSystemService(UsbManager::class.java) ?: return
        val device = usb.deviceList.values.firstOrNull { it.deviceId == deviceId } ?: return
        if (!UsbDeviceClassifier.shouldOfferUsbAccessOnAttach(applicationContext, device)) return
        if (usb.hasPermission(device)) {
            refreshPrintersSafely()
            return
        }
        UsbHostPermissions.requestPermissionForDevice(this, device)
    }

    private fun applySystemBarInsets() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val scroll = findViewById<ScrollView>(R.id.mainScroll)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(view.paddingLeft, bars.top, view.paddingRight, bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(scroll)
    }

    override fun onStart() {
        super.onStart()
        BridgeSafeStart.mainActivityVisible = true
    }

    override fun onStop() {
        BridgeSafeStart.mainActivityVisible = false
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        UsbHostPermissions.register(this)
        UsbHostPermissions.onPermissionSettled = { onUsbPermissionSettled() }
        consumeRefreshPrintersExtra(intent)
        dropUnpluggedUsbFromList()
        if (runtimePermissionsResolved) {
            refreshServiceStatusReadOnly(scanPrinters = true)
        }
    }

    override fun onDestroy() {
        if (UsbHostPermissions.onPermissionSettled != null) {
            UsbHostPermissions.onPermissionSettled = null
        }
        BridgeSafeStart.cancelPending()
        clearProbeTasks()
        runCatching { crashDialog?.dismiss() }
        crashDialog = null
        super.onDestroy()
    }

    private fun updateVersionHeader() {
        val label = getString(R.string.bridge_version_label, BuildConfig.VERSION_NAME)
        findViewById<TextView>(R.id.versionText).text = label
        title = getString(R.string.app_name)
    }

    private fun maybeLaunchOemWizard() {
        if (!runtimePermissionsResolved) return
        if (pendingWizardLaunch) return
        if (autoWizardShownThisSession) return
        if (OemSetupPreferences.isWizardCompleted(this)) return
        pendingWizardLaunch = true
        autoWizardShownThisSession = true
        runCatching { openOemSetupWizard() }
            .onFailure {
                pendingWizardLaunch = false
                autoWizardShownThisSession = false
                Toast.makeText(this, R.string.oem_setup_launch_failed, Toast.LENGTH_LONG).show()
            }
    }

    private fun openOemSetupWizard() {
        wizardLauncher.launch(SetupWizardActivity.createIntent(this))
    }

    private fun scrollToPrinters() {
        val scroll = findViewById<ScrollView>(R.id.mainScroll)
        val target = findViewById<View>(R.id.printersCard)
        scroll.post { scroll.smoothScrollTo(0, target.top) }
    }

    private fun updateTapToPayDiagnostics(cachedHealth: BridgeHealthChecker.HealthSnapshot? = null) {
        val card = findViewById<View>(R.id.tapToPayDiagnosticsCard)
        val text = findViewById<TextView>(R.id.tapToPayDiagnosticsText)
        if (!BuildConfig.HAS_ADYEN_SDK) {
            card.visibility = View.GONE
            return
        }
        if (cachedHealth != null) {
            applyTapToPayDiagnostics(card, text, cachedHealth)
            return
        }
        Thread {
            val health = BridgeHealthChecker.probeResult().snapshot
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                applyTapToPayDiagnostics(card, text, health)
            }
        }.start()
    }

    private fun applyTapToPayDiagnostics(
        card: View,
        text: TextView,
        health: BridgeHealthChecker.HealthSnapshot?,
    ) {
        val ready = health?.tapToPayReady == true
        if (ready) {
            card.visibility = View.GONE
            return
        }
        card.visibility = View.VISIBLE
        val message = health?.tapToPayMessage ?: getString(R.string.tap_to_pay_ready_unknown)
        text.text = getString(R.string.tap_to_pay_setup_hint, message)
    }

    private fun requestNeededPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        notificationPermissionResolved = true
        runtimePermissionsResolved = true
        BridgeSafeStart.markUiReady()
        onNotificationReadyUiOnly()
    }

    private fun hasBluetoothPermissions(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        return bluetoothPermissionsNeeded().isEmpty()
    }

    private fun bluetoothPermissionsNeeded(): List<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return emptyList()
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.BLUETOOTH_CONNECT
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.BLUETOOTH_SCAN
        }
        return needed
    }

    private fun startBridgeManually() {
        if (!BridgePermissions.hasNotificationPermission(this)) {
            requestNeededPermissions()
            return
        }
        UsbHostPermissions.register(this)
        BridgeSafeStart.markUiReady()
        val epoch = beginStatusEpoch()
        startInProgress = true
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_service_checking)
        Thread {
            val before = runCatching { BridgeHealthChecker.probeResult() }.getOrElse { error ->
                BridgeHealthChecker.ProbeOutcome(failureReason = error.message ?: error.javaClass.simpleName)
            }
            runOnUiThread {
                if (!epochLive(epoch)) return@runOnUiThread
                if (before.snapshot != null) {
                    // Already listening. Do not start, stop, or show a failure dialog.
                    applyBridgeReady(before.snapshot, scanPrinters = true)
                    return@runOnUiThread
                }
                findViewById<TextView>(R.id.statusText).text = getString(R.string.status_starting)
                Toast.makeText(this, R.string.bridge_start_requested, Toast.LENGTH_SHORT).show()
                val invoked = BridgeSafeStart.startNow(this, bypassDebounce = true)
                val startNote = if (invoked) {
                    null
                } else {
                    BridgeCrashLog.lastReason(this) ?: "startForegroundService was not invoked"
                }
                // One start attempt. Probes only — never call startForegroundService again.
                scheduleHealthProbes(epoch, startNote)
            }
        }.start()
    }

    /**
     * Read-only /health when the activity is shown. Does not start or stop the service.
     */
    private fun refreshServiceStatusReadOnly(scanPrinters: Boolean = false) {
        if (scanPrinters) pendingLivePrinterScan = true
        if (startInProgress || isFinishing || isDestroyed) return
        val epoch = statusEpoch
        if (healthProbeInFlight) return
        healthProbeInFlight = true
        Thread {
            val result = runCatching { BridgeHealthChecker.probeResult() }.getOrNull()
            runOnUiThread {
                healthProbeInFlight = false
                if (!epochLive(epoch) || startInProgress) return@runOnUiThread
                val snapshot = result?.snapshot
                if (snapshot != null) {
                    val scan = pendingLivePrinterScan
                    pendingLivePrinterScan = false
                    applyBridgeReady(snapshot, scanPrinters = scan)
                } else {
                    applyBridgeDownQuiet()
                }
            }
        }.start()
    }

    /** Try /health at about 1s, 2s, and 4s after Start. Any success means the bridge is ready. */
    private fun scheduleHealthProbes(epoch: Int, startNote: String?) {
        clearProbeTasks()
        val reasons = ArrayList<String>()
        if (!startNote.isNullOrBlank()) reasons += startNote.trim()
        var pending = START_PROBE_DELAYS_MS.size
        START_PROBE_DELAYS_MS.forEach { delayMs ->
            val task = Runnable {
                if (!epochLive(epoch)) return@Runnable
                Thread {
                    val result = runCatching { BridgeHealthChecker.probeResult() }.getOrElse { error ->
                        BridgeHealthChecker.ProbeOutcome(
                            failureReason = error.message ?: error.javaClass.simpleName,
                        )
                    }
                    runOnUiThread {
                        if (!epochLive(epoch)) return@runOnUiThread
                        val snapshot = result.snapshot
                        if (snapshot != null) {
                            applyBridgeReady(snapshot, scanPrinters = true)
                            return@runOnUiThread
                        }
                        val reason = result.failureReason?.trim().orEmpty().ifBlank { "health check failed" }
                        if (reason !in reasons) reasons += reason
                        pending -= 1
                        if (pending <= 0) {
                            showStartFailure(reasons.joinToString("\n"))
                        }
                    }
                }.start()
            }
            probeTasks += task
            serviceStatusHandler.postDelayed(task, delayMs)
        }
    }

    private fun beginStatusEpoch(): Int {
        clearProbeTasks()
        statusEpoch += 1
        return statusEpoch
    }

    private fun epochLive(epoch: Int): Boolean {
        return epoch == statusEpoch && !isFinishing && !isDestroyed
    }

    private fun clearProbeTasks() {
        probeTasks.forEach { serviceStatusHandler.removeCallbacks(it) }
        probeTasks.clear()
    }

    private fun applyBridgeReady(
        health: BridgeHealthChecker.HealthSnapshot,
        scanPrinters: Boolean = false,
    ) {
        clearProbeTasks()
        statusEpoch += 1
        startInProgress = false
        if (failureDialogFromStart) {
            runCatching { crashDialog?.dismiss() }
            crashDialog = null
            failureDialogFromStart = false
        }
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_ready)
        findViewById<TextView>(R.id.hintText).text = getString(R.string.main_hint_short)
        findViewById<View>(R.id.serviceStatusIndicator)
            .setBackgroundResource(R.drawable.service_status_running)
        updateTapToPayDiagnostics(health)
        if (scanPrinters) refreshPrintersSafely()
    }

    /** Resume probe found the server down. Red dot only — no dialog, no stopService. */
    private fun applyBridgeDownQuiet() {
        if (isFinishing || isDestroyed) return
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_service_stopped)
        findViewById<TextView>(R.id.hintText).text = getString(R.string.tap_start_bridge_hint)
        findViewById<View>(R.id.serviceStatusIndicator)
            .setBackgroundResource(R.drawable.service_status_stopped)
    }

    /** Adds saved LAN hosts without dropping USB, Bluetooth, or built-in rows. */
    private fun showLanPrintersNow() {
        val lan = com.rebornsense.printbridge.print.NetworkRawDriver().discover(applicationContext)
        val defaultId = PrinterPreferences.getDefaultPrinterId(this)
        val kept = shownPrinters.filter { it.connectionType != "lan" }
        publishPrinters((kept + lan).distinctBy { it.id }, defaultId)
    }

    private fun publishPrinters(printers: List<PrinterEndpoint>, defaultId: String?) {
        val deduped = dedupeDisplayedPrinters(withoutUnpluggedUsb(printers))
        val marked = deduped.map { ep -> ep.copy(isDefault = ep.id == defaultId) }.let { list ->
            if (list.none { it.isDefault } && list.isNotEmpty()) {
                list.mapIndexed { index, ep -> ep.copy(isDefault = index == 0) }
            } else {
                list
            }
        }
        shownPrinters = marked
        printerAdapter.submit(marked, defaultId)
        emptyPrintersText.visibility = if (marked.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun refreshPrintersSafely() {
        if (printerScanInFlight) return
        printerScanInFlight = true
        val previous = shownPrinters.toList()
        val scan = Thread {
            val result = runCatching {
                UsbHostPermissions.recordGrantedDevices(applicationContext)
                val printers = registry.refresh(applicationContext)
                val usbOk = registry.didUsbDiscoverSucceed()
                val defaultId = PrinterPreferences.getDefaultPrinterId(this@MainActivity)
                Triple(printers, defaultId, usbOk)
            }
            runOnUiThread {
                printerScanInFlight = false
                if (isFinishing || isDestroyed) return@runOnUiThread
                result.onSuccess { (printers, defaultId, usbOk) ->
                    val next = if (usbOk) {
                        printers
                    } else {
                        mergeKeepingUsb(previous, printers)
                    }
                    publishPrinters(next, defaultId)
                }.onFailure {
                    val defaultId = PrinterPreferences.getDefaultPrinterId(this)
                    publishPrinters(previous, defaultId)
                    Toast.makeText(this, R.string.printer_scan_failed, Toast.LENGTH_SHORT).show()
                }
            }
        }
        scan.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { thread, error ->
            BridgeCrashLog.record(applicationContext, error, "printer scan ${thread.name}")
            runOnUiThread {
                printerScanInFlight = false
            }
        }
        scan.start()
    }

    /**
     * USB scan failed. Keep a previous USB row only when that device is still in
     * [UsbManager.getDeviceList]. Remembered vid:pid values are not rows.
     */
    private fun mergeKeepingUsb(
        previous: List<PrinterEndpoint>,
        discovered: List<PrinterEndpoint>,
    ): List<PrinterEndpoint> {
        val rest = discovered.filter { it.connectionType != "usb" }
        val usb = (previous + discovered).filter { it.connectionType == "usb" }
        return (usb + rest).distinctBy { it.id }
    }

    private fun dropUnpluggedUsbFromList() {
        if (!::printerAdapter.isInitialized) return
        if (shownPrinters.none { it.connectionType == "usb" }) return
        publishPrinters(shownPrinters, PrinterPreferences.getDefaultPrinterId(this))
    }

    /**
     * USB rows require a live [UsbManager] device. If deviceList cannot be read,
     * drop USB rows instead of keeping an unplugged printer. LAN rows stay.
     */
    private fun withoutUnpluggedUsb(printers: List<PrinterEndpoint>): List<PrinterEndpoint> {
        if (printers.none { it.connectionType == "usb" }) return printers
        val attached = runCatching {
            val usb = getSystemService(UsbManager::class.java) ?: return@runCatching emptySet<String>()
            usb.deviceList.values.map { device -> "${device.vendorId}:${device.productId}" }.toSet()
        }.getOrElse { emptySet() }
        return printers.filter { endpoint ->
            if (endpoint.connectionType != "usb") return@filter true
            val vid = endpoint.meta["vendorId"]?.trim().orEmpty()
            val pid = endpoint.meta["productId"]?.trim().orEmpty()
            vid.isNotEmpty() && pid.isNotEmpty() && "$vid:$pid" in attached
        }
    }

    private fun refreshPrinters() {
        refreshPrintersSafely()
    }

    private fun onUsbPermissionSettled() {
        if (isFinishing || isDestroyed) return
        val pending = pendingUsbTestPrint
        pendingUsbTestPrint = null
        refreshPrintersSafely()
        if (pending == null || usbTestRetried) return
        usbTestRetried = true
        val device = registry.locateUsbDevice(this, pending)
        when {
            device == null -> Toast.makeText(this, "USB printer not found", Toast.LENGTH_LONG).show()
            UsbHostPermissions.hasPermission(this, device) -> performTestPrint(pending)
            else -> Toast.makeText(this, usbPermissionDeniedMessage(pending), Toast.LENGTH_LONG).show()
        }
    }

    private fun showSavedCrashIfAny() {
        val text = runCatching { BridgeCrashLog.read(this) }.getOrNull() ?: return
        if (text.isBlank()) return
        failureDialogFromStart = false
        showCrashLogDialog(text)
    }

    /**
     * Shown only after every Start probe failed. A failed probe does not stop the service.
     * [probeReason] is the health-check detail (timeout, connection refused, HTTP code, body).
     */
    private fun showStartFailure(probeReason: String? = null) {
        if (isFinishing || isDestroyed) return
        clearProbeTasks()
        startInProgress = false
        statusEpoch += 1
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_start_failed)
        findViewById<TextView>(R.id.hintText).text = getString(R.string.tap_start_bridge_hint)
        findViewById<View>(R.id.serviceStatusIndicator)
            .setBackgroundResource(R.drawable.service_status_stopped)
        val probe = probeReason?.trim().orEmpty()
        val log = runCatching { BridgeCrashLog.read(this) }.getOrNull()?.trim().orEmpty()
        val body = when {
            probe.isNotBlank() && log.isNotBlank() && !log.contains(probe) -> "$probe\n\n$log"
            probe.isNotBlank() -> getString(R.string.bridge_service_did_not_stay_reason, probe)
            log.isNotBlank() -> log
            else -> getString(R.string.bridge_service_did_not_stay)
        }
        failureDialogFromStart = true
        Toast.makeText(this, R.string.bridge_start_failed_see_log, Toast.LENGTH_LONG).show()
        window.decorView.post {
            if (!isFinishing && !isDestroyed && failureDialogFromStart) showCrashLogDialog(body)
        }
    }

    private fun showCrashLogDialog(text: String) {
        if (isFinishing || isDestroyed) return
        val body = text.trim().ifBlank { getString(R.string.bridge_service_did_not_stay) }
        runCatching { crashDialog?.dismiss() }
        val shown = runCatching {
            presentCrashDialog(body, useMessage = false)
            true
        }.getOrElse { error ->
            Log.e(TAG, "Could not show crash log view", error)
            false
        }
        if (shown) return
        runCatching { presentCrashDialog(body.take(3500), useMessage = true) }
            .onFailure { error -> Log.e(TAG, "Could not show crash log", error) }
    }

    private fun presentCrashDialog(body: String, useMessage: Boolean) {
        val builder = AlertDialog.Builder(this)
            .setTitle(getString(R.string.crash_log_title, BuildConfig.VERSION_NAME))
            .setNegativeButton(android.R.string.ok, null)
        if (!useMessage) {
            val scroll = ScrollView(this)
            val textView = TextView(this).apply {
                this.text = body
                setTextIsSelectable(true)
                typeface = Typeface.MONOSPACE
                textSize = 12f
                setPadding(48, 32, 48, 32)
            }
            scroll.addView(
                textView,
                ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
            builder.setView(scroll)
                .setPositiveButton(R.string.crash_log_clear) { _, _ ->
                    runCatching { BridgeCrashLog.clear(this) }
                }
        } else {
            builder.setMessage(body)
        }
        val dialog = builder.create()
        crashDialog = dialog
        dialog.show()
    }

    private fun requestUsbPrinterAccess() {
        if (!runtimePermissionsResolved) {
            Toast.makeText(this, R.string.usb_grant_wait_permissions, Toast.LENGTH_SHORT).show()
            return
        }
        val requested = UsbHostPermissions.requestNextMissingPermission(this)
        if (!requested) {
            Toast.makeText(this, R.string.usb_grant_none_pending, Toast.LENGTH_LONG).show()
        }
        refreshPrinters()
    }

    private fun setupAutoStartSwitch() {
        val autoStartSwitch = findViewById<SwitchMaterial>(R.id.autoStartSwitch)
        suppressAutoStartListener = true
        autoStartSwitch.isChecked = PrinterPreferences.isAutoStartEnabled(this)
        suppressAutoStartListener = false
        autoStartSwitch.setOnCheckedChangeListener { _, isChecked ->
            if (suppressAutoStartListener) return@setOnCheckedChangeListener
            PrinterPreferences.setAutoStartEnabled(this, isChecked)
            if (isChecked) {
                if (BridgePermissions.hasNotificationPermission(this)) {
                    startBridgeManually()
                }
                Toast.makeText(this, R.string.auto_start_enabled_toast, Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, R.string.auto_start_disabled_toast, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setDefaultPrinter(endpoint: PrinterEndpoint) {
        PrinterPreferences.setDefaultPrinterId(this, endpoint.id)
        Toast.makeText(
            this,
            getString(R.string.default_set, PrinterDisplay.title(endpoint)),
            Toast.LENGTH_SHORT,
        ).show()
        refreshPrinters()
    }

    private fun showAddNetworkPrinterDialog() {
        val inputLayout = TextInputLayout(this).apply {
            hint = getString(R.string.lan_printer_hint)
            setPadding(48, 24, 48, 0)
        }
        val input = TextInputEditText(inputLayout.context).apply {
            inputType = android.text.InputType.TYPE_CLASS_TEXT
        }
        inputLayout.addView(input)
        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.add_network_printer)
            .setMessage(R.string.lan_printer_dialog_message)
            .setView(inputLayout)
            .setPositiveButton(R.string.add, null)
            .setNegativeButton(android.R.string.cancel, null)
            .create()
        dialog.setOnShowListener {
            val positive = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            positive.isEnabled = false
            input.doAfterTextChanged { text ->
                positive.isEnabled = !text.isNullOrBlank()
            }
            positive.setOnClickListener {
                val raw = input.text?.toString()?.trim().orEmpty()
                val host = PrinterPreferences.normalizeLanHost(raw)
                if (host == null) {
                    Toast.makeText(this, R.string.lan_printer_invalid, Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                PrinterPreferences.addLanHost(this, host)
                showLanPrintersNow()
                refreshPrintersSafely()
                Toast.makeText(this, R.string.lan_printer_added, Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
        }
        dialog.show()
    }

    private fun testPrint(endpoint: PrinterEndpoint) {
        if (endpoint.connectionType == "bluetooth" && !hasBluetoothPermissions()) {
            pendingBluetoothTestPrint = endpoint
            bluetoothPermissionLauncher.launch(bluetoothPermissionsNeeded().toTypedArray())
            return
        }
        if (endpoint.connectionType == "usb" && !prepareUsbTestPrint(endpoint)) {
            return
        }
        performTestPrint(endpoint)
    }

    /**
     * @return true when USB permission is already granted and the test should run now.
     * A missing permission opens the system dialog and retries once from [onUsbPermissionSettled].
     */
    private fun prepareUsbTestPrint(endpoint: PrinterEndpoint): Boolean {
        val device = registry.locateUsbDevice(this, endpoint)
        if (device == null) {
            Toast.makeText(this, "USB printer not found", Toast.LENGTH_LONG).show()
            return false
        }
        if (UsbHostPermissions.hasPermission(this, device)) return true
        pendingUsbTestPrint = endpoint
        usbTestRetried = false
        UsbHostPermissions.requestPermissionForDevice(this, device)
        if (UsbHostPermissions.hasPermission(this, device)) {
            pendingUsbTestPrint = null
            return true
        }
        if (!UsbHostPermissions.isRequestPending()) {
            pendingUsbTestPrint = null
            Toast.makeText(this, usbPermissionDeniedMessage(endpoint), Toast.LENGTH_LONG).show()
        }
        return false
    }

    private fun usbPermissionDeniedMessage(endpoint: PrinterEndpoint): String {
        return "USB permission not granted for ${endpoint.name} — open Bridge Reborn and allow USB access"
    }

    private fun performTestPrint(endpoint: PrinterEndpoint) {
        val driver = registry.driverFor(endpoint) ?: run {
            Toast.makeText(this, R.string.test_print_failed, Toast.LENGTH_SHORT).show()
            return
        }
        val sample = buildTestTicket()
        testRowBtnEnabled(false)
        Thread {
            val result = driver.print(applicationContext, endpoint, sample)
            runOnUiThread {
                testRowBtnEnabled(true)
                if (result.isSuccess) {
                    Toast.makeText(
                        this,
                        getString(R.string.test_print_ok, PrinterDisplay.title(endpoint)),
                        Toast.LENGTH_SHORT,
                    ).show()
                } else {
                    val message = friendlyPrintError(result.exceptionOrNull())
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
            }
        }.start()
    }

    private fun testRowBtnEnabled(enabled: Boolean) {
        findViewById<RecyclerView>(R.id.printerRecycler).isEnabled = enabled
    }

    private fun friendlyPrintError(error: Throwable?): String {
        val raw = error?.message?.trim().orEmpty()
        if (raw.isBlank()) return getString(R.string.test_print_failed)
        return when {
            raw.contains("socket", ignoreCase = true) && raw.contains("closed", ignoreCase = true) ->
                getString(R.string.test_print_socket_closed)
            raw.contains("BLUETOOTH_SCAN", ignoreCase = true) ||
                raw.contains("BLUETOOTH_CONNECT", ignoreCase = true) ->
                getString(R.string.test_print_bluetooth_permission_denied)
            raw.contains("Bluetooth", ignoreCase = true) ->
                getString(R.string.test_print_bluetooth_failed, raw)
            else -> raw
        }
    }

    private fun buildTestTicket(): ByteArray {
        val text = "Bridge Reborn\nTest print OK\n\n"
        val init = byteArrayOf(0x1B, 0x40)
        val feed = byteArrayOf(0x0A, 0x0A, 0x0A)
        val cut = byteArrayOf(0x1D, 0x56, 0x00)
        return init + text.toByteArray(Charsets.UTF_8) + feed + cut
    }

    companion object {
        const val EXTRA_USB_DEVICE_ID = "usb_device_id"
        const val EXTRA_REFRESH_PRINTERS = "refresh_printers"
        private const val TAG = "MainActivity"
        private val START_PROBE_DELAYS_MS = longArrayOf(1_000L, 2_000L, 4_000L)
    }
}

private fun dedupeDisplayedPrinters(printers: List<PrinterEndpoint>): List<PrinterEndpoint> {
    val seen = LinkedHashSet<String>()
    val out = ArrayList<PrinterEndpoint>(printers.size)
    for (endpoint in printers) {
        val key = displayKey(endpoint)
        if (seen.add(key)) out += endpoint
    }
    return out
}

private fun displayKey(endpoint: PrinterEndpoint): String {
    if (endpoint.connectionType != "usb") return endpoint.id
    val vid = endpoint.meta["vendorId"]?.trim().orEmpty()
    val pid = endpoint.meta["productId"]?.trim().orEmpty()
    if (vid.isEmpty() || pid.isEmpty()) return endpoint.id
    return "usb:$vid:$pid"
}
