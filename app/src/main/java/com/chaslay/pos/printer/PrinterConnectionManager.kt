package com.chaslay.pos.printer

import android.content.Context
import com.chaslay.pos.data.local.dao.BusinessSettingsDao
import com.chaslay.pos.data.local.dao.PrinterConfigDao
import com.chaslay.pos.util.PosLocalPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PrinterConnectionManager @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val printerConfigDao: PrinterConfigDao,
    private val businessSettingsDao: BusinessSettingsDao,
    private val printerService: BluetoothPrinterService,
    private val usbPrinterManager: UsbPrinterManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Register saved USB printer/scale addresses before the first Activity [onResume] (post-boot USB prompt). */
    fun syncMonitoredUsbAddressesFromDatabase() {
        runBlocking {
            runCatching {
                val settings = businessSettingsDao.get() ?: return@runBlocking
                val printers = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
                    .filter { it.isEnabled && it.address.isNotBlank() }
                val legacyUsb = settings.printerMacAddress?.trim()?.takeIf { UsbPrinterManager.isUsbAddress(it) }
                val usbAddresses = printers
                    .filter { it.connectionType == "USB" || UsbPrinterManager.isUsbAddress(it.address) }
                    .map { usbPrinterManager.normalizeStoredAddress(it.address) }
                    .plus(listOfNotNull(legacyUsb?.let { usbPrinterManager.normalizeStoredAddress(it) }))
                usbPrinterManager.setMonitoredPrinterAddresses(usbAddresses)

                val scaleEnabled = PosLocalPrefs.applyScaleEnabledIfUserSet(appContext, settings.scaleEnabled)
                val scaleUsb = PosLocalPrefs.applyScaleUsbAddressIfUserSet(appContext, settings.scaleUsbAddress)
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }
                val monitoredScale = if (scaleEnabled) scaleUsb else null
                usbPrinterManager.setMonitoredScaleAddresses(
                    listOfNotNull(monitoredScale?.let { usbPrinterManager.normalizeStoredAddress(it) })
                )
            }
        }
    }

    fun warmupOnStartup() {
        syncMonitoredUsbAddressesFromDatabase()
        scope.launch {
            val printers = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
                .filter { it.isEnabled && it.address.isNotBlank() }
            usbPrinterManager.syncGrantedDevicesFromSystem()
            printers.forEach { printer ->
                printerService.warmupConnection(printer.address, printer.connectionType)
            }
        }
    }
}
