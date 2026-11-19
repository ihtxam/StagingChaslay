package com.chaslay.pos.data.local

import androidx.sqlite.db.SupportSQLiteDatabase
import com.chaslay.pos.data.local.dao.RestaurantTableDao
import com.chaslay.pos.data.local.dao.TableFloorDao
import com.chaslay.pos.data.local.entity.RestaurantTableEntity
import com.chaslay.pos.data.local.entity.TableFloorEntity

/**
 * Default local floor plan for merchants with no panel floor plan yet.
 * Salle + Terrace with a small table count — not the legacy 20-table Main Floor / Patio demo.
 */
object DefaultFloorPlanSeeder {
    const val FLOOR_SALLE = "Salle"
    const val FLOOR_TERRACE = "Terrace"

    private val BUNDLED_FLOOR_NAMES = setOf(
        "Main Floor",
        "Patio",
        FLOOR_SALLE,
        FLOOR_TERRACE,
        "Terrasse",
    )

    private val BUNDLED_TABLE_NAME = Regex("""^(Table\s+\d+|T\d+)$""", RegexOption.IGNORE_CASE)

    fun isBundledFloorName(name: String): Boolean =
        BUNDLED_FLOOR_NAMES.any { it.equals(name.trim(), ignoreCase = true) }

    fun isBundledTableName(name: String): Boolean =
        BUNDLED_TABLE_NAME.matches(name.trim())

    fun isBundledDemoFloorPlan(
        floors: List<TableFloorEntity>,
        tables: List<RestaurantTableEntity>,
    ): Boolean {
        val activeFloors = floors.filter { it.isActive }
        if (activeFloors.isEmpty()) return false
        if (activeFloors.any { !it.remoteId.isNullOrBlank() }) return false
        if (activeFloors.any { !isBundledFloorName(it.name) }) return false
        val activeTables = tables.filter { it.isActive }
        if (activeTables.any { !it.remoteId.isNullOrBlank() }) return false
        return activeTables.all { isBundledTableName(it.name) }
    }

    suspend fun seedWithRoom(
        floorDao: TableFloorDao,
        tableDao: RestaurantTableDao,
    ) {
        val salleId = floorDao.insert(TableFloorEntity(name = FLOOR_SALLE, sortOrder = 1))
        val terraceId = floorDao.insert(TableFloorEntity(name = FLOOR_TERRACE, sortOrder = 2))
        insertDefaultTables(tableDao, salleId, terraceId)
    }

    private suspend fun insertDefaultTables(
        tableDao: RestaurantTableDao,
        salleId: Long,
        terraceId: Long,
    ) {
        val salleLayouts = listOf(
            Triple("T1", 0.10f, 0.14f),
            Triple("T2", 0.30f, 0.14f),
            Triple("T3", 0.50f, 0.14f),
            Triple("T4", 0.10f, 0.40f),
            Triple("T5", 0.30f, 0.40f),
            Triple("T6", 0.50f, 0.40f),
        )
        val terraceLayouts = listOf(
            Triple("T1", 0.18f, 0.22f),
            Triple("T2", 0.48f, 0.22f),
            Triple("T3", 0.18f, 0.52f),
            Triple("T4", 0.48f, 0.52f),
        )
        var sort = 1
        salleLayouts.forEachIndexed { index, (label, x, y) ->
            tableDao.insert(
                RestaurantTableEntity(
                    name = label,
                    sortOrder = sort++,
                    floorId = salleId,
                    seatCapacity = 4,
                    planX = x,
                    planY = y,
                    planWidth = 0.12f,
                    planHeight = 0.12f,
                    shape = "ROUND",
                )
            )
        }
        terraceLayouts.forEachIndexed { index, (label, x, y) ->
            tableDao.insert(
                RestaurantTableEntity(
                    name = label,
                    sortOrder = sort++,
                    floorId = terraceId,
                    seatCapacity = 4,
                    planX = x,
                    planY = y,
                    planWidth = 0.12f,
                    planHeight = 0.12f,
                    shape = "ROUND",
                )
            )
        }
    }

    fun seedSql(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            INSERT OR IGNORE INTO table_floors (id, name, sortOrder, isActive)
            VALUES (1, '${q(FLOOR_SALLE)}', 1, 1)
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT OR IGNORE INTO table_floors (id, name, sortOrder, isActive)
            VALUES (2, '${q(FLOOR_TERRACE)}', 2, 1)
            """.trimIndent()
        )
        listOf(
            listOf(1L, "T1", 0.10f, 0.14f),
            listOf(1L, "T2", 0.30f, 0.14f),
            listOf(1L, "T3", 0.50f, 0.14f),
            listOf(1L, "T4", 0.10f, 0.40f),
            listOf(1L, "T5", 0.30f, 0.40f),
            listOf(1L, "T6", 0.50f, 0.40f),
            listOf(2L, "T1", 0.18f, 0.22f),
            listOf(2L, "T2", 0.48f, 0.22f),
            listOf(2L, "T3", 0.18f, 0.52f),
            listOf(2L, "T4", 0.48f, 0.52f),
        ).forEachIndexed { index, row ->
            val floorId = row[0] as Long
            val label = row[1] as String
            val x = row[2] as Float
            val y = row[3] as Float
            val id = index + 1
            db.execSQL(
                """
                INSERT OR IGNORE INTO restaurant_tables
                (id, name, sortOrder, isActive, floorId, seatCapacity, planX, planY, planWidth, planHeight, shape, rotation)
                VALUES ($id, '${q(label)}', $id, 1, $floorId, 4, $x, $y, 0.12, 0.12, 'ROUND', 0)
                """.trimIndent()
            )
        }
    }

    private fun q(value: String): String = value.replace("'", "''")
}