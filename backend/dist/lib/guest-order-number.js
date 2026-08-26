"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderMetaFromNotes = parseOrderMetaFromNotes;
exports.guestOrderNumber = guestOrderNumber;
exports.isGuestFacingOdsNumber = isGuestFacingOdsNumber;
exports.resolveOdsPushNumber = resolveOdsPushNumber;
const OPAQUE_ORDER_RE = /^(WP|DI|POS)-/i;
const HEX_FRAGMENT_RE = /^[a-f0-9]{6,12}$/i;
const WEBPOS_CLIENT_RE = /^webpos-/i;
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;
/** Normalize kitchen / tab shout to #1234 form. */
function normalizeShout(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return "";
    return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#/, "")}`;
}
function parseOrderMetaFromNotes(notes) {
    const text = String(notes || "");
    let ticketDisplay = text.match(TICKET_NOTE_RE)?.[1]?.trim();
    if (ticketDisplay && !ticketDisplay.startsWith("#")) {
        ticketDisplay = `#${ticketDisplay.replace(/^#/, "")}`;
    }
    const tabNumber = text.match(TAB_NOTE_RE)?.[1]?.trim();
    return { ticketDisplay: ticketDisplay || undefined, tabNumber: tabNumber || undefined };
}
/**
 * Guest-facing primary order reference.
 * Prefers kitchen shout / tab number over opaque WP-/DI- backend ids.
 */
function guestOrderNumber(opts) {
    const shout = String(opts.orderDisplay || "").trim();
    if (shout && !OPAQUE_ORDER_RE.test(shout)) {
        return normalizeShout(shout);
    }
    const tab = String(opts.tabNumber || "")
        .trim()
        .replace(/^#/, "");
    if (tab)
        return `#${tab}`;
    const raw = String(opts.orderNumber || "").trim();
    if (!raw || OPAQUE_ORDER_RE.test(raw))
        return "";
    return raw;
}
/** True when a value is safe to show on the customer pickup board (ODS). */
function isGuestFacingOdsNumber(value) {
    const n = String(value || "").trim();
    if (!n)
        return false;
    if (OPAQUE_ORDER_RE.test(n))
        return false;
    if (WEBPOS_CLIENT_RE.test(n))
        return false;
    if (HEX_FRAGMENT_RE.test(n))
        return false;
    const bare = n.replace(/^#/, "");
    if (/^\d{1,6}$/.test(bare))
        return true;
    if (/^#\d{1,6}$/.test(n))
        return true;
    if (/^D-\d{1,4}$/i.test(n))
        return true;
    if (/^WEB-/i.test(n))
        return true;
    if (/^TX-/i.test(n))
        return true;
    if (/^ORD-/i.test(n))
        return true;
    return false;
}
/** Normalize a kitchen ticket key for ODS push; returns empty when not guest-facing. */
function resolveOdsPushNumber(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed)
        return "";
    const base = trimmed.split("@")[0]?.trim() || "";
    if (!base || !isGuestFacingOdsNumber(base))
        return "";
    const bare = base.replace(/^#/, "");
    if (/^\d{1,6}$/.test(bare))
        return `#${bare}`;
    return base;
}
//# sourceMappingURL=guest-order-number.js.map