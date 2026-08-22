"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInvoicePaymentMethod = void 0;
exports.merchantListInvoices = merchantListInvoices;
exports.merchantInvoicePdf = merchantInvoicePdf;
exports.merchantRecordInvoicePayment = merchantRecordInvoicePayment;
exports.chaslayInvoiceRouter = chaslayInvoiceRouter;
const express_1 = require("express");
const invoice_service_1 = require("@/services/invoice.service");
Object.defineProperty(exports, "isInvoicePaymentMethod", { enumerable: true, get: function () { return invoice_service_1.isInvoicePaymentMethod; } });
const router = (0, express_1.Router)();
function sendPdf(res, pdf, download = false) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${pdf.filename}"`);
    res.setHeader("Content-Length", String(pdf.buffer.length));
    res.send(pdf.buffer);
}
/** GET /api/merchant/invoices */
async function merchantListInvoices(req, res) {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const invoices = await invoice_service_1.InvoiceService.list(merchantId, {
            status: String(req.query.status || "all"),
            q: String(req.query.q || ""),
            limit: Number(req.query.limit || 200),
        });
        res.json({ success: true, invoices });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to list invoices";
        res.status(400).json({ error: msg });
    }
}
/** GET /api/merchant/orders/:orderId/invoice.pdf */
async function merchantInvoicePdf(req, res) {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const pdf = await invoice_service_1.InvoiceService.renderPdf(merchantId, String(req.params.orderId));
        const download = String(req.query.download || "") === "1";
        sendPdf(res, pdf, download);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to generate invoice";
        const code = msg === "Order not found" ? 404 : 400;
        res.status(code).json({ error: msg });
    }
}
/** POST /api/merchant/orders/:orderId/record-invoice-payment */
async function merchantRecordInvoicePayment(req, res) {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const order = await invoice_service_1.InvoiceService.recordPayment(merchantId, String(req.params.orderId), "invoice");
        res.json({ success: true, order });
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to record invoice payment";
        const code = msg === "Order not found" ? 404 : 400;
        res.status(code).json({ error: msg });
    }
}
exports.default = router;
/** Chaslay Android routes mounted at /v1/invoices */
function chaslayInvoiceRouter() {
    const r = (0, express_1.Router)();
    r.get("/:id/pdf", async (req, res) => {
        try {
            const merchantId = req.chaslayMerchantId;
            if (!merchantId)
                return res.status(401).json({ error: "Unauthorized" });
            const pdf = await invoice_service_1.InvoiceService.renderPdf(merchantId, String(req.params.id));
            sendPdf(res, pdf);
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to generate invoice";
            res.status(msg === "Order not found" ? 404 : 400).json({ error: msg });
        }
    });
    r.post("/:id/record-payment", async (req, res) => {
        try {
            const merchantId = req.chaslayMerchantId;
            if (!merchantId)
                return res.status(401).json({ error: "Unauthorized" });
            const order = await invoice_service_1.InvoiceService.recordPayment(merchantId, String(req.params.id), "invoice");
            res.json({
                success: true,
                order: {
                    id: order.id,
                    invoiceNumber: order.invoiceNumber,
                    paymentMethod: order.paymentMethod,
                    paymentStatus: order.paymentStatus,
                },
            });
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to record invoice payment";
            res.status(msg === "Order not found" ? 404 : 400).json({ error: msg });
        }
    });
    return r;
}
//# sourceMappingURL=invoice.routes.js.map