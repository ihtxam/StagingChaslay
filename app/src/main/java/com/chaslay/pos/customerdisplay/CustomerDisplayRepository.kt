package com.chaslay.pos.customerdisplay

import com.chaslay.pos.data.remote.SyncApi
import com.chaslay.pos.data.remote.dto.CdsLiveLineDto
import com.chaslay.pos.data.remote.dto.CdsPushRequest
import com.chaslay.pos.data.remote.dto.CdsPushStateDto
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Singleton
class CustomerDisplayRepository @Inject constructor(
    private val syncApi: SyncApi,
) {
    suspend fun pushLiveState(state: CustomerDisplayState) = withContext(Dispatchers.IO) {
        syncApi.pushCustomerDisplayState(
            CdsPushRequest(
                state = CdsPushStateDto(
                    merchantName = state.merchantName,
                    currency = state.currency,
                    lines = state.lines.map {
                        CdsLiveLineDto(
                            name = it.name,
                            qty = it.qty,
                            lineTotal = it.lineTotal,
                            modifiers = it.modifiers,
                        )
                    },
                    subtotal = state.subtotal,
                    discount = state.discount,
                    tax = state.tax,
                    total = state.total,
                    phase = state.phase.name,
                    receiptUrl = state.receiptUrl,
                    locale = state.locale,
                    updatedAt = state.updatedAt,
                ),
            ),
        )
    }
}
