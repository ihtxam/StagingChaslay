package com.chaslay.pos.ui.reports

import com.chaslay.pos.data.remote.dto.RemoteProfitMarginReport
import com.chaslay.pos.data.remote.dto.RemoteProfitRow
import com.chaslay.pos.domain.model.roundMoney

object ProfitMarginRemoteMapper {

    fun toLocal(report: RemoteProfitMarginReport): ProfitMarginReport {
        val summaryDto = report.summary
        val summary = ProfitMarginSnapshot(
            netMerchandise = roundMoney(summaryDto?.revenue ?: 0.0),
            cogs = roundMoney(summaryDto?.cogs ?: 0.0),
            grossProfit = roundMoney(summaryDto?.profit ?: 0.0),
            marginPercent = summaryDto?.marginPct ?: 0.0,
            linesMissingCost = summaryDto?.linesMissingBuyingPrice ?: 0,
            revenueChangePct = summaryDto?.revenueChangePct,
            profitChangePct = summaryDto?.profitChangePct
        )
        val gran = report.granularity?.lowercase()
        val byPeriod = report.byPeriod.orEmpty().map { mapRow(it) }
        val byDay = if (gran == "month") emptyList() else byPeriod
        val byMonth = if (gran == "month") byPeriod else emptyList()
        return ProfitMarginReport(
            summary = summary,
            byProduct = report.byProduct.orEmpty().map { mapRow(it) },
            byCategory = report.byCategory.orEmpty().map { mapRow(it) },
            byDay = byDay,
            byMonth = byMonth,
            fromCloud = true,
            previousRangeLabel = report.previousRange?.label
        )
    }

    private fun mapRow(row: RemoteProfitRow): ProfitMarginRow =
        ProfitMarginRow(
            id = row.id,
            label = row.label,
            quantity = roundMoney(row.quantity),
            revenue = roundMoney(row.revenue),
            cogs = roundMoney(row.cogs),
            profit = roundMoney(row.profit),
            marginPercent = row.marginPct,
            revenueChangePct = row.revenueChangePct,
            profitChangePct = row.profitChangePct
        )
}
