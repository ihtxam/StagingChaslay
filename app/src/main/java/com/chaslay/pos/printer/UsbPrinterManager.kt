package com.chaslay.pos.printer

/**
 * USB ESC/POS printing and host permission for saved POS printers.
 *
 * ## REGRESSION LOCK — do not change without manual tablet retest
 *
 * Stable device id is **`usb:vendorId:productId` only** (never serial — serial needs permission
 * and breaks matching). Permission prefs/callbacks use the same vid:pid key via [permissionKey].
 *
 * **When to show the system USB dialog (Ojavana-style — not on app open)**
 * - [requestPermission] when the user **prints** ([sendBytes]) and `!hasPermission`, or from
 *   Settings when they pick / test a USB printer.
 * - USB **ATTACHED** receiver auto-requests only for [setMonitoredPrinterAddresses] after
 *   [UsbBootAttachGrace] (not on app open right after reboot). Print path uses [shouldAutoRequestPermission].
 * - [syncForegroundUsbPermissionState] from [com.chaslay.pos.MainActivity.onResume]: sync grants;
 *   **one** [requestPermission] per reboot when a saved USB printer or scale is attached but unauthorized
 *   (Android often clears USB grant on reboot while the cable stays connected). Never on every resume
 *   when [UsbManager.hasPermission] is already true. No background timers / warmup dialogs.
 * - [syncGrantedDevicesFromSystem] / [recordAlreadyGrantedDevices] sync Android’s grant without UI.
 *
 * **Do not regress**
 * - Single in-flight permission ([permissionQueueInFlight], [pendingPermissionDeviceId]).
 * - [reconcilePendingWithGrant] + [clearStalePendingRequest] (45s) after dismiss or replug.
 * - PendingIntent: [PendingIntent.FLAG_MUTABLE] on API 31+ for [UsbManager.requestPermission].
 * - No chained “next missing” prompts after a grant (avoid second dialog without print/attach).
 */
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import com.chaslay.pos.printer.EscPosEncoder
import com.chaslay.pos.scale.ScaleUsbMatcher
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.min

data class UsbPrinterDevice(
    /** Stable id stored in printer config, e.g. usb:1234:5678 */
    val stableAddress: String,
    val vendorId: Int,
    val productId: Int,
    val displayName: String,
    val hasPermission: Boolean = false,
    /** Ephemeral Android path — changes when replugged; not stored. */
    val deviceName: String = stableAddress
)

