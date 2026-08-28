package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.FloorPlanElementType
import com.chaslay.pos.domain.model.TableShape
import com.chaslay.pos.ui.theme.vectronColors

private val AccentTeal = Color(0xFF00897B)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TablePlanDesignerScreen(
    onBack: () -> Unit,
    viewModel: TablePlanViewModel = hiltViewModel()
) {
    val colors = vectronColors()
    Scaffold(
        containerColor = colors.background,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        stringResource(R.string.table_plan_designer),
                        color = colors.textPrimary,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.checkout_back),
                            tint = colors.textPrimary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = colors.header,
                    titleContentColor = colors.textPrimary,
                    navigationIconContentColor = colors.textPrimary
                )
            )
        }
    ) { padding ->
        TablePlanDesignerContent(
            viewModel = viewModel,
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        )
    }
}

/** Embedded designer for Settings → Tables (no second scaffold). */
@Composable
fun TablePlanDesignerContent(
    viewModel: TablePlanViewModel = hiltViewModel(),
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()
    val context = LocalContext.current
    val selectedFloor = state.floors.find { it.id == state.selectedFloorId }
    val isCloudManaged = !selectedFloor?.remoteId.isNullOrBlank() ||
        state.tables.any { !it.remoteId.isNullOrBlank() }
    val designCanvasWidth = selectedFloor?.canvasWidth?.coerceAtLeast(320) ?: 1000
    val designCanvasHeight = selectedFloor?.canvasHeight?.coerceAtLeast(240) ?: 700
    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = colors.textPrimary,
        unfocusedTextColor = colors.textPrimary,
        focusedBorderColor = AccentTeal,
        unfocusedBorderColor = colors.textSecondary.copy(alpha = 0.4f),
        focusedLabelColor = AccentTeal,
        unfocusedLabelColor = colors.textSecondary,
        cursorColor = AccentTeal
    )

    LaunchedEffect(state.message) {
        state.message?.let { msg ->
            android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_SHORT).show()
            viewModel.clearMessage()
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            state.floors.forEach { floor ->
                FilterChip(
                    selected = floor.id == state.selectedFloorId,
                    onClick = { viewModel.selectFloor(floor.id) },
                    label = { Text(floor.name, fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentTeal,
                        selectedLabelColor = Color.White,
                        containerColor = colors.panelLight,
                        labelColor = colors.textPrimary
                    )
                )
            }
            Button(
                onClick = viewModel::addTable,
                enabled = !isCloudManaged,
                colors = ButtonDefaults.buttonColors(containerColor = AccentTeal),
                contentPadding = ButtonDefaults.ContentPadding
            ) {
                Icon(Icons.Default.Add, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.add_table), fontSize = 13.sp)
            }
            OutlinedButton(onClick = viewModel::autoLayout, enabled = !isCloudManaged) {
                Icon(Icons.Default.GridView, contentDescription = null)
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.auto_layout), fontSize = 13.sp)
            }
            OutlinedButton(
                onClick = { viewModel.addElement(FloorPlanElementType.WALL) },
                enabled = !isCloudManaged
            ) {
                Text(stringResource(R.string.add_wall), fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = { viewModel.addElement(FloorPlanElementType.DOOR) },
                enabled = !isCloudManaged
            ) {
                Text(stringResource(R.string.add_door), fontSize = 12.sp)
            }
            OutlinedButton(
                onClick = { viewModel.addElement(FloorPlanElementType.BAR) },
                enabled = !isCloudManaged
            ) {
                Text(stringResource(R.string.add_bar), fontSize = 12.sp)
            }
            OutlinedTextField(
                value = state.newFloorName,
                onValueChange = viewModel::updateNewFloorName,
                label = { Text(stringResource(R.string.new_floor_name), fontSize = 11.sp) },
                singleLine = true,
                enabled = !isCloudManaged,
                colors = fieldColors,
                modifier = Modifier.width(160.dp)
            )
            OutlinedButton(onClick = viewModel::addFloor, enabled = !isCloudManaged) {
                Text(stringResource(R.string.add_floor), fontSize = 12.sp)
            }
        }

        if (isCloudManaged) {
            Text(
                stringResource(R.string.table_plan_cloud_managed),
                fontSize = 11.sp,
                color = Color(0xFF00897B),
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 4.dp, bottom = 4.dp)
            )
        }

        Text(
            stringResource(
                if (isCloudManaged) R.string.table_plan_cloud_help else R.string.table_plan_help
            ),
            fontSize = 11.sp,
            color = colors.textSecondary,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .heightIn(min = 280.dp)
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, colors.gridGap, RoundedCornerShape(10.dp))
        ) {
            FloorPlanCanvas(
                tables = state.tables.map { table ->
                    FloorPlanTableDisplay(
                        id = table.id,
                        name = table.name,
                        seatCapacity = table.seatCapacity,
                        planX = table.planX,
                        planY = table.planY,
                        planWidth = table.planWidth,
                        planHeight = table.planHeight,
                        shape = table.shape,
                        rotation = table.rotation,
                        isActive = table.id == state.selectedTableId
                    )
                },
                elements = state.elements.map { element ->
                    FloorPlanElementDisplay(
                        id = element.id,
                        elementType = element.elementType,
                        label = element.label,
                        planX = element.planX,
                        planY = element.planY,
                        planWidth = element.planWidth,
                        planHeight = element.planHeight,
                        rotation = element.rotation,
                        isSelected = element.id == state.selectedElementId
                    )
                },
                editable = !isCloudManaged,
                selectedTableId = state.selectedTableId,
                selectedElementId = state.selectedElementId,
                onTableClick = viewModel::selectTable,
                onTableMoved = if (isCloudManaged) null else viewModel::moveTable,
                onTableResized = if (isCloudManaged) null else viewModel::resizeTable,
                onElementClick = viewModel::selectElement,
                onElementMoved = if (isCloudManaged) null else viewModel::moveElement,
                designCanvasWidth = designCanvasWidth,
                designCanvasHeight = designCanvasHeight,
                modifier = Modifier.fillMaxSize()
            )
        }

        if (state.selectedTableId != null || state.selectedElementId != null) {
            TableEditBottomPanel(
                state = state,
                fieldColors = fieldColors,
                readOnlyLayout = isCloudManaged,
                onClose = viewModel::clearSelection,
                onNameChange = viewModel::updateEditName,
                onSeatsChange = viewModel::updateEditSeats,
                onShapeChange = viewModel::updateEditShape,
                onPlanWidthChange = viewModel::updateEditPlanWidthPct,
                onPlanHeightChange = viewModel::updateEditPlanHeightPct,
                onElementLabelChange = viewModel::updateEditElementLabel,
                onSaveTable = viewModel::saveSelectedTable,
                onDeleteTable = viewModel::deleteSelectedTable,
                onSaveElement = viewModel::saveSelectedElement,
                onDeleteElement = viewModel::deleteSelectedElement,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp)
            )
        }

        HorizontalDivider(modifier = Modifier.padding(top = 8.dp))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 4.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(
                    if (state.selectedTableId != null || state.selectedElementId != null) {
                        R.string.table_plan_edit_hint
                    } else {
                        R.string.table_plan_layout_saved
                    }
                ),
                fontSize = 12.sp,
                color = colors.textSecondary,
                modifier = Modifier.weight(1f).padding(end = 8.dp)
            )
            if (!isCloudManaged && state.selectedTableId != null) {
                Button(
                    onClick = viewModel::saveSelectedTable,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) {
                    Text(stringResource(R.string.save))
                }
            } else if (!isCloudManaged && state.selectedElementId != null) {
                Button(
                    onClick = viewModel::saveSelectedElement,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) {
                    Text(stringResource(R.string.save))
                }
            }
        }
    }
}

