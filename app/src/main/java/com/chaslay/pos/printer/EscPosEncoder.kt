package com.chaslay.pos.printer

import com.chaslay.pos.util.TextEncoding
import java.text.Normalizer

object EscPosEncoder {
    /** IBM CP850 byte values (matches JDK/code page 850 and WebPOS thermal output). */
    private val UNICODE_TO_CP850: Map<Int, Int> = mapOf(
        0x00C0 to 0xB7, 0x00C1 to 0xB5, 0x00C2 to 0xB6, 0x00C3 to 0xC7,
        0x00C4 to 0x8E, 0x00C5 to 0x8F, 0x00C6 to 0x92, 0x00C7 to 0x80,
        0x00C8 to 0xD4, 0x00C9 to 0x90, 0x00CA to 0xD2, 0x00CB to 0xD3,
        0x00CC to 0xDE, 0x00CD to 0xD6, 0x00CE to 0xD7, 0x00CF to 0xD8,
        0x00D0 to 0xD1, 0x00D1 to 0xA5, 0x00D2 to 0xE3, 0x00D3 to 0xE0,
        0x00D4 to 0xE2, 0x00D5 to 0xE5, 0x00D6 to 0x99, 0x00D7 to 0x9E,
        0x00D8 to 0x9D, 0x00D9 to 0xEB, 0x00DA to 0xE9, 0x00DB to 0xEA,
        0x00DC to 0x9A, 0x00DD to 0xED, 0x00DE to 0xE8, 0x00DF to 0xE1,
        0x00E0 to 0x85, 0x00E1 to 0xA0, 0x00E2 to 0x83, 0x00E3 to 0xC6,
        0x00E4 to 0x84, 0x00E5 to 0x86, 0x00E6 to 0x91, 0x00E7 to 0x87,
        0x00E8 to 0x8A, 0x00E9 to 0x82, 0x00EA to 0x88, 0x00EB to 0x89,
        0x00EC to 0x8D, 0x00ED to 0xA1, 0x00EE to 0x8C, 0x00EF to 0x8B,
        0x00F0 to 0xD0, 0x00F1 to 0xA4, 0x00F2 to 0x95, 0x00F3 to 0xA2,
        0x00F4 to 0x93, 0x00F5 to 0xE4, 0x00F6 to 0x94, 0x00F7 to 0xF6,
        0x00F8 to 0x9B, 0x00F9 to 0x97, 0x00FA to 0xA3, 0x00FB to 0x96,
        0x00FC to 0x81, 0x00FD to 0xEC, 0x00FE to 0xE7, 0x00FF to 0x98,
        0x20AC to 0xD5, 0x00A3 to 0x9C, 0x00B0 to 0xF8,
    )

    /** Normalize symbols / mojibake / fancy dashes before CP850 encoding. */
    fun normalizeForPrint(text: String): String {
        val normalized = Normalizer.normalize(
            TextEncoding.normalizeDashes(TextEncoding.repairCatalogText(text)),
            Normalizer.Form.NFC
        )
            .replace('\uFFFD', ' ')
            .replace('\u2019', '\'')
            .replace('\u2018', '\'')
            .replace('\u02BC', '\'')
            .replace('\u201C', '"')
            .replace('\u201D', '"')
            .replace("\u2026", "...")
            .replace('\u00A0', ' ')
            .replace(Regex("[\u00B7\u2022\u2219\u22C5\u30FB]"), "|")
        return foldLatinForThermalFirmware(normalized)
    }

    /** Strip accents so GBK-default firmware cannot misread CP850 high bytes as Chinese glyphs. */
    private fun foldLatinForThermalFirmware(text: String): String = buildString(text.length) {
        for (ch in text) {
            val code = ch.code
            when {
                code <= 0x7F -> append(ch)
                else -> append(foldCharToAscii(ch) ?: '?')
            }
        }
    }

    private fun foldCharToAscii(ch: Char): Char? {
        val decomposed = Normalizer.normalize(ch.toString(), Normalizer.Form.NFD)
        for (c in decomposed) {
            val cp = c.code
            if (cp in 0x20..0x7E) return c
        }
        return null
    }

    /** Single-byte CP850 body bytes — pair with ESC t 2 in the print header (WebPOS / Print Agent). */
    fun encode(text: String): ByteArray {
        val normalized = normalizeForPrint(text)
        val out = ArrayList<Byte>(normalized.length)
        for (ch in normalized) {
            val code = ch.code
            when {
                code <= 0x7F -> out.add(code.toByte())
                else -> {
                    val mapped = UNICODE_TO_CP850[code]
                    if (mapped != null) {
                        out.add(mapped.toByte())
                    } else {
                        out.add(transliterateToCp850(ch))
                    }
                }
            }
        }
        return out.toByteArray()
    }

    private fun transliterateToCp850(ch: Char): Byte {
        val decomposed = Normalizer.normalize(ch.toString(), Normalizer.Form.NFD)
        for (c in decomposed) {
            val cp = c.code
            if (cp in 0x20..0x7E) return cp.toByte()
        }
        return 0x3F
    }

    fun decodeForLog(payload: ByteArray): String =
        runCatching { String(payload, Charsets.ISO_8859_1) }.getOrElse { payload.decodeToString() }
}

