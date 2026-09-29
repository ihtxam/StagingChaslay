package com.rebornsense.printbridge.print

/**
 * Realtek USB 10/100 LAN (0x0BDA:0x8152, decimal 3034:33106) was saved as the
 * receipt printer. Those names must not be reused for a cash sale.
 */
internal object StalePrinterSelection {
    const val SUNMI_INTERNAL_ID = "sunmi:internal"

    private val REALTEK_HEX = Regex("""0BDA\s*:\s*8152""", RegexOption.IGNORE_CASE)
    private val REALTEK_DECIMAL = Regex("""3034\s*:\s*33106""")
    private val USB_LAN_NAME = Regex("""10\s*/\s*100\s*LAN""", RegexOption.IGNORE_CASE)

    fun isStaleRealtek(value: String?): Boolean {
        val raw = value?.trim().orEmpty()
        if (raw.isEmpty()) return false
        if (REALTEK_HEX.containsMatchIn(raw)) return true
        if (REALTEK_DECIMAL.containsMatchIn(raw)) return true
        if (USB_LAN_NAME.containsMatchIn(raw)) return true
        return false
    }

    /**
     * Prefer a live USB printer-class device when the saved default is missing,
     * is the Realtek dongle, or is no longer plugged in.
     * Returns the id that should be treated as default (may equal [currentId]).
     */
    fun chooseDefaultId(currentId: String?, endpoints: List<DefaultCandidate>): String? {
        val current = currentId?.trim()?.takeIf { it.isNotEmpty() }
        val liveMatch = current?.let { matchLive(it, endpoints) }
        val sunmiInternal = endpoints.firstOrNull { it.id == SUNMI_INTERNAL_ID }
        val printerClass = endpoints.firstOrNull { it.usbPrinterClass }
        val replace = current == null || isStaleRealtek(current) || liveMatch == null
        if (sunmiInternal != null && (replace || current?.startsWith("usb:") == true)) {
            return sunmiInternal.id
        }
        if (printerClass != null && replace) return printerClass.id
        return liveMatch?.id ?: current
    }

    private fun matchLive(id: String, endpoints: List<DefaultCandidate>): DefaultCandidate? {
        endpoints.firstOrNull { it.id == id }?.let { return it }
        val key = usbVidPid(id) ?: return null
        return endpoints.firstOrNull { usbVidPid(it.id) == key }
    }

    /** `usb:vid:pid` or `usb:vid:pid:serial` → `vid:pid`. */
    private fun usbVidPid(id: String): String? {
        if (!id.startsWith("usb:")) return null
        val parts = id.removePrefix("usb:").split(":")
        if (parts.size < 2) return null
        val vid = parts[0].toIntOrNull() ?: return null
        val pid = parts[1].toIntOrNull() ?: return null
        return "$vid:$pid"
    }
}

internal data class DefaultCandidate(
    val id: String,
    val usbPrinterClass: Boolean,
)
