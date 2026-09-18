/** Flatten DrizzleQueryError / pg error chains into one searchable string. */
export declare function dbErrorChain(error: unknown): string;
/** Detect Postgres "undefined column/relation" errors from Drizzle/pg. */
export declare function isMissingSchemaError(raw: string): boolean;
export declare function isMissingSchemaErrorFrom(error: unknown): boolean;
/** Extract snake_case column name from a Postgres missing-column error, if present. */
export declare function missingColumnFromError(raw: string): string | null;
export declare function missingColumnFromDbError(error: unknown): string | null;
/** Extract table name from Postgres missing-column / missing-relation errors. */
export declare function missingTableFromError(raw: string): string | null;
export declare function missingTableColumnFromDbError(error: unknown): {
    table: string | null;
    column: string | null;
};
/** Detect missing multi-location tables (locations, HQ catalog, per-location stock, etc.). */
export declare function isLocationsSchemaError(raw: string): boolean;
/**
 * Map a raw DB error to a user-facing migration hint when we recognize the missing object.
 */
export declare function formatDbMigrateError(raw: string, fallback?: string): string;
export declare function migrateLogTag(raw: string): string | null;
//# sourceMappingURL=db-schema-errors.d.ts.map