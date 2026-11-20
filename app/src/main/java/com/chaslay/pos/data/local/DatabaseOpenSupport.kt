package com.chaslay.pos.data.local

import android.content.Context
import android.util.Log
import java.io.File

/** Deletes Room SQLite files so the next open can recreate schema from scratch. */
internal fun deleteLocalDatabaseFiles(context: Context, name: String) {
    val dbDir = context.getDatabasePath(name).parentFile ?: return
    dbDir.listFiles()?.forEach { file ->
        if (file.name == name || file.name.startsWith("$name-")) {
            if (!file.delete()) {
                Log.w(TAG, "Could not delete DB file ${file.name}")
            }
        }
    }
}

internal const val DATABASE_NAME = "food_truck_pos.db"

private const val TAG = "DatabaseOpen"