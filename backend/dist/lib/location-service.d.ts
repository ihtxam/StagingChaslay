/**
 * Provider-independent address autocomplete / geocoding.
 * Default provider: Photon (komoot). Nominatim search is the fallback.
 * Frontend never calls Photon/Nominatim directly.
 */
export type LocationSuggestion = {
    id: string;
    displayAddress: string;
    addressLine1?: string;
    houseNumber?: string;
    street?: string;
    postcode?: string;
    city?: string;
    country?: string;
    countryCode?: string;
    latitude: number;
    longitude: number;
    provider: "photon" | "nominatim";
    providerId?: string;
};
type PhotonFeature = {
    geometry?: {
        coordinates?: number[];
    };
    properties?: {
        osm_id?: number | string;
        osm_type?: string;
        name?: string;
        street?: string;
        housenumber?: string;
        postcode?: string;
        city?: string;
        district?: string;
        state?: string;
        country?: string;
        countrycode?: string;
    };
};
type NominatimHit = {
    lat?: string;
    lon?: string;
    display_name?: string;
    osm_id?: number;
    osm_type?: string;
    address?: {
        house_number?: string;
        road?: string;
        pedestrian?: string;
        postcode?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        country?: string;
        country_code?: string;
    };
};
export declare function normalizeCountryCode(raw?: string | null): string | undefined;
export declare function composeDisplayAddress(parts: {
    houseNumber?: string;
    street?: string;
    name?: string;
    postcode?: string;
    city?: string;
    country?: string;
}): string;
export declare function photonFeatureToSuggestion(feature: PhotonFeature): LocationSuggestion | null;
export declare function nominatimHitToSuggestion(hit: NominatimHit): LocationSuggestion | null;
export declare function filterAndDedupeSuggestions(items: LocationSuggestion[], countryCode?: string): LocationSuggestion[];
export declare function autocompleteAddress(opts: {
    q: string;
    countryCode?: string;
    lat?: number | null;
    lng?: number | null;
    limit?: number;
    lang?: string;
}): Promise<LocationSuggestion[]>;
export {};
//# sourceMappingURL=location-service.d.ts.map