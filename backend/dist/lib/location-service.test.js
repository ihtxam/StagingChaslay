"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Location autocomplete helpers — run: cd backend && npx tsx src/lib/location-service.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const location_service_1 = require("./location-service");
strict_1.default.equal((0, location_service_1.normalizeCountryCode)("ch"), "CH");
strict_1.default.equal((0, location_service_1.normalizeCountryCode)("Switzerland"), "CH");
strict_1.default.equal((0, location_service_1.normalizeCountryCode)("Suisse"), "CH");
strict_1.default.equal((0, location_service_1.normalizeCountryCode)("France"), "FR");
strict_1.default.equal((0, location_service_1.normalizeCountryCode)(""), undefined);
strict_1.default.equal((0, location_service_1.composeDisplayAddress)({
    houseNumber: "12",
    street: "Rue de Lausanne",
    postcode: "1800",
    city: "Vevey",
    country: "Switzerland",
}), "12 Rue de Lausanne, 1800 Vevey, Switzerland");
const photon = (0, location_service_1.photonFeatureToSuggestion)({
    geometry: { coordinates: [6.8427, 46.4621] },
    properties: {
        osm_id: 99,
        osm_type: "N",
        name: "Rue de Lausanne",
        street: "Rue de Lausanne",
        housenumber: "12",
        postcode: "1800",
        city: "Vevey",
        country: "Switzerland",
        countrycode: "ch",
    },
});
strict_1.default.ok(photon);
strict_1.default.equal(photon.latitude, 46.4621);
strict_1.default.equal(photon.longitude, 6.8427);
strict_1.default.equal(photon.houseNumber, "12");
strict_1.default.equal(photon.postcode, "1800");
strict_1.default.equal(photon.countryCode, "CH");
strict_1.default.match(photon.displayAddress, /Rue de Lausanne/);
const nomi = (0, location_service_1.nominatimHitToSuggestion)({
    lat: "46.2",
    lon: "6.15",
    display_name: "1 Rue du Rhône, Genève",
    osm_id: 1,
    osm_type: "way",
    address: {
        house_number: "1",
        road: "Rue du Rhône",
        postcode: "1204",
        city: "Genève",
        country: "Switzerland",
        country_code: "ch",
    },
});
strict_1.default.ok(nomi);
strict_1.default.equal(nomi.city, "Genève");
strict_1.default.equal(nomi.street, "Rue du Rhône");
const mixed = (0, location_service_1.filterAndDedupeSuggestions)([
    {
        id: "1",
        displayAddress: "A",
        latitude: 46.2,
        longitude: 6.15,
        provider: "photon",
        countryCode: "FR",
    },
    {
        id: "2",
        displayAddress: "B",
        latitude: 46.2,
        longitude: 6.16,
        provider: "photon",
        countryCode: "CH",
    },
    {
        id: "3",
        displayAddress: "B",
        latitude: 46.2,
        longitude: 6.16,
        provider: "nominatim",
        countryCode: "CH",
    },
], "CH");
strict_1.default.equal(mixed.length, 1);
strict_1.default.equal(mixed[0].id, "2");
console.log("location-service.test.ts: ok");
//# sourceMappingURL=location-service.test.js.map