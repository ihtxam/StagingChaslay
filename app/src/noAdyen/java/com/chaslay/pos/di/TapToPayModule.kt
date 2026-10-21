package com.chaslay.pos.di

import com.chaslay.pos.payment.taptopay.NoopTapToPayEngine
import com.chaslay.pos.payment.taptopay.TapToPayEngine
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Binds the inert engine. Replaced by the `src/adyen` module when the SDK is in the build. */
@Module
@InstallIn(SingletonComponent::class)
abstract class TapToPayModule {

    @Binds
    @Singleton
    abstract fun bindTapToPayEngine(engine: NoopTapToPayEngine): TapToPayEngine
}
