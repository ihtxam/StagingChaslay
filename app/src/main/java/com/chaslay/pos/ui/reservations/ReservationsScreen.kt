package com.chaslay.pos.ui.reservations

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.chaslay.pos.R
import com.chaslay.pos.data.local.entity.ReservationEntity
import com.chaslay.pos.ui.theme.posUiColors
import com.chaslay.pos.ui.theme.vectronColors
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class PendingConfirm(val action: String) {
    ACCEPT("accept"),
    REJECT("reject"),
    SEAT("seat"),
    COMPLETE("complete"),
    NO_SHOW("no_show"),
    PROMOTE("promote_waitlist")
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ReservationsScreen(
    onBack: () -> Unit,
    viewModel: ReservationsViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val colors = vectronColors()
    val ui = posUiColors()
    var detail by remember { mutableStateOf<ReservationEntity?>(null) }
    var pendingConfirm by remember { mutableStateOf<Pair<ReservationEntity, PendingConfirm>?>(null) }
    var cancelTarget by remember { mutableStateOf<ReservationEntity?>(null) }

    state.actionError?.let { err ->
        val message = if (err == "offline") {
            stringResource(R.string.reservations_action_offline)
        } else {
            err.ifBlank { stringResource(R.string.reservations_action_failed) }
        }
        AlertDialog(
            onDismissRequest = { viewModel.clearActionError() },
            title = { Text(stringResource(R.string.error)) },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearActionError() }) {
                    Text(stringResource(R.string.ok))
                }
            }
        )
    }

    detail?.let { row ->
        ReservationDetailDialog(
            row = row,
            actionsEnabled = state.canPerformHostActions && !state.actionInProgress,
            onDismiss = { detail = null },
            onAccept = { detail = null; pendingConfirm = row to PendingConfirm.ACCEPT },
            onReject = { detail = null; pendingConfirm = row to PendingConfirm.REJECT },
            onSeat = { detail = null; pendingConfirm = row to PendingConfirm.SEAT },
            onComplete = { detail = null; pendingConfirm = row to PendingConfirm.COMPLETE },
            onNoShow = { detail = null; pendingConfirm = row to PendingConfirm.NO_SHOW },
            onPromote = { detail = null; pendingConfirm = row to PendingConfirm.PROMOTE },
            onCancelBooking = {
                cancelTarget = row
                detail = null
            }
        )
    }

    pendingConfirm?.let { (row, confirm) ->
        val messageRes = when (confirm) {
            PendingConfirm.ACCEPT -> R.string.reservations_action_confirm_accept
            PendingConfirm.REJECT -> R.string.reservations_action_confirm_reject
            PendingConfirm.SEAT -> R.string.reservations_action_confirm_seat
            PendingConfirm.COMPLETE -> R.string.reservations_action_confirm_complete
            PendingConfirm.NO_SHOW -> R.string.reservations_action_confirm_no_show
            PendingConfirm.PROMOTE -> R.string.reservations_action_confirm_promote
        }
        AlertDialog(
            onDismissRequest = { pendingConfirm = null },
            text = { Text(stringResource(messageRes)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.runAction(row.id, confirm.action)
                        pendingConfirm = null
                        detail = null
                    }
                ) {
                    Text(stringResource(R.string.confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingConfirm = null }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    cancelTarget?.let { row ->
        ReservationCancelDialog(
            onDismiss = { cancelTarget = null },
            onConfirm = { reason ->
                viewModel.runAction(
                    reservationId = row.id,
                    action = "cancel",
                    cancelReason = reason,
                    sendRejectionEmail = true
                )
                cancelTarget = null
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.reservations_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back_to_pos)
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.refresh() }, enabled = !state.refreshing) {
                        Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.refresh))
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(colors.background)
        ) {
            if (!state.moduleVisible) {
                Text(
                    stringResource(R.string.reservations_module_disabled),
                    modifier = Modifier.padding(16.dp),
                    color = ui.textSecondary
                )
                return@Column
            }
            if (!state.canPerformHostActions) {
                Text(
                    stringResource(R.string.reservations_action_offline),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    color = ui.textSecondary,
                    fontSize = 12.sp
                )
            } else if (state.lastSyncError != null) {
                Text(
                    stringResource(R.string.reservations_offline_hint),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    color = ui.textSecondary,
                    fontSize = 12.sp
                )
            }
            if (state.reservations.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Default.CalendarToday,
                        contentDescription = null,
                        tint = ui.textSecondary
                    )
                    Text(
                        stringResource(R.string.reservations_empty),
                        color = ui.textSecondary,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.reservations, key = { it.id }) { row ->
                        ReservationRow(row = row, onClick = { detail = row })
                    }
                }
            }
        }
    }
}

