package com.chaslay.pos.util

import android.content.Context
import com.chaslay.pos.R
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object ScheduledOrderDateFormat {

    private fun startOfDayMs(timeMs: Long): Long {
        val cal = Calendar.getInstance().apply { timeInMillis = timeMs }
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    fun dayKey(timeMs: Long): Long {
        val cal = Calendar.getInstance().apply { timeInMillis = timeMs }
        return cal.get(Calendar.YEAR) * 1000L + cal.get(Calendar.DAY_OF_YEAR)
    }

    /** Group header, e.g. "Today · 23.08.2026" or "Friday · 28.08.2026". */
    fun formatDayHeader(context: Context, timeMs: Long): String {
        val todayStart = startOfDayMs(System.currentTimeMillis())
        val targetStart = startOfDayMs(timeMs)
        val diffDays = ((targetStart - todayStart) / 86_400_000L).toInt()
        val datePart = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date(timeMs))
        return when (diffDays) {
            0 -> "${context.getString(R.string.today)} · $datePart"
            1 -> "${context.getString(R.string.pickup_tomorrow)} · $datePart"
            else -> {
                val weekday = SimpleDateFormat("EEEE", Locale.getDefault()).format(Date(timeMs))
                "$weekday · $datePart"
            }
        }
    }

    /** Per-order label shown on cards, e.g. "23.08.2026 · 14:30". */
    fun formatDateTime(timeMs: Long): String {
        return SimpleDateFormat("dd.MM.yyyy · HH:mm", Locale.getDefault()).format(Date(timeMs))
    }

    fun formatTime(timeMs: Long): String {
        return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(timeMs))
    }
}
