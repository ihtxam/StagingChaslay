package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.drag
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.chaslay.pos.domain.model.FloorPlanElementType
import com.chaslay.pos.domain.model.TableShape
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.ui.theme.VectronColors
import kotlin.math.abs
import kotlin.math.roundToInt

internal fun clampPlanPosition(
    planX: Float,
    planY: Float,
    planWidth: Float,
    planHeight: Float
): Pair<Float, Float> {
    val w = planWidth.coerceIn(0.04f, 0.5f)
    val h = planHeight.coerceIn(0.03f, 0.5f)
    val x = planX.coerceIn(0f, (1f - w).coerceAtLeast(0f))
    val y = planY.coerceIn(0f, (1f - h).coerceAtLeast(0f))
    return x to y
}

internal enum class PlanResizeHandle {
    NW, N, NE, E, SE, S, SW, W
}

internal data class PlanRect(
    val planX: Float,
    val planY: Float,
    val planWidth: Float,
    val planHeight: Float
)

internal fun applyPlanResize(
    handle: PlanResizeHandle,
    start: PlanRect,
    deltaX: Float,
    deltaY: Float
): PlanRect {
    var x = start.planX
    var y = start.planY
    var w = start.planWidth
    var h = start.planHeight

    when (handle) {
        PlanResizeHandle.E, PlanResizeHandle.NE, PlanResizeHandle.SE -> w = start.planWidth + deltaX
        PlanResizeHandle.W, PlanResizeHandle.NW, PlanResizeHandle.SW -> {
            w = start.planWidth - deltaX
            x = start.planX + deltaX
        }
        PlanResizeHandle.N, PlanResizeHandle.S -> Unit
    }
    when (handle) {
        PlanResizeHandle.S, PlanResizeHandle.SE, PlanResizeHandle.SW -> h = start.planHeight + deltaY
        PlanResizeHandle.N, PlanResizeHandle.NE, PlanResizeHandle.NW -> {
            h = start.planHeight - deltaY
            y = start.planY + deltaY
        }
        PlanResizeHandle.E, PlanResizeHandle.W -> Unit
    }

    val minW = 0.04f
    val minH = 0.03f
    if (w < minW) {
        if (handle == PlanResizeHandle.W || handle == PlanResizeHandle.NW || handle == PlanResizeHandle.SW) {
            x = start.planX + start.planWidth - minW
        }
        w = minW
    }
    if (h < minH) {
        if (handle == PlanResizeHandle.N || handle == PlanResizeHandle.NE || handle == PlanResizeHandle.NW) {
            y = start.planY + start.planHeight - minH
        }
        h = minH
    }

    w = w.coerceIn(minW, 0.5f)
    h = h.coerceIn(minH, 0.5f)
    val (cx, cy) = clampPlanPosition(x, y, w, h)
    return PlanRect(cx, cy, w, h)
}

data class FloorPlanTableDisplay(
    val id: Long,
    val name: String,
    val seatCapacity: Int,
    val planX: Float,
    val planY: Float,
    val planWidth: Float,
    val planHeight: Float,
    val shape: String,
    val rotation: Float,
    val status: TableStatus = TableStatus.FREE,
    val orderTotal: Double = 0.0,
    val guestCount: Int? = null,
    val isActive: Boolean = false,
    val hasReservation: Boolean = false
)

data class FloorPlanElementDisplay(
    val id: Long,
    val elementType: String,
    val label: String?,
    val planX: Float,
    val planY: Float,
    val planWidth: Float,
    val planHeight: Float,
    val rotation: Float,
    val isSelected: Boolean = false
)

fun TableWithOrderInfo.toFloorPlanDisplay(activeTableName: String?, currencySymbol: String): FloorPlanTableDisplay =
    FloorPlanTableDisplay(
        id = id,
        name = name,
        seatCapacity = seatCapacity,
        planX = planX,
        planY = planY,
        planWidth = planWidth,
        planHeight = planHeight,
        shape = shape,
        rotation = rotation,
        status = status,
        orderTotal = orderTotal,
        guestCount = guestCount,
        isActive = name == activeTableName,
        hasReservation = hasReservation
    )

