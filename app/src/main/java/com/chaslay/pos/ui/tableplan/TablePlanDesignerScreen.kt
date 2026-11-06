package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.RestaurantTableEntity
import com.chaslay.pos.domain.model.TableShape
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes
import com.chaslay.pos.ui.theme.posUiColors
import com.chaslay.pos.ui.theme.vectronColors
import kotlin.math.cos
import kotlin.math.sin

private val AccentTeal = PosColors.Primary
private val PlanCanvasBg = Color(0xFFF3F5F7)
private val PlanGridLine = Color(0xFFDDE3E8)

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
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TablePlanDesignerContent(
    viewModel: TablePlanViewModel = hiltViewModel(),
    modifier: Modifier = Modifier
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()
    val ui = posUiColors()
    val context = LocalContext.current
    val selectedFloor = state.floors.find { it.id == state.selectedFloorId }
    val isCloudManaged = !selectedFloor?.remoteId.isNullOrBlank() ||
        state.tables.any { !it.remoteId.isNullOrBlank() }
    var zoom by remember { mutableStateOf(1f) }

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

    val tableCount = state.tables.size
    val totalCovers = state.tables.sumOf { it.seatCapacity }
    val referenceCapacity = state.tables.firstOrNull()?.seatCapacity ?: 4

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.background)
            .padding(horizontal = PosDimens.Space2, vertical = PosDimens.Space2)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            state.floors.forEach { floor ->
                val selected = floor.id == state.selectedFloorId
                FilterChip(
                    selected = selected,
                    onClick = { viewModel.selectFloor(floor.id) },
                    label = {
                        Text(floor.name, fontSize = 12.sp, fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal)
                    },
                    shape = PosShapes.Medium,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentTeal,
                        selectedLabelColor = Color.White,
                        containerColor = ui.surface,
                        labelColor = colors.textPrimary
                    )
                )
            }
            Button(
                onClick = viewModel::addTable,
                enabled = !isCloudManaged,
                colors = ButtonDefaults.buttonColors(containerColor = AccentTeal),
                contentPadding = ButtonDefaults.ContentPadding,
                shape = PosShapes.Medium
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.add_table), fontSize = 13.sp)
            }
            OutlinedTextField(
                value = state.newFloorName,
                onValueChange = viewModel::updateNewFloorName,
                label = { Text(stringResource(R.string.new_floor_name), fontSize = 11.sp) },
                singleLine = true,
                enabled = !isCloudManaged,
                colors = fieldColors,
                modifier = Modifier.width(168.dp),
                shape = PosShapes.Medium
            )
            OutlinedButton(
                onClick = viewModel::addFloor,
                enabled = !isCloudManaged,
                shape = PosShapes.Medium,
                border = BorderStroke(1.dp, ui.border)
            ) {
                Text(stringResource(R.string.add_floor), fontSize = 12.sp)
            }
        }

        if (isCloudManaged) {
            CloudReadOnlyBanner(text = stringResource(R.string.table_plan_cloud_managed))
        }

        Text(
            stringResource(R.string.table_plan_row_help),
            fontSize = 11.sp,
            color = colors.textSecondary,
            modifier = Modifier.padding(top = 8.dp, bottom = 6.dp)
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .clip(PosShapes.Large)
                .background(PlanCanvasBg)
                .borderCompat(1.dp, ui.border)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ui.surface)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    stringResource(
                        R.string.table_plan_toolbar_line,
                        selectedFloor?.name.orEmpty(),
                        tableCount,
                        totalCovers
                    ),
                    fontSize = 11.sp,
                    color = colors.textSecondary,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f).padding(end = 8.dp)
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(PosColors.Success)
                    )
                    Text(
                        stringResource(R.string.table_plan_saved_status),
                        fontSize = 11.sp,
                        color = colors.textSecondary
                    )
                    IconButton(
                        onClick = { /* informational */ },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Outlined.Info,
                            contentDescription = null,
                            tint = colors.textSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                    OutlinedButton(
                        onClick = { zoom = (zoom - 0.1f).coerceIn(0.75f, 1.35f) },
                        contentPadding = ButtonDefaults.TextButtonContentPadding,
                        modifier = Modifier.height(32.dp),
                        enabled = zoom > 0.76f
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = null, modifier = Modifier.size(16.dp))
                    }
                    Text("${(zoom * 100).toInt()}%", fontSize = 12.sp, color = colors.textPrimary)
                    OutlinedButton(
                        onClick = { zoom = (zoom + 0.1f).coerceIn(0.75f, 1.35f) },
                        contentPadding = ButtonDefaults.TextButtonContentPadding,
                        modifier = Modifier.height(32.dp),
                        enabled = zoom < 1.34f
                    ) {
                        Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    }
                }
            }

            HorizontalDivider(color = ui.border.copy(alpha = 0.65f))

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .drawDottedGrid()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 14.dp)
            ) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy((12 * zoom).dp),
                    verticalArrangement = Arrangement.spacedBy((12 * zoom).dp)
                ) {
                    state.tables.forEach { table ->
                        val selected = table.id == state.selectedTableId
                        TablePlanMiniCard(
                            table = table,
                            selected = selected,
                            zoom = zoom,
                            onClick = { viewModel.selectTable(table.id) }
                        )
                    }
                }
            }

            HorizontalDivider(color = ui.border.copy(alpha = 0.65f))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(ui.surfaceMuted)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    stringResource(R.string.table_plan_canvas_legend_capacity, referenceCapacity),
                    fontSize = 10.sp,
                    color = colors.textSecondary,
                    modifier = Modifier.weight(1f)
                )
                Text(
                    stringResource(R.string.table_plan_canvas_footer_note),
                    fontSize = 10.sp,
                    color = colors.textSecondary,
                    modifier = Modifier.weight(1.4f),
                    textAlign = TextAlign.Center,
                )
                Text(
                    stringResource(R.string.table_plan_canvas_summary, tableCount, totalCovers),
                    fontSize = 10.sp,
                    color = colors.textSecondary,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.End,
                )
            }
        }

        if (state.selectedTableId != null) {
            TableEditBottomPanel(
                state = state,
                fieldColors = fieldColors,
                readOnlyLayout = true,
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

        HorizontalDivider(modifier = Modifier.padding(top = 8.dp), color = ui.border)
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
                    if (state.selectedTableId != null) {
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
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal),
                    shape = PosShapes.Medium
                ) {
                    Text(stringResource(R.string.save))
                }
            }
        }
    }
}