@Composable
private fun ReservationDetailDialog(
    row: ReservationEntity,
    actionsEnabled: Boolean,
    onDismiss: () -> Unit,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onSeat: () -> Unit,
    onComplete: () -> Unit,
    onNoShow: () -> Unit,
    onPromote: () -> Unit,
    onCancelBooking: () -> Unit
) {
    val status = row.status.lowercase(Locale.ROOT)
    val terminal = status in listOf("cancelled", "canceled", "rejected", "completed", "no_show")
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(stringResource(R.string.reservation_detail_title, row.code))
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(row.guestName, fontWeight = FontWeight.Bold)
                Text(row.guestPhone)
                row.guestEmail?.takeIf { it.isNotBlank() }?.let { Text(it) }
                Text(
                    stringResource(
                        R.string.reservation_party_size,
                        row.partySize
                    )
                )
                Text(formatReservationTime(row.reservedAtMs))
                Text(stringResource(R.string.reservation_status_label, formatStatus(row.status)))
                row.tableLabel?.takeIf { it.isNotBlank() }?.let { label ->
                    Text(stringResource(R.string.reservation_table, label))
                }
                row.notes?.takeIf { it.isNotBlank() }?.let { Text(it) }
                if (actionsEnabled && !terminal) {
                    ReservationActionButtons(
                        status = status,
                        onAccept = onAccept,
                        onReject = onReject,
                        onSeat = onSeat,
                        onComplete = onComplete,
                        onNoShow = onNoShow,
                        onPromote = onPromote,
                        onCancelBooking = onCancelBooking
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.close))
            }
        }
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReservationActionButtons(
    status: String,
    onAccept: () -> Unit,
    onReject: () -> Unit,
    onSeat: () -> Unit,
    onComplete: () -> Unit,
    onNoShow: () -> Unit,
    onPromote: () -> Unit,
    onCancelBooking: () -> Unit
) {
    Column(
        modifier = Modifier.padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            when {
                status == "waitlist" -> {
                    Button(onClick = onPromote) {
                        Text(stringResource(R.string.reservations_promote_waitlist))
                    }
                    OutlinedButton(onClick = onSeat) {
                        Text(stringResource(R.string.reservations_seat))
                    }
                }
                status == "pending" -> {
                    Button(onClick = onAccept) {
                        Text(stringResource(R.string.reservations_accept))
                    }
                    OutlinedButton(onClick = onReject) {
                        Text(stringResource(R.string.reservations_reject))
                    }
                }
            }
            if (status in listOf("confirmed", "pending")) {
                OutlinedButton(onClick = onSeat) {
                    Text(stringResource(R.string.reservations_seat))
                }
            }
            if (status == "seated") {
                OutlinedButton(onClick = onComplete) {
                    Text(stringResource(R.string.reservations_complete))
                }
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (status in listOf("pending", "confirmed")) {
                TextButton(onClick = onCancelBooking) {
                    Text(stringResource(R.string.reservations_cancel))
                }
                TextButton(onClick = onNoShow) {
                    Text(stringResource(R.string.reservations_no_show))
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ReservationCancelDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    val reasonOptions = listOf(
        R.string.reservations_cancel_reason_no_show,
        R.string.reservations_cancel_reason_customer,
        R.string.reservations_cancel_reason_table,
        R.string.reservations_cancel_reason_overbooking,
        R.string.reservations_cancel_reason_other
    ).map { stringResource(it) }
    var selectedReason by remember { mutableStateOf<String?>(null) }
    var otherText by remember { mutableStateOf("") }
    val isOther = selectedReason == reasonOptions.lastOrNull()
    val canSubmit = selectedReason != null && (!isOther || otherText.isNotBlank())

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.reservations_cancel_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(stringResource(R.string.reservations_cancel_hint), fontSize = 13.sp)
                Text(stringResource(R.string.reservations_cancel_reason_prompt), fontWeight = FontWeight.Medium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    reasonOptions.forEach { label ->
                        FilterChip(
                            selected = selectedReason == label,
                            onClick = { selectedReason = label },
                            label = { Text(label) }
                        )
                    }
                }
                if (isOther) {
                    OutlinedTextField(
                        value = otherText,
                        onValueChange = { otherText = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSubmit,
                onClick = {
                    val reason = if (isOther) otherText.trim() else selectedReason.orEmpty()
                    onConfirm(reason)
                }
            ) {
                Text(stringResource(R.string.reservations_cancel_confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun ReservationRow(row: ReservationEntity, onClick: () -> Unit) {
    val ui = posUiColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ui.surface, shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(row.guestName, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(
                "${formatReservationTime(row.reservedAtMs)} · ${stringResource(R.string.reservation_party_size, row.partySize)}",
                fontSize = 12.sp,
                color = ui.textSecondary
            )
            row.tableLabel?.takeIf { it.isNotBlank() }?.let {
                Text(
                    stringResource(R.string.reservation_table, it),
                    fontSize = 12.sp,
                    color = ui.textSecondary
                )
            }
        }
        Text(
            formatStatus(row.status),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = ui.textPrimary
        )
    }
}

private fun formatReservationTime(ms: Long): String {
    val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
    return fmt.format(Date(ms))
}

@Composable
private fun formatStatus(raw: String): String {
    val key = when (raw.lowercase(Locale.ROOT)) {
        "pending" -> R.string.reservation_status_pending
        "confirmed" -> R.string.reservation_status_confirmed
        "seated" -> R.string.reservation_status_seated
        "waitlist" -> R.string.reservation_status_waitlist
        "cancelled", "canceled" -> R.string.reservation_status_cancelled
        "rejected" -> R.string.reservation_status_rejected
        "no_show" -> R.string.reservation_status_no_show
        "completed" -> R.string.reservation_status_completed
        else -> null
    }
    return if (key != null) stringResource(key) else raw.replace('_', ' ')
}