@Composable
fun FloorPlanCanvas(
    tables: List<FloorPlanTableDisplay>,
    elements: List<FloorPlanElementDisplay> = emptyList(),
    editable: Boolean,
    selectedTableId: Long?,
    selectedElementId: Long? = null,
    onTableClick: (Long) -> Unit,
    onTableMoved: ((Long, Float, Float) -> Unit)?,
    onTableResized: ((Long, Float, Float, Float, Float) -> Unit)? = null,
    onElementClick: ((Long) -> Unit)? = null,
    onElementMoved: ((Long, Float, Float) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    BoxWithConstraints(
        modifier = modifier
            .fillMaxSize()
            .background(Color(0xFFECEFF1))
            .border(1.dp, Color(0xFFB0BEC5))
    ) {
        val canvasW = maxWidth
        val canvasH = maxHeight
        // Guard against zero-size layout (parent Column without weight).
        if (canvasW.value < 8f || canvasH.value < 8f) return@BoxWithConstraints

        val selectedElement = elements.find { it.id == selectedElementId }
        val backgroundElements = if (selectedElement != null) {
            elements.filter { it.id != selectedElementId }
        } else {
            elements
        }

        backgroundElements.forEach { element ->
            DraggablePlanItem(
                planX = element.planX,
                planY = element.planY,
                planWidth = element.planWidth,
                planHeight = element.planHeight,
                rotation = element.rotation,
                canvasW = canvasW.value,
                canvasH = canvasH.value,
                editable = editable && onElementMoved != null,
                isSelected = element.isSelected,
                onMoved = { x, y -> onElementMoved?.invoke(element.id, x, y) },
                onClick = { onElementClick?.invoke(element.id) }
            ) {
                FloorPlanElementChip(element = element)
            }
        }

        tables.forEach { table ->
            DraggablePlanItem(
                planX = table.planX,
                planY = table.planY,
                planWidth = table.planWidth,
                planHeight = table.planHeight,
                rotation = table.rotation,
                canvasW = canvasW.value,
                canvasH = canvasH.value,
                editable = editable && onTableMoved != null,
                isSelected = table.id == selectedTableId,
                onResized = if (editable && onTableResized != null && table.id == selectedTableId) {
                    { x, y, w, h -> onTableResized(table.id, x, y, w, h) }
                } else {
                    null
                },
                onMoved = { x, y -> onTableMoved?.invoke(table.id, x, y) },
                onClick = { onTableClick(table.id) }
            ) {
                FloorPlanTableChip(
                    table = table,
                    isSelected = table.id == selectedTableId
                )
            }
        }

        selectedElement?.let { element ->
            DraggablePlanItem(
                planX = element.planX,
                planY = element.planY,
                planWidth = element.planWidth,
                planHeight = element.planHeight,
                rotation = element.rotation,
                canvasW = canvasW.value,
                canvasH = canvasH.value,
                editable = editable && onElementMoved != null,
                isSelected = true,
                onMoved = { x, y -> onElementMoved?.invoke(element.id, x, y) },
                onClick = { onElementClick?.invoke(element.id) },
                modifier = Modifier.zIndex(1f)
            ) {
                FloorPlanElementChip(element = element)
            }
        }
    }
}

@Composable
private fun DraggablePlanItem(
    planX: Float,
    planY: Float,
    planWidth: Float,
    planHeight: Float,
    rotation: Float,
    canvasW: Float,
    canvasH: Float,
    editable: Boolean,
    isSelected: Boolean = false,
    onResized: ((Float, Float, Float, Float) -> Unit)? = null,
    onMoved: (Float, Float) -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    var previewRect by remember(planX, planY, planWidth, planHeight) { mutableStateOf<PlanRect?>(null) }
    val displayX = previewRect?.planX ?: planX
    val displayY = previewRect?.planY ?: planY
    val displayW = previewRect?.planWidth ?: planWidth
    val displayH = previewRect?.planHeight ?: planHeight

    val w = (displayW.coerceIn(0.04f, 0.5f) * canvasW).dp
    val h = (displayH.coerceIn(0.03f, 0.5f) * canvasH).dp
    val baseX = displayX.coerceIn(0f, 1f) * canvasW
    val baseY = displayY.coerceIn(0f, 1f) * canvasH
    var dragOffsetX by remember(displayX, displayY) { mutableFloatStateOf(0f) }
    var dragOffsetY by remember(displayX, displayY) { mutableFloatStateOf(0f) }

    Box(
        modifier = modifier
            .offset {
                IntOffset(
                    (baseX + dragOffsetX).roundToInt(),
                    (baseY + dragOffsetY).roundToInt()
                )
            }
            .rotate(rotation)
            .pointerInput(displayX, displayY, editable, isSelected, onResized) {
                // Single gesture handler: tap selects, drag moves (no clickable conflict).
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    var totalDrag = 0f
                    var moved = false
                    drag(down.id) { change ->
                        val delta = change.positionChange()
                        change.consume()
                        if (editable) {
                            dragOffsetX += delta.x
                            dragOffsetY += delta.y
                        }
                        totalDrag += abs(delta.x) + abs(delta.y)
                        if (totalDrag > 8f) moved = true
                    }
                    if (!moved) {
                        onClick()
                    } else if (editable) {
                        val (x, y) = clampPlanPosition(
                            planX = (baseX + dragOffsetX) / canvasW,
                            planY = (baseY + dragOffsetY) / canvasH,
                            planWidth = displayW,
                            planHeight = displayH
                        )
                        onMoved(x, y)
                    }
                    dragOffsetX = 0f
                    dragOffsetY = 0f
                }
            }
    ) {
        Box(modifier = Modifier.size(width = w.coerceAtLeast(40.dp), height = h.coerceAtLeast(24.dp))) {
            content()
            if (isSelected && editable && onResized != null) {
                PlanResizeHandles(
                    startRect = PlanRect(planX, planY, planWidth, planHeight),
                    canvasW = canvasW,
                    canvasH = canvasH,
                    onPreview = { previewRect = it },
                    onCommit = { rect ->
                        onResized(rect.planX, rect.planY, rect.planWidth, rect.planHeight)
                        previewRect = null
                    },
                    onCancelPreview = { previewRect = null }
                )
            }
        }
    }
}

