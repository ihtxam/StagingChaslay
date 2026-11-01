package com.chaslay.pos.ui.pos

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.CategoryEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScanCreateProductDialog(
    barcode: String,
    categories: List<CategoryEntity>,
    currencySymbol: String,
    saving: Boolean,
    onDismiss: () -> Unit,
    onCreate: (name: String, price: Double, categoryId: Long, stock: Int, costPrice: Double?) -> Unit
) {
    var name by remember(barcode) { mutableStateOf("") }
    var salePrice by remember(barcode) { mutableStateOf("") }
    var costPrice by remember(barcode) { mutableStateOf("") }
    var stock by remember(barcode) { mutableStateOf("1") }
    var categoryId by remember(barcode, categories) {
        mutableStateOf(categories.firstOrNull()?.id)
    }
    var categoryExpanded by remember { mutableStateOf(false) }
    val selectedCategory = categories.find { it.id == categoryId }

    Dialog(
        onDismissRequest = { if (!saving) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.82f)
                .padding(8.dp),
            shape = RoundedCornerShape(20.dp),
            color = Color.White,
            shadowElevation = 8.dp
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    stringResource(R.string.pos_scan_create_product_title),
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    stringResource(R.string.pos_scan_create_product_hint, barcode),
                    fontSize = 13.sp,
                    color = Color(0xFF64748B)
                )
                Spacer(modifier = Modifier.height(14.dp))
                Column(
                    modifier = Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.product_name)) },
                        singleLine = true,
                        enabled = !saving
                    )
                    OutlinedTextField(
                        value = salePrice,
                        onValueChange = { salePrice = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.price)) },
                        prefix = { Text("$currencySymbol ") },
                        singleLine = true,
                        enabled = !saving
                    )
                    OutlinedTextField(
                        value = costPrice,
                        onValueChange = { costPrice = it.filter { ch -> ch.isDigit() || ch == '.' } },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.cost_price)) },
                        prefix = { Text("$currencySymbol ") },
                        singleLine = true,
                        enabled = !saving
                    )
                    OutlinedTextField(
                        value = stock,
                        onValueChange = { stock = it.filter(Char::isDigit) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(stringResource(R.string.stock_quantity)) },
                        singleLine = true,
                        enabled = !saving
                    )
                    ExposedDropdownMenuBox(
                        expanded = categoryExpanded,
                        onExpandedChange = { if (!saving) categoryExpanded = it },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = selectedCategory?.name.orEmpty(),
                            onValueChange = {},
                            readOnly = true,
                            label = { Text(stringResource(R.string.category)) },
                            trailingIcon = {
                                ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded)
                            },
                            modifier = Modifier
                                .menuAnchor()
                                .fillMaxWidth(),
                            enabled = !saving
                        )
                        ExposedDropdownMenu(
                            expanded = categoryExpanded,
                            onDismissRequest = { categoryExpanded = false }
                        ) {
                            categories.forEach { category ->
                                DropdownMenuItem(
                                    text = { Text(category.name) },
                                    onClick = {
                                        categoryId = category.id
                                        categoryExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss, enabled = !saving) {
                        Text(stringResource(R.string.cancel))
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val trimmedName = name.trim()
                            val price = salePrice.toDoubleOrNull()
                            val catId = categoryId
                            val stockNum = stock.toIntOrNull() ?: -1
                            val cost = costPrice.trim().takeIf { it.isNotEmpty() }?.toDoubleOrNull()
                            if (trimmedName.isEmpty() || catId == null || price == null || price < 0 ||
                                stockNum < 0 || (costPrice.isNotBlank() && (cost == null || cost < 0))
                            ) {
                                return@Button
                            }
                            onCreate(trimmedName, price, catId, stockNum, cost)
                        },
                        enabled = !saving && categories.isNotEmpty()
                    ) {
                        Text(
                            if (saving) stringResource(R.string.sending) else stringResource(R.string.save)
                        )
                    }
                }
            }
        }
    }
}
