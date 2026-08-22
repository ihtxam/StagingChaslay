"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Local check: Swiss QR matrix exists and the A4 invoice PDF paints it
 * as vectors (not a blank PDFKit PNG embed).
 */
const zlib_1 = __importDefault(require("zlib"));
const swiss_qr_bill_1 = require("../lib/swiss-qr-bill");
const invoice_service_1 = require("../services/invoice.service");
function pdfPageContent(buf) {
    const raw = buf.toString("latin1");
    const parts = [];
    for (const m of raw.matchAll(/\/Length (\d+)\s*\/Filter \/FlateDecode\s*>>\s*stream\r?\n/g)) {
        const start = buf.indexOf(Buffer.from("stream"), m.index ?? 0);
        if (start < 0)
            continue;
        let dataStart = start + "stream".length;
        if (buf[dataStart] === 0x0d)
            dataStart += 1;
        if (buf[dataStart] === 0x0a)
            dataStart += 1;
        try {
            parts.push(zlib_1.default.inflateSync(buf.subarray(dataStart, dataStart + Number(m[1]))).toString("latin1"));
        }
        catch {
            /* skip non-content streams */
        }
    }
    return parts.join("\n");
}
function pdfShownText(content) {
    return [...content.matchAll(/<([0-9a-fA-F]+)>/g)]
        .map((m) => Buffer.from(m[1], "hex").toString("latin1"))
        .join("");
}
const labels = {
    invoice: "INVOICE",
    invoiceNo: "Invoice no.",
    date: "Date",
    due: "Due date",
    order: "Order",
    billTo: "Bill to",
    description: "Description",
    qty: "Qty",
    unit: "Unit",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    tip: "Tip",
    vat: "VAT",
    total: "Total",
    bank: "Bank details",
    iban: "IBAN",
    qrIban: "QR-IBAN",
    accountHolder: "Account holder",
    bankName: "Bank",
    vatNo: "VAT",
    phone: "Phone",
    email: "Email",
    awaiting: "Awaiting payment",
    paid: "Paid",
    receipt: "Receipt",
    payment: "Payment part",
    currency: "Currency",
    account: "Account / Payable to",
    reference: "Reference",
    additional: "Additional information",
    payableBy: "Payable by",
    payableTo: "Payable to",
    acceptance: "Acceptance point",
    qrMissingIban: "Swiss QR-bill unavailable. Add an IBAN in Settings → Bank details.",
    qrFailed: "Swiss QR-bill could not be generated.",
};
const IBAN = "CH9300762011623852957";
function sampleInput(partial = {}) {
    return {
        labels,
        lang: "en",
        merchant: {
            name: "Test Restaurant",
            address: "Bahnhofstrasse 1",
            city: "8001 Zurich",
            country: "CH",
            bankIban: IBAN,
            bankAccountHolder: "Test Restaurant GmbH",
        },
        customer: { name: "Ada Lovelace", address: "Rue du Rhone 2, Geneva" },
        invoiceNumber: "INV-2026-00001",
        orderNumber: "POS-1001",
        issued: new Date("2026-08-19T10:00:00Z"),
        due: new Date("2026-09-18T10:00:00Z"),
        items: [{ name: "Lunch menu", qty: 2, unit: 18, total: 36 }],
        subtotal: 36,
        tax: 2.77,
        discount: 0,
        tip: 0,
        total: 38.77,
        paid: false,
        qrPayload: "",
        qrMissingReason: "",
        qrr: "",
        payIban: IBAN,
        ...partial,
    };
}
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
async function main() {
    const payload = (0, swiss_qr_bill_1.buildSwissQrPayload)({
        iban: IBAN,
        amount: 38.77,
        currency: "CHF",
        creditor: (0, swiss_qr_bill_1.parseAddressFromMerchant)({
            name: "Test Restaurant GmbH",
            address: "Bahnhofstrasse 1",
            city: "8001 Zurich",
            country: "CH",
        }),
        referenceType: "NON",
        unstructuredMessage: "INV-2026-00001",
    });
    const matrix = (0, swiss_qr_bill_1.swissQrModuleRuns)(payload);
    console.log("QR modules", matrix.moduleCount, "runs", matrix.runs.length);
    assert(matrix.moduleCount >= 21, "QR matrix too small");
    assert(matrix.runs.length >= 40, "QR has too few dark runs");
    const withQr = await (0, invoice_service_1.renderInvoicePdf)(sampleInput({ qrPayload: payload }));
    const content = pdfPageContent(withQr);
    const shown = pdfShownText(content);
    assert(withQr.subarray(0, 4).toString() === "%PDF", "PDF header missing");
    assert(withQr.length > 4000, `PDF too small (${withQr.length})`);
    assert(shown.includes(IBAN), `IBAN missing from PDF text (${shown.slice(0, 180)})`);
    assert(shown.includes("Payment part"), "QR-bill payment part missing");
    assert(shown.includes("INV-2026-00001"), "invoice number missing");
    assert(!/\/Subtype \/Image/.test(withQr.toString("latin1")), "PDF still embeds a raster image for the QR");
    const rects = (content.match(/ re\b/g) || []).length;
    assert(rects >= 200, `too few vector rects for a QR (${rects})`);
    assert(content.includes("19.8 19.8 re"), "Swiss cross overlay missing");
    console.log("invoice with QR: bytes", withQr.length, "pages", (withQr.toString("latin1").match(/\/Type \/Page\b/g) || []).length, "rects", rects);
    const missing = await (0, invoice_service_1.renderInvoicePdf)(sampleInput({
        qrPayload: "",
        qrMissingReason: "missing_iban",
        payIban: "",
        merchant: { name: "Test Restaurant" },
    }));
    const missingText = pdfShownText(pdfPageContent(missing));
    assert(missingText.includes("Swiss QR-bill unavailable") || missingText.includes("Add an IBAN"), `fallback message missing when IBAN is empty (${missingText.slice(0, 180)})`);
    console.log("invoice without IBAN: fallback present, bytes", missing.length);
    console.log("OK");
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=verify-invoice-qr.js.map