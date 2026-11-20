package com.chaslay.pos.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material.icons.outlined.Cake
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FreeBreakfast
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.ListAlt
import androidx.compose.material.icons.outlined.LocalCafe
import androidx.compose.material.icons.outlined.LocalBar
import androidx.compose.material.icons.outlined.LocalOffer
import androidx.compose.material.icons.outlined.LocalPizza
import androidx.compose.material.icons.outlined.LunchDining
import androidx.compose.material.icons.outlined.MonitorWeight
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.Payments
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Print
import androidx.compose.material.icons.outlined.Receipt
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material.icons.outlined.TableRestaurant
import java.text.Normalizer
import java.util.Locale
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import com.chaslay.pos.R
import com.chaslay.pos.domain.model.PaymentMethod
import com.chaslay.pos.ui.menu.MenuSection
import com.chaslay.pos.ui.settings.SettingsSection

/** Modern-layout sidebar: custom ic_pos_* vectors (avoid on [PosMenuDesign.CLASSIC] paths). */
@DrawableRes
fun settingsSectionIconRes(section: SettingsSection): Int? = when (section) {
    SettingsSection.GENERAL -> R.drawable.ic_pos_settings_general
    SettingsSection.VAT -> R.drawable.ic_pos_settings_taxes
    SettingsSection.PAYMENTS -> R.drawable.ic_pos_settings_payments
    SettingsSection.PRINTERS -> R.drawable.ic_pos_settings_printers
    SettingsSection.SCALE -> R.drawable.ic_pos_settings_balance
    SettingsSection.RECEIPTS -> R.drawable.ic_pos_settings_receipts
    SettingsSection.FLOOR_DEVICES -> R.drawable.ic_pos_settings_floor_waiters
    SettingsSection.USERS_ACCOUNTS -> R.drawable.ic_pos_settings_users_roles
    SettingsSection.APPEARANCE -> R.drawable.ic_pos_settings_appearance
    SettingsSection.LICENSE -> R.drawable.ic_pos_settings_licence
    SettingsSection.UPDATE -> R.drawable.ic_pos_settings_general
    SettingsSection.TABLES -> R.drawable.ic_pos_settings_tables
    SettingsSection.DIAGNOSTICS -> R.drawable.ic_pos_settings_general
}

/** Classic-layout sidebar: bundled Material icons (no ic_pos_* decode). */
fun settingsSectionMaterialIcon(section: SettingsSection): ImageVector? = when (section) {
    SettingsSection.GENERAL -> Icons.Outlined.Settings
    SettingsSection.VAT -> Icons.Outlined.Receipt
    SettingsSection.PAYMENTS -> Icons.Outlined.Payments
    SettingsSection.PRINTERS -> Icons.Outlined.Print
    SettingsSection.SCALE -> Icons.Outlined.MonitorWeight
    SettingsSection.RECEIPTS -> Icons.Outlined.Description
    SettingsSection.FLOOR_DEVICES -> Icons.Outlined.Restaurant
    SettingsSection.USERS_ACCOUNTS -> Icons.Outlined.Person
    SettingsSection.APPEARANCE -> Icons.Outlined.Palette
    SettingsSection.LICENSE -> Icons.Outlined.Badge
    SettingsSection.UPDATE -> Icons.Outlined.SystemUpdate
    SettingsSection.TABLES -> Icons.Outlined.TableRestaurant
    SettingsSection.DIAGNOSTICS -> Icons.Outlined.BugReport
}

@DrawableRes
fun menuSectionIconRes(section: MenuSection): Int = when (section) {
    MenuSection.PRODUCT_LIST -> R.drawable.ic_pos_settings_general
    MenuSection.IMPORT_EXPORT -> R.drawable.ic_pos_actions_send
    MenuSection.EXTRAS_AND_NOS -> R.drawable.ic_pos_settings_receipts
    MenuSection.COMBOS -> R.drawable.ic_pos_settings_payments
}

fun menuSectionMaterialIcon(section: MenuSection): ImageVector = when (section) {
    MenuSection.PRODUCT_LIST -> Icons.Outlined.ListAlt
    MenuSection.IMPORT_EXPORT -> Icons.Outlined.IosShare
    MenuSection.EXTRAS_AND_NOS -> Icons.Outlined.LocalOffer
    MenuSection.COMBOS -> Icons.Outlined.Payments
}

@DrawableRes
fun checkoutPaymentMethodIconRes(method: PaymentMethod): Int = when (method) {
    PaymentMethod.CASH -> R.drawable.ic_pos_payment_cash
    PaymentMethod.CARD -> R.drawable.ic_pos_payment_card
    PaymentMethod.ADYEN_TERMINAL -> R.drawable.ic_pos_payment_terminal
    PaymentMethod.TAP_TO_PAY -> R.drawable.ic_pos_payment_contactless
    PaymentMethod.PAY_LATER -> R.drawable.ic_pos_payment_deferred
    PaymentMethod.INVOICE -> R.drawable.ic_pos_payment_invoice
    else -> R.drawable.ic_pos_payment_card
}

