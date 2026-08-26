import { Request, Response, NextFunction } from "express";
import { type BusinessModule } from "@/lib/business-module";
export declare function getMerchantBusinessModule(merchantId: string): Promise<BusinessModule | null>;
/** null module = legacy merchant — allow all vertical features. */
export declare function requireBusinessModule(...modules: BusinessModule[]): (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const requireRestaurantModule: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export declare const requireRetailModule: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
//# sourceMappingURL=business-module.middleware.d.ts.map