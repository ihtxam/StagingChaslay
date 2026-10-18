package com.rebornsense.printbridge.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.rebornsense.printbridge.BridgeUserUnlock
import com.rebornsense.printbridge.PrintBridgeLauncher

/**
 * Re-scan Bridge printers when a bonded Bluetooth device connects, disconnects, is newly
 * paired, or when the adapter is turned on — no need to open Bridge or tap Refresh.
 */
class BluetoothPrinterHotplugReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        runCatching {
            if (!BridgeUserUnlock.isCredentialStorageReady(context)) return
            when (intent?.action) {
                BluetoothDevice.ACTION_ACL_DISCONNECTED -> {
                    val device = intent.bluetoothDeviceExtra()
                    if (device != null && isBondedPrinterDevice(device)) {
                        PrintBridgeLauncher.notifyBluetoothDisconnected(
                            context.applicationContext,
                            device.address,
                        )
                    }
                    scheduleRefresh(context.applicationContext, intent?.action)
                }
                BluetoothDevice.ACTION_ACL_CONNECTED -> {
                    val device = intent.bluetoothDeviceExtra()
                    if (device != null && !isBondedPrinterDevice(device)) return
                    scheduleRefresh(context.applicationContext, intent?.action)
                }
                BluetoothDevice.ACTION_BOND_STATE_CHANGED -> {
                    val device = intent.bluetoothDeviceExtra() ?: return
                    val state = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.BOND_NONE)
                    if (state == BluetoothDevice.BOND_BONDED) {
                        scheduleRefresh(context.applicationContext, intent.action)
                    } else if (state == BluetoothDevice.BOND_NONE) {
                        PrintBridgeLauncher.notifyBluetoothDisconnected(
                            context.applicationContext,
                            device.address,
                        )
                        scheduleRefresh(context.applicationContext, intent.action)
                    }
                }
                BluetoothAdapter.ACTION_STATE_CHANGED -> {
                    val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
                    if (state == BluetoothAdapter.STATE_ON) {
                        scheduleRefresh(context.applicationContext, intent.action)
                    }
                }
            }
        }.onFailure { error ->
            Log.w(TAG, "Bluetooth hotplug ignored", error)
        }
    }

    @SuppressLint("MissingPermission")
    private fun isBondedPrinterDevice(device: BluetoothDevice): Boolean {
        return device.bondState == BluetoothDevice.BOND_BONDED
    }

    companion object {
        private const val TAG = "BtPrinterHotplug"
    }
}

private fun Intent.bluetoothDeviceExtra(): BluetoothDevice? {
    return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
        getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
    } else {
        @Suppress("DEPRECATION")
        getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
    }
}

private val debounceHandler = android.os.Handler(android.os.Looper.getMainLooper())
private var pendingRefresh: Runnable? = null
private const val REFRESH_DEBOUNCE_MS = 600L

private fun scheduleRefresh(app: Context, reason: String?) {
    pendingRefresh?.let { debounceHandler.removeCallbacks(it) }
    val runnable = Runnable {
        pendingRefresh = null
        Log.d("BtPrinterHotplug", "Refresh printer list ($reason)")
        PrintBridgeLauncher.refreshAfterHardwareChange(app)
    }
    pendingRefresh = runnable
    debounceHandler.postDelayed(runnable, REFRESH_DEBOUNCE_MS)
}
