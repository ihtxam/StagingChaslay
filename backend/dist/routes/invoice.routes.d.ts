import { Request, Response } from "express";
import { isInvoicePaymentMethod } from "@/services/invoice.service";
declare const router: import("express-serve-static-core").Router;
/** GET /api/merchant/invoices */
export declare function merchantListInvoices(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/** POST /api/merchant/orders/:orderId/email-invoice */
export declare function merchantEmailInvoice(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/** GET /api/merchant/orders/:orderId/invoice.pdf */
export declare function merchantInvoicePdf(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
/** POST /api/merchant/orders/:orderId/record-invoice-payment */
export declare function merchantRecordInvoicePayment(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
export default router;
/** Reborn Android routes mounted at /v1/invoices */
export declare function chaslayInvoiceRouter(): import("express-serve-static-core").Router;
export { isInvoicePaymentMethod };
//# sourceMappingURL=invoice.routes.d.ts.map