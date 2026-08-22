/** Detect Postgres "undefined column/relation" errors from Drizzle/pg. */
export declare function isMissingSchemaError(raw: string): boolean;
/** Extract snake_case column name from a Postgres missing-column error, if present. */
export declare function missingColumnFromError(raw: string): string | null;
/**
 * Map a raw DB error to a user-facing migration hint when we recognize the missing object.
 */
export declare function formatDbMigrateError(raw: string, fallback?: string): string;
export declare function migrateLogTag(raw: string): string | null;
//# sourceMappingURL=db-schema-errors.d.ts.map