@Composable
private fun CloudReadOnlyBanner(text: String) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .clip(PosShapes.Medium)
            .background(PosColors.InfoSubtle)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Icon(
            Icons.Outlined.Info,
            contentDescription = null,
            tint = PosColors.Info,
            modifier = Modifier.size(20.dp)
        )
        Text(
            text,
            fontSize = 12.sp,
            color = ui.textPrimary,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun TablePlanMiniCard(
    table: RestaurantTableEntity,
    selected: Boolean,
    zoom: Float,
    onClick: () -> Unit
) {
    val ui = posUiColors()
    val shape = TableShape.fromApi(table.shape)
    val cardW = (120 * zoom).dp
    val cardH = (118 * zoom).dp
    Card(
        modifier = Modifier
            .width(cardW)
            .height(cardH)
            .clickable(onClick = onClick),
        shape = PosShapes.Large,
        colors = CardDefaults.cardColors(containerColor = ui.surface),
        border = BorderStroke(
            width = if (selected) 2.dp else 1.dp,
            color = if (selected) AccentTeal else ui.border
        ),
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Icon(
                Icons.Outlined.MoreVert,
                contentDescription = null,
                tint = ui.textMuted,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(4.dp)
                    .size(18.dp)
            )
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                TableTopDownGlyph(shape = shape, tint = AccentTeal.copy(alpha = 0.85f))
                Spacer(modifier = Modifier.height((6 * zoom).dp))
                Text(
                    table.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = (13 * zoom).sp,
                    color = ui.textPrimary,
                    maxLines = 1
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    Icon(
                        Icons.Default.Person,
                        contentDescription = null,
                        tint = ui.textSecondary,
                        modifier = Modifier.size((14 * zoom).dp)
                    )
                    Text(
                        "${table.seatCapacity}",
                        fontSize = (12 * zoom).sp,
                        color = ui.textSecondary
                    )
                }
            }
        }
    }
}

@Composable
private fun TableTopDownGlyph(shape: TableShape, tint: Color) {
    Canvas(
        modifier = Modifier.size(44.dp)
    ) {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val tableR = size.minDimension * 0.22f
        val chairR = size.minDimension * 0.07f
        val orbit = size.minDimension * 0.36f
        when (shape) {
            TableShape.ROUND -> {
                drawCircle(color = tint.copy(alpha = 0.2f), radius = tableR * 1.1f, center = Offset(cx, cy))
                drawCircle(color = tint, radius = tableR, center = Offset(cx, cy))
                repeat(4) { i ->
                    val angleRad = Math.toRadians((i * 90.0 - 90.0))
                    val ox = cx + cos(angleRad).toFloat() * orbit
                    val oy = cy + sin(angleRad).toFloat() * orbit
                    drawCircle(color = tint.copy(alpha = 0.55f), radius = chairR, center = Offset(ox, oy))
                }
            }
            TableShape.SQUARE, TableShape.RECT -> {
                val half = tableR * 1.15f
                drawRoundRect(
                    color = tint.copy(alpha = 0.18f),
                    topLeft = Offset(cx - half, cy - half * 0.85f),
                    size = Size(half * 2f, half * 1.7f),
                    cornerRadius = CornerRadius(4f, 4f)
                )
                drawRoundRect(
                    color = tint,
                    topLeft = Offset(cx - half * 0.92f, cy - half * 0.78f),
                    size = Size(half * 1.84f, half * 1.56f),
                    cornerRadius = CornerRadius(3f, 3f)
                )
                val gap = half * 1.05f
                listOf(
                    Offset(cx, cy - gap),
                    Offset(cx + gap, cy),
                    Offset(cx, cy + gap),
                    Offset(cx - gap, cy),
                ).forEach { p ->
                    drawCircle(color = tint.copy(alpha = 0.55f), radius = chairR, center = p)
                }
            }
        }
    }
}

private fun Modifier.borderCompat(width: androidx.compose.ui.unit.Dp, color: Color): Modifier =
    this.then(
        Modifier.border(width, color, PosShapes.Large)
    )

private fun Modifier.drawDottedGrid(): Modifier = this.then(
    Modifier.drawBehind {
        val step = 18.dp.toPx()
        val gridColor = PlanGridLine
        var x = 0f
        while (x <= size.width) {
            drawLine(
                color = gridColor,
                start = Offset(x, 0f),
                end = Offset(x, size.height),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 10f), 0f)
            )
            x += step
        }
        var y = 0f
        while (y <= size.height) {
            drawLine(
                color = gridColor,
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 10f), 0f)
            )
            y += step
        }
    }
)

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
            .clip(PosShapes.Large)
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
