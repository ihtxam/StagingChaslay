import { NextFunction, Request, Response } from "express";
import { schema } from "@/db";
declare global {
    namespace Express {
        interface Request {
            /** Set when Host matches a verified merchant custom domain (routing only). */
            shopMerchantFromHost?: typeof schema.merchants.$inferSelect | null;
        }
    }
}
/**
 * Non-blocking parallel routing helper: attach verified custom-domain merchant when Host matches.
 * Always calls next(); slug/path routing remains the fallback everywhere else.
 */
export declare function shopHostMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=shop-host.middleware.d.ts.map