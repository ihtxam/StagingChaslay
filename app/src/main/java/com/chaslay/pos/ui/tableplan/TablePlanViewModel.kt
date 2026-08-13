package com.chaslay.pos.ui.tableplan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.entity.FloorPlanElementEntity
import com.chaslay.pos.data.local.entity.RestaurantTableEntity
import com.chaslay.pos.data.local.entity.TableFloorEntity
import com.chaslay.pos.data.repository.TableOrderRepository
import com.chaslay.pos.domain.model.FloorPlanElementType
import com.chaslay.pos.domain.model.TableShape
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

data class TablePlanUiState(
    val floors: List<TableFloorEntity> = emptyList(),
    val selectedFloorId: Long = 1,
    val tables: List<RestaurantTableEntity> = emptyList(),
    val elements: List<FloorPlanElementEntity> = emptyList(),
    val selectedTableId: Long? = null,
    val selectedElementId: Long? = null,
    val editName: String = "",
    val editSeats: String = "4",
    val editShape: TableShape = TableShape.ROUND,
    val editPlanWidthPct: String = "12",
    val editPlanHeightPct: String = "12",
    val showEditDialog: Boolean = false,
    val showElementEditDialog: Boolean = false,
    val editElementLabel: String = "",
    val newFloorName: String = "",
    val message: String? = null
)

