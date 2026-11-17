package com.chaslay.pos.data.remote

import com.chaslay.pos.data.remote.dto.AckResponse
import com.chaslay.pos.data.remote.dto.CdsPushRequest
import com.chaslay.pos.data.remote.dto.DiagnosticReportRequest
import com.chaslay.pos.data.remote.dto.ProfitMarginReportResponse
import com.chaslay.pos.data.remote.dto.IncomingOrdersResponse
import com.chaslay.pos.data.remote.dto.MenuBootstrapResponse
import com.chaslay.pos.data.remote.dto.MenuChangesResponse
import com.chaslay.pos.data.remote.dto.PaymentConfigResponse
import com.chaslay.pos.data.remote.dto.PushCatalogRequest
import com.chaslay.pos.data.remote.dto.PushCatalogResponse
import com.chaslay.pos.data.remote.dto.PushTerminalsRequest
import com.chaslay.pos.data.remote.dto.PushTerminalsResponse
import com.chaslay.pos.data.remote.dto.ReservationActionRequest
import com.chaslay.pos.data.remote.dto.ReservationActionResponse
import com.chaslay.pos.data.remote.dto.ReservationsConfigRequest
import com.chaslay.pos.data.remote.dto.ReservationsConfigResponse
import com.chaslay.pos.data.remote.dto.ReservationsSyncResponse
import com.chaslay.pos.data.remote.dto.StaffSyncResponse
import com.chaslay.pos.data.remote.dto.VerifyStaffPinRequest
import com.chaslay.pos.data.remote.dto.VerifyStaffPinResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface SyncApi {
    @GET("v1/sync/bootstrap")
    suspend fun bootstrap(): MenuBootstrapResponse

    @GET("v1/sync/menu")
    suspend fun menuChanges(@Query("since") since: Long): MenuChangesResponse

    @POST("v1/sync/push-catalog")
    suspend fun pushCatalog(@Body body: PushCatalogRequest): PushCatalogResponse

    @GET("v1/sync/payment-config")
    suspend fun paymentConfig(): PaymentConfigResponse

    @GET("v1/sync/reservations")
    suspend fun reservations(): ReservationsSyncResponse

    @PUT("v1/sync/reservations/config")
    suspend fun updateReservationsConfig(@Body body: ReservationsConfigRequest): ReservationsConfigResponse

    @POST("v1/sync/reservations/{id}/action")
    suspend fun reservationAction(
        @Path("id") id: String,
        @Body body: ReservationActionRequest
    ): ReservationActionResponse

    @POST("v1/sync/cds/push")
    suspend fun pushCustomerDisplayState(@Body body: CdsPushRequest): AckResponse

    @POST("v1/sync/terminals")
    suspend fun pushTerminals(@Body body: PushTerminalsRequest): PushTerminalsResponse

    @GET("v1/sync/staff")
    suspend fun staff(): StaffSyncResponse

    @POST("v1/sync/staff/verify-pin")
    suspend fun verifyStaffPin(@Body body: VerifyStaffPinRequest): VerifyStaffPinResponse

    @GET("v1/orders/incoming")
    suspend fun incomingOrders(@Query("since") since: Long): IncomingOrdersResponse

    @POST("v1/orders/{id}/ack")
    suspend fun ackOrder(@Path("id") id: String): AckResponse

    @POST("v1/sync/diagnostic-report")
    suspend fun postDiagnosticReport(
        @Header("X-Api-Key") apiKey: String,
        @Body body: DiagnosticReportRequest,
    ): AckResponse

    @GET("v1/sync/reports/profit-margin")
    suspend fun profitMarginReport(
        @Query("preset") preset: String,
        @Query("granularity") granularity: String? = null,
        @Query("staffId") staffId: String? = null,
        @Query("from") from: String? = null,
        @Query("to") to: String? = null
    ): ProfitMarginReportResponse
}
