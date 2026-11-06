package com.chaslay.pos.data.repository

import com.chaslay.pos.data.local.dao.ReservationDao
import com.chaslay.pos.data.local.entity.ReservationEntity
import java.util.Calendar
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow

@Singleton
class ReservationRepository @Inject constructor(
    private val reservationDao: ReservationDao
) {
    fun observeToday(): Flow<List<ReservationEntity>> {
        val (fromMs, toMs) = todayWindowMs()
        return reservationDao.observeBetween(fromMs, toMs)
    }

    suspend fun getToday(): List<ReservationEntity> {
        val (fromMs, toMs) = todayWindowMs()
        return reservationDao.getBetween(fromMs, toMs)
    }

    private fun todayWindowMs(): Pair<Long, Long> {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val fromMs = cal.timeInMillis
        cal.add(Calendar.DAY_OF_YEAR, 1)
        return fromMs to cal.timeInMillis
    }
}
