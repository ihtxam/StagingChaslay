"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suggestSwissPostal = suggestSwissPostal;
exports.cityForSwissPostal = cityForSwissPostal;
const fs_1 = require("fs");
const path_1 = require("path");
let cache = null;
function loadPlz() {
    if (cache)
        return cache;
    const path = (0, path_1.join)(__dirname, "swiss-plz.json");
    cache = JSON.parse((0, fs_1.readFileSync)(path, "utf8"));
    return cache;
}
/**
 * Suggest Swiss PLZ codes (and city names) for autocomplete.
 * `q` may be a partial or full 4-digit postal code.
 */
function suggestSwissPostal(q, limit = 12) {
    const digits = String(q || "").replace(/\D/g, "").slice(0, 4);
    if (digits.length < 2)
        return [];
    const map = loadPlz();
    const out = [];
    for (const zip of Object.keys(map)) {
        if (!zip.startsWith(digits))
            continue;
        const cities = map[zip] || [];
        out.push({
            zip,
            city: cities[0] || "",
            cities,
        });
        if (out.length >= limit)
            break;
    }
    return out;
}
function cityForSwissPostal(zip) {
    const digits = String(zip || "").replace(/\D/g, "");
    if (digits.length !== 4)
        return null;
    const cities = loadPlz()[digits];
    return cities?.[0] || null;
}
//# sourceMappingURL=swiss-postal.js.map