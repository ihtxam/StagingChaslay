export declare function ensureLicensesSchema(): Promise<boolean>;
export declare function ensureLicensesSchemaAtStartup(): void;
/** Retry a licenses query after applying missing-column/table patches. */
export declare function withLicenseSchemaRetry<T>(fn: () => Promise<T>): Promise<T>;
//# sourceMappingURL=ensure-licenses-schema.d.ts.map