@Composable
private fun BoxScope.PlanResizeHandles(
    startRect: PlanRect,
    canvasW: Float,
    canvasH: Float,
    onPreview: (PlanRect) -> Unit,
    onCommit: (PlanRect) -> Unit,
    onCancelPreview: () -> Unit
) {
    val handleSize = 12.dp
    val handles = listOf(
        PlanResizeHandle.NW to Alignment.TopStart,
        PlanResizeHandle.N to Alignment.TopCenter,
        PlanResizeHandle.NE to Alignment.TopEnd,
        PlanResizeHandle.E to Alignment.CenterEnd,
        PlanResizeHandle.SE to Alignment.BottomEnd,
        PlanResizeHandle.S to Alignment.BottomCenter,
        PlanResizeHandle.SW to Alignment.BottomStart,
        PlanResizeHandle.W to Alignment.CenterStart
    )

    handles.forEach { (handle, alignment) ->
        Box(
            modifier = Modifier
                .zIndex(2f)
                .align(alignment)
                .size(handleSize)
                .offset(
                    x = when (alignment) {
                        Alignment.TopStart, Alignment.CenterStart, Alignment.BottomStart -> (-6).dp
                        Alignment.TopEnd, Alignment.CenterEnd, Alignment.BottomEnd -> 6.dp
                        else -> 0.dp
                    },
                    y = when (alignment) {
                        Alignment.TopStart, Alignment.TopCenter, Alignment.TopEnd -> (-6).dp
                        Alignment.BottomStart, Alignment.BottomCenter, Alignment.BottomEnd -> 6.dp
                        else -> 0.dp
                    }
                )
                .clip(RoundedCornerShape(2.dp))
                .background(Color.White)
                .border(2.dp, Color(0xFF00897B), RoundedCornerShape(2.dp))
                .pointerInput(handle, startRect) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        var totalDeltaX = 0f
                        var totalDeltaY = 0f
                        drag(down.id) { change ->
                            val delta = change.positionChange()
                            change.consume()
                            totalDeltaX += delta.x / canvasW
                            totalDeltaY += delta.y / canvasH
                            onPreview(
                                applyPlanResize(
                                    handle = handle,
                                    start = startRect,
                                    deltaX = totalDeltaX,
                                    deltaY = totalDeltaY
                                )
                            )
                        }
                        if (totalDeltaX != 0f || totalDeltaY != 0f) {
                            onCommit(
                                applyPlanResize(
                                    handle = handle,
                                    start = startRect,
                                    deltaX = totalDeltaX,
                                    deltaY = totalDeltaY
                                )
                            )
                        } else {
                            onCancelPreview()
                        }
                    }
                }
        )
    }
}

