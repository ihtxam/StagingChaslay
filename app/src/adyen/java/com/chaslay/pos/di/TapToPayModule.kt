package com.chaslay.pos.di

import com.chaslay.pos.payment.taptopay.AdyenTapToPayService
import com.chaslay.pos.payment.taptopay.TapToPayEngine
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Binds the Adyen SoftPOS engine. Only compiled when the SDK is in the build. */
@Module
@InstallIn(SingletonComponent::class)
abstract class TapToPayModule {

    @Binds
    @Singleton
    abstract fun bindTapToPayEngine(engine: AdyenTapToPayService): TapToPayEngine
}