@Singleton
class UsbPrinterManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val usbManager: UsbManager? =
        context.getSystemService(Context.USB_SERVICE) as? UsbManager

    private val permissionAction = "${context.packageName}.USB_PERMISSION"
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val pendingCallbacks = ConcurrentHashMap<String, (Boolean) -> Unit>()
    private var permissionReceiverRegistered = false
    private var attachReceiverRegistered = false
    private var detachReceiverRegistered = false
    @Volatile
    private var monitoredPrinterAddresses: Set<String> = emptySet()
    @Volatile
    private var monitoredPrinterAddressesSynced = false
    @Volatile
    private var monitoredScaleAddresses: Set<String> = emptySet()
    @Volatile
    private var monitoredScaleAddressesSynced = false
    private val permissionQueueInFlight = AtomicBoolean(false)
    @Volatile
    private var pendingPermissionDeviceId: Int? = null
    @Volatile
    private var pendingRequestStartedElapsed: Long = 0L

    private val attachReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) return
            val device = intent.getUsbDeviceExtra() ?: return
            val manager = usbManager ?: return
            val address = permissionKey(stableAddress(device))
            if (manager.hasPermission(device)) {
                rememberGrantedAddress(address)
                return
            }
            val isPrinter = isLikelyPrinter(device)
            val isScale = ScaleUsbMatcher.isLikelyScale(device, ::isLikelyPrinter)
            if (!isPrinter && !isScale) return
            if (UsbBootAttachGrace.isWithinPostBootGrace(context)) {
                Log.d(TAG, "USB attach — defer permission until after boot grace ($address)")
                return
            }
            val shouldAuto = (isPrinter && shouldAutoRequestOnAttach(address)) ||
                (isScale && shouldAutoRequestScaleOnAttach(address))
            if (!shouldAuto) {
                Log.d(TAG, "USB attach — skip auto prompt (not a saved POS USB device)")
                return
            }
            if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(context, device)) {
                Log.d(TAG, "USB attach — permission prompt debounced for $address")
                return
            }
            UsbAttachPromptGuard.markPromptIssued(context, device)
            requestPermission(address) { granted ->
                if (granted) Log.i(TAG, "USB permission re-granted on attach for $address")
            }
        }
    }

    private val detachReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != UsbManager.ACTION_USB_DEVICE_DETACHED) return
            val device = intent.getUsbDeviceExtra() ?: return
            UsbAttachPromptGuard.clearSuppressForDevice(context, device)
        }
    }

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != permissionAction) return
            val device = intent.getUsbDeviceExtra()
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            val key = device?.let { permissionKey(stableAddress(it)) } ?: return
            pendingPermissionDeviceId = null
            if (granted) rememberGrantedAddress(key)
            pendingCallbacks.remove(key)?.invoke(granted)
            permissionQueueInFlight.set(false)
        }
    }

    fun listDevices(): List<UsbPrinterDevice> {
        val manager = usbManager ?: return emptyList()
        return manager.deviceList.values
            .filter { isLikelyPrinter(it) }
            .map { deviceToInfo(it, manager.hasPermission(it)) }
    }

    /** Used by scale USB scan to hide ESC/POS printers from the scale picker. */
    fun isLikelyEscPosPrinter(device: UsbDevice): Boolean = isLikelyPrinter(device)

    fun hasPermission(address: String): Boolean {
        val manager = usbManager ?: return false
        val device = resolveDevice(address) ?: return false
        return manager.hasPermission(device)
    }

    /** One dialog at a time; uses package-scoped broadcast [permissionAction] + deviceId PendingIntent. */
    fun requestPermission(address: String, onResult: (Boolean) -> Unit) {
        val manager = usbManager ?: run {
            onResult(false)
            return
        }
        val device = resolveDevice(address) ?: run {
            onResult(false)
            return
        }
        if (manager.hasPermission(device)) {
            rememberGrantedAddress(permissionKey(stableAddress(device)))
            onResult(true)
            return
        }
        runCatching {
            ensurePermissionReceiverRegistered()
            reconcilePendingWithGrant(manager)
            clearStalePendingRequest(manager)
            if (pendingPermissionDeviceId != null) {
                onResult(false)
                return
            }
            val key = permissionKey(stableAddress(device))
            pendingCallbacks[key] = onResult
            permissionQueueInFlight.set(true)
            pendingPermissionDeviceId = device.deviceId
            pendingRequestStartedElapsed = SystemClock.elapsedRealtime()
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val permissionIntent = PendingIntent.getBroadcast(
                context,
                device.deviceId,
                Intent(permissionAction).setPackage(context.packageName),
                flags
            )
            Log.i(TAG, "Requesting USB permission for $key deviceId=${device.deviceId}")
            UsbAttachPromptGuard.markPromptIssued(context, device)
            manager.requestPermission(device, permissionIntent)
        }.onFailure {
            permissionQueueInFlight.set(false)
            pendingPermissionDeviceId = null
            pendingCallbacks.remove(permissionKey(stableAddress(device)))
            onResult(false)
        }
    }

    /** Register USB attach/permission receivers. */
    fun startMonitoring() {
        ensurePermissionReceiverRegistered()
        ensureAttachReceiverRegistered()
        ensureDetachReceiverRegistered()
        recordAlreadyGrantedDevices()
    }

    /** Saved POS printer USB addresses (stable usb:vid:pid[:serial]). */
    fun setMonitoredPrinterAddresses(addresses: Collection<String>) {
        monitoredPrinterAddresses = addresses
            .map { permissionKey(normalizeStoredAddress(it)) }
            .filter { isUsbAddress(it) }
            .toSet()
        monitoredPrinterAddressesSynced = true
    }

    /** Saved Aclas / scale USB addresses (stable usb:vid:pid). */
    fun setMonitoredScaleAddresses(addresses: Collection<String>) {
        monitoredScaleAddresses = addresses
            .map { permissionKey(normalizeStoredAddress(it)) }
            .filter { isUsbAddress(it) }
            .toSet()
        monitoredScaleAddressesSynced = true
    }

    /** Sync granted devices from the system; does not show dialogs (safe from background). */
    fun syncGrantedDevicesFromSystem() {
        recordAlreadyGrantedDevices()
    }

    /**
     * Call from Activity [onResume]: reconcile pending state, remember already-granted devices, and
     * (once per reboot) prompt for a saved USB printer that lost host permission while still attached.
     */
    fun syncForegroundUsbPermissionState() {
        val manager = usbManager ?: return
        recordAlreadyGrantedDevices()
        reconcilePendingWithGrant(manager)
        clearStalePendingRequest(manager)
        maybeRequestPostBootMonitoredUsbPermission(manager)
        maybeRequestPostBootMonitoredScaleUsbPermission(manager)
        maybeRequestForegroundMonitoredScaleUsbPermission(manager)
    }

    /**
     * When a saved scale is plugged in but unauthorized, prompt from the foreground (login / POS resume),
     * not only from Settings → Scale. Debounced via [UsbAttachPromptGuard] after dismiss.
     */
    private fun maybeRequestForegroundMonitoredScaleUsbPermission(manager: UsbManager) {
        if (!monitoredScaleAddressesSynced) return
        if (monitoredScaleAddresses.isEmpty()) return
        if (pendingPermissionDeviceId != null) return

        val missingAddress = monitoredScaleAddresses.firstOrNull { address ->
            val device = resolveDevice(address) ?: return@firstOrNull false
            ScaleUsbMatcher.isLikelyScale(device, ::isLikelyPrinter) && !manager.hasPermission(device)
        } ?: return

        val device = resolveDevice(missingAddress) ?: return
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(context, device)) {
            Log.d(TAG, "Foreground scale USB prompt debounced for $missingAddress")
            return
        }
        Log.i(TAG, "Foreground scale USB permission prompt for monitored scale $missingAddress")
        requestPermission(missingAddress) { granted ->
            if (granted) Log.i(TAG, "USB permission granted for scale $missingAddress")
        }
    }

    /**
     * Ojavana-style post-reboot single prompt on login / first POS frame. Skipped when permission
     * is already granted or no monitored device is connected (replug uses the attach receiver).
     */
    private fun maybeRequestPostBootMonitoredUsbPermission(manager: UsbManager) {
        if (!UsbBootAttachGrace.shouldOfferPostBootForegroundPrompt(context)) return
        if (!monitoredPrinterAddressesSynced) return
        if (monitoredPrinterAddresses.isEmpty()) {
            UsbBootAttachGrace.markPostBootForegroundPromptCompleted(context)
            return
        }
        if (pendingPermissionDeviceId != null) return

        val missingAddress = monitoredPrinterAddresses.firstOrNull { address ->
            val device = resolveDevice(address) ?: return@firstOrNull false
            isLikelyPrinter(device) && !manager.hasPermission(device)
        }
        if (missingAddress == null) {
            UsbBootAttachGrace.markPostBootForegroundPromptCompleted(context)
            return
        }

        UsbBootAttachGrace.markPostBootForegroundPromptCompleted(context)
        val device = resolveDevice(missingAddress) ?: return
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(context, device)) {
            Log.d(TAG, "Post-boot USB prompt debounced for $missingAddress")
            return
        }
        Log.i(TAG, "Post-boot USB permission prompt for monitored printer $missingAddress")
        requestPermission(missingAddress) { granted ->
            if (granted) Log.i(TAG, "USB permission granted after reboot for $missingAddress")
        }
    }

    private fun maybeRequestPostBootMonitoredScaleUsbPermission(manager: UsbManager) {
        if (!UsbBootAttachGrace.shouldOfferPostBootScaleForegroundPrompt(context)) return
        if (!monitoredScaleAddressesSynced) return
        if (monitoredScaleAddresses.isEmpty()) {
            UsbBootAttachGrace.markPostBootScaleForegroundPromptCompleted(context)
            return
        }
        if (pendingPermissionDeviceId != null) return

        val missingAddress = monitoredScaleAddresses.firstOrNull { address ->
            val device = resolveDevice(address) ?: return@firstOrNull false
            ScaleUsbMatcher.isLikelyScale(device, ::isLikelyPrinter) && !manager.hasPermission(device)
        }
        if (missingAddress == null) {
            UsbBootAttachGrace.markPostBootScaleForegroundPromptCompleted(context)
            return
        }

        UsbBootAttachGrace.markPostBootScaleForegroundPromptCompleted(context)
        val device = resolveDevice(missingAddress) ?: return
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(context, device)) {
            Log.d(TAG, "Post-boot scale USB prompt debounced for $missingAddress")
            return
        }
        Log.i(TAG, "Post-boot USB permission prompt for monitored scale $missingAddress")
        requestPermission(missingAddress) { granted ->
            if (granted) Log.i(TAG, "USB permission granted after reboot for scale $missingAddress")
        }
    }

    /**
     * Settings → Scale or test reading when host permission was cleared but the scale stayed plugged in.
     * Skips when permission is already granted; respects the single in-flight permission queue.
     */
    fun requestMonitoredScalePermissionFromSettings(address: String?, onResult: ((Boolean) -> Unit)? = null) {
        val normalized = address?.trim()?.takeIf { it.isNotEmpty() } ?: run {
            onResult?.invoke(false)
            return
        }
        val key = permissionKey(normalizeStoredAddress(normalized))
        if (key !in monitoredScaleAddresses) {
            onResult?.invoke(false)
            return
        }
        val manager = usbManager ?: run {
            onResult?.invoke(false)
            return
        }
        val device = resolveDevice(normalized) ?: run {
            onResult?.invoke(false)
            return
        }
        if (manager.hasPermission(device)) {
            rememberGrantedAddress(key)
            onResult?.invoke(true)
            return
        }
        if (pendingPermissionDeviceId != null) {
            onResult?.invoke(false)
            return
        }
        if (UsbAttachPromptGuard.shouldSuppressPermissionDialog(context, device)) {
            onResult?.invoke(false)
            return
        }
        requestPermission(normalized) { granted ->
            onResult?.invoke(granted)
        }
    }

    fun normalizeStoredAddress(address: String): String {
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) return trimmed
        resolveDevice(trimmed)?.let { return stableAddress(it) }
        return trimmed
    }

    fun formatAddressForDisplay(address: String): String {
        val trimmed = address.trim()
        if (trimmed.startsWith(USB_PREFIX)) {
            parseStableAddress(trimmed)?.let { (vid, pid, _) ->
                val device = resolveDevice(trimmed)
                return if (device != null) buildDisplayName(device) else "USB printer ($vid:$pid)"
            }
        }
        if (trimmed.startsWith("/dev/bus/usb")) {
            resolveDevice(trimmed)?.let { return buildDisplayName(it) }
            return "USB printer"
        }
        return trimmed
    }

    fun buildTestPayload(): ByteArray {
        val text = buildString {
            appendLine("RebornPOS")
            appendLine("TEST PRINT")
            appendLine("Fran\u00E7ais: esp\u00E8ces caf\u00E9 cr\u00E8me")
            appendLine("Test: \u00E9 \u00E8 \u00FC \u00D8")
            appendLine("\n\n\n")
        }
        return byteArrayOf(0x1B, 0x40, 0x1B, 0x74, 0x02) +
            EscPosEncoder.encode(text) +
            byteArrayOf(0x1D, 0x56, 0x00)
    }

    fun sendBytes(
        address: String,
        payload: ByteArray,
        bulkTimeoutMs: Int = 15_000
    ): Result<Unit> = runCatching {
        val manager = usbManager ?: error("USB not available")
        val device = resolveDevice(address) ?: error("USB printer not found — replug USB and re-select in Settings")
        if (!manager.hasPermission(device)) {
            if (shouldAutoRequestPermission(address)) {
                requestPermission(address) { granted ->
                    if (granted) Log.i(TAG, "USB permission granted during print for $address")
                }
                error("USB permission required — allow the system dialog, then print again")
            } else {
                error("USB printer not authorized — open Settings → Printers, select the printer, and allow USB access")
            }
        }
        val connection = manager.openDevice(device) ?: error("Could not open USB printer")
        try {
            val candidates = findPrintEndpoints(device)
            if (candidates.isEmpty()) error("No USB print endpoint found")
            var lastError: Exception? = null
            for ((usbInterface, endpoint) in candidates) {
                try {
                    if (!connection.claimInterface(usbInterface, true)) {
                        lastError = IllegalStateException("Could not claim USB interface")
                        continue
                    }
                    transferBulk(connection, endpoint, payload, bulkTimeoutMs)
                    connection.releaseInterface(usbInterface)
                    return@runCatching
                } catch (e: Exception) {
                    lastError = e as? Exception ?: Exception(e.message)
                    runCatching { connection.releaseInterface(usbInterface) }
                }
            }
            throw lastError ?: IllegalStateException("USB transfer failed")
        } finally {
            connection.close()
        }
    }

    fun resolveDevice(address: String): UsbDevice? {
        val manager = usbManager ?: return null
        val trimmed = address.trim()
        if (trimmed.isBlank()) return null
        val devices = manager.deviceList.values

        devices.find { it.deviceName == trimmed }?.let { return it }

        parseStableAddress(trimmed)?.let { (vid, pid, serial) ->
            devices.find { device ->
                device.vendorId == vid &&
                    device.productId == pid &&
                    (serial == null || deviceSerial(device) == serial)
            }?.let { return it }
        }

        // Legacy configs saved only VID:PID inside parentheses, e.g. "/dev/bus/usb/001/003 (1234:5678)"
        LEGACY_VID_PID_REGEX.find(trimmed)?.let { match ->
            val vid = match.groupValues[1].toIntOrNull() ?: return@let
            val pid = match.groupValues[2].toIntOrNull() ?: return@let
            devices.find { it.vendorId == vid && it.productId == pid }?.let { return it }
        }

        val printers = devices.filter { isLikelyPrinter(it) }
        if (printers.size == 1) return printers.first()

        return null
    }

    private fun deviceToInfo(device: UsbDevice, hasPermission: Boolean) = UsbPrinterDevice(
        stableAddress = stableAddress(device),
        vendorId = device.vendorId,
        productId = device.productId,
        displayName = buildDisplayName(device),
        hasPermission = hasPermission,
        deviceName = device.deviceName
    )

    private fun buildDisplayName(device: UsbDevice): String {
        val brand = listOfNotNull(
            device.productName?.trim()?.takeIf { it.isNotEmpty() },
            device.manufacturerName?.trim()?.takeIf { it.isNotEmpty() }
        ).distinct().joinToString(" ")
            .ifBlank { "USB ESC/POS printer" }
        return "$brand (${device.vendorId}:${device.productId})"
    }

    private fun transferBulk(
        connection: android.hardware.usb.UsbDeviceConnection,
        endpoint: UsbEndpoint,
        payload: ByteArray,
        bulkTimeoutMs: Int = 15_000
    ) {
        val chunkSize = 512
        var offset = 0
        while (offset < payload.size) {
            val length = min(chunkSize, payload.size - offset)
            val sent = connection.bulkTransfer(endpoint, payload, offset, length, bulkTimeoutMs)
            if (sent < 0) {
                error("USB transfer failed (code $sent) — check cable and printer power")
            }
            offset += sent
            if (offset < payload.size) {
                Thread.sleep(25)
            }
        }
        Thread.sleep(100)
    }

    private fun findPrintEndpoints(device: UsbDevice): List<Pair<UsbInterface, UsbEndpoint>> {
        val endpoints = mutableListOf<Pair<UsbInterface, UsbEndpoint>>()
        for (index in 0 until device.interfaceCount) {
            val usbInterface = device.getInterface(index)
            for (endpointIndex in 0 until usbInterface.endpointCount) {
                val endpoint = usbInterface.getEndpoint(endpointIndex)
                if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                    endpoint.direction == UsbConstants.USB_DIR_OUT
                ) {
                    endpoints.add(usbInterface to endpoint)
                }
            }
        }
        return endpoints.sortedByDescending { (usbInterface, _) ->
            when (usbInterface.interfaceClass) {
                UsbConstants.USB_CLASS_PRINTER -> 3
                UsbConstants.USB_CLASS_VENDOR_SPEC -> 2
                else -> if (hasBulkOut(usbInterface)) 1 else 0
            }
        }
    }

    private fun isLikelyPrinter(device: UsbDevice): Boolean {
        if (device.deviceClass == UsbConstants.USB_CLASS_PRINTER) return true
        return (0 until device.interfaceCount).any { index ->
            val usbInterface = device.getInterface(index)
            usbInterface.interfaceClass == UsbConstants.USB_CLASS_PRINTER ||
                (hasBulkOut(usbInterface) && usbInterface.interfaceClass !in NON_PRINTER_USB_CLASSES)
        }
    }

    private fun hasBulkOut(usbInterface: UsbInterface): Boolean =
        (0 until usbInterface.endpointCount).any { index ->
            val endpoint = usbInterface.getEndpoint(index)
            endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                endpoint.direction == UsbConstants.USB_DIR_OUT
        }

    private fun ensureAttachReceiverRegistered() {
        if (attachReceiverRegistered) return
        val filter = IntentFilter(UsbManager.ACTION_USB_DEVICE_ATTACHED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(attachReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(attachReceiver, filter)
        }
        attachReceiverRegistered = true
    }

    private fun ensureDetachReceiverRegistered() {
        if (detachReceiverRegistered) return
        val filter = IntentFilter(UsbManager.ACTION_USB_DEVICE_DETACHED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(detachReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(detachReceiver, filter)
        }
        detachReceiverRegistered = true
    }

    private fun ensurePermissionReceiverRegistered() {
        if (permissionReceiverRegistered) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(
                permissionReceiver,
                IntentFilter(permissionAction),
                Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(permissionReceiver, IntentFilter(permissionAction))
        }
        permissionReceiverRegistered = true
    }

    private fun Intent.getUsbDeviceExtra(): UsbDevice? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            getParcelableExtra(UsbManager.EXTRA_DEVICE)
        }

    private fun deviceSerial(device: UsbDevice): String? = runCatching { device.serialNumber }.getOrNull()

    private fun shouldAutoRequestPermission(address: String): Boolean {
        val normalized = permissionKey(normalizeStoredAddress(address))
        if (normalized in monitoredPrinterAddresses) return true
        return normalized in rememberedGrantedAddresses()
    }

    /** Attach-time prompts: saved POS printers only (not “remembered grant” prefs after reboot). */
    private fun shouldAutoRequestOnAttach(address: String): Boolean {
        val normalized = permissionKey(normalizeStoredAddress(address))
        return normalized in monitoredPrinterAddresses
    }

    private fun shouldAutoRequestScaleOnAttach(address: String): Boolean {
        val normalized = permissionKey(normalizeStoredAddress(address))
        return normalized in monitoredScaleAddresses
    }

    /** vid:pid key used for permission prefs/callbacks — never includes serial (serial needs permission). */
    private fun permissionKey(address: String): String {
        parseStableAddress(normalizeStoredAddress(address))?.let { (vid, pid, _) ->
            return "${USB_PREFIX}$vid:$pid"
        }
        return normalizeStoredAddress(address)
    }

    private fun rememberedGrantedAddresses(): Set<String> =
        prefs.getStringSet(PREFS_GRANTED_ADDRESSES, emptySet())
            ?.map { permissionKey(it) }
            ?.toSet()
            .orEmpty()

    private fun rememberGrantedAddress(address: String) {
        val normalized = permissionKey(address)
        val updated = prefs.getStringSet(PREFS_GRANTED_ADDRESSES, emptySet())
            ?.map { permissionKey(it) }
            ?.toMutableSet()
            ?: mutableSetOf()
        if (updated.add(normalized)) {
            prefs.edit().putStringSet(PREFS_GRANTED_ADDRESSES, updated).apply()
        }
    }

    private fun recordAlreadyGrantedDevices() {
        val manager = usbManager ?: return
        manager.deviceList.values
            .filter { manager.hasPermission(it) }
            .forEach { device ->
                when {
                    isLikelyPrinter(device) -> rememberGrantedAddress(stableAddress(device))
                    ScaleUsbMatcher.isLikelyScale(device, ::isLikelyPrinter) ->
                        rememberGrantedAddress(stableAddress(device))
                }
            }
    }

    private fun reconcilePendingWithGrant(manager: UsbManager) {
        val pendingId = pendingPermissionDeviceId ?: return
        val device = manager.deviceList.values.firstOrNull { it.deviceId == pendingId } ?: run {
            pendingPermissionDeviceId = null
            permissionQueueInFlight.set(false)
            return
        }
        if (manager.hasPermission(device)) {
            pendingPermissionDeviceId = null
            permissionQueueInFlight.set(false)
            rememberGrantedAddress(permissionKey(stableAddress(device)))
            pendingCallbacks.remove(permissionKey(stableAddress(device)))?.invoke(true)
            Log.d(TAG, "Reconciled USB permission already granted for ${permissionKey(stableAddress(device))}")
        }
    }

    private fun clearStalePendingRequest(manager: UsbManager, maxAgeMs: Long = 45_000L) {
        val pendingId = pendingPermissionDeviceId ?: return
        val device = manager.deviceList.values.firstOrNull { it.deviceId == pendingId }
        if (device != null && manager.hasPermission(device)) {
            pendingPermissionDeviceId = null
            permissionQueueInFlight.set(false)
            return
        }
        if (device == null) {
            pendingPermissionDeviceId = null
            permissionQueueInFlight.set(false)
            return
        }
        if (SystemClock.elapsedRealtime() - pendingRequestStartedElapsed > maxAgeMs) {
            Log.w(TAG, "Clearing stale USB permission request for deviceId=$pendingId")
            pendingPermissionDeviceId = null
            permissionQueueInFlight.set(false)
        }
    }

    companion object {
        private const val TAG = "UsbPrinterManager"
        private const val PREFS_NAME = "usb_printer_prefs"
        private const val PREFS_GRANTED_ADDRESSES = "granted_usb_addresses"
        private const val USB_PREFIX = "usb:"
        private val LEGACY_VID_PID_REGEX = Regex("\\((\\d+):(\\d+)\\)\\s*$")

        fun stableAddress(device: UsbDevice): String {
            // Match Ojavana/print-bridge: vid:pid only — serial requires USB permission and breaks matching.
            return "${USB_PREFIX}${device.vendorId}:${device.productId}"
        }

        fun parseStableAddress(address: String): Triple<Int, Int, String?>? {
            if (!address.startsWith(USB_PREFIX)) return null
            val body = address.removePrefix(USB_PREFIX)
            val parts = body.split(":")
            val vid = parts.getOrNull(0)?.toIntOrNull() ?: return null
            val pid = parts.getOrNull(1)?.toIntOrNull() ?: return null
            val serial = parts.drop(2).joinToString(":").takeIf { it.isNotEmpty() }
            return Triple(vid, pid, serial)
        }

        fun isUsbAddress(address: String?): Boolean {
            if (address.isNullOrBlank()) return false
            return address.startsWith(USB_PREFIX) || address.startsWith("/dev/bus/usb")
        }

        private val NON_PRINTER_USB_CLASSES = setOf(
            UsbConstants.USB_CLASS_HID,
            UsbConstants.USB_CLASS_HUB,
            UsbConstants.USB_CLASS_CDC_DATA,
            UsbConstants.USB_CLASS_COMM
        )
    }
}