@Composable
private fun TableEditBottomPanel(
    state: TablePlanUiState,
    fieldColors: androidx.compose.material3.TextFieldColors,
    readOnlyLayout: Boolean,
    onClose: () -> Unit,
    onNameChange: (String) -> Unit,
    onSeatsChange: (String) -> Unit,
    onShapeChange: (TableShape) -> Unit,
    onPlanWidthChange: (String) -> Unit,
    onPlanHeightChange: (String) -> Unit,
    onElementLabelChange: (String) -> Unit,
    onSaveTable: () -> Unit,
    onDeleteTable: () -> Unit,
    onSaveElement: () -> Unit,
    onDeleteElement: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = vectronColors()
    val editingTable = state.selectedTableId != null

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(colors.panelLight)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                if (editingTable) stringResource(R.string.edit_table)
                else stringResource(R.string.edit_floor_element),
                color = colors.textPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            IconButton(onClick = onClose) {
                Icon(Icons.Default.Close, contentDescription = stringResource(R.string.cancel), tint = colors.textPrimary)
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (editingTable) {
                OutlinedTextField(
                    value = state.editName,
                    onValueChange = onNameChange,
                    label = { Text(stringResource(R.string.table_name)) },
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.width(140.dp)
                )
                OutlinedTextField(
                    value = state.editSeats,
                    onValueChange = onSeatsChange,
                    label = { Text(stringResource(R.string.seat_capacity)) },
                    singleLine = true,
                    colors = fieldColors,
                    modifier = Modifier.width(100.dp)
                )
                TableShape.entries.forEach { shape ->
                    FilterChip(
                        selected = state.editShape == shape,
                        onClick = { onShapeChange(shape) },
                        label = {
                            Text(
                                when (shape) {
                                    TableShape.ROUND -> stringResource(R.string.shape_round)
                                    TableShape.SQUARE -> stringResource(R.string.shape_square)
                                    TableShape.RECT -> stringResource(R.string.shape_rect)
                                },
                                fontSize = 11.sp
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AccentTeal,
                            selectedLabelColor = Color.White,
                            containerColor = colors.panelDark,
                            labelColor = colors.textPrimary
                        )
                    )
                }
                if (!readOnlyLayout) {
                    OutlinedTextField(
                        value = state.editPlanWidthPct,
                        onValueChange = onPlanWidthChange,
                        label = { Text("W %", fontSize = 11.sp) },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.width(72.dp)
                    )
                    OutlinedTextField(
                        value = state.editPlanHeightPct,
                        onValueChange = onPlanHeightChange,
                        label = { Text("H %", fontSize = 11.sp) },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.width(72.dp)
                    )
                }
            } else {
                OutlinedTextField(
                    value = state.editElementLabel,
                    onValueChange = onElementLabelChange,
                    label = { Text(stringResource(R.string.element_label_optional)) },
                    singleLine = true,
                    enabled = !readOnlyLayout,
                    colors = fieldColors,
                    modifier = Modifier.width(220.dp)
                )
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!readOnlyLayout) {
                TextButton(onClick = if (editingTable) onDeleteTable else onDeleteElement) {
                    Text(stringResource(R.string.delete), color = Color(0xFFE57373))
                }
            }
            Spacer(modifier = Modifier.weight(1f))
            OutlinedButton(onClick = onClose) {
                Text(stringResource(R.string.cancel))
            }
            if (!readOnlyLayout) {
                Button(
                    onClick = if (editingTable) onSaveTable else onSaveElement,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) {
                    Text(stringResource(R.string.save))
                }
            }
        }
    }
}
