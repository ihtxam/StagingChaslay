package com.chaslay.pos.data.local

import android.content.Context
import android.util.Log
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.chaslay.pos.data.preferences.SyncPreferences
import java.security.MessageDigest

class DatabaseCallback(
    private val context: Context
) : RoomDatabase.Callback() {
    override fun onCreate(db: SupportSQLiteDatabase) {
        super.onCreate(db)
        seedAll(db)
    }

    override fun onOpen(db: SupportSQLiteDatabase) {
        super.onOpen(db)
        runCatching { runOnOpenMaintenance(db) }
            .onFailure { Log.e(TAG, "Database onOpen maintenance failed — continuing with best-effort open", it) }
    }

    private fun runOnOpenMaintenance(db: SupportSQLiteDatabase) {
        wipeLegacyOrderDataIfNeeded(db)
        val prefs = context.getSharedPreferences("pos_migrations", Context.MODE_PRIVATE)
        val menuCloudSynced =
            SyncPreferences.hasRemoteMenuSync(context) || hasCloudSyncedCatalog(db)
        if (!menuCloudSynced) {
            runCatching {
                if (count(db, "categories") == 0L || count(db, "products") == 0L) {
                    SushiSakeCatalogSeeder.seed(db)
                } else if (
                    !prefs.getBoolean("sushi_migration_v1", false) &&
                    SushiSakeCatalogSeeder.isLegacySoupDemo(db)
                ) {
                    SushiSakeCatalogSeeder.replaceCatalog(db)
                    prefs.edit().putBoolean("sushi_migration_v1", true).apply()
                }
            }.onFailure { Log.w(TAG, "Catalog seed/migration skipped", it) }
        }
        if (count(db, "roles") == 0L) {
            seedRoles(db)
        }
        if (count(db, "users") == 0L) {
            seedUsers(db)
        }
        if (count(db, "business_settings") == 0L) {
            seedSettings(db)
        }
        migrateLegacyBundledFloorPlanIfNeeded(db, prefs)
        seedOrRepairFloorPlan(db)
        if (count(db, "discount_presets") == 0L) {
            seedDiscountPresets(db)
        }
        if (count(db, "cancel_reasons") == 0L) {
            seedCancelReasons(db)
        }
        if (count(db, "customers") == 0L) {
            seedCustomers(db)
        }
        migrateDemoStaffPinsIfNeeded(db, prefs)
        runCatching {
            db.execSQL(
                """
                UPDATE products
                SET stockQuantity = 50, lowStockThreshold = 5
                WHERE stockQuantity IS NULL AND isOpenPrice = 0
                """.trimIndent()
            )
            fixCorruptedProductNames(db)
        }.onFailure { Log.w(TAG, "Product name repair skipped", it) }
    }

    /**
     * Demo floor seed used to run when [restaurant_tables] was empty even if the merchant
     * already had real floors — that re-injected 20 demo tables and could desync plans.
     * Only seed demo data when both floors and tables are empty; otherwise repair orphans.
     */
    /** One-time: drop legacy Main Floor / Patio 20-table demo in favour of Salle / Terrace. */
    private fun migrateLegacyBundledFloorPlanIfNeeded(
        db: SupportSQLiteDatabase,
        prefs: android.content.SharedPreferences,
    ) {
        if (prefs.getBoolean("default_floor_plan_v2", false)) return
        val floors = mutableListOf<Pair<Long, String>>()
        db.query("SELECT id, name FROM table_floors WHERE isActive = 1").use { cursor ->
            while (cursor.moveToNext()) {
                floors += cursor.getLong(0) to cursor.getString(1).orEmpty()
            }
        }
        val hasRemoteFloor = db.query(
            "SELECT COUNT(*) FROM table_floors WHERE isActive = 1 AND remoteId IS NOT NULL AND TRIM(remoteId) != ''"
        ).use { c ->
            c.moveToFirst() && c.getLong(0) > 0L
        }
        if (hasRemoteFloor) {
            prefs.edit().putBoolean("default_floor_plan_v2", true).apply()
            return
        }
        val legacyNames = floors.map { it.second.trim() }.toSet()
        val isLegacyMainPatio = legacyNames.contains("Main Floor") && legacyNames.contains("Patio")
        val tableCount = count(db, "restaurant_tables")
        if (!isLegacyMainPatio && tableCount <= 10L) {
            prefs.edit().putBoolean("default_floor_plan_v2", true).apply()
            return
        }
        if (!isLegacyMainPatio && tableCount > 10L) {
            prefs.edit().putBoolean("default_floor_plan_v2", true).apply()
            return
        }
        db.execSQL("DELETE FROM floor_plan_elements")
        db.execSQL("DELETE FROM restaurant_tables")
        db.execSQL("DELETE FROM table_floors")
        DefaultFloorPlanSeeder.seedSql(db)
        prefs.edit().putBoolean("default_floor_plan_v2", true).apply()
    }

    private fun seedOrRepairFloorPlan(db: SupportSQLiteDatabase) {
        val floorCount = count(db, "table_floors")
        val tableCount = count(db, "restaurant_tables")
        when {
            floorCount == 0L && tableCount == 0L -> {
                seedTableFloors(db)
                seedTables(db)
            }
            floorCount == 0L && tableCount > 0L -> {
                seedTableFloors(db)
                repairOrphanTableFloorIds(db)
            }
            floorCount > 0L && tableCount == 0L -> {
                // Merchant cleared tables — do not inject demo tables over a custom floor plan.
            }
            else -> repairOrphanTableFloorIds(db)
        }
    }

    private fun repairOrphanTableFloorIds(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            UPDATE restaurant_tables
            SET floorId = (
                SELECT id FROM table_floors WHERE isActive = 1 ORDER BY sortOrder, id LIMIT 1
            )
            WHERE floorId NOT IN (SELECT id FROM table_floors)
            """.trimIndent()
        )
    }

    /** Repair catalog names saved with broken encoding (Snacké, Thon Ø50, etc.). */
    private fun fixCorruptedProductNames(db: SupportSQLiteDatabase) {
        repairMojibakeInCatalog(db)
        val fixes = listOf(
            "Spring Saumon Snack\u00E9" to listOf(
                "Spring Saumon Snack\uFFFD",
                "Spring Saumon Snack?",
                "Spring Saumon Snack\u00C3\u00A9"
            ),
            "Yakisoba Saumon Snack\u00E9" to listOf(
                "Yakisoba Saumon Snack\uFFFD",
                "Yakisoba Saumon Snack?",
                "Yakisoba Saumon Snack\u00C3\u00A9"
            ),
            "Thon \u00D850" to listOf(
                "Thon O50",
                "Thon o50",
                "Thon ?50",
                "Thon \uFFFD50"
            )
        )
        fixes.forEach { (correct, variants) ->
            variants.forEach { bad ->
                db.execSQL(
                    "UPDATE products SET name = ? WHERE name = ?",
                    arrayOf(correct, bad)
                )
            }
        }
    }

    /** UTF-8 mis-read as Latin-1 in SQLite (SnackÃ©, Thon Ã˜50, etc.). */
    private fun repairMojibakeInCatalog(db: SupportSQLiteDatabase) {
        val replacements = listOf(
            "\u00C3\u00A9" to "\u00E9",
            "\u00C3\u00A8" to "\u00E8",
            "\u00C3\u00AA" to "\u00EA",
            "\u00C3\u00AB" to "\u00EB",
            "\u00C3\u00BC" to "\u00FC",
            "\u00C3\u00B6" to "\u00F6",
            "\u00C3\u00A4" to "\u00E4",
            "\u00C3\u00A7" to "\u00E7",
            "\u00C3\u0089" to "\u00C9",
            "\u00C3\u0098" to "\u00D8",
            "\u00C3\u00B8" to "\u00F8",
            "\u00C2\u00B0" to "\u00B0"
        )
        replacements.forEach { (bad, good) ->
            db.execSQL("UPDATE products SET name = REPLACE(name, ?, ?)", arrayOf(bad, good))
            db.execSQL("UPDATE categories SET name = REPLACE(name, ?, ?)", arrayOf(bad, good))
        }
    }

    private fun count(db: SupportSQLiteDatabase, table: String): Long {
        db.query("SELECT COUNT(*) FROM $table").use { cursor ->
            return if (cursor.moveToFirst()) cursor.getLong(0) else 0L
        }
    }

    /** Products pulled from panel carry a remoteId — never overwrite with demo seed. */
    private fun hasCloudSyncedCatalog(db: SupportSQLiteDatabase): Boolean {
        db.query(
            "SELECT COUNT(*) FROM products WHERE remoteId IS NOT NULL AND TRIM(remoteId) != ''"
        ).use { cursor ->
            return cursor.moveToFirst() && cursor.getLong(0) > 0L
        }
    }

    private fun seedAll(db: SupportSQLiteDatabase) {
        seedRoles(db)
        seedUsers(db)
        seedSettings(db)
        seedTableFloors(db)
        seedTables(db)
        SushiSakeCatalogSeeder.seed(db)
        seedDiscountPresets(db)
        seedCancelReasons(db)
        seedCustomers(db)
    }

    private fun seedRoles(db: SupportSQLiteDatabase) {
        val allPerms = "USE_POS,PROCESS_PAYMENTS,APPLY_DISCOUNTS,OPEN_CASH_DRAWER,SEND_KITCHEN,MANAGE_TABLES,TAKEAWAY_ORDERS,DELIVERY_ORDERS,VIEW_ORDER_HISTORY,CANCEL_ORDERS,REFUND_ORDERS,VIEW_REPORTS,MANAGE_PRODUCTS,ACCESS_SETTINGS,MANAGE_USERS,MANAGE_ROLES,END_OF_DAY"
        val waiterPerms = "USE_POS,PROCESS_PAYMENTS,APPLY_DISCOUNTS,OPEN_CASH_DRAWER,SEND_KITCHEN,MANAGE_TABLES,TAKEAWAY_ORDERS,VIEW_ORDER_HISTORY,CANCEL_ORDERS"
        val deliveryPerms = "USE_POS,DELIVERY_ORDERS,VIEW_ORDER_HISTORY,SEND_KITCHEN,PROCESS_PAYMENTS"
        val managerPerms = "USE_POS,PROCESS_PAYMENTS,APPLY_DISCOUNTS,OPEN_CASH_DRAWER,SEND_KITCHEN,MANAGE_TABLES,TAKEAWAY_ORDERS,DELIVERY_ORDERS,VIEW_ORDER_HISTORY,CANCEL_ORDERS,REFUND_ORDERS,VIEW_REPORTS,MANAGE_PRODUCTS,ACCESS_SETTINGS,END_OF_DAY"
        val cashierPerms = "USE_POS,PROCESS_PAYMENTS,TAKEAWAY_ORDERS,VIEW_ORDER_HISTORY,OPEN_CASH_DRAWER,APPLY_DISCOUNTS"
        listOf(
            Triple(1L, "Admin", allPerms),
            Triple(2L, "Waiter", waiterPerms),
            Triple(3L, "Delivery", deliveryPerms),
            Triple(4L, "Manager", managerPerms),
            Triple(5L, "Cashier", cashierPerms)
        ).forEach { (id, name, perms) ->
            db.execSQL(
                """
                INSERT OR IGNORE INTO roles (id, name, permissions, isSystem)
                VALUES ($id, '${q(name)}', '${q(perms)}', 1)
                """.trimIndent()
            )
        }
    }

    private fun seedUsers(db: SupportSQLiteDatabase) {
        val now = System.currentTimeMillis()
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (1, 'Admin', 'admin@foodtruck.local', '${hash("1234")}', '${hash("admin123")}', 1, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (2, 'Waiter', NULL, '${hash("1111")}', NULL, 2, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (3, 'Delivery', NULL, '${hash("2222")}', NULL, 3, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (4, 'Cashier', NULL, '${hash("4444")}', NULL, 5, 1, 0, $now)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
            VALUES (5, 'Manager', NULL, '${hash("0000")}', NULL, 4, 1, 0, $now)
            """.trimIndent()
        )
    }

    private fun seedSettings(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            INSERT OR IGNORE INTO business_settings (
                id, businessName, vatNumber, address, phone, email, website,
                defaultCurrency, currencySymbol, defaultLanguage,
                tapToPayEnabled, adyenTerminalEnabled, adyenTerminalId, adyenApiKey, adyenMerchantAccount,
                paymentMethodsManagedByCloud,
                dineInVatRate, takeawayVatRate, defaultServiceType, posMode,
                receiptBaseUrl, receiptHeader, receiptFooter, kitchenTicketHeader, kitchenTicketFooter
            ) VALUES (
                1, '${q("Sushi Sake")}', '', '${q("17 Rue Cheneau-de-Bourg, 1003 Lausanne")}', '+41 79 621 39 37', 'noreply@rebornsense.com', '',
                'CHF', 'CHF', 'fr',
                0, 0, '', '', '',
                0,
                8.1, 2.6, 'TAKEAWAY', 'RESTAURANT',
                'https://pay.rebornsense.com/receipt',
                '${q("Sushi Sake")}', '${q("Merci!")}', '', ''
            )
            """.trimIndent()
        )
    }

    private fun seedTableFloors(db: SupportSQLiteDatabase) {
        DefaultFloorPlanSeeder.seedSql(db)
    }

    private fun seedTables(db: SupportSQLiteDatabase) {
        // Tables are inserted together with floors in [DefaultFloorPlanSeeder.seedSql].
    }

    private fun seedDiscountPresets(db: SupportSQLiteDatabase) {
        listOf(
            Triple(1, "VIP", 10.0),
            Triple(2, "Student", 15.0),
            Triple(3, "Staff", 20.0)
        ).forEach { (id, name, percent) ->
            db.execSQL(
                """
                INSERT OR IGNORE INTO discount_presets (id, name, percent, isActive, sortOrder)
                VALUES ($id, '${q(name)}', $percent, 1, $id)
                """.trimIndent()
            )
        }
    }

    private fun seedCustomers(db: SupportSQLiteDatabase) {
        val now = System.currentTimeMillis()
        listOf(
            Triple("Abigail Peterson", "+1 555-0101", "abigail@example.com"),
            Triple("Acme Corporation", "+1 555-0102", "orders@acme.example.com"),
            Triple("Anita Oliver", "+1 555-0103", "anita@example.com")
        ).forEachIndexed { index, (name, phone, email) ->
            val address = when (index) {
                0 -> "77 Santa Barbara Rd, Pleasant Hill CA 94523, United States"
                1 -> "100 Market St, San Francisco CA 94105, United States"
                else -> "12 Oak Avenue, Oakland CA 94607, United States"
            }
            db.execSQL(
                """
                INSERT OR IGNORE INTO customers (id, name, phone, email, address, zip, notes, createdAt)
                VALUES (${index + 1}, '${q(name)}', '${q(phone)}', '${q(email)}', '${q(address)}', '', '', $now)
                """.trimIndent()
            )
        }
    }

    private fun seedCancelReasons(db: SupportSQLiteDatabase) {
        listOf(
            "Could not process order",
            "Kitchen too busy",
            "Client cancellation",
            "Out of stock",
            "Wrong order entered",
            "Other"
        ).forEachIndexed { index, reason ->
            db.execSQL(
                """
                INSERT OR IGNORE INTO cancel_reasons (id, label, sortOrder, isActive)
                VALUES (${index + 1}, '${q(reason)}', ${index + 1}, 1)
                """.trimIndent()
            )
        }
    }

    /** Avoid demo Cashier PIN 0000 colliding with synced manager PINs on merchant devices. */
    private fun migrateDemoStaffPinsIfNeeded(
        db: SupportSQLiteDatabase,
        prefs: android.content.SharedPreferences
    ) {
        if (prefs.getBoolean("demo_staff_pin_v51", false)) return
        val now = System.currentTimeMillis()
        val legacyCashierPin = hash("0000")
        val newCashierPin = hash("4444")
        val managerPin = hash("0000")
        db.execSQL(
            """
            UPDATE users
            SET pinHash = '$newCashierPin'
            WHERE id = 4 AND email IS NULL AND name = 'Cashier' AND pinHash = '$legacyCashierPin'
            """.trimIndent()
        )
        val managerExists = db.query("SELECT id FROM users WHERE id = 5 LIMIT 1").use { cursor ->
            cursor.moveToFirst()
        }
        if (!managerExists) {
            db.execSQL(
                """
                INSERT OR IGNORE INTO users (id, name, email, pinHash, passwordHash, roleId, isActive, biometricEnabled, createdAt)
                VALUES (5, 'Manager', NULL, '$managerPin', NULL, 4, 1, 0, $now)
                """.trimIndent()
            )
        }
        val syncedStaff = db.query("SELECT id FROM users WHERE email LIKE 'sync:%' LIMIT 1").use { cursor ->
            cursor.moveToFirst()
        }
        if (syncedStaff) {
            db.execSQL(
                """
                UPDATE users
                SET isActive = 0
                WHERE id IN (1, 2, 3, 4, 5) AND email IS NULL
                """.trimIndent()
            )
        }
        prefs.edit().putBoolean("demo_staff_pin_v51", true).apply()
    }

    /** One-time wipe so client handoff builds start without demo sales history. */
    private fun wipeLegacyOrderDataIfNeeded(db: SupportSQLiteDatabase) {
        val prefs = context.getSharedPreferences("pos_migrations", Context.MODE_PRIVATE)
        if (prefs.getBoolean("client_order_wipe_v2", false)) return
        db.execSQL("DELETE FROM transaction_items")
        db.execSQL("DELETE FROM transactions")
        db.execSQL("DELETE FROM kitchen_messages")
        db.execSQL("DELETE FROM table_order_items")
        db.execSQL("DELETE FROM table_orders")
        db.execSQL("DELETE FROM held_order_items")
        db.execSQL("DELETE FROM held_orders")
        prefs.edit().putBoolean("client_order_wipe_v2", true).apply()
    }

    private fun q(value: String): String = value.replace("'", "''")

    private fun hash(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val TAG = "DatabaseCallback"
    }
}
