import { Router, Request, Response } from "express";
import { InvoiceService, isInvoicePaymentMethod } from "@/services/invoice.service";

const router = Router();

function sendPdf(res: Response, pdf: { buffer: Buffer; filename: string }) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${pdf.filename}"`);
  res.setHeader("Content-Length", String(pdf.buffer.length));
  res.send(pdf.buffer);
}

/** GET /api/merchant/orders/:orderId/invoice.pdf */
export async function merchantInvoicePdf(req: Request, res: Response) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const pdf = await InvoiceService.renderPdf(merchantId, String(req.params.orderId));
    sendPdf(res, pdf);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate invoice";
    const code = msg === "Order not found" ? 404 : 400;
    res.status(code).json({ error: msg });
  }
}

/** POST /api/merchant/orders/:orderId/record-invoice-payment */
export async function merchantRecordInvoicePayment(req: Request, res: Response) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const order = await InvoiceService.recordPayment(
      merchantId,
      String(req.params.orderId),
      String(req.body?.paymentMethod || "cash")
    );
    res.json({ success: true, order });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to record invoice payment";
    const code = msg === "Order not found" ? 404 : 400;
    res.status(code).json({ error: msg });
  }
}

export default router;

/** Chaslay Android routes mounted at /v1/invoices */
export function chaslayInvoiceRouter() {
  const r = Router();
  r.get("/:id/pdf", async (req: Request, res: Response) => {
    try {
      const merchantId = req.chaslayMerchantId;
      if (!merchantId) return res.status(401).json({ error: "Unauthorized" });
      const pdf = await InvoiceService.renderPdf(merchantId, String(req.params.id));
      sendPdf(res, pdf);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to generate invoice";
      res.status(msg === "Order not found" ? 404 : 400).json({ error: msg });
    }
  });
  r.post("/:id/record-payment", async (req: Request, res: Response) => {
    try {
      const merchantId = req.chaslayMerchantId;
      if (!merchantId) return res.status(401).json({ error: "Unauthorized" });
      const order = await InvoiceService.recordPayment(
        merchantId,
        String(req.params.id),
        String(req.body?.paymentMethod || "cash")
      );
      res.json({
        success: true,
        order: {
          id: order.id,
          invoiceNumber: order.invoiceNumber,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to record invoice payment";
      res.status(msg === "Order not found" ? 404 : 400).json({ error: msg });
    }
  });
  return r;
}

export { isInvoicePaymentMethod };
