/**
 * Location autocomplete helpers — run: cd backend && npx tsx src/lib/location-service.test.ts
 */
import assert from "node:assert/strict";
import {
  composeDisplayAddress,
  filterAndDedupeSuggestions,
  nominatimHitToSuggestion,
  normalizeCountryCode,
  photonFeatureToSuggestion,
} from "./location-service";

assert.equal(normalizeCountryCode("ch"), "CH");
assert.equal(normalizeCountryCode("Switzerland"), "CH");
assert.equal(normalizeCountryCode("Suisse"), "CH");
assert.equal(normalizeCountryCode("France"), "FR");
assert.equal(normalizeCountryCode(""), undefined);

assert.equal(
  composeDisplayAddress({
    houseNumber: "12",
    street: "Rue de Lausanne",
    postcode: "1800",
    city: "Vevey",
    country: "Switzerland",
  }),
  "12 Rue de Lausanne, 1800 Vevey, Switzerland"
);

const photon = photonFeatureToSuggestion({
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
assert.ok(photon);
assert.equal(photon!.latitude, 46.4621);
assert.equal(photon!.longitude, 6.8427);
assert.equal(photon!.houseNumber, "12");
assert.equal(photon!.postcode, "1800");
assert.equal(photon!.countryCode, "CH");
assert.match(photon!.displayAddress, /Rue de Lausanne/);

const nomi = nominatimHitToSuggestion({
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
assert.ok(nomi);
assert.equal(nomi!.city, "Genève");
assert.equal(nomi!.street, "Rue du Rhône");

const mixed = filterAndDedupeSuggestions(
  [
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
  ],
  "CH"
);
assert.equal(mixed.length, 1);
assert.equal(mixed[0].id, "2");

console.log("location-service.test.ts: ok");
