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