@DrawableRes
fun checkoutGiftCardIconRes(): Int = R.drawable.ic_pos_payment_gift

private enum class PosCategoryIconKind {
    DRINKS,
    BREAKFAST,
    SALADS,
    COFFEE,
    DESSERTS,
    PIZZA,
    SANDWICHES,
    OFFERS,
}

private fun normalizeCategoryIconKey(name: String, remoteId: String?): String {
    val raw = buildString {
        append(name.trim())
        if (!remoteId.isNullOrBlank()) {
            append(' ')
            append(remoteId.trim())
        }
    }
    return Normalizer.normalize(raw, Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "")
        .lowercase(Locale.ROOT)
        .replace('-', ' ')
        .replace('_', ' ')
}

private fun resolvePosCategoryIconKind(name: String, remoteId: String? = null): PosCategoryIconKind? {
    val key = normalizeCategoryIconKey(name, remoteId)
    return when {
        key.containsKeyword("drink", "beverage", "boisson", "getrank", "soda", "juice", "soft")
            -> PosCategoryIconKind.DRINKS
        key.containsKeyword("breakfast", "brunch", "petit dejeuner", "fruhstuck")
            -> PosCategoryIconKind.BREAKFAST
        key.containsKeyword("salad", "salade")
            -> PosCategoryIconKind.SALADS
        key.containsKeyword("coffee", "cafe", "espresso", "kaffee", "latte", "cappuccino")
            -> PosCategoryIconKind.COFFEE
        key.containsKeyword("dessert", "patisserie", "sweet", "sucr", "cake", "pastry")
            -> PosCategoryIconKind.DESSERTS
        key.containsKeyword("pizza", "pizze")
            -> PosCategoryIconKind.PIZZA
        key.containsKeyword("sandwich", "panini", "wrap", "burger", "baguette")
            -> PosCategoryIconKind.SANDWICHES
        key.containsKeyword("offer", "promo", "promotion", "deal", "special", "rabatt", "reduction")
            -> PosCategoryIconKind.OFFERS
        else -> null
    }
}

private fun String.containsKeyword(vararg needles: String): Boolean =
    needles.any { needle -> contains(needle) }

/** POS catalog default category icon from name / remote slug when no custom image is set. */
@DrawableRes
fun posCategoryIconRes(name: String, remoteId: String? = null): Int? = when (resolvePosCategoryIconKind(name, remoteId)) {
    PosCategoryIconKind.DRINKS -> R.drawable.ic_pos_category_drinks
    PosCategoryIconKind.BREAKFAST -> R.drawable.ic_pos_category_breakfast
    PosCategoryIconKind.SALADS -> R.drawable.ic_pos_category_salads
    PosCategoryIconKind.COFFEE -> R.drawable.ic_pos_category_coffee
    PosCategoryIconKind.DESSERTS -> R.drawable.ic_pos_category_desserts
    PosCategoryIconKind.PIZZA -> R.drawable.ic_pos_category_pizza
    PosCategoryIconKind.SANDWICHES -> R.drawable.ic_pos_category_sandwiches
    PosCategoryIconKind.OFFERS -> R.drawable.ic_pos_category_offers
    null -> null
}

/** Classic POS paths: lightweight Material fallback matching [posCategoryIconRes] keywords. */
fun posCategoryMaterialIcon(name: String, remoteId: String? = null): ImageVector = when (resolvePosCategoryIconKind(name, remoteId)) {
    PosCategoryIconKind.DRINKS -> Icons.Outlined.LocalBar
    PosCategoryIconKind.BREAKFAST -> Icons.Outlined.FreeBreakfast
    PosCategoryIconKind.SALADS -> Icons.Outlined.Restaurant
    PosCategoryIconKind.COFFEE -> Icons.Outlined.LocalCafe
    PosCategoryIconKind.DESSERTS -> Icons.Outlined.Cake
    PosCategoryIconKind.PIZZA -> Icons.Outlined.LocalPizza
    PosCategoryIconKind.SANDWICHES -> Icons.Outlined.LunchDining
    PosCategoryIconKind.OFFERS -> Icons.Outlined.LocalOffer
    null -> Icons.Outlined.Category
}

/** Renders a modern mockup vector drawable; prefer [settingsSectionMaterialIcon] when design is Classic. */
@Composable
fun PosVectorIcon(
    @DrawableRes resId: Int,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    tint: Color = LocalContentColor.current,
) {
    Icon(
        painter = painterResource(resId),
        contentDescription = contentDescription,
        modifier = modifier,
        tint = tint,
    )
}
