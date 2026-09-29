package com.rebornsense.printbridge

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
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
import com.rebornsense.printbridge.PrintBridgeLauncher
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
    private var suppressAutoStartListener = false
    private val serviceStatusHandler = Handler(Looper.getMainLooper())
    private val serviceStatusRunnable = object : Runnable {
        override fun run() {
            updateServiceStatus()
            serviceStatusHandler.postDelayed(this, SERVICE_STATUS_INTERVAL_MS)
        }
    }

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
    }

    /** After notifications are allowed: update status text only — no USB/BT scan, no FGS (Nebullus crash). */
    private fun onNotificationReadyUiOnly() {
        if (isFinishing || isDestroyed) return
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_starting)
        findViewById<TextView>(R.id.hintText).text = getString(R.string.tap_start_bridge_hint)
        findViewById<View>(R.id.serviceStatusIndicator)
            .setBackgroundResource(R.drawable.service_status_stopped)
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
        UsbHostPermissions.onPermissionSettled = {
            if (!isFinishing && !isDestroyed) refreshPrintersSafely()
        }
        consumeRefreshPrintersExtra(intent)
        if (notificationPermissionResolved) {
            updateServiceStatus()
        }
        serviceStatusHandler.postDelayed(serviceStatusRunnable, SERVICE_STATUS_INTERVAL_MS)
    }

    override fun onPause() {
        serviceStatusHandler.removeCallbacks(serviceStatusRunnable)
        super.onPause()
    }

    override fun onDestroy() {
        if (UsbHostPermissions.onPermissionSettled != null) {
            UsbHostPermissions.onPermissionSettled = null
        }
        BridgeSafeStart.cancelPending()
        serviceStatusHandler.removeCallbacks(serviceStatusRunnable)
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
            val health = BridgeHealthChecker.probeHealth()
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

    private fun startBridge() {
        BridgeSafeStart.startNow(this, bypassDebounce = true)
        serviceStatusHandler.postDelayed({ updateServiceStatus() }, 600L)
    }

    private fun startBridgeManually() {
        if (!BridgePermissions.hasNotificationPermission(this)) {
            requestNeededPermissions()
            return
        }
        UsbHostPermissions.register(this)
        BridgeSafeStart.markUiReady()
        Toast.makeText(this, R.string.bridge_start_requested, Toast.LENGTH_SHORT).show()
        val started = BridgeSafeStart.startNow(this, bypassDebounce = true)
        if (!started) {
            Toast.makeText(this, R.string.bridge_start_failed, Toast.LENGTH_LONG).show()
            return
        }
        showLanPrintersNow()
        serviceStatusHandler.postDelayed({ updateServiceStatus() }, 1_200L)
        serviceStatusHandler.postDelayed({
            refreshPrintersSafely()
            updateTapToPayDiagnostics()
        }, 2_800L)
    }

    private fun showLanPrintersNow() {
        val lan = com.rebornsense.printbridge.print.NetworkRawDriver().discover(applicationContext)
        val defaultId = PrinterPreferences.getDefaultPrinterId(this)
        val shown = lan.map { ep -> ep.copy(isDefault = ep.id == defaultId) }.let { list ->
            if (list.none { it.isDefault } && list.isNotEmpty()) {
                list.mapIndexed { index, ep -> ep.copy(isDefault = index == 0) }
            } else {
                list
            }
        }
        printerAdapter.submit(shown, defaultId)
        emptyPrintersText.visibility = if (shown.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun refreshPrintersSafely() {
        showLanPrintersNow()
        if (printerScanInFlight) return
        printerScanInFlight = true
        val scan = Thread {
            val result = runCatching {
                UsbHostPermissions.recordGrantedDevices(applicationContext)
                val printers = registry.refresh(applicationContext)
                val defaultId = PrinterPreferences.getDefaultPrinterId(this@MainActivity)
                printers to defaultId
            }
            runOnUiThread {
                printerScanInFlight = false
                if (isFinishing || isDestroyed) return@runOnUiThread
                result.onSuccess { (printers, defaultId) ->
                    printerAdapter.submit(printers, defaultId)
                    emptyPrintersText.visibility = if (printers.isEmpty()) View.VISIBLE else View.GONE
                }.onFailure {
                    showLanPrintersNow()
                    Toast.makeText(this, R.string.printer_scan_failed, Toast.LENGTH_SHORT).show()
                }
            }
        }
        scan.uncaughtExceptionHandler = Thread.UncaughtExceptionHandler { _, error ->
            android.util.Log.e("MainActivity", "printer scan crashed", error)
            runOnUiThread {
                printerScanInFlight = false
                if (isFinishing || isDestroyed) return@runOnUiThread
                showLanPrintersNow()
            }
        }
        scan.start()
    }

    private fun refreshPrinters() {
        refreshPrintersSafely()
    }

    private fun updateServiceStatus() {
        if (healthProbeInFlight) return
        healthProbeInFlight = true
        val statusText = findViewById<TextView>(R.id.statusText)
        val hintText = findViewById<TextView>(R.id.hintText)
        val serviceIndicator = findViewById<View>(R.id.serviceStatusIndicator)
        statusText.text = getString(R.string.status_service_checking)
        Thread {
            val health = BridgeHealthChecker.probeHealth()
            runOnUiThread {
                healthProbeInFlight = false
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (health != null) {
                    statusText.text = getString(R.string.status_ready)
                    hintText.text = getString(R.string.main_hint_short)
                    serviceIndicator.setBackgroundResource(R.drawable.service_status_running)
                } else {
                    statusText.text = getString(R.string.status_starting)
                    hintText.text = getString(R.string.tap_start_bridge_hint)
                    serviceIndicator.setBackgroundResource(R.drawable.service_status_stopped)
                }
                updateTapToPayDiagnostics(health)
            }
        }.start()
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
        performTestPrint(endpoint)
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
        private const val SERVICE_STATUS_INTERVAL_MS = 3_000L
    }
}
