package com.rebornsense.printbridge

import android.Manifest
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import com.google.android.material.switchmaterial.SwitchMaterial
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.rebornsense.printbridge.print.DriverRegistry
import com.rebornsense.printbridge.print.PrinterEndpoint
import com.rebornsense.printbridge.print.PrinterPreferences
import com.rebornsense.printbridge.PrintBridgeLauncher
import com.rebornsense.printbridge.device.DeviceProfiler
import com.rebornsense.printbridge.setup.OemSettingsNavigator
import com.rebornsense.printbridge.setup.OemSetupPreferences
import com.rebornsense.printbridge.setup.SetupWizardActivity

class MainActivity : AppCompatActivity() {
    private val registry = DriverRegistry()
    private var usbPermissionReceiver: BroadcastReceiver? = null
    private var pendingBluetoothTestPrint: PrinterEndpoint? = null
    private lateinit var printerAdapter: PrinterListAdapter
    private lateinit var emptyPrintersText: TextView
    private var pendingWizardLaunch = false

    private val wizardLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            updateOemSetupBanner()
        }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { _ ->
            startBridge()
            refreshPrinters()
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
        setContentView(R.layout.activity_main)
        emptyPrintersText = findViewById(R.id.emptyPrintersText)
        printerAdapter = PrinterListAdapter(
            onSetDefault = { endpoint -> setDefaultPrinter(endpoint) },
            onTestPrint = { endpoint -> testPrint(endpoint) },
        )
        findViewById<RecyclerView>(R.id.printerRecycler).adapter = printerAdapter
        setupAutoStartSwitch()
        requestNeededPermissions()
        findViewById<Button>(R.id.refreshBtn).setOnClickListener { refreshPrinters() }
        findViewById<Button>(R.id.testPrintBtn).setOnClickListener { testPrintDefault() }
        findViewById<Button>(R.id.addLanBtn).setOnClickListener { addLanPrinter() }
        findViewById<Button>(R.id.oemSetupBtn).setOnClickListener { openOemSetupWizard() }
        updateOemSetupBanner()
    }

    override fun onResume() {
        super.onResume()
        refreshPrinters()
        updateOemSetupBanner()
        maybeLaunchOemWizard()
    }

    private fun maybeLaunchOemWizard() {
        if (pendingWizardLaunch) return
        if (OemSetupPreferences.isWizardCompleted(this)) return
        pendingWizardLaunch = true
        openOemSetupWizard()
    }

    private fun openOemSetupWizard() {
        wizardLauncher.launch(SetupWizardActivity.createIntent(this))
    }

    private fun updateOemSetupBanner() {
        val banner = findViewById<View>(R.id.oemSetupBanner)
        val summary = findViewById<TextView>(R.id.oemSetupBannerSummary)
        val needsSetup = !OemSetupPreferences.isWizardCompleted(this) ||
            !OemSettingsNavigator.isBatteryOptimizationDisabled(this)
        banner.visibility = if (needsSetup) View.VISIBLE else View.GONE
        if (needsSetup) {
            summary.text = getString(
                R.string.oem_setup_banner_summary,
                DeviceProfiler.detect().displayName,
            )
        }
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
            startBridge()
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
        findViewById<TextView>(R.id.statusText).text = getString(R.string.status_ready)
        findViewById<TextView>(R.id.hintText).text = getString(R.string.open_webpos)
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
        requestUsbPermissionsForAttachedDevices()
        val printers = registry.refresh(applicationContext)
        val defaultId = PrinterPreferences.getDefaultPrinterId(this)
        printerAdapter.submit(printers, defaultId)
        emptyPrintersText.visibility = if (printers.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun setDefaultPrinter(endpoint: PrinterEndpoint) {
        PrinterPreferences.setDefaultPrinterId(this, endpoint.id)
        Toast.makeText(this, getString(R.string.default_set, endpoint.name), Toast.LENGTH_SHORT).show()
        refreshPrinters()
    }

    private fun addLanPrinter() {
        val host = findViewById<EditText>(R.id.lanHostInput).text?.toString()?.trim().orEmpty()
        if (host.isBlank()) {
            Toast.makeText(this, R.string.lan_printer_hint, Toast.LENGTH_SHORT).show()
            return
        }
        PrinterPreferences.addLanHost(this, host)
        findViewById<EditText>(R.id.lanHostInput).text?.clear()
        refreshPrinters()
    }

    private fun testPrintDefault() {
        val defaultId = PrinterPreferences.getDefaultPrinterId(this)
        val endpoint = defaultId?.let { registry.findById(it) }
            ?: registry.findByName(null)
        if (endpoint == null) {
            Toast.makeText(this, R.string.no_printers_yet, Toast.LENGTH_SHORT).show()
            return
        }
        testPrint(endpoint)
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
        findViewById<Button>(R.id.testPrintBtn).isEnabled = false
        Thread {
            val result = driver.print(applicationContext, endpoint, sample)
            runOnUiThread {
                findViewById<Button>(R.id.testPrintBtn).isEnabled = true
                if (result.isSuccess) {
                    Toast.makeText(this, getString(R.string.test_print_ok, endpoint.name), Toast.LENGTH_SHORT).show()
                } else {
                    val message = friendlyPrintError(result.exceptionOrNull())
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
            }
        }.start()
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
        val text = "Reborn Print Bridge\nTest print OK\n\n"
        val init = byteArrayOf(0x1B, 0x40)
        val feed = byteArrayOf(0x0A, 0x0A, 0x0A)
        val cut = byteArrayOf(0x1D, 0x56, 0x00)
        return init + text.toByteArray(Charsets.UTF_8) + feed + cut
    }

    private fun requestUsbPermissionsForAttachedDevices() {
        val usb = getSystemService(Context.USB_SERVICE) as UsbManager
        val action = "com.rebornsense.printbridge.USB_PERMISSION"
        if (usbPermissionReceiver == null) {
            usbPermissionReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    refreshPrinters()
                }
            }
            registerReceiver(
                usbPermissionReceiver,
                IntentFilter(action),
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    RECEIVER_NOT_EXPORTED
                } else {
                    0
                }
            )
        }
        for (device in usb.deviceList.values) {
            if (usb.hasPermission(device)) continue
            val pi = PendingIntent.getBroadcast(
                this,
                device.deviceId,
                Intent(action),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            usb.requestPermission(device, pi)
        }
    }

    override fun onDestroy() {
        usbPermissionReceiver?.let { unregisterReceiver(it) }
        usbPermissionReceiver = null
        super.onDestroy()
    }
}