@HiltViewModel
class TablePlanViewModel @Inject constructor(
    private val tableOrderRepository: TableOrderRepository,
    private val floorPlanSyncRepository: com.chaslay.pos.sync.FloorPlanSyncRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TablePlanUiState())
    val uiState: StateFlow<TablePlanUiState> = _uiState.asStateFlow()

    init {
        reload()
    }

    fun reload() {
        viewModelScope.launch {
            runCatching { floorPlanSyncRepository.syncFloorPlans() }
            val floors = tableOrderRepository.getAllFloors()
            val floorId = _uiState.value.selectedFloorId.takeIf { id ->
                floors.any { it.id == id }
            } ?: floors.firstOrNull()?.id ?: 1L
            var tables = tableOrderRepository.getTablesForFloor(floorId)
            // Skip auto-grid when tables were synced from the merchant panel.
            if (tables.none { !it.remoteId.isNullOrBlank() } && tablesAreClustered(tables)) {
                tableOrderRepository.autoLayoutFloor(floorId)
                tables = tableOrderRepository.getTablesForFloor(floorId)
            }
            val elements = tableOrderRepository.getFloorElements(floorId)
            _uiState.update {
                it.copy(
                    floors = floors,
                    selectedFloorId = floorId,
                    tables = tables,
                    elements = elements,
                    message = null
                )
            }
        }
    }

    private fun tablesAreClustered(tables: List<RestaurantTableEntity>): Boolean {
        if (tables.size < 2) return false
        val xs = tables.map { it.planX }
        val ys = tables.map { it.planY }
        val xSpan = (xs.maxOrNull() ?: 0f) - (xs.minOrNull() ?: 0f)
        val ySpan = (ys.maxOrNull() ?: 0f) - (ys.minOrNull() ?: 0f)
        // All nearly on one row/column, or piled at the origin.
        return (ySpan < 0.06f && tables.size >= 3) ||
            (xSpan < 0.06f && tables.size >= 3) ||
            tables.all { it.planX <= 0.02f && it.planY <= 0.02f }
    }

    fun clearSelection() {
        _uiState.update {
            it.copy(
                selectedTableId = null,
                selectedElementId = null,
                showEditDialog = false,
                showElementEditDialog = false
            )
        }
    }

    fun selectFloor(floorId: Long) {
        viewModelScope.launch {
            var tables = tableOrderRepository.getTablesForFloor(floorId)
            if (tables.none { !it.remoteId.isNullOrBlank() } && tablesAreClustered(tables)) {
                tableOrderRepository.autoLayoutFloor(floorId)
                tables = tableOrderRepository.getTablesForFloor(floorId)
            }
            val elements = tableOrderRepository.getFloorElements(floorId)
            _uiState.update {
                it.copy(
                    selectedFloorId = floorId,
                    tables = tables,
                    elements = elements,
                    selectedTableId = null,
                    selectedElementId = null
                )
            }
        }
    }

    fun selectTable(tableId: Long) {
        val table = _uiState.value.tables.find { it.id == tableId } ?: return
        // Tap selects only — drag can move without opening the edit dialog.
        _uiState.update {
            it.copy(
                selectedTableId = tableId,
                selectedElementId = null,
                editName = table.name,
                editSeats = table.seatCapacity.toString(),
                editShape = TableShape.fromApi(table.shape),
                editPlanWidthPct = (table.planWidth * 100f).roundToInt().toString(),
                editPlanHeightPct = (table.planHeight * 100f).roundToInt().toString(),
                showEditDialog = false,
                showElementEditDialog = false
            )
        }
    }

    fun openEditSelectedTable() {
        val tableId = _uiState.value.selectedTableId ?: return
        val table = _uiState.value.tables.find { it.id == tableId } ?: return
        _uiState.update {
            it.copy(
                editName = table.name,
                editSeats = table.seatCapacity.toString(),
                editShape = TableShape.fromApi(table.shape),
                editPlanWidthPct = (table.planWidth * 100f).roundToInt().toString(),
                editPlanHeightPct = (table.planHeight * 100f).roundToInt().toString(),
                showEditDialog = true,
                showElementEditDialog = false
            )
        }
    }

    fun selectElement(elementId: Long) {
        val element = _uiState.value.elements.find { it.id == elementId } ?: return
        _uiState.update {
            it.copy(
                selectedElementId = elementId,
                selectedTableId = null,
                editElementLabel = element.label.orEmpty(),
                showElementEditDialog = false,
                showEditDialog = false
            )
        }
    }

    fun openEditSelectedElement() {
        val elementId = _uiState.value.selectedElementId ?: return
        val element = _uiState.value.elements.find { it.id == elementId } ?: return
        _uiState.update {
            it.copy(
                editElementLabel = element.label.orEmpty(),
                showElementEditDialog = true,
                showEditDialog = false
            )
        }
    }

    fun dismissEditDialog() = clearSelection()

    fun dismissElementEditDialog() = clearSelection()

    fun updateEditName(value: String) = _uiState.update { it.copy(editName = value) }
    fun updateEditSeats(value: String) = _uiState.update { it.copy(editSeats = value) }
    fun updateEditShape(shape: TableShape) = _uiState.update { it.copy(editShape = shape) }
    fun updateEditPlanWidthPct(value: String) = _uiState.update { it.copy(editPlanWidthPct = value) }
    fun updateEditPlanHeightPct(value: String) = _uiState.update { it.copy(editPlanHeightPct = value) }
    fun updateEditElementLabel(value: String) = _uiState.update { it.copy(editElementLabel = value) }
    fun updateNewFloorName(value: String) = _uiState.update { it.copy(newFloorName = value) }

    fun saveSelectedTable() {
        val state = _uiState.value
        val tableId = state.selectedTableId ?: return
        val table = state.tables.find { it.id == tableId } ?: return
        val seats = state.editSeats.toIntOrNull()?.coerceIn(1, 99) ?: table.seatCapacity
        val planWidth = state.editPlanWidthPct.toFloatOrNull()?.div(100f)?.coerceIn(0.04f, 0.5f) ?: table.planWidth
        val planHeight = state.editPlanHeightPct.toFloatOrNull()?.div(100f)?.coerceIn(0.03f, 0.5f) ?: table.planHeight
        val (planX, planY) = clampPlanPosition(table.planX, table.planY, planWidth, planHeight)
        viewModelScope.launch {
            tableOrderRepository.updateTable(
                table.copy(
                    name = state.editName.trim().ifBlank { table.name },
                    seatCapacity = seats,
                    shape = state.editShape.apiValue,
                    planX = planX,
                    planY = planY,
                    planWidth = planWidth,
                    planHeight = planHeight
                )
            )
            reload()
            _uiState.update { it.copy(showEditDialog = false, message = "Table saved") }
        }
    }

    fun saveSelectedElement() {
        val state = _uiState.value
        val elementId = state.selectedElementId ?: return
        val element = state.elements.find { it.id == elementId } ?: return
        viewModelScope.launch {
            tableOrderRepository.updateFloorElement(
                element.copy(label = state.editElementLabel.trim().ifBlank { null })
            )
            reload()
            _uiState.update { it.copy(showElementEditDialog = false, message = "Element saved") }
        }
    }

    fun deleteSelectedTable() {
        val tableId = _uiState.value.selectedTableId ?: return
        viewModelScope.launch {
            tableOrderRepository.deleteTable(tableId)
            reload()
            _uiState.update { it.copy(showEditDialog = false, message = "Table removed") }
        }
    }

    fun deleteSelectedElement() {
        val elementId = _uiState.value.selectedElementId ?: return
        viewModelScope.launch {
            tableOrderRepository.deleteFloorElement(elementId)
            reload()
            _uiState.update { it.copy(showElementEditDialog = false, message = "Element removed") }
        }
    }

    fun addTable() {
        val floorId = _uiState.value.selectedFloorId
        val count = _uiState.value.tables.size + 1
        viewModelScope.launch {
            tableOrderRepository.addTable("Table $count", floorId = floorId, seatCapacity = 4)
            reload()
            _uiState.update { it.copy(message = "Table added — drag to position") }
        }
    }

    fun addElement(type: FloorPlanElementType) {
        viewModelScope.launch {
            tableOrderRepository.addFloorElement(_uiState.value.selectedFloorId, type.apiValue)
            reload()
            _uiState.update { it.copy(message = "${type.apiValue} added — drag to position") }
        }
    }

    fun addFloor() {
        val name = _uiState.value.newFloorName.trim()
        if (name.isBlank()) {
            _uiState.update { it.copy(message = "Enter a floor name") }
            return
        }
        viewModelScope.launch {
            val id = tableOrderRepository.addFloor(name)
            _uiState.update { it.copy(newFloorName = "", selectedFloorId = id) }
            reload()
        }
    }

    fun moveTable(tableId: Long, planX: Float, planY: Float) {
        val table = _uiState.value.tables.find { it.id == tableId } ?: return
        val (x, y) = clampPlanPosition(planX, planY, table.planWidth, table.planHeight)
        val updated = table.copy(planX = x, planY = y)
        _uiState.update { state ->
            state.copy(tables = state.tables.map { if (it.id == tableId) updated else it })
        }
        viewModelScope.launch { tableOrderRepository.updateTable(updated) }
    }

    fun resizeTable(tableId: Long, planX: Float, planY: Float, planWidth: Float, planHeight: Float) {
        val table = _uiState.value.tables.find { it.id == tableId } ?: return
        val w = planWidth.coerceIn(0.04f, 0.5f)
        val h = planHeight.coerceIn(0.03f, 0.5f)
        val (x, y) = clampPlanPosition(planX, planY, w, h)
        val updated = table.copy(planX = x, planY = y, planWidth = w, planHeight = h)
        _uiState.update { state ->
            state.copy(
                tables = state.tables.map { if (it.id == tableId) updated else it },
                editPlanWidthPct = if (state.selectedTableId == tableId) {
                    (w * 100f).roundToInt().toString()
                } else {
                    state.editPlanWidthPct
                },
                editPlanHeightPct = if (state.selectedTableId == tableId) {
                    (h * 100f).roundToInt().toString()
                } else {
                    state.editPlanHeightPct
                }
            )
        }
        viewModelScope.launch { tableOrderRepository.updateTable(updated) }
    }

    fun moveElement(elementId: Long, planX: Float, planY: Float) {
        val element = _uiState.value.elements.find { it.id == elementId } ?: return
        val (x, y) = clampPlanPosition(planX, planY, element.planWidth, element.planHeight)
        val updated = element.copy(planX = x, planY = y)
        _uiState.update { state ->
            state.copy(elements = state.elements.map { if (it.id == elementId) updated else it })
        }
        viewModelScope.launch { tableOrderRepository.updateFloorElement(updated) }
    }

    fun autoLayout() {
        viewModelScope.launch {
            tableOrderRepository.autoLayoutFloor(_uiState.value.selectedFloorId)
            reload()
            _uiState.update { it.copy(message = "Tables arranged in grid") }
        }
    }

    fun clearMessage() = _uiState.update { it.copy(message = null) }
}
