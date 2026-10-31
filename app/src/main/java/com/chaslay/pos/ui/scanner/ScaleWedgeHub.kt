package com.chaslay.pos.ui.scanner

import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.EditText
import android.widget.TextView
import com.chaslay.pos.scale.ScaleWedgeParser
import java.util.concurrent.CopyOnWriteArraySet

/**
 * HID keyboard-wedge weighing scales (digits + Enter). Consumed before [BarcodeWedgeHub]
 * when [enabled] while a weight entry dialog is open.
 */
object ScaleWedgeHub {
    @Volatile
    var enabled: Boolean = false

    data class Reading(
        val weightKg: Double,
        val displayUnit: ScaleWedgeParser.Result.DisplayUnit
    )

    private val listeners = CopyOnWriteArraySet<(Reading, confirmed: Boolean) -> Unit>()
    private val buffer = StringBuilder()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastKeyAtMs = 0L

    private const val BURST_GAP_MS = 350L
    private const val IDLE_SUBMIT_MS = 280L

    private val idleSubmit = Runnable {
        val raw = synchronized(buffer) {
            val value = buffer.toString()
            buffer.setLength(0)
            value
        }
        deliver(raw, confirmed = false)
    }

    fun addListener(listener: (Reading, confirmed: Boolean) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (Reading, confirmed: Boolean) -> Unit) {
        listeners.remove(listener)
    }

    fun dispatch(event: KeyEvent, focused: View?): Boolean {
        if (!enabled) return false
        if (event.action != KeyEvent.ACTION_DOWN) return false
        if (isVisibleTextEntry(focused)) return false

        val now = System.currentTimeMillis()
        synchronized(buffer) {
            if (now - lastKeyAtMs > BURST_GAP_MS) buffer.setLength(0)
            lastKeyAtMs = now
        }
        mainHandler.removeCallbacks(idleSubmit)

        when (event.keyCode) {
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_NUMPAD_ENTER,
            KeyEvent.KEYCODE_TAB -> {
                val raw = synchronized(buffer) {
                    val value = buffer.toString()
                    buffer.setLength(0)
                    value
                }
                return deliver(raw, confirmed = true)
            }
            KeyEvent.KEYCODE_DEL, KeyEvent.KEYCODE_FORWARD_DEL -> {
                synchronized(buffer) {
                    if (buffer.isNotEmpty()) buffer.deleteCharAt(buffer.length - 1)
                }
                return synchronized(buffer) { buffer.isNotEmpty() }
            }
            else -> {
                val ch = charFrom(event) ?: return false
                synchronized(buffer) { buffer.append(ch) }
                mainHandler.postDelayed(idleSubmit, IDLE_SUBMIT_MS)
                return true
            }
        }
    }

    private fun deliver(raw: String, confirmed: Boolean): Boolean {
        val cleaned = raw.replace(Regex("[\\x00-\\x1F\\x7F]"), "").trim()
        if (cleaned.length < 1) return false
        val parsed = ScaleWedgeParser.parse(cleaned) ?: return false
        val reading = Reading(parsed.weightKg, parsed.displayUnit)
        listeners.forEach { it(reading, confirmed) }
        return true
    }

    private fun charFrom(event: KeyEvent): Char? {
        val unicode = event.unicodeChar
        if (unicode != 0 && !Character.isISOControl(unicode)) {
            return unicode.toChar()
        }
        val label = event.displayLabel
        if (label != '\u0000' && !label.isISOControl() && label.code in 32..126) {
            return label
        }
        return null
    }

    private fun isVisibleTextEntry(focused: View?): Boolean {
        if (focused == null || !focused.isShown) return false
        if (focused.width <= 2 || focused.height <= 2) return false
        return focused is EditText || (focused is TextView && focused.isTextSelectable && focused.hasFocus())
    }
}
