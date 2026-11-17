package com.chaslay.pos.ui.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
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
import com.chaslay.pos.ui.components.PosVectorIcon
import com.chaslay.pos.ui.components.menuSectionIconRes
import com.chaslay.pos.ui.components.menuSectionMaterialIcon
import com.chaslay.pos.ui.pos.compact.CompactPosColors
import com.chaslay.pos.ui.theme.posUiColors
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.vectronColors

@Composable
fun MenuHubScreen(
    useCompactPortrait: Boolean = false,
    viewModel: MenuViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val posMenuDesign by viewModel.posMenuDesign.collectAsStateWithLifecycle()
    val useModernNavIcons = posMenuDesign.isModern
    val colors = vectronColors()
    val ui = posUiColors()

    state.message?.let { msg ->
        AlertDialog(
            onDismissRequest = viewModel::clearMessage,
            confirmButton = {
                TextButton(onClick = viewModel::clearMessage) {
                    Text(stringResource(R.string.ok))
                }
            },
            text = { Text(msg) }
        )
    }

    val canvasBg = if (useCompactPortrait) CompactPosColors.Bg else ui.canvas
    val navLabel: (MenuSection) -> Int = { section ->
        when (section) {
            MenuSection.PRODUCT_LIST -> R.string.product_list
            MenuSection.IMPORT_EXPORT -> R.string.menu_import_export
            MenuSection.EXTRAS_AND_NOS -> R.string.pos_extras_and_nos
            MenuSection.COMBOS -> R.string.combos
        }
    }
    val sectionBody = @Composable {
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
            MenuSection.EXTRAS_AND_NOS -> ExtrasAndNosListSection(
                modifierGroups = state.modifierGroups,
                addonGroups = state.addonGroups,
                viewModel = viewModel,
            )
            MenuSection.COMBOS -> CombosSectionHost(viewModel = viewModel)
        }
    }

    if (useCompactPortrait) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(canvasBg),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .background(CompactPosColors.Surface)
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                MenuSection.sidebarOrder.forEach { section ->
                    val selected = state.section == section
                    FilterChip(
                        selected = selected,
                        onClick = { viewModel.setSection(section) },
                        label = {
                            Text(
                                stringResource(navLabel(section)),
                                fontSize = 12.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                            )
                        },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = CompactPosColors.Teal,
                            selectedLabelColor = Color.White,
                            containerColor = CompactPosColors.ActionCellBg,
                            labelColor = CompactPosColors.Ink,
                        ),
                    )
                }
            }
            Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                sectionBody()
            }
        }
    } else {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .background(canvasBg)
        ) {
            Column(
                modifier = Modifier
                    .width(180.dp)
                    .fillMaxHeight()
                    .background(ui.surface)
                    .padding(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    stringResource(R.string.menu_settings),
                    fontWeight = FontWeight.Bold,
                    color = ui.textPrimary,
                    modifier = Modifier.padding(8.dp),
                )
                MenuSection.sidebarOrder.forEach { section ->
                    val selected = state.section == section
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (selected) PosColors.Primary else Color.Transparent)
                            .clickable { viewModel.setSection(section) }
                            .padding(horizontal = 10.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    ) {
                        val navIconTint = if (selected) Color.White else colors.textPrimary
                        if (useModernNavIcons) {
                            PosVectorIcon(
                                resId = menuSectionIconRes(section),
                                contentDescription = null,
                                tint = navIconTint,
                                modifier = Modifier.size(18.dp),
                            )
                        } else {
                            Icon(
                                imageVector = menuSectionMaterialIcon(section),
                                contentDescription = null,
                                tint = navIconTint,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                        Text(
                            stringResource(navLabel(section)),
                            color = if (selected) Color.White else colors.textPrimary,
                            fontSize = 13.sp,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    }
                }
            }
            Box(modifier = Modifier.weight(1f).fillMaxHeight()) {
                sectionBody()
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
