package com.chaslay.pos.customerdisplay

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.view.Display
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Full-screen customer-facing CDS on the Sunmi rear / secondary display (native Compose). */
class CustomerDisplayPresentation(
    outerContext: Context,
    display: Display,
) : Presentation(outerContext, display), LifecycleOwner, SavedStateRegistryOwner {

    private val lifecycleRegistry = LifecycleRegistry(this)
    private val savedStateRegistryController = SavedStateRegistryController.create(this)

    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val savedStateRegistry: SavedStateRegistry
        get() = savedStateRegistryController.savedStateRegistry

    private val _state = MutableStateFlow(
        CustomerDisplayState(phase = CustomerDisplayPhase.idle),
    )
    private val _branding = MutableStateFlow(CustomerDisplayBranding())

    val state: StateFlow<CustomerDisplayState> = _state.asStateFlow()
    val branding: StateFlow<CustomerDisplayBranding> = _branding.asStateFlow()

    fun updateState(state: CustomerDisplayState) {
        _state.value = state
    }

    fun updateBranding(branding: CustomerDisplayBranding) {
        _branding.value = branding
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        savedStateRegistryController.performAttach()
        savedStateRegistryController.performRestore(savedInstanceState)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_CREATE)
        try {
            val composeView = ComposeView(context)
            composeView.setViewTreeLifecycleOwner(this)
            composeView.setViewTreeSavedStateRegistryOwner(this)
            composeView.setContent {
                val dark = isSystemInDarkTheme()
                MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme()) {
                    NativeCustomerDisplayScreen(
                        stateFlow = _state,
                        brandingFlow = _branding,
                    )
                }
            }
            setContentView(composeView)
        } catch (e: Throwable) {
            Log.e(TAG, "Customer display Compose setup failed", e)
        }
    }

    override fun onStart() {
        super.onStart()
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_START)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_RESUME)
    }

    override fun onStop() {
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_PAUSE)
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_STOP)
        super.onStop()
    }

    override fun dismiss() {
        lifecycleRegistry.handleLifecycleEvent(Lifecycle.Event.ON_DESTROY)
        super.dismiss()
    }

    private companion object {
        const val TAG = "CustomerDisplayPresentation"
    }
}
