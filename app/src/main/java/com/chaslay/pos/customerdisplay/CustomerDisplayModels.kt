package com.chaslay.pos.customerdisplay

enum class CustomerDisplayPhase {
    idle,
    building,
    payment,
    thankyou,
}

data class CustomerDisplayLine(
    val name: String,
    val qty: Double,
    val lineTotal: Double,
    val modifiers: String? = null,
)

data class CustomerDisplayState(
    val merchantName: String? = null,
    val currency: String = "CHF",
    val lines: List<CustomerDisplayLine> = emptyList(),
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val tax: Double = 0.0,
    val total: Double = 0.0,
    val phase: CustomerDisplayPhase,
    val receiptUrl: String? = null,
    val locale: String? = null,
    val updatedAt: Long = System.currentTimeMillis(),
)
