"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNosModifierGroup = isNosModifierGroup;
exports.ensureNosTicketName = ensureNosTicketName;
exports.modifierOptionTicketName = modifierOptionTicketName;
/** Modifier groups that represent removals / exclusions (Oracle Simphony-style "No's"). */
function isNosModifierGroup(title) {
    const key = title.trim().toLowerCase().replace(/['']/g, "'");
    return key === "no's" || key === "nos" || key === "no" || key === "removals";
}
/** Ticket / kitchen label: ensure exclusion modifiers read as "No …". */
function ensureNosTicketName(name) {
    const trimmed = (name || "").trim();
    if (!trimmed)
        return trimmed;
    if (/^no[\s\-.]/i.test(trimmed) || /^no$/i.test(trimmed))
        return trimmed;
    return `No ${trimmed}`;
}
function modifierOptionTicketName(name, groupTitle) {
    return isNosModifierGroup(groupTitle) ? ensureNosTicketName(name) : name;
}
//# sourceMappingURL=modifier-nos.js.map