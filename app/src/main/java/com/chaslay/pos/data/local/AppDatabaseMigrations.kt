package com.chaslay.pos.data.local

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

val MIGRATION_50_51 = object : Migration(50, 51) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "ALTER TABLE business_settings ADD COLUMN terminalAskGratuityEnabled INTEGER NOT NULL DEFAULT 0"
        )
    }
}

val MIGRATION_51_52 = object : Migration(51, 52) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "ALTER TABLE business_settings ADD COLUMN expressPayPlacement TEXT NOT NULL DEFAULT 'product_grid'"
        )
        db.execSQL(
            "ALTER TABLE business_settings ADD COLUMN retailCashTenderDialogEnabled INTEGER NOT NULL DEFAULT 1"
        )
    }
}

val MIGRATION_52_53 = object : Migration(52, 53) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            "ALTER TABLE business_settings ADD COLUMN checkoutEurDisplayEnabled INTEGER NOT NULL DEFAULT 0"
        )
        db.execSQL(
            "ALTER TABLE business_settings ADD COLUMN checkoutChfToEurRate REAL NOT NULL DEFAULT 0"
        )
        db.execSQL(
            "ALTER TABLE business_settings ADD COLUMN receiptBodyTextScale INTEGER NOT NULL DEFAULT 1"
        )
    }
}

val MIGRATION_53_54 = object : Migration(53, 54) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "platformAboutHtml")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN platformAboutHtml TEXT NOT NULL DEFAULT ''"
            )
        }
    }
}

val MIGRATION_54_55 = object : Migration(54, 55) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "cdsEnabled")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN cdsEnabled INTEGER NOT NULL DEFAULT 1"
            )
        }
        if (!businessSettingsColumnExists(db, "cdsAccessToken")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN cdsAccessToken TEXT NOT NULL DEFAULT ''"
            )
        }
        if (!businessSettingsColumnExists(db, "cdsShortCode")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN cdsShortCode TEXT NOT NULL DEFAULT ''"
            )
        }
        if (!businessSettingsColumnExists(db, "cdsMerchantSlug")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN cdsMerchantSlug TEXT NOT NULL DEFAULT ''"
            )
        }
        if (!businessSettingsColumnExists(db, "cdsDisplayUrl")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN cdsDisplayUrl TEXT NOT NULL DEFAULT ''"
            )
        }
    }
}

val MIGRATION_55_56 = object : Migration(55, 56) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "invoiceEnabled")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN invoiceEnabled INTEGER NOT NULL DEFAULT 1"
            )
        }
    }
}

val MIGRATION_56_57 = object : Migration(56, 57) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "retailWeighedCustomEntryEnabled")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN retailWeighedCustomEntryEnabled INTEGER NOT NULL DEFAULT 0"
            )
        }
    }
}

val MIGRATION_57_58 = object : Migration(57, 58) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "reservationsEnabled")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN reservationsEnabled INTEGER NOT NULL DEFAULT 0"
            )
        }
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS synced_reservations (
                id TEXT NOT NULL PRIMARY KEY,
                code TEXT NOT NULL,
                guestName TEXT NOT NULL,
                guestPhone TEXT NOT NULL,
                guestEmail TEXT,
                partySize INTEGER NOT NULL,
                reservedAtMs INTEGER NOT NULL,
                status TEXT NOT NULL,
                tableRemoteId TEXT,
                tableLabel TEXT,
                notes TEXT,
                source TEXT,
                syncedAtMs INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS index_synced_reservations_reservedAtMs ON synced_reservations(reservedAtMs)"
        )
    }
}

val MIGRATION_58_59 = object : Migration(58, 59) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "syncTablePlanWithCloud")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN syncTablePlanWithCloud INTEGER NOT NULL DEFAULT 1"
            )
        }
    }
}

val MIGRATION_59_60 = object : Migration(59, 60) {
    override fun migrate(db: SupportSQLiteDatabase) {
        if (!businessSettingsColumnExists(db, "restaurantWeighedCustomEntryEnabled")) {
            db.execSQL(
                "ALTER TABLE business_settings ADD COLUMN restaurantWeighedCustomEntryEnabled INTEGER NOT NULL DEFAULT 0"
            )
        }
    }
}

private fun businessSettingsColumnExists(db: SupportSQLiteDatabase, column: String): Boolean {
    db.query("PRAGMA table_info(business_settings)").use { cursor ->
        val nameIndex = cursor.getColumnIndex("name")
        if (nameIndex < 0) return false
        while (cursor.moveToNext()) {
            if (column == cursor.getString(nameIndex)) return true
        }
    }
    return false
}
