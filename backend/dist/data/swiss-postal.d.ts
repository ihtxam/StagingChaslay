export type PostalSuggestion = {
    zip: string;
    city: string;
    cities: string[];
};
/**
 * Suggest Swiss PLZ codes (and city names) for autocomplete.
 * `q` may be a partial or full 4-digit postal code.
 */
export declare function suggestSwissPostal(q: string, limit?: number): PostalSuggestion[];
export declare function cityForSwissPostal(zip: string): string | null;
//# sourceMappingURL=swiss-postal.d.ts.map