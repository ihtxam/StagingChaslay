package com.chaslay.pos.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.res.stringResource
import com.chaslay.pos.R

private const val SCAN_GAP_MS = 100L

/**
 * Captures HID keyboard-wedge RFID readers (rapid key burst + Enter), matching WebPOS [RfidScanInput].
 * Rapid bursts are buffered locally; [onValueChange] is not called until Enter or manual typing.
 */
@Composable
fun RfidScanField(
    value: String,
    onValueChange: (String) -> Unit,
    onScanComplete: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    autoFocus: Boolean = false
) {
    var buffer by remember { mutableStateOf("") }
    var lastKeyAt by remember { mutableLongStateOf(0L) }
    val focusRequester = remember { FocusRequester() }

    androidx.compose.runtime.LaunchedEffect(autoFocus) {
        if (autoFocus) focusRequester.requestFocus()
    }

    OutlinedTextField(
        value = buffer.ifBlank { value },
        onValueChange = { newValue ->
            val now = System.currentTimeMillis()
            val gap = now - lastKeyAt
            lastKeyAt = now
            val wedge = gap < SCAN_GAP_MS || buffer.isNotEmpty()
            if (wedge) {
                buffer = newValue
            } else {
                onValueChange(newValue)
                buffer = ""
            }
        },
        modifier = modifier
            .fillMaxWidth()
            .focusRequester(focusRequester)
            .onPreviewKeyEvent { event ->
                if (event.key == Key.Enter) {
                    val scanned = (buffer.ifBlank { value }).trim()
                    if (scanned.isNotEmpty()) {
                        onValueChange(scanned)
                        onScanComplete(scanned)
                        buffer = ""
                    }
                    true
                } else {
                    false
                }
            },
        placeholder = {
            Text(placeholder ?: stringResource(R.string.rfid_scan_placeholder))
        },
        singleLine = true
    )
}
