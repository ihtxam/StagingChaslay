package com.chaslay.pos.printer

import com.chaslay.pos.data.local.dao.BusinessSettingsDao
import com.chaslay.pos.data.local.dao.PrinterConfigDao
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PrinterConnectionManager @Inject constructor(
    private val printerConfigDao: PrinterConfigDao,
    private val businessSettingsDao: BusinessSettingsDao,
    private val printerService: BluetoothPrinterService,
    private val usbPrinterManager: UsbPrinterManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun warmupOnStartup() {
        scope.launch {
            val printers = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
                .filter { it.isEnabled && it.address.isNotBlank() }
            val legacyUsb = runCatching { businessSettingsDao.get()?.printerMacAddress }
                .getOrNull()
                ?.trim()
                ?.takeIf { UsbPrinterManager.isUsbAddress(it) }
            val usbAddresses = printers
                .filter { it.connectionType == "USB" || UsbPrinterManager.isUsbAddress(it.address) }
                .map { usbPrinterManager.normalizeStoredAddress(it.address) }
                .plus(listOfNotNull(legacyUsb?.let { usbPrinterManager.normalizeStoredAddress(it) }))
            // Monitored USB addresses drive attach/onResume prompts only — no background dialogs.
            usbPrinterManager.setMonitoredPrinterAddresses(usbAddresses)
            usbPrinterManager.syncGrantedDevicesFromSystem()
            printers.forEach { printer ->
                printerService.warmupConnection(printer.address, printer.connectionType)
            }
        }
    }
}
