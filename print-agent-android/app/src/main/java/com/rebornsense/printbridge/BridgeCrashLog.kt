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
        runCatching {
            Log.e(TAG, source, error)
            val appContext = context.applicationContext
            val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
            val stack = StringWriter().also { writer ->
                error.printStackTrace(PrintWriter(writer))
            }.toString()
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
                append(stack)
                if (!stack.endsWith("\n")) append('\n')
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
        }
    }
}
