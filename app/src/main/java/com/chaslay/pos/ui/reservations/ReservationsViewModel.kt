package com.chaslay.pos.ui.reservations

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chaslay.pos.data.local.entity.ReservationEntity
import com.chaslay.pos.data.preferences.SyncApiKeyStore
import com.chaslay.pos.data.repository.ReservationRepository
import com.chaslay.pos.data.repository.SettingsRepository
import com.chaslay.pos.domain.model.PosMode
import com.chaslay.pos.sync.ReservationSyncRepository
import com.chaslay.pos.sync.SyncService
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class ReservationsListScope {
    TODAY,
    FUTURE,
}

data class ReservationsUiState(
    val moduleVisible: Boolean = false,
    val listScope: ReservationsListScope = ReservationsListScope.TODAY,
    val reservations: List<ReservationEntity> = emptyList(),
    val refreshing: Boolean = false,
    val actionInProgress: Boolean = false,
    val actionError: String? = null,
    val canPerformHostActions: Boolean = false,
    val lastSyncError: String? = null,
    val lastSyncedCount: Int? = null
)

@HiltViewModel
class ReservationsViewModel @Inject constructor(
    private val reservationRepository: ReservationRepository,
    private val reservationSyncRepository: ReservationSyncRepository,
    private val settingsRepository: SettingsRepository,
    private val syncService: SyncService,
    private val syncApiKeyStore: SyncApiKeyStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReservationsUiState())
    val uiState: StateFlow<ReservationsUiState> = _uiState.asStateFlow()
    private val listScope = MutableStateFlow(ReservationsListScope.TODAY)

    init {
        viewModelScope.launch {
            settingsRepository.observeSettings().collect { settings ->
                _uiState.update {
                    it.copy(
                        moduleVisible = settings.reservationsEnabled && settings.posMode == PosMode.RESTAURANT,
                        canPerformHostActions = syncApiKeyStore.hasKey()
                    )
                }
            }
        }
        viewModelScope.launch {
            listScope
                .flatMapLatest { scope ->
                    when (scope) {
                        ReservationsListScope.TODAY -> reservationRepository.observeToday()
                        ReservationsListScope.FUTURE -> reservationRepository.observeFuture()
                    }
                }
                .collect { list ->
                    _uiState.update { it.copy(reservations = list) }
                }
        }
        refresh(fromUser = false)
    }

    fun setListScope(scope: ReservationsListScope) {
        listScope.value = scope
        _uiState.update { it.copy(listScope = scope) }
    }

    fun refresh(fromUser: Boolean = true) {
        viewModelScope.launch {
            if (fromUser) {
                _uiState.update { it.copy(refreshing = true, lastSyncError = null) }
            }
            val result = syncService.syncReservationsOnly()
            _uiState.update {
                it.copy(
                    refreshing = false,
                    lastSyncError = result.error,
                    lastSyncedCount = if (result.skipped) null else result.count,
                    canPerformHostActions = syncApiKeyStore.hasKey()
                )
            }
        }
    }

    fun clearActionError() {
        _uiState.update { it.copy(actionError = null) }
    }

    fun runAction(
        reservationId: String,
        action: String,
        cancelReason: String? = null,
        sendRejectionEmail: Boolean? = null
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(actionInProgress = true, actionError = null) }
            val result = reservationSyncRepository.performAction(
                reservationId = reservationId,
                action = action,
                cancelReason = cancelReason,
                sendRejectionEmail = sendRejectionEmail
            )
            _uiState.update {
                it.copy(
                    actionInProgress = false,
                    actionError = when {
                        result.success -> null
                        result.offline -> "offline"
                        else -> result.error
                    }
                )
            }
        }
    }
}
