package com.chaslay.pos.debug

import android.content.Context
import android.os.Build
import com.chaslay.pos.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** Rolling on-device trace (Sunmi bind/print, printer routing, etc.) for support uploads. */
@Singleton
class PosDiagnosticLogger @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val dir: File
        get() = File(context.filesDir, "pos_diagnostics").also { it.mkdirs() }

    private val sessionFile: File
        get() = File(dir, "session.log")

    private val lock = Any()

    fun log(tag: String, message: String) {
        appendLine(level = "I", tag = tag, message = message)
    }

    fun logWarn(tag: String, message: String, throwable: Throwable? = null) {
        val full = if (throwable != null) {
            "$message — ${throwable.message ?: throwable.javaClass.simpleName}"
        } else {
            message
        }
        appendLine(level = "W", tag = tag, message = full)
    }

    fun logSunmiBind(phase: String, detail: String? = null) {
        val msg = buildString {
            append("bind phase=")
            append(phase)
            detail?.trim()?.takeIf { it.isNotEmpty() }?.let {
                append(" ")
                append(it)
            }
        }
        appendLine(level = "I", tag = "SunmiBind", message = msg)
    }

    fun logSunmiPrint(operation: String, detail: String? = null, error: Throwable? = null) {
        val level = if (error != null) "E" else "I"
        val msg = buildString {
            append("print op=")
            append(operation)
            detail?.trim()?.takeIf { it.isNotEmpty() }?.let {
                append(" ")
                append(it)
            }
            error?.let {
                append(" error=")
                append(it.message ?: it.javaClass.simpleName)
            }
        }
        appendLine(level = level, tag = "SunmiPrint", message = msg)
    }

    fun tailSessionLines(maxLines: Int = MAX_TAIL_LINES): String {
        if (!sessionFile.exists()) return "(no session log yet)\n"
        val lines = sessionFile.readLines()
        val tail = lines.takeLast(maxLines)
        return tail.joinToString("\n").let { if (it.isBlank()) "(empty session log)\n" else "$it\n" }
    }

    fun buildSupportPayload(crashLogger: CrashLogger): String {
        val whenLabel = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date())
        return buildString {
            appendLine("=== Reborn POS diagnostic export ===")
            appendLine("Collected: $whenLabel")
            appendLine("App: ${BuildConfig.VERSION_NAME} (${context.packageName})")
            appendLine("Build: ${if (BuildConfig.DEBUG) "debug" else "release"}")
            appendLine("API host: ${BuildConfig.LICENSE_API_BASE_URL}")
            appendLine("Diagnostic API: ${BuildConfig.DIAGNOSTIC_API_BASE_URL}")
            appendLine("Device: ${Build.MANUFACTURER} ${Build.MODEL} SDK ${Build.VERSION.SDK_INT}")
            appendLine()
            appendLine("--- Session log (recent) ---")
            append(tailSessionLines())
            appendLine()
            appendLine("--- Pending crash/error files ---")
            val crashDir = File(context.filesDir, "crashes")
            val files = crashDir.listFiles()
                ?.filter { it.isFile && it.name.endsWith(".log") }
                ?.sortedByDescending { it.lastModified() }
                .orEmpty()
            if (files.isEmpty()) {
                appendLine("(none)")
            } else {
                files.take(8).forEach { file ->
                    appendLine()
                    appendLine("### ${file.name}")
                    append(
                        DiagnosticLogUploader.redactSecrets(file.readText())
                            .take(CRASH_SNIPPET_CHARS)
                    )
                    if (file.length() > CRASH_SNIPPET_CHARS) appendLine("\n… (truncated)")
                    appendLine()
                }
            }
            appendLine()
            appendLine("--- Crash log index ---")
            crashLogger.listLogs().take(20).forEach { entry ->
                appendLine("${entry.fileName} @ ${entry.title}")
            }
        }.let { DiagnosticLogUploader.redactSecrets(it).take(MAX_EXPORT_CHARS) }
    }

    /** Text file for share sheet (includes full session + crash snippets). */
    fun writeShareExport(crashLogger: CrashLogger): File {
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val file = File(dir, "pos_support_$stamp.txt")
        file.writeText(buildSupportPayload(crashLogger))
        return file
    }

    private fun appendLine(level: String, tag: String, message: String) {
        val stamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(Date())
        val line = "$stamp $level/$tag: $message"
        synchronized(lock) {
            sessionFile.appendText("$line\n")
            trimSessionFile()
        }
    }

    private fun trimSessionFile() {
        val lines = sessionFile.readLines()
        if (lines.size <= MAX_SESSION_LINES) return
        sessionFile.writeText(lines.takeLast(MAX_SESSION_LINES).joinToString("\n") + "\n")
    }

    companion object {
        private const val MAX_SESSION_LINES = 4_000
        private const val MAX_TAIL_LINES = 800
        private const val MAX_EXPORT_CHARS = 120_000
        private const val CRASH_SNIPPET_CHARS = 12_000
    }
}
