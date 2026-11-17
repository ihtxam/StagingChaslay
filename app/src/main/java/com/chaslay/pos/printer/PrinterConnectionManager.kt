package com.chaslay.pos.printer

import android.content.Context
import com.chaslay.pos.data.local.dao.BusinessSettingsDao
import com.chaslay.pos.data.local.dao.PrinterConfigDao
import com.chaslay.pos.printer.SunmiInternalPrinter
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
    private val sunmiInternalPrinter: SunmiInternalPrinter,
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
            migrateSunmiStoredPrinters()
            if (SunmiInternalPrinter.isSunmiDevice()) {
                sunmiInternalPrinter.bindIfNeeded()
            }
            val printers = runCatching { printerConfigDao.getAll() }.getOrDefault(emptyList())
                .filter { it.isEnabled && it.address.isNotBlank() }
            usbPrinterManager.syncGrantedDevicesFromSystem()
            printers.forEach { printer ->
                printerService.warmupConnection(printer.address, printer.connectionType)
            }
        }
    }

    private suspend fun migrateSunmiStoredPrinters() {
        if (!SunmiInternalPrinter.isSunmiDevice()) return
        runCatching {
            val printers = printerConfigDao.getAll()
            for (printer in printers) {
                if (!SunmiInternalPrinter.shouldMigrateStoredPrinter(
                        printer.address,
                        printer.name,
                        printer.connectionType,
                    )
                ) {
                    continue
                }
                val coerced = SunmiInternalPrinter.coerceForStorage(
                    printer.address,
                    printer.name,
                    printer.connectionType,
                )
                printerConfigDao.upsert(
                    printer.copy(
                        address = coerced.address,
                        name = coerced.name,
                        connectionType = coerced.connectionType,
                    ),
                )
            }
            val settings = businessSettingsDao.get() ?: return
            if (!SunmiInternalPrinter.shouldMigrateStoredPrinter(
                    settings.printerMacAddress,
                    settings.printerName,
                    null,
                )
            ) {
                return
            }
            val coerced = SunmiInternalPrinter.coerceForStorage(
                settings.printerMacAddress.orEmpty(),
                settings.printerName.orEmpty(),
                "BLUETOOTH",
            )
            businessSettingsDao.upsert(
                settings.copy(
                    printerMacAddress = coerced.address,
                    printerName = coerced.name,
                ),
            )
        }
    }
}
