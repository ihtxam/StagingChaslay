package com.rebornsense.printbridge.print

import android.bluetooth.BluetoothAdapter

/** [BluetoothAdapter.cancelDiscovery] needs BLUETOOTH_ADMIN (API ≤30) or BLUETOOTH_SCAN (API 31+). */
internal fun BluetoothAdapter?.safeCancelDiscovery() {
    if (this == null) return
    runCatching { cancelDiscovery() }
}
