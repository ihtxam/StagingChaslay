package com.chaslay.pos.ui.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.CategoryEntity
import com.chaslay.pos.data.local.entity.ProductEntity
import com.chaslay.pos.ui.catalog.CatalogScreen
import com.chaslay.pos.ui.theme.vectronColors
@Composable
fun MenuHubScreen(viewModel: MenuViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()

    state.message?.let { msg ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = { TextButton(onClick = viewModel::clearMessage) { Text("OK") } },
            text = { Text(msg) }
        )
    }

    Row(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .width(180.dp)
                .fillMaxHeight()
                .background(colors.panelLight)
                .padding(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(stringResource(R.string.menu_settings), fontWeight = FontWeight.Bold, modifier = Modifier.padding(8.dp))
            MenuSection.entries.forEach { section ->
                val selected = state.section == section
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(if (selected) Color(0xFF00897B) else Color.Transparent)
                        .clickable { viewModel.setSection(section) }
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    Text(
                        stringResource(
                            when (section) {
                                MenuSection.PRODUCT_LIST -> R.string.product_list
                                MenuSection.IMPORT_EXPORT -> R.string.menu_import_export
                                MenuSection.MODIFIERS -> R.string.modifiers
                                MenuSection.ADDONS -> R.string.addons
                                MenuSection.COMBOS -> R.string.combos
                            }
                        ),
                        color = if (selected) Color.White else colors.textPrimary,
                        fontSize = 13.sp
                    )
                }
            }
        }
        Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
            when (state.section) {
                MenuSection.PRODUCT_LIST -> CatalogScreen()
                MenuSection.IMPORT_EXPORT -> MenuImportSection(
                    importMode = state.importMode,
                    importPreview = state.importPreview,
                    isImporting = state.isImporting,
                    onModeChange = viewModel::setImportMode,
                    onPickFile = viewModel::parseImportFile,
                    onConfirmImport = viewModel::confirmImport,
                    onDismissPreview = viewModel::dismissImportPreview,
                    onExportTemplate = viewModel::exportTemplate
                )
                MenuSection.MODIFIERS -> ModifierListSection(
                    groups = state.modifierGroups,
                    viewModel = viewModel
                )
                MenuSection.ADDONS -> AddonListSection(
                    groups = state.addonGroups,
                    viewModel = viewModel
                )
                MenuSection.COMBOS -> CombosSectionHost(viewModel = viewModel)
            }
        }
    }
}

@Composable
private fun CombosSectionHost(viewModel: MenuViewModel) {
    var combos by remember { mutableStateOf<List<ProductEntity>>(emptyList()) }
    var categories by remember { mutableStateOf<List<CategoryEntity>>(emptyList()) }
    LaunchedEffect(Unit) {
        combos = viewModel.getComboProducts()
        categories = viewModel.getAllCategories()
    }
    CombosSection(
        combos = combos,
        categories = categories,
        viewModel = viewModel,
        onRefresh = {
            combos = viewModel.getComboProducts()
            categories = viewModel.getAllCategories()
        }
    )
}
