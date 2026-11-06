package com.chaslay.pos.customerdisplay

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import androidx.appcompat.view.ContextThemeWrapper
import com.chaslay.pos.R
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NativeCustomerDisplayManager @Inject constructor() {
    private val mainHandler = Handler(Looper.getMainLooper())
    @Volatile
    private var presentation: CustomerDisplayPresentation? = null
    @Volatile
    private var cachedHasSecondaryDisplay: Boolean? = null

    fun dualScreenAvailable(context: Context): Boolean =
        hasSecondaryDisplay(context.applicationContext)

    /** Non-blocking; caches a negative result so till does not re-probe every cart tick. */
    fun hasSecondaryDisplay(context: Context): Boolean {
        cachedHasSecondaryDisplay?.let { return it }
        val found = findCustomerDisplay(context) != null
        cachedHasSecondaryDisplay = found
        return found
    }

    fun invalidateDisplayCache() {
        cachedHasSecondaryDisplay = null
    }

    fun isOpen(): Boolean = presentation?.isShowing == true

    fun ensureOpen(context: Context): OpenResult {
        val display = findCustomerDisplay(context.applicationContext)
            ?: return OpenResult(ok = false, message = "No secondary display found")
        // post + await on the main thread deadlocks: the Runnable never runs while we block.
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return showOnDisplay(context.applicationContext, display)
        }
        val latch = CountDownLatch(1)
        var result = OpenResult(ok = false, message = "Could not show customer display")
        mainHandler.post {
            result = showOnDisplay(context.applicationContext, display)
            latch.countDown()
        }
        if (!latch.await(2, TimeUnit.SECONDS)) {
            Log.w(TAG, "Timed out waiting for customer display Presentation")
        }
        return result
    }

    fun update(state: CustomerDisplayState, branding: CustomerDisplayBranding) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            applyUpdate(state, branding)
            return
        }
        mainHandler.post {
            runCatching { applyUpdate(state, branding) }
                .onFailure { Log.w(TAG, "Customer display update failed", it) }
        }
    }

    fun close() {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            dismissPresentation()
            return
        }
        mainHandler.post {
            runCatching { dismissPresentation() }
                .onFailure { Log.w(TAG, "Customer display close failed", it) }
        }
    }

    private fun applyUpdate(state: CustomerDisplayState, branding: CustomerDisplayBranding) {
        presentation?.updateState(state)
        presentation?.updateBranding(branding)
    }

    private fun dismissPresentation() {
        presentation?.dismiss()
        presentation = null
    }

    private fun showOnDisplay(appContext: Context, display: Display): OpenResult {
        return try {
            if (!display.isValid) {
                return OpenResult(ok = false, message = "Secondary display is not valid")
            }
            val themed = ContextThemeWrapper(appContext, R.style.Theme_RebornPOS)
            val existing = presentation
            if (existing != null && existing.isShowing && existing.display.displayId == display.displayId) {
                return OpenResult(ok = true, message = "Already showing", displayId = display.displayId)
            }
            runCatching { existing?.dismiss() }
            presentation = null
            val next = CustomerDisplayPresentation(themed, display)
            next.show()
            presentation = next
            OpenResult(ok = true, message = "Showing", displayId = display.displayId)
        } catch (e: Exception) {
            Log.w(TAG, "Presentation show failed", e)
            runCatching { presentation?.dismiss() }
            presentation = null
            OpenResult(ok = false, message = e.message ?: "Presentation failed")
        }
    }

    private fun findCustomerDisplay(context: Context): Display? {
        val dm = context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return null
        val displays = dm.displays ?: return null
        return displays
            .filter { isValidCustomerDisplay(it) }
            .maxByOrNull { display ->
                val mode = display.mode
                if (mode != null) mode.physicalWidth * mode.physicalHeight else display.displayId
            }
    }

    private fun isValidCustomerDisplay(display: Display): Boolean {
        if (display.displayId == Display.DEFAULT_DISPLAY) return false
        if (!display.isValid) return false
        val mode = display.mode ?: return false
        if (mode.physicalWidth <= 0 || mode.physicalHeight <= 0) return false
        return true
    }

    data class OpenResult(
        val ok: Boolean,
        val message: String = "",
        val displayId: Int = -1,
    )

    private companion object {
        const val TAG = "NativeCustomerDisplay"
    }
}
