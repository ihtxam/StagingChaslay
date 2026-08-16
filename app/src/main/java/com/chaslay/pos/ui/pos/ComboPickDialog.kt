package com.chaslay.pos.ui.pos

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.ComboPickState
import com.chaslay.pos.domain.model.ComboSelection
import com.chaslay.pos.domain.model.ComboSlotModel
import java.util.Locale

data class ComboPickResult(
    val selections: List<ComboSelection>,
    val quantity: Int
)

@Composable
fun ComboPickDialog(
    state: ComboPickState,
    currencySymbol: String,
    showProductImages: Boolean = false,
    onConfirm: (ComboPickResult) -> Unit,
    onDismiss: () -> Unit
) {
    val combo = state.combo
    val product = combo.product
    var itemQty by remember { mutableIntStateOf(1) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val picks = remember(combo.product.id) {
        mutableStateMapOf<Long, MutableMap<Long, Int>>().apply {
            combo.slots.forEach { slot -> put(slot.id, mutableMapOf()) }
        }
    }

    val allValid = combo.slots.all { slot ->
        val count = picks[slot.id]?.values?.sum() ?: 0
        count >= slot.minPick && count <= slot.maxPick
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .fillMaxHeight(0.88f),
            color = Color(0xFF1E1E1E),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(product.name, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(
                            stringResource(R.string.combo_deal_price, currencySymbol, product.price),
                            color = Color(0xFF4CAF50),
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 15.sp
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null, tint = Color(0xFFE57373))
                    }
                }

                Row(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        combo.slots.forEach { slot ->
                            ComboSlotSection(
                                slot = slot,
                                picks = picks[slot.id].orEmpty(),
                                showProductImages = showProductImages,
                                onToggle = { productId ->
                                    val map = picks.getOrPut(slot.id) { mutableMapOf() }
                                    val current = map.values.sum()
                                    if (slot.maxPick <= 1) {
                                        map.clear()
                                        map[productId] = 1
                                    } else {
                                        val qty = map[productId] ?: 0
                                        if (qty > 0) {
                                            if (qty == 1) map.remove(productId) else map[productId] = qty - 1
                                        } else if (current < slot.maxPick) {
                                            map[productId] = 1
                                        }
                                    }
                                },
                                onIncrement = { productId ->
                                    val map = picks.getOrPut(slot.id) { mutableMapOf() }
                                    val current = map.values.sum()
                                    if (current < slot.maxPick) {
                                        map[productId] = (map[productId] ?: 0) + 1
                                    }
                                },
                                onDecrement = { productId ->
                                    val map = picks.getOrPut(slot.id) { mutableMapOf() }
                                    val qty = map[productId] ?: 0
                                    if (qty > 1) map[productId] = qty - 1 else map.remove(productId)
                                }
                            )
                        }
                    }

                    Column(
                        modifier = Modifier
                            .width(68.dp)
                            .fillMaxHeight()
                            .background(Color(0xFF252525))
                            .padding(vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        IconButton(
                            onClick = { itemQty++ },
                            modifier = Modifier.background(Color(0xFF00897B), RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                        }
                        Text(
                            itemQty.toString(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 26.sp,
                            modifier = Modifier.padding(vertical = 10.dp)
                        )
                        IconButton(
                            onClick = { if (itemQty > 1) itemQty-- },
                            modifier = Modifier.background(Color(0xFF424242), RoundedCornerShape(8.dp))
                        ) {
                            Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White)
                        }
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF2A2A2A))
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    errorMessage?.let { msg ->
                        Text(msg, color = Color(0xFFE57373), fontSize = 12.sp)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            stringResource(R.string.total_items, itemQty),
                            color = Color.Gray,
                            fontSize = 13.sp
                        )
                        Text(
                            "$currencySymbol ${"%.2f".format(Locale.getDefault(), product.price * itemQty)}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )
                    }
                    Button(
                        onClick = {
                            val validation = validateComboPicks(combo.slots, picks)
                            if (validation != null) {
                                errorMessage = validation
                                return@Button
                            }
                            errorMessage = null
                            val selections = buildComboSelections(combo.slots, picks)
                            onConfirm(ComboPickResult(selections, itemQty))
                        },
                        enabled = allValid,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF00897B),
                            disabledContainerColor = Color(0xFF424242)
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(
                            stringResource(R.string.combo_add_to_order).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ComboSlotSection(
    slot: ComboSlotModel,
    picks: Map<Long, Int>,
    showProductImages: Boolean = false,
    onToggle: (Long) -> Unit,
    onIncrement: (Long) -> Unit,
    onDecrement: (Long) -> Unit
) {
    val selectedCount = picks.values.sum()
    val tileHeight = if (showProductImages) 96.dp else 72.dp
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(slot.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(
                comboSlotHeader(slot, selectedCount),
                color = if (selectedCount >= slot.minPick) Color(0xFF80CBC4) else Color.Gray,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        }
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.height(((slot.options.size + 1) / 2 * tileHeight.value.toInt()).coerceAtLeast(tileHeight.value.toInt()).dp)
        ) {
            items(slot.options, key = { it.productId }) { option ->
                val qty = picks[option.productId] ?: 0
                val selected = qty > 0
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(tileHeight)
                        .border(
                            width = if (selected) 2.dp else 1.dp,
                            color = if (selected) Color(0xFF00897B) else Color(0xFF555555),
                            shape = RoundedCornerShape(8.dp)
                        )
                        .background(
                            if (selected) Color(0xFF1B3A38) else Color(0xFF333333),
                            RoundedCornerShape(8.dp)
                        )
                        .clickable { onToggle(option.productId) }
                        .padding(8.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        if (showProductImages && !option.imageUri.isNullOrBlank()) {
                            coil.compose.AsyncImage(
                                model = option.imageUri,
                                contentDescription = null,
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(4.dp)),
                                contentScale = ContentScale.Crop
                            )
                        }
                        Text(
                            option.productName,
                            color = Color.White,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 13.sp,
                            maxLines = 2,
                            textAlign = TextAlign.Center
                        )
                        if (slot.maxPick > 1 && selected) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = { onDecrement(option.productId) },
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Icon(Icons.Default.Remove, contentDescription = null, tint = Color.White, modifier = Modifier.padding(0.dp))
                                }
                                Text(
                                    qty.toString(),
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(horizontal = 4.dp)
                                )
                                IconButton(
                                    onClick = { onIncrement(option.productId) },
                                    modifier = Modifier.height(28.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, tint = Color.White)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun comboSlotHeader(slot: ComboSlotModel, selectedCount: Int): String {
    return when {
        slot.minPick == slot.maxPick ->
            stringResource(R.string.combo_slot_included, slot.maxPick)
        selectedCount > 0 ->
            stringResource(R.string.combo_slot_selected, selectedCount, slot.maxPick)
        else ->
            stringResource(R.string.combo_slot_pick_range, slot.minPick, slot.maxPick)
    }
}

private fun validateComboPicks(
    slots: List<ComboSlotModel>,
    picks: Map<Long, Map<Long, Int>>
): String? {
    slots.forEach { slot ->
        val count = picks[slot.id]?.values?.sum() ?: 0
        if (count < slot.minPick) return "Please choose ${slot.minPick} for ${slot.name}"
        if (count > slot.maxPick) return "Too many picks for ${slot.name}"
    }
    return null
}

private fun buildComboSelections(
    slots: List<ComboSlotModel>,
    picks: Map<Long, Map<Long, Int>>
): List<ComboSelection> {
    val result = mutableListOf<ComboSelection>()
    slots.forEach { slot ->
        val map = picks[slot.id].orEmpty()
        slot.options.filter { map.containsKey(it.productId) }.forEach { opt ->
            val qty = map[opt.productId] ?: 0
            repeat(qty) {
                result.add(ComboSelection(slot.name, opt.productId, opt.productName))
            }
        }
    }
    return result
}
