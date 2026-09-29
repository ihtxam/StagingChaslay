package com.rebornsense.printbridge

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Small operational log (USB permission, print denials) separate from crash stacks.
 * Kept at [filesDir]/bridge-events.log, trimmed like [BridgeCrashLog].
 */
object BridgeEventsLog {
    private const val TAG = "BridgeEventsLog"
    private const val FILE_NAME = "bridge-events.log"
    private const val MAX_BYTES = 8 * 1024
    private val lock = Any()

    fun record(context: Context, source: String, message: String) {
        val clean = message.trim().ifBlank { source }
        runCatching {
            Log.i(TAG, "$source: $clean")
            val appContext = context.applicationContext
            val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            val entry = buildString {
                append(stamp)
                append(" v")
                append(BuildConfig.VERSION_NAME)
                append(" ")
                append(source)
                append(": ")
                append(clean)
                append('\n')
            }
            synchronized(lock) {
                val file = File(appContext.filesDir, FILE_NAME)
                file.appendText(entry)
                val bytes = file.readBytes()
                if (bytes.size > MAX_BYTES) {
                    file.writeBytes(bytes.copyOfRange(bytes.size - MAX_BYTES, bytes.size))
                }
            }
        }.onFailure { error ->
            Log.w(TAG, "failed to write events log", error)
        }
    }
}
