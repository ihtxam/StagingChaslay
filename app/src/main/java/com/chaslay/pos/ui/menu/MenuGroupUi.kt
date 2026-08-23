package com.chaslay.pos.ui.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R

internal val MenuTeal = Color(0xFF0D9488)
private val MenuBorder = Color(0xFFE2E8F0)
private val MenuMuted = Color(0xFF64748B)
private val MenuSurface = Color(0xFFF5F6F8)

@Composable
internal fun MenuSearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = { Text(placeholder, color = MenuMuted) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MenuTeal,
            unfocusedBorderColor = MenuBorder
        )
    )
}

@Composable
internal fun MenuListHeader(
    title: String,
    hint: String,
    addLabel: String,
    onAdd: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text(hint, color = MenuMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }
        Button(
            onClick = onAdd,
            colors = ButtonDefaults.buttonColors(containerColor = MenuTeal),
            shape = RoundedCornerShape(8.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
            Text(addLabel, modifier = Modifier.padding(start = 4.dp))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MenuBadge(text: String) {
    Text(
        text = text,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFFF1F5F9))
            .padding(horizontal = 8.dp, vertical = 4.dp),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = Color(0xFF334155)
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun MenuGroupCard(
    title: String,
    badges: List<String>,
    preview: String,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    expandedContent: (@Composable () -> Unit)? = null
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MenuBorder, RoundedCornerShape(14.dp)),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(title, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    if (badges.isNotEmpty()) {
                        FlowRow(
                            modifier = Modifier.padding(top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            badges.forEach { MenuBadge(it) }
                        }
                    }
                    Text(
                        preview,
                        fontSize = 12.sp,
                        color = MenuMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                Row {
                    OutlinedButton(onClick = onEdit, shape = RoundedCornerShape(8.dp)) {
                        Text(stringResource(R.string.edit), fontSize = 13.sp)
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFFDC2626))
                    }
                }
            }
            expandedContent?.invoke()
        }
    }
}

@Composable
internal fun MenuEmptyState(title: String, hint: String, onAdd: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MenuBorder, RoundedCornerShape(14.dp)),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(hint, color = MenuMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            Button(
                onClick = onAdd,
                modifier = Modifier.padding(top = 12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MenuTeal)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Text(stringResource(R.string.add_new_group), modifier = Modifier.padding(start = 4.dp))
            }
        }
    }
}

@Composable
internal fun MenuEditorDialog(
    title: String,
    onDismiss: () -> Unit,
    onSave: () -> Unit,
    content: @Composable () -> Unit
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MenuSurface
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f))
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = null)
                    }
                }
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    content()
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White)
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.End)
                ) {
                    TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
                    Button(
                        onClick = onSave,
                        colors = ButtonDefaults.buttonColors(containerColor = MenuTeal)
                    ) {
                        Text(stringResource(R.string.save))
                    }
                }
            }
        }
    }
}

@Composable
internal fun MenuSectionCard(
    title: String? = null,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            title?.let {
                Text(it, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            }
            content()
        }
    }
}

@Composable
internal fun MenuQuantityStepper(
    label: String,
    value: Int,
    min: Int,
    onChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, modifier = Modifier.weight(1f), fontSize = 13.sp)
        IconButton(
            onClick = { if (value > min) onChange(value - 1) },
            enabled = value > min
        ) {
            Icon(Icons.Default.Remove, contentDescription = null)
        }
        Text(value.toString(), fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 8.dp))
        IconButton(onClick = { onChange(value + 1) }) {
            Icon(Icons.Default.Add, contentDescription = null)
        }
    }
}

@Composable
internal fun MenuOptionEditorRow(
    name: String,
    onNameChange: (String) -> Unit,
    price: String? = null,
    onPriceChange: ((String) -> Unit)? = null,
    inStock: Boolean,
    onInStockChange: (Boolean) -> Unit,
    onDelete: () -> Unit,
    canDelete: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text(stringResource(R.string.name)) },
            singleLine = true,
            shape = RoundedCornerShape(8.dp)
        )
        if (price != null && onPriceChange != null) {
            OutlinedTextField(
                value = price,
                onValueChange = onPriceChange,
                modifier = Modifier.size(width = 88.dp, height = 56.dp),
                label = { Text("CHF", fontSize = 10.sp) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                shape = RoundedCornerShape(8.dp)
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(stringResource(R.string.in_stock), fontSize = 9.sp, color = MenuMuted)
            Switch(checked = inStock, onCheckedChange = onInStockChange)
        }
        IconButton(onClick = onDelete, enabled = canDelete) {
            Icon(Icons.Default.Delete, contentDescription = null, tint = Color(0xFFDC2626))
        }
    }
}
