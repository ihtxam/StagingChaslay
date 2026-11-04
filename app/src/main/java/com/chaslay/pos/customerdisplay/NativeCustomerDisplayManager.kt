package com.chaslay.pos.customerdisplay

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
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
    private var currentUrl: String = ""

    fun dualScreenAvailable(context: Context): Boolean =
        findCustomerDisplay(context) != null

    fun isOpen(): Boolean = presentation?.isShowing == true

    fun open(context: Context, url: String): OpenResult {
        val trimmed = url.trim()
        if (!trimmed.startsWith("http")) {
            return OpenResult(ok = false, message = "url must be http(s)")
        }
        val display = findCustomerDisplay(context.applicationContext)
            ?: return OpenResult(ok = false, message = "No secondary display found")
        val latch = CountDownLatch(1)
        var result = OpenResult(ok = false, message = "Could not show customer display")
        mainHandler.post {
            result = showOnDisplay(context.applicationContext, display, trimmed)
            latch.countDown()
        }
        latch.await(2, TimeUnit.SECONDS)
        return result
    }

    fun close() {
        mainHandler.post {
            presentation?.dismiss()
            presentation = null
            currentUrl = ""
        }
    }

    private fun showOnDisplay(appContext: Context, display: Display, url: String): OpenResult {
        return try {
            val themed = ContextThemeWrapper(appContext, R.style.Theme_RebornPOS)
            val existing = presentation
            if (existing != null && existing.isShowing && currentUrl == url) {
                return OpenResult(ok = true, message = "Already showing", displayId = display.displayId)
            }
            existing?.dismiss()
            val next = CustomerDisplayPresentation(themed, display, url)
            next.show()
            presentation = next
            currentUrl = url
            OpenResult(ok = true, message = "Showing", displayId = display.displayId)
        } catch (e: Exception) {
            presentation = null
            currentUrl = ""
            OpenResult(ok = false, message = e.message ?: "Presentation failed")
        }
    }

    private fun findCustomerDisplay(context: Context): Display? {
        val dm = context.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager ?: return null
        val displays = dm.displays ?: return null
        return displays
            .filter { it.displayId != Display.DEFAULT_DISPLAY }
            .maxByOrNull { display ->
                val mode = display.mode
                if (mode != null) mode.physicalWidth * mode.physicalHeight else display.displayId
            }
    }

    data class OpenResult(
        val ok: Boolean,
        val message: String = "",
        val displayId: Int = -1,
    )
}
