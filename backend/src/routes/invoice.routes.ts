import { Router, Request, Response } from "express";
import { InvoiceService, isInvoicePaymentMethod } from "@/services/invoice.service";

const router = Router();

function sendPdf(
  res: Response,
  pdf: { buffer: Buffer; filename: string },
  download = false
) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${pdf.filename}"`
  );
  res.setHeader("Content-Length", String(pdf.buffer.length));
  res.send(pdf.buffer);
}

/** GET /api/merchant/invoices */
export async function merchantListInvoices(req: Request, res: Response) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const invoices = await InvoiceService.list(merchantId, {
      status: String(req.query.status || "all"),
      q: String(req.query.q || ""),
      limit: Number(req.query.limit || 200),
    });
    res.json({ success: true, invoices });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to list invoices";
    res.status(400).json({ error: msg });
  }
}

/** POST /api/merchant/orders/:orderId/email-invoice */
export async function merchantEmailInvoice(req: Request, res: Response) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const to = req.body?.to ? String(req.body.to).trim() : undefined;
    const result = await InvoiceService.sendEmail(merchantId, String(req.params.orderId), { to });
    res.json({ success: true, ...result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to email invoice";
    const code = msg === "Order not found" ? 404 : 400;
    res.status(code).json({ error: msg });
  }
}

/** GET /api/merchant/orders/:orderId/invoice.pdf */
export async function merchantInvoicePdf(req: Request, res: Response) {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });
    const pdf = await InvoiceService.renderPdf(merchantId, String(req.params.orderId));
    const download = String(req.query.download || "") === "1";
    sendPdf(res, pdf, download);
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
      "invoice"
    );
    res.json({ success: true, order });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to record invoice payment";
    const code = msg === "Order not found" ? 404 : 400;
    res.status(code).json({ error: msg });
  }
}

export default router;

/** Reborn Android routes mounted at /v1/invoices */
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
        "invoice"
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
