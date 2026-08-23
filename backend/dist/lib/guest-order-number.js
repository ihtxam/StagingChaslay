"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOrderMetaFromNotes = parseOrderMetaFromNotes;
exports.guestOrderNumber = guestOrderNumber;
const OPAQUE_ORDER_RE = /^(WP|DI)-/i;
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;
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
