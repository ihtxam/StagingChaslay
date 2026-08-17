package com.chaslay.pos.ui.scanner

import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.EditText
import android.widget.TextView
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Hardware USB/HID barcode scanners type digits then Enter. Compose focus is easy to lose
 * after tapping the grid, so [MainActivity] feeds key events here regardless of focus.
 */
object BarcodeWedgeHub {
    @Volatile
    var enabled: Boolean = false

    private val listeners = CopyOnWriteArraySet<(String) -> Unit>()
    private val buffer = StringBuilder()
    private val mainHandler = Handler(Looper.getMainLooper())
    private var lastKeyAtMs = 0L

    private const val BURST_GAP_MS = 160L
    private const val AUTO_SUBMIT_MS = 90L
    private const val MIN_SUBMIT_LEN = 3
    private const val AUTO_SUBMIT_LEN = 6

    private val autoSubmit = Runnable {
        val code = synchronized(buffer) {
            val value = buffer.toString().trim()
            buffer.setLength(0)
            value
        }
        if (code.length >= AUTO_SUBMIT_LEN) emit(code)
    }

    fun addListener(listener: (String) -> Unit) {
        listeners.add(listener)
    }

    fun removeListener(listener: (String) -> Unit) {
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
        mainHandler.removeCallbacks(autoSubmit)

        when (event.keyCode) {
            KeyEvent.KEYCODE_ENTER,
            KeyEvent.KEYCODE_NUMPAD_ENTER,
            KeyEvent.KEYCODE_TAB -> {
                val code = synchronized(buffer) {
                    val value = buffer.toString().trim()
                    buffer.setLength(0)
                    value
                }
                if (code.length >= MIN_SUBMIT_LEN) {
                    emit(code)
                    return true
                }
                return false
            }
            KeyEvent.KEYCODE_DEL, KeyEvent.KEYCODE_FORWARD_DEL -> {
                synchronized(buffer) {
                    if (buffer.isNotEmpty()) buffer.deleteCharAt(buffer.length - 1)
                }
                return synchronized(buffer) { buffer.isNotEmpty() }
            }
            else -> {
                val ch = charFrom(event) ?: return false
                val length = synchronized(buffer) {
                    buffer.append(ch)
                    buffer.length
                }
                if (length >= AUTO_SUBMIT_LEN) {
                    mainHandler.postDelayed(autoSubmit, AUTO_SUBMIT_MS)
                }
                return length >= 1
            }
        }
    }

    private fun emit(code: String) {
        listeners.forEach { listener -> listener(code) }
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
