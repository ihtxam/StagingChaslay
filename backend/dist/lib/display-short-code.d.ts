import { getDb } from "@/db";
type Db = ReturnType<typeof getDb>;
/** Allocate a numeric short code (5–6 digits), unique across TV/KDS/ODS displays. */
export declare function allocateDisplayShortCode(db: Db): Promise<string>;
export declare function ensureKdsStationShortCodes(db: Db, merchantId: string): Promise<void>;
export declare function ensureOdsDisplayShortCodes(db: Db, merchantId: string): Promise<void>;
export {};
//# sourceMappingURL=display-short-code.d.ts.map