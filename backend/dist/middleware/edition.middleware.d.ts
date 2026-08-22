import { Request, Response, NextFunction } from "express";
import type { EditionFeatureKey } from "@/lib/edition-features";
/**
 * Require merchant edition to include a feature. Null edition = legacy full access.
 */
export declare function requireEditionFeature(...features: EditionFeatureKey[]): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=edition.middleware.d.ts.map