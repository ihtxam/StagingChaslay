import { Request, Response, NextFunction } from "express";
import { JWTPayload } from "@/services/auth.service";
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
            merchantId?: string;
        }
    }
}
/**
 * Middleware to verify JWT token
 */
export declare function verifyToken(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Middleware to check if user is superadmin
 */
export declare function requireSuperadmin(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Middleware to check if user is a reseller (agency)
 */
export declare function requireReseller(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Merchant owner only (not staff)
 */
export declare function requireMerchantOwner(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Merchant owner or staff with POS / waiter / catalog / panel entry permissions.
 * Route-level requirePermission still gates writes (settings, billing, inventory, catalog).
 */
export declare function requireMerchantPanel(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
/** @deprecated use requireMerchantPanel */
export declare function requireMerchant(req: Request, res: Response, next: NextFunction): void | Response<any, Record<string, any>>;
/**
 * Merchant owner or staff (any authenticated merchant context)
 */
export declare function requireMerchantAccess(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Middleware to verify merchant access to their own data
 */
export declare function verifyMerchantAccess(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Middleware to set merchant context
 */
export declare function setMerchantContext(req: Request, res: Response, next: NextFunction): void;
export declare function requirePermission(...required: string[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=auth.middleware.d.ts.map