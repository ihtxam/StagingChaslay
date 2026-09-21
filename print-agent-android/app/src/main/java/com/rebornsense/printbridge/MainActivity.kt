package com.rebornsense.printbridge

import android.Manifest
import android.content.pm.PackageManager
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

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            runtimePermissionsResolved = true
            startBridge()
            refreshPrinters()
            window.decorView.postDelayed({ refreshPrinters() }, 2_500)
            maybeLaunchOemWizard()
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        OemSetupPreferences.syncInstalledVersion(this)
        runCatching {
            Class.forName("com.rebornsense.printbridge.payment.adyen.AdyenBootstrap")
                .getMethod("register", AppCompatActivity::class.java)
                .invoke(null, this)
        }
        setContentView(R.layout.activity_main)
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
        findViewById<MaterialButton>(R.id.addLanBtn).setOnClickListener { showAddNetworkPrinterDialog() }
        findViewById<MaterialButton>(R.id.setupWizardBtn).setOnClickListener { openOemSetupWizard() }
        updateTapToPayDiagnostics()
    }

    override fun onResume() {
        super.onResume()
        refreshPrinters()
        updateServiceStatus()
        updateTapToPayDiagnostics()
        serviceStatusHandler.postDelayed(serviceStatusRunnable, SERVICE_STATUS_INTERVAL_MS)
        maybeLaunchOemWizard()
    }

    override fun onPause() {
        serviceStatusHandler.removeCallbacks(serviceStatusRunnable)
        super.onPause()
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

    private fun updateTapToPayDiagnostics() {
        val card = findViewById<View>(R.id.tapToPayDiagnosticsCard)
        val text = findViewById<TextView>(R.id.tapToPayDiagnosticsText)
        if (!BuildConfig.HAS_ADYEN_SDK) {
            card.visibility = View.GONE
            return
        }
        val health = BridgeHealthChecker.probeHealth()
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
        val needed = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed += Manifest.permission.POST_NOTIFICATIONS
        }
        needed += bluetoothPermissionsNeeded()
        if (needed.isEmpty()) {
            runtimePermissionsResolved = true
            startBridge()
            refreshPrinters()
            maybeLaunchOemWizard()
        } else {
            permissionLauncher.launch(needed.toTypedArray())
        }
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
        PrintBridgeLauncher.start(this)
        updateServiceStatus()
    }

    private fun updateServiceStatus() {
        val statusText = findViewById<TextView>(R.id.statusText)
        val hintText = findViewById<TextView>(R.id.hintText)
        val serviceIndicator = findViewById<View>(R.id.serviceStatusIndicator)

        val health = BridgeHealthChecker.probeHealth()
        if (health != null) {
            statusText.text = getString(R.string.status_ready)
            hintText.text = getString(R.string.main_hint_short)
            serviceIndicator.setBackgroundResource(R.drawable.service_status_running)
        } else {
            statusText.text = getString(R.string.status_starting)
            hintText.text = getString(R.string.oem_step_bridge_pending)
            serviceIndicator.setBackgroundResource(R.drawable.service_status_stopped)
            PrintBridgeLauncher.start(this)
        }
        updateTapToPayDiagnostics()
    }

    private fun setupAutoStartSwitch() {
        val autoStartSwitch = findViewById<SwitchMaterial>(R.id.autoStartSwitch)
        autoStartSwitch.isChecked = PrinterPreferences.isAutoStartEnabled(this)
        autoStartSwitch.setOnCheckedChangeListener { _, isChecked ->
            PrinterPreferences.setAutoStartEnabled(this, isChecked)
            if (isChecked) {
                startBridge()
                Toast.makeText(this, R.string.auto_start_enabled_toast, Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, R.string.auto_start_disabled_toast, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun refreshPrinters() {
        UsbHostPermissions.ensureGranted(this)
        val printers = registry.refresh(applicationContext)
        val defaultId = PrinterPreferences.getDefaultPrinterId(this)
        printerAdapter.submit(printers, defaultId)
        emptyPrintersText.visibility = if (printers.isEmpty()) View.VISIBLE else View.GONE
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
                val host = input.text?.toString()?.trim().orEmpty()
                if (host.isBlank()) return@setOnClickListener
                PrinterPreferences.addLanHost(this, host)
                refreshPrinters()
                Toast.makeText(this, R.string.lan_printer_added, Toast.LENGTH_SHORT).show()
                dialog.dismiss()
            }
        }
        dialog.show()
    }

    private fun testPrint(endpoint: PrinterEndpoint) {
        if (endpoint.connectionType == "bluetooth" && !hasBluetoothPermissions()) {
            pendingBluetoothTestPrint = endpoint
            permissionLauncher.launch(bluetoothPermissionsNeeded().toTypedArray())
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

    override fun onDestroy() {
        serviceStatusHandler.removeCallbacks(serviceStatusRunnable)
        super.onDestroy()
    }

    companion object {
        private const val SERVICE_STATUS_INTERVAL_MS = 3_000L
    }
}
