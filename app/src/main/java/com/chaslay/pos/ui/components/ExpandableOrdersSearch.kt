package com.chaslay.pos.ui.components
import com.chaslay.pos.ui.theme.posUiColors

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.chaslay.pos.R
import com.chaslay.pos.ui.theme.PosColors
import com.chaslay.pos.ui.theme.PosDimens
import com.chaslay.pos.ui.theme.PosShapes

/**
 * Collapsed search icon only (avoids clipped placeholder in tight toolbars).
 * Tap to expand; stays open while [query] is non-empty.
 */
@Composable
fun ExpandableOrdersSearch(
    query: String,
    onQueryChange: (String) -> Unit,
    placeholderRes: Int,
    modifier: Modifier = Modifier,
    expandedMinWidth: Dp = 160.dp,
    expandedMaxWidth: Dp = 240.dp,
    searchContentDescriptionRes: Int = R.string.search_orders,
) {
    var expanded by remember { mutableStateOf(query.isNotBlank()) }
    val focusRequester = remember { FocusRequester() }
    val active = expanded || query.isNotBlank()

    LaunchedEffect(expanded) {
        if (expanded) focusRequester.requestFocus()
    }

    if (!active) {
        IconButton(
            onClick = { expanded = true },
            modifier = modifier
                .size(PosDimens.TouchTargetMin)
                .border(1.dp, posUiColors().border, PosShapes.Medium)
        ) {
            Icon(
                Icons.Default.Search,
                contentDescription = stringResource(searchContentDescriptionRes),
                tint = posUiColors().textMuted
            )
        }
        return
    }

    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier
            .widthIn(min = expandedMinWidth, max = expandedMaxWidth)
            .focusRequester(focusRequester),
        singleLine = true,
        placeholder = {
            androidx.compose.material3.Text(
                stringResource(placeholderRes),
                fontSize = 13.sp,
                maxLines = 1
            )
        },
        leadingIcon = {
            Icon(
                Icons.Default.Search,
                contentDescription = stringResource(searchContentDescriptionRes),
                tint = posUiColors().textMuted
            )
        },
        trailingIcon = {
            IconButton(
                onClick = {
                    if (query.isBlank()) {
                        expanded = false
                    } else {
                        onQueryChange("")
                    }
                }
            ) {
                Icon(Icons.Default.Close, contentDescription = stringResource(R.string.clear), tint = posUiColors().textMuted)
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        shape = PosShapes.Medium,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = PosColors.Primary,
            unfocusedBorderColor = posUiColors().border,
            focusedContainerColor = posUiColors().surface,
            unfocusedContainerColor = posUiColors().surface,
            cursorColor = PosColors.Primary
        )
    )
}
