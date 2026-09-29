package com.rebornsense.printbridge

import android.app.Application
import android.content.Context
import android.util.Log
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * On-device crash log so a tablet can show the last failure without adb.
 * Keeps [filesDir]/bridge-crash.log trimmed to the last [MAX_BYTES].
 */
object BridgeCrashLog {
    private const val TAG = "BridgeCrashLog"
    private const val FILE_NAME = "bridge-crash.log"
    private const val PREFS = "bridge_crash_prefs"
    private const val KEY_REASON = "last_reason"
    private const val MAX_BYTES = 16 * 1024

    private val lock = Any()

    fun install(app: Application) {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            record(app, throwable, "uncaught:${thread.name}")
            if (previous != null && previous !== Thread.getDefaultUncaughtExceptionHandler()) {
                previous.uncaughtException(thread, throwable)
            }
        }
    }

    fun record(context: Context, error: Throwable, source: String) {
        val reason = error.message?.trim()?.takeIf { it.isNotEmpty() } ?: error.javaClass.simpleName
        persistReason(context, "$source: $reason")
        appendEntry(context, source, stackOf(error))
    }

    /** Short line in the same crash log, plus a prefs copy if the file write fails. */
    fun recordReason(context: Context, source: String, message: String) {
        val clean = message.trim().ifBlank { source }
        persistReason(context, "$source: $clean")
        appendEntry(context, source, clean + "\n")
    }

    fun lastReason(context: Context): String? {
        return runCatching {
            context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_REASON, null)
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
        }.getOrNull()
    }

    private fun persistReason(context: Context, reason: String) {
        val clean = reason.trim().take(500)
        if (clean.isEmpty()) return
        runCatching {
            context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_REASON, clean)
                .commit()
        }
    }

    private fun stackOf(error: Throwable): String {
        val stack = StringWriter().also { writer ->
            error.printStackTrace(PrintWriter(writer))
        }.toString()
        return if (stack.endsWith("\n")) stack else stack + "\n"
    }

    private fun appendEntry(context: Context, source: String, body: String) {
        runCatching {
            Log.e(TAG, "$source\n$body")
            val appContext = context.applicationContext
            val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            val entry = buildString {
                append("=== ")
                append(stamp)
                append(" v")
                append(BuildConfig.VERSION_NAME)
                append(" (")
                append(BuildConfig.VERSION_CODE)
                append(") ")
                append(source)
                append(" ===\n")
                append(body)
                if (!body.endsWith("\n")) append('\n')
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
        }.onFailure { writeError ->
            Log.e(TAG, "failed to write crash log", writeError)
        }
    }

    fun read(context: Context): String? {
        return runCatching {
            val file = File(context.applicationContext.filesDir, FILE_NAME)
            if (!file.exists() || file.length() <= 0L) return null
            file.readText().trim().takeIf { it.isNotEmpty() }
        }.getOrNull()
    }

    fun clear(context: Context) {
        runCatching {
            synchronized(lock) {
                File(context.applicationContext.filesDir, FILE_NAME).delete()
            }
            context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_REASON)
                .commit()
        }
    }
}
