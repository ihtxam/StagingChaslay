package com.rebornsense.printbridge.payment

import android.app.Activity
import android.content.pm.PackageManager
import android.content.Context

/** Fallback when the Adyen SDK is not bundled in this APK build. */
class TapToPayEngineStub : TapToPayEngine {
    override fun isReady(): Boolean = false

    override fun readinessMessage(context: Context): String =
        "Tap to Pay requires Bridge Reborn build with Adyen SDK (see print-agent-android README)."

    override suspend fun registerDevice(context: Context, params: TapToPayAuthParams): TapToPayRegisterOutcome {
        return TapToPayRegisterOutcome(ok = false, message = readinessMessage(context))
    }

    override suspend fun processSale(activity: Activity, params: TapToPaySaleParams): TapToPaySaleOutcome {
        return TapToPaySaleOutcome(
            ok = false,
            status = "error",
            message = readinessMessage(activity),
        )
    }
}

fun Context.hasNfcFeature(): Boolean =
    packageManager.hasSystemFeature(PackageManager.FEATURE_NFC)
