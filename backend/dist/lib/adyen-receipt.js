"use strict";
/** Parse Adyen Terminal API PaymentReceipt OutputText into plain thermal lines. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaymentReceipts = parsePaymentReceipts;
exports.adyenReceiptToPlainText = adyenReceiptToPlainText;
exports.appendAdyenReceiptBlock = appendAdyenReceiptBlock;
exports.parseAdyenReceiptJson = parseAdyenReceiptJson;
function urlDecode(value) {
    try {
        return decodeURIComponent(String(value).replace(/\+/g, " "));
    }
    catch {
        return value;
    }
}
function leftRight(left, right, width) {
    const leftText = left.slice(0, width - right.length - 1);
    const padding = Math.max(1, width - leftText.length - right.length);
    return leftText + " ".repeat(padding) + right;
}
function renderLine(rawText, width) {
    const decoded = urlDecode(rawText);
    if (!decoded.includes("="))
        return decoded;
    const params = new URLSearchParams();
    for (const part of decoded.split("&")) {
        const [k, ...rest] = part.split("=");
        if (k)
            params.set(k.trim(), urlDecode(rest.join("=").trim()));
    }
    const key = (params.get("key") || "").toLowerCase();
    const name = params.get("name") || "";
    const value = params.get("value") || "";
    switch (key) {
        case "filler":
        case "signature":
            return "";
        case "sigline":
        case "merchantsigline":
            return "_".repeat(Math.min(28, width));
        case "header1":
        case "header2":
        case "thanks":
        case "approved":
        case "refused":
        case "void":
        case "cardholderheader":
            return value || name;
        default:
            if (name && value)
                return leftRight(name, value, width);
            return name || value || "";
    }
}
function parseOutputText(outputText) {
    const lines = [];
    for (const obj of outputText) {
        const rawText = String(obj.Text || "");
        const bold = String(obj.CharacterStyle || "").toLowerCase() === "bold";
        const alignment = String(obj.Alignment || "");
        const centered = /cent(er|re)/i.test(alignment) || alignment.toLowerCase() === "right";
        const endOfLine = obj.EndOfLineFlag !== false;
        lines.push({
            text: renderLine(rawText, 32),
            bold,
            centered,
            endOfLine,
        });
    }
    return lines;
}
function parsePaymentReceipts(paymentResponse) {
    const receipts = paymentResponse.PaymentReceipt;
    if (!Array.isArray(receipts))
        return { customer: null, cashier: null };
    let customer = null;
    let cashier = null;
    for (const element of receipts) {
        const receipt = element;
        const qualifier = String(receipt.DocumentQualifier || "");
        const outputContent = receipt.OutputContent;
        const outputText = outputContent?.OutputText;
        if (!Array.isArray(outputText))
            continue;
        const parsed = {
            documentQualifier: qualifier,
            lines: parseOutputText(outputText),
        };
        if (/customerreceipt/i.test(qualifier))
            customer = parsed;
        else if (/cashierreceipt/i.test(qualifier))
            cashier = parsed;
    }
    return { customer, cashier };
}
function center(text, width) {
    if (text.length >= width)
        return text;
    const pad = Math.floor((width - text.length) / 2);
    return " ".repeat(Math.max(0, pad)) + text;
}
function adyenReceiptToPlainText(receipt, lineWidth = 32) {
    let out = "";
    let pending = "";
    for (const line of receipt.lines) {
        let segment = line.text;
        if (line.centered)
            segment = center(segment, lineWidth);
        else if (line.bold)
            segment = segment.toUpperCase();
        if (line.endOfLine !== false) {
            out += pending + segment + "\n";
            pending = "";
        }
        else {
            pending += segment;
        }
    }
    if (pending)
        out += pending + "\n";
    return out + "\n";
}
function appendAdyenReceiptBlock(receiptText, receipt, lineWidth = 32) {
    if (!receipt?.lines?.length)
        return receiptText;
    const thin = "-".repeat(Math.min(lineWidth, 32));
    return (receiptText +
        thin +
        "\n" +
        adyenReceiptToPlainText(receipt, lineWidth));
}
function parseAdyenReceiptJson(json) {
    if (!json?.trim())
        return null;
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed?.lines) && parsed.lines.length ? parsed : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=adyen-receipt.js.map