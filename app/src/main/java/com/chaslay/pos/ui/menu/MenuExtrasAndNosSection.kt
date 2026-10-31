package com.chaslay.pos.ui.menu

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.AddonGroupEntity
import com.chaslay.pos.data.local.entity.ModifierGroupEntity

private sealed interface ExtraGroupListEntry {
    val sortName: String

    data class Modifier(val group: ModifierGroupEntity) : ExtraGroupListEntry {
        override val sortName: String get() = group.name
    }

    data class Addon(val group: AddonGroupEntity) : ExtraGroupListEntry {
        override val sortName: String get() = group.name
    }
}

@Composable
fun ExtrasAndNosListSection(
    modifierGroups: List<ModifierGroupEntity>,
    addonGroups: List<AddonGroupEntity>,
    viewModel: MenuViewModel,
) {
    var showModifierEditor by remember { mutableStateOf(false) }
    var showAddonEditor by remember { mutableStateOf(false) }
    var editingModifier by remember { mutableStateOf<ModifierGroupEntity?>(null) }
    var editingAddon by remember { mutableStateOf<AddonGroupEntity?>(null) }
    var query by remember { mutableStateOf("") }

    val entries = remember(modifierGroups, addonGroups, query) {
        val combined = modifierGroups.map { ExtraGroupListEntry.Modifier(it) } +
            addonGroups.map { ExtraGroupListEntry.Addon(it) }
        combined
            .filter { query.isBlank() || it.sortName.contains(query, ignoreCase = true) }
            .sortedBy { it.sortName.lowercase() }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        MenuListHeader(
            title = stringResource(R.string.pos_extras_and_nos),
            hint = stringResource(R.string.extras_nos_page_hint),
            addLabel = stringResource(R.string.add_new_group),
            onAdd = {
                editingModifier = null
                showModifierEditor = true
            },
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(
                onClick = {
                    editingModifier = ModifierGroupEntity(name = "Extras")
                    showModifierEditor = true
                },
            ) {
                Text(stringResource(R.string.extras_nos_quick_extras))
            }
            OutlinedButton(
                onClick = {
                    editingModifier = ModifierGroupEntity(name = "No's")
                    showModifierEditor = true
                },
            ) {
                Text(stringResource(R.string.extras_nos_quick_nos))
            }
            OutlinedButton(
                onClick = {
                    editingAddon = null
                    showAddonEditor = true
                },
            ) {
                Text(stringResource(R.string.extras_nos_add_paid_group))
            }
        }
        MenuSearchField(
            query = query,
            onQueryChange = { query = it },
            placeholder = stringResource(R.string.menu_search_groups),
        )
        if (entries.isEmpty()) {
            MenuEmptyState(
                title = stringResource(R.string.menu_no_groups_yet),
                hint = stringResource(R.string.extras_nos_page_hint),
                onAdd = {
                    editingModifier = null
                    showModifierEditor = true
                },
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(entries, key = {
                    when (it) {
                        is ExtraGroupListEntry.Modifier -> "m-${it.group.id}"
                        is ExtraGroupListEntry.Addon -> "a-${it.group.id}"
                    }
                }) { entry ->
                    when (entry) {
                        is ExtraGroupListEntry.Modifier -> ModifierGroupCard(
                            group = entry.group,
                            viewModel = viewModel,
                            onEdit = {
                                editingModifier = entry.group
                                showModifierEditor = true
                            },
                            onDelete = { viewModel.deleteModifierGroup(entry.group.id) },
                        )
                        is ExtraGroupListEntry.Addon -> AddonGroupCard(
                            group = entry.group,
                            viewModel = viewModel,
                            onEdit = {
                                editingAddon = entry.group
                                showAddonEditor = true
                            },
                            onDelete = { viewModel.deleteAddonGroup(entry.group.id) },
                        )
                    }
                }
            }
        }
    }

    if (showModifierEditor) {
        ModifierEditorDialog(
            group = editingModifier,
            viewModel = viewModel,
            onDismiss = { showModifierEditor = false },
            onSaved = { showModifierEditor = false },
        )
    }
    if (showAddonEditor) {
        AddonEditorDialog(
            group = editingAddon,
            viewModel = viewModel,
            onDismiss = { showAddonEditor = false },
            onSaved = { showAddonEditor = false },
        )
    }
}
