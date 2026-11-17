package com.chaslay.pos.printer

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.chaslay.pos.debug.PosDiagnosticLogger
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single bind to Sunmi [InnerPrinterManager] — shared by built-in thermal and customer LCD.
 * Multiple independent binds can disconnect each other and leave printing or CDS blank.
 */
@Singleton
class SunmiPrinterServiceHolder @Inject constructor(
    @ApplicationContext private val context: Context,
    private val posDiagnosticLogger: PosDiagnosticLogger,
) {
    private val serviceRef = AtomicReference<SunmiPrinterService?>(null)
    private val lastBindError = AtomicReference<String?>(null)
    private val bindLock = Any()

    @Volatile
    private var bindInFlight = false

    @Volatile
    private var waitLatch: CountDownLatch? = null

    private val callback = object : InnerPrinterCallback() {
        override fun onConnected(service: SunmiPrinterService?) {
            bindInFlight = false
            serviceRef.set(service)
            if (service != null) {
                lastBindError.set(null)
                Log.i(TAG, "Sunmi printer service connected (${deviceProfile()})")
                posDiagnosticLogger.logSunmiBind("connected", deviceProfile())
            } else {
                lastBindError.set("Sunmi printer service returned null")
                Log.w(TAG, "Sunmi printer service onConnected with null service")
                posDiagnosticLogger.logSunmiBind("connected_null_service", deviceProfile())
            }
            waitLatch?.countDown()
        }

        override fun onDisconnected() {
            Log.w(TAG, "Sunmi printer service disconnected")
            posDiagnosticLogger.logSunmiBind("disconnected", deviceProfile())
            serviceRef.set(null)
            bindInFlight = false
            if (lastBindError.get() == null) {
                lastBindError.set("Sunmi printer service disconnected")
            }
            waitLatch?.countDown()
        }
    }

    fun bindIfNeeded() {
        if (serviceRef.get() != null) return
        if (!SunmiInternalPrinter.isSunmiDevice()) return
        synchronized(bindLock) {
            if (serviceRef.get() != null) return
            if (bindInFlight) {
                awaitBindResult()
                return
            }
            repeat(MAX_BIND_ATTEMPTS) { attempt ->
                if (serviceRef.get() != null) return
                bindInFlight = true
                lastBindError.set(null)
                posDiagnosticLogger.logSunmiBind(
                    "bind_start",
                    if (attempt == 0) deviceProfile() else "${deviceProfile()} attempt=${attempt + 1}",
                )
                val latch = CountDownLatch(1)
                waitLatch = latch
                val appCtx = context.applicationContext
                val posted = postToMain {
                    runCatching {
                        InnerPrinterManager.getInstance().bindService(appCtx, callback)
                    }.onFailure { error ->
                        bindInFlight = false
                        val detail = buildString {
                            append(error.message ?: error.javaClass.simpleName)
                            append(" — check Sunmi printer service / manifest queries on ")
                            append(deviceProfile())
                        }
                        lastBindError.set(detail)
                        Log.w(TAG, "Sunmi bindService failed: $detail", error)
                        posDiagnosticLogger.logSunmiBind("bind_failed", detail)
                        latch.countDown()
                    }
                }
                if (!posted) {
                    bindInFlight = false
                    lastBindError.set("Main looper unavailable")
                    latch.countDown()
                }
                if (!latch.await(BIND_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                    if (serviceRef.get() == null) {
                        bindInFlight = false
                        val msg = "Timed out waiting for Sunmi printer service (${deviceProfile()})"
                        lastBindError.compareAndSet(null, msg)
                        Log.w(TAG, msg)
                        posDiagnosticLogger.logSunmiBind("bind_timeout", msg)
                    }
                    latch.countDown()
                }
                waitLatch = null
                if (serviceRef.get() != null) return
                if (attempt < MAX_BIND_ATTEMPTS - 1) {
                    bindInFlight = false
                    Thread.sleep(BIND_RETRY_DELAY_MS)
                }
            }
        }
    }

    /** Re-bind after [onDisconnected] — used before print when the service dropped. */
    fun rebindIfDisconnected() {
        if (serviceRef.get() != null) return
        bindInFlight = false
        bindIfNeeded()
    }

    private fun awaitBindResult() {
        val latch = waitLatch ?: return
        latch.await(BIND_TIMEOUT_SEC, TimeUnit.SECONDS)
    }

    private fun postToMain(block: () -> Unit): Boolean {
        val mainHandler = Handler(Looper.getMainLooper())
        return if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
            true
        } else {
            mainHandler.post(block)
            true
        }
    }

    fun getService(): SunmiPrinterService? {
        bindIfNeeded()
        return serviceRef.get()
    }

    /** Whether Sunmi print service is bound — does not initiate bind. */
    fun isServiceConnected(): Boolean = serviceRef.get() != null

    fun lastConnectionError(): String? = lastBindError.get()

    fun deviceProfile(): String =
        "${Build.MANUFACTURER}/${Build.MODEL} (SDK ${Build.VERSION.SDK_INT})"

    companion object {
        private const val TAG = "SunmiPrinterHolder"
        private const val BIND_TIMEOUT_SEC = 12L
        private const val MAX_BIND_ATTEMPTS = 3
        private const val BIND_RETRY_DELAY_MS = 400L
    }
}