@Composable
private fun FloorPlanElementChip(element: FloorPlanElementDisplay) {
    val type = FloorPlanElementType.fromApi(element.elementType)
    val bg = when (type) {
        FloorPlanElementType.WALL -> Color(0xFF4A4A4A)
        FloorPlanElementType.DOOR -> Color(0xFF8D6E63)
        FloorPlanElementType.BAR -> Color(0xFF6D4C41)
        FloorPlanElementType.OBSTACLE -> Color(0xFF9E9E9E)
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(3.dp))
            .background(bg)
            .border(
                width = if (element.isSelected) 2.dp else 0.dp,
                color = Color.White,
                shape = RoundedCornerShape(3.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = element.label ?: when (type) {
                FloorPlanElementType.WALL -> "Wall"
                FloorPlanElementType.DOOR -> "Door"
                FloorPlanElementType.BAR -> "Bar"
                FloorPlanElementType.OBSTACLE -> "Obstacle"
            },
            color = Color.White,
            fontSize = 9.sp,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}

@Composable
private fun FloorPlanTableChip(
    table: FloorPlanTableDisplay,
    isSelected: Boolean
) {
    val bg = when {
        isSelected -> VectronColors.CardBlue
        table.isActive -> VectronColors.CardBlue.copy(alpha = 0.95f)
        table.status == TableStatus.OCCUPIED -> Color(0xFFE67E22)
        table.status == TableStatus.ACTIVE -> VectronColors.CashGreen.copy(alpha = 0.9f)
        else -> Color(0xFF5C6BC0).copy(alpha = 0.8f)
    }
    val shape = TableShape.fromApi(table.shape)
    val clipShape = when (shape) {
        TableShape.ROUND -> CircleShape
        TableShape.SQUARE -> RoundedCornerShape(6.dp)
        TableShape.RECT -> RoundedCornerShape(4.dp)
    }
    val coverLabel = table.guestCount?.let { "$it/${table.seatCapacity}" }
        ?: "${table.seatCapacity} seats"

    Box(
        modifier = Modifier
            .fillMaxSize()
            .then(
                if (table.hasReservation && !table.isActive && table.status == TableStatus.FREE) {
                    Modifier.border(3.dp, Color(0xFFF59E0B), clipShape)
                } else Modifier
            )
            .clip(clipShape)
            .background(bg)
            .border(
                width = if (isSelected || table.isActive) 2.dp else 0.dp,
                color = Color.White,
                shape = clipShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(4.dp)
        ) {
            Text(table.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp, maxLines = 1)
            Text(coverLabel, color = Color.White.copy(alpha = 0.9f), fontSize = 9.sp, textAlign = TextAlign.Center)
            if (table.orderTotal > 0) {
                Text("%.0f".format(table.orderTotal), color = Color.White.copy(alpha = 0.85f), fontSize = 8.sp)
            }
        }
    }
}
