package com.chaslay.pos.printer

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
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
) {
    private val serviceRef = AtomicReference<SunmiPrinterService?>(null)
    private val bindLock = Any()

    fun bindIfNeeded() {
        if (serviceRef.get() != null) return
        if (!SunmiInternalPrinter.isSunmiDevice()) return
        synchronized(bindLock) {
            if (serviceRef.get() != null) return
            repeat(MAX_BIND_ATTEMPTS) { attempt ->
                if (serviceRef.get() != null) return
                if (attemptSingleBind()) return
                if (attempt < MAX_BIND_ATTEMPTS - 1) {
                    Thread.sleep(BIND_RETRY_DELAY_MS)
                }
            }
        }
    }

    private fun attemptSingleBind(): Boolean {
        return runCatching {
            val latch = CountDownLatch(1)
            val callback = object : InnerPrinterCallback() {
                override fun onConnected(service: SunmiPrinterService?) {
                    serviceRef.set(service)
                    if (service != null) {
                        Log.i(TAG, "Sunmi printer service connected (${deviceProfile()})")
                    } else {
                        Log.w(TAG, "Sunmi printer service onConnected with null service")
                    }
                    latch.countDown()
                }

                override fun onDisconnected() {
                    Log.w(TAG, "Sunmi printer service disconnected")
                    serviceRef.set(null)
                }
            }
            val appCtx = context.applicationContext
            val mainHandler = Handler(Looper.getMainLooper())
            if (Looper.myLooper() == Looper.getMainLooper()) {
                runCatching {
                    InnerPrinterManager.getInstance().bindService(appCtx, callback)
                }.onFailure {
                    Log.w(TAG, "Sunmi bindService failed", it)
                    latch.countDown()
                }
            } else {
                mainHandler.post {
                    runCatching {
                        InnerPrinterManager.getInstance().bindService(appCtx, callback)
                    }.onFailure {
                        Log.w(TAG, "Sunmi bindService failed", it)
                        latch.countDown()
                    }
                }
            }
            if (!latch.await(BIND_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                Log.w(TAG, "Timed out waiting for Sunmi printer service (${deviceProfile()})")
            }
            serviceRef.get() != null
        }.onFailure {
            Log.w(TAG, "Sunmi printer bind failed", it)
        }.getOrDefault(false)
    }

    fun getService(): SunmiPrinterService? {
        bindIfNeeded()
        return serviceRef.get()
    }

    /** Whether Sunmi print service is bound — does not initiate bind. */
    fun isServiceConnected(): Boolean = serviceRef.get() != null

    fun deviceProfile(): String =
        "${Build.MANUFACTURER}/${Build.MODEL} (SDK ${Build.VERSION.SDK_INT})"

    companion object {
        private const val TAG = "SunmiPrinterHolder"
        private const val BIND_TIMEOUT_SEC = 8L
        private const val MAX_BIND_ATTEMPTS = 3
        private const val BIND_RETRY_DELAY_MS = 400L
    }
}
