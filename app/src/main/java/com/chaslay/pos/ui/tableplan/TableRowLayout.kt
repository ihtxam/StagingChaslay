package com.chaslay.pos.ui.tableplan

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.domain.model.TableStatus
import com.chaslay.pos.domain.model.TableWithOrderInfo
import com.chaslay.pos.ui.theme.VectronColors

/**
 * Simple table picker: one wrapped row of chips (no floor-plan coordinates or drag-and-drop).
 */
@Composable
fun TableRowPickerLayout(
    tables: List<TableWithOrderInfo>,
    currencySymbol: String,
    activeTableName: String?,
    onSelectTable: (Long) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(bottom = 12.dp)
    ) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            tables.forEach { table ->
                TableRowChip(
                    table = table,
                    currencySymbol = currencySymbol,
                    isActive = table.name == activeTableName,
                    onClick = { onSelectTable(table.id) }
                )
            }
        }
    }
}

@Composable
fun TableRowChip(
    table: TableWithOrderInfo,
    currencySymbol: String,
    isActive: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val bg = when {
        isActive -> VectronColors.CardBlue
        table.status == TableStatus.OCCUPIED -> Color(0xFFE67E22)
        table.status == TableStatus.ACTIVE -> VectronColors.CashGreen.copy(alpha = 0.9f)
        else -> Color(0xFF5C6BC0).copy(alpha = 0.85f)
    }
    Box(
        modifier = modifier
            .widthIn(min = 96.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(table.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (table.orderTotal > 0.0) {
                Text(
                    "$currencySymbol ${"%.2f".format(table.orderTotal)}",
                    color = Color.White.copy(alpha = 0.92f),
                    fontSize = 11.sp
                )
            }
            Text(
                "${table.seatCapacity}",
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 10.sp
            )
        }
    }
}
