package com.chaslay.pos.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PosPermission
import com.chaslay.pos.domain.model.sanitizeStaffPinInput
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.ui.text.style.TextOverflow
import com.chaslay.pos.ui.components.PosVectorIcon
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosSwitch
import com.chaslay.pos.ui.theme.posUiColors
import java.text.DateFormat
import java.util.Date

private val AccentTeal = PosColors.Primary

private enum class UsersStatusFilter { ALL, ACTIVE, INACTIVE }

private enum class UsersRolesSubTab { Users, Roles }

@Composable
fun UsersRolesSection(
    canManageRoles: Boolean,
    useModernVisuals: Boolean = false,
    viewModel: UsersRolesViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = posUiColors()
    var selectedTab by remember { mutableStateOf(UsersRolesSubTab.Users) }
    var userQuery by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf(UsersStatusFilter.ALL) }

    LaunchedEffect(state.message) {
        state.message?.let {
            kotlinx.coroutines.delay(2500)
            viewModel.clearMessage()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                Text(
                    stringResource(R.string.users_accounts),
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = colors.textPrimary,
                )
                Text(
                    stringResource(R.string.users_accounts_help),
                    fontSize = 13.sp,
                    color = colors.textSecondary,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (!canManageRoles || selectedTab == UsersRolesSubTab.Users) {
                Button(
                    onClick = viewModel::openNewUser,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal),
                    shape = RoundedCornerShape(10.dp),
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.add_user))
                }
            }
        }
        state.message?.let {
            Text(it, color = AccentTeal, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }

        if (canManageRoles) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = selectedTab == UsersRolesSubTab.Users,
                    onClick = { selectedTab = UsersRolesSubTab.Users },
                    label = { Text(stringResource(R.string.settings_users_tab)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentTeal,
                        selectedLabelColor = Color.White
                    )
                )
                FilterChip(
                    selected = selectedTab == UsersRolesSubTab.Roles,
                    onClick = { selectedTab = UsersRolesSubTab.Roles },
                    label = { Text(stringResource(R.string.settings_roles_tab)) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = AccentTeal,
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        when {
            !canManageRoles || selectedTab == UsersRolesSubTab.Users -> {
                val filteredUsers = state.users.filter { row ->
                    val matchesQuery = userQuery.isBlank() ||
                        row.user.name.contains(userQuery, ignoreCase = true) ||
                        row.user.email.orEmpty().contains(userQuery, ignoreCase = true)
                    val matchesStatus = when (statusFilter) {
                        UsersStatusFilter.ALL -> true
                        UsersStatusFilter.ACTIVE -> row.user.isActive
                        UsersStatusFilter.INACTIVE -> !row.user.isActive
                    }
                    matchesQuery && matchesStatus
                }
                val activeUsers = filteredUsers.filter { it.user.isActive }
                val inactiveUsers = filteredUsers.filter { !it.user.isActive }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = userQuery,
                        onValueChange = { userQuery = it },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text(stringResource(R.string.users_search_hint)) },
                        singleLine = true,
                    )
                    FilterChip(
                        selected = statusFilter == UsersStatusFilter.ALL,
                        onClick = { statusFilter = UsersStatusFilter.ALL },
                        label = { Text(stringResource(R.string.users_status_filter_all), fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AccentTeal,
                            selectedLabelColor = Color.White,
                        ),
                    )
                }

                if (filteredUsers.isEmpty()) {
                    Text(
                        stringResource(R.string.no_users_yet),
                        color = colors.textSecondary,
                        fontSize = 13.sp,
                    )
                } else {
                    if (activeUsers.isNotEmpty() && statusFilter != UsersStatusFilter.INACTIVE) {
                        UsersTableSectionHeader(
                            title = stringResource(R.string.users_section_active),
                            count = activeUsers.size,
                            accent = colors.successSubtle,
                            dot = PosColors.Success,
                        )
                        UsersTableHeaderRow()
                        activeUsers.forEach { row ->
                            UsersTableRow(
                                row = row,
                                useModernVisuals = useModernVisuals,
                                onEdit = { viewModel.openEditUser(row.user) },
                                onDelete = { viewModel.requestDeleteUser(row.user) },
                            )
                        }
                    }
                    if (inactiveUsers.isNotEmpty() && statusFilter != UsersStatusFilter.ACTIVE) {
                        Spacer(modifier = Modifier.height(8.dp))
                        UsersTableSectionHeader(
                            title = stringResource(R.string.users_section_inactive),
                            count = inactiveUsers.size,
                            accent = colors.warningSubtle,
                            dot = PosColors.Warning,
                        )
                        UsersTableHeaderRow()
                        inactiveUsers.forEach { row ->
                            UsersTableRow(
                                row = row,
                                useModernVisuals = useModernVisuals,
                                onEdit = { viewModel.openEditUser(row.user) },
                                onDelete = { viewModel.requestDeleteUser(row.user) },
                            )
                        }
                    }
                }
            }

            selectedTab == UsersRolesSubTab.Roles -> {
                Button(
                    onClick = viewModel::openNewRole,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.add_role))
                }
                Text(
                    stringResource(R.string.roles_list),
                    fontWeight = FontWeight.SemiBold,
                    color = colors.textPrimary,
                    fontSize = 15.sp
                )
                state.roles.forEach { role ->
                    val perms = PosPermission.decode(role.permissions)
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = colors.surfaceMuted)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(42.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF5C6BC0).copy(alpha = 0.18f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.Security,
                                    contentDescription = null,
                                    tint = Color(0xFF5C6BC0),
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    role.name,
                                    fontWeight = FontWeight.SemiBold,
                                    color = colors.textPrimary,
                                    fontSize = 15.sp
                                )
                                Text(
                                    if (perms.isEmpty()) "No permissions"
                                    else "${perms.size} permission(s)",
                                    fontSize = 12.sp,
                                    color = colors.textSecondary
                                )
                                Text(
                                    perms.take(4).joinToString(", ") { it.name.replace('_', ' ') } +
                                        if (perms.size > 4) "…" else "",
                                    fontSize = 11.sp,
                                    color = colors.textSecondary,
                                    maxLines = 2
                                )
                            }
                            IconButton(onClick = { viewModel.openEditRole(role) }) {
                                Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.edit), tint = AccentTeal)
                            }
                            if (!role.isSystem) {
                                IconButton(onClick = { viewModel.deleteRole(role.id) }) {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = stringResource(R.string.delete),
                                        tint = Color(0xFFE57373)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (state.showUserDialog) {
        AlertDialog(
            onDismissRequest = viewModel::closeUserDialog,
            title = {
                Text(if (state.editingUserId == 0L) stringResource(R.string.add_user) else stringResource(R.string.edit_user))
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = state.formName,
                        onValueChange = viewModel::updateFormName,
                        label = { Text(stringResource(R.string.user_name)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.formEmail,
                        onValueChange = viewModel::updateFormEmail,
                        label = { Text(stringResource(R.string.email_optional)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(stringResource(R.string.assign_role), fontSize = 12.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        state.roles.forEach { role ->
                            FilterChip(
                                selected = state.formRoleId == role.id,
                                onClick = { viewModel.updateFormRoleId(role.id) },
                                label = {
                                    Text(
                                        role.name,
                                        maxLines = 1,
                                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = AccentTeal,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }
                    OutlinedTextField(
                        value = state.formPin,
                        onValueChange = { viewModel.updateFormPin(sanitizeStaffPinInput(it)) },
                        label = { Text(stringResource(R.string.pos_pin)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = state.formPassword,
                        onValueChange = viewModel::updateFormPassword,
                        label = { Text(stringResource(R.string.password_reset_new)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PosSwitch(checked = state.formActive, onCheckedChange = viewModel::updateFormActive)
                        Text(stringResource(R.string.user_active))
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::saveUser,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) { Text(stringResource(R.string.save)) }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeUserDialog) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    if (state.showRoleDialog && canManageRoles) {
        AlertDialog(
            onDismissRequest = viewModel::closeRoleDialog,
            title = {
                Text(if (state.editingRoleId == 0L) stringResource(R.string.add_role) else stringResource(R.string.edit_role))
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    OutlinedTextField(
                        value = state.formRoleName,
                        onValueChange = viewModel::updateFormRoleName,
                        label = { Text(stringResource(R.string.role_name)) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text(stringResource(R.string.permissions), fontWeight = FontWeight.SemiBold)
                    PosPermission.entries.forEach { permission ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = permission in state.formPermissions,
                                onCheckedChange = { viewModel.togglePermission(permission) }
                            )
                            Text(permission.name.replace('_', ' '), fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = viewModel::saveRole,
                    colors = ButtonDefaults.buttonColors(containerColor = AccentTeal)
                ) { Text(stringResource(R.string.save)) }
            },
            dismissButton = {
                TextButton(onClick = viewModel::closeRoleDialog) { Text(stringResource(R.string.cancel)) }
            }
        )
    }

    if (state.showDeleteUserDialog && state.pendingDeleteUser != null) {
        val userName = state.pendingDeleteUser!!.name
        AlertDialog(
            onDismissRequest = viewModel::dismissDeleteUserDialog,
            title = { Text(stringResource(R.string.delete_user)) },
            text = {
                Text(stringResource(R.string.delete_user_confirm, userName))
            },
            confirmButton = {
                Button(
                    onClick = viewModel::confirmDeleteUser,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE57373)),
                ) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDeleteUserDialog) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }
}

@Composable
private fun UsersTableSectionHeader(title: String, count: Int, accent: Color, dot: Color) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = accent,
        shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(dot),
            )
            Text("$title ($count)", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        }
    }
}

@Composable
private fun UsersTableHeaderRow() {
    val colors = posUiColors()
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            UsersHeaderCell(stringResource(R.string.users_col_user), 1.6f)
            UsersHeaderCell(stringResource(R.string.users_col_role), 1f)
            UsersHeaderCell(stringResource(R.string.users_col_contact), 1.2f)
            UsersHeaderCell(stringResource(R.string.users_col_status), 0.9f)
            UsersHeaderCell(stringResource(R.string.users_col_last_activity), 1.1f)
            UsersHeaderCell(stringResource(R.string.users_col_actions), 0.8f)
        }
    }
}

@Composable
private fun RowScope.UsersHeaderCell(text: String, weight: Float) {
    Text(
        text,
        modifier = Modifier.weight(weight),
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        color = posUiColors().textMuted,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}

@Composable
private fun UsersTableRow(
    row: UserRow,
    useModernVisuals: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val colors = posUiColors()
    var menuOpen by remember { mutableStateOf(false) }
    val lastActivity = remember(row.user.createdAt) {
        DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT)
            .format(Date(row.user.createdAt))
    }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.border),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier = Modifier.weight(1.6f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(AccentTeal.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center,
                ) {
                    if (useModernVisuals) {
                        PosVectorIcon(
                            resId = com.chaslay.pos.R.drawable.ic_pos_settings_users_roles,
                            contentDescription = null,
                            tint = AccentTeal,
                            modifier = Modifier.size(22.dp),
                        )
                    } else {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = AccentTeal,
                            modifier = Modifier.size(22.dp),
                        )
                    }
                }
                Column {
                    Text(row.user.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(row.roleName, fontSize = 11.sp, color = colors.textMuted, maxLines = 1)
                }
            }
            Text(
                row.roleName,
                modifier = Modifier.weight(1f),
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                row.user.email?.takeIf { it.isNotBlank() } ?: stringResource(R.string.users_last_activity_unknown),
                modifier = Modifier.weight(1.2f),
                fontSize = 12.sp,
                color = colors.textSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                modifier = Modifier.weight(0.9f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(if (row.user.isActive) PosColors.Success else PosColors.Warning),
                )
                Text(
                    if (row.user.isActive) stringResource(R.string.user_status_active) else stringResource(R.string.user_status_inactive),
                    fontSize = 11.sp,
                )
            }
            Text(
                lastActivity,
                modifier = Modifier.weight(1.1f),
                fontSize = 11.sp,
                color = colors.textMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                modifier = Modifier.weight(0.8f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                OutlinedButton(onClick = onEdit, shape = RoundedCornerShape(8.dp)) {
                    Text(stringResource(R.string.edit), fontSize = 12.sp)
                }
                IconButton(onClick = { menuOpen = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = null, tint = colors.textMuted)
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.edit_user)) },
                        onClick = {
                            menuOpen = false
                            onEdit()
                        },
                    )
                    DropdownMenuItem(
                        text = {
                            Text(
                                stringResource(R.string.delete_user),
                                color = Color(0xFFE57373),
                            )
                        },
                        onClick = {
                            menuOpen = false
                            onDelete()
                        },
                    )
                }
            }
        }
    }
}
