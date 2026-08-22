"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateDDMMYYYY = formatDateDDMMYYYY;
exports.formatTimeHHMM = formatTimeHHMM;
exports.formatDateTimeDDMMYYYY = formatDateTimeDDMMYYYY;
const geo_1 = require("@/lib/geo");
function toDate(input) {
    if (input == null || input === "")
        return null;
    const d = input instanceof Date ? input : new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
}
/** User-facing calendar date: DD-MM-YYYY (Europe/Zurich) */
function formatDateDDMMYYYY(input) {
    const d = toDate(input);
    if (!d)
        return "";
    const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: geo_1.MERCHANT_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d);
    const [y, m, day] = ymd.split("-");
    return `${day}-${m}-${y}`;
}
/** User-facing time: HH:mm (24h, Europe/Zurich) */
function formatTimeHHMM(input) {
    const d = toDate(input);
    if (!d)
        return "";
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: geo_1.MERCHANT_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}
/** User-facing date + time: DD-MM-YYYY HH:mm */
function formatDateTimeDDMMYYYY(input) {
    const datePart = formatDateDDMMYYYY(input);
    if (!datePart)
        return "";
    const timePart = formatTimeHHMM(input);
    return timePart ? `${datePart} ${timePart}` : datePart;
}
//# sourceMappingURL=date-format.js.map