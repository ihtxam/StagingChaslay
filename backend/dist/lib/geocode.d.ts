/**
 * Nominatim forward geocode (OpenStreetMap).
 * Server-side only — respects OSM usage policy via User-Agent.
 */
export declare function geocodeQuery(query: string): Promise<{
    found: false;
} | {
    found: true;
    lat: number;
    lng: number;
    displayName?: string;
}>;
//# sourceMappingURL=geocode.d.ts.map