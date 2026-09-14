import { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            locationId?: string;
        }
    }
}
/**
 * Reads X-Location-Id header, validates staff access, sets req.locationId.
 * Unknown or stale headers fall back to the merchant default location
 * so Settings / catalog keep working for single-shop merchants.
 */
export declare function setLocationContext(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=location.middleware.d.ts.map