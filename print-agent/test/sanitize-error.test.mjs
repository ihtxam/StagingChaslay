import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function sanitizePrintAgentError(error, printerName, fallback) {
  const safeFallback = fallback || "Print failed";
  try {
    const raw = [error && error.stderr, error && error.message, error && error.stdout]
      .filter(Boolean)
      .join("\n");
    const win32 =
      raw.match(/OpenPrinter failed for '([^']+)' \(Win32=(\d+)\)/i) ||
      raw.match(/StartDocPrinter failed for '([^']+)' \(Win32=(\d+)\)/i) ||
      raw.match(/StartPagePrinter failed for '([^']+)' \(Win32=(\d+)\)/i) ||
      raw.match(/WritePrinter failed for '([^']+)' \(Win32=(\d+)\)/i);
    const named = raw.match(/Printer '([^']+)' not found/i);
    const gl = /\bGLPrinter\b/i.test(raw) ? "GLPrinter" : "";
    const name = (win32 && win32[1]) || (named && named[1]) || printerName || gl || "";
    const code = win32
      ? Number(win32[2])
      : Number((raw.match(/Win32\s*[=:]?\s*(\d+)/i) || [])[1] || 0);
    if (code === 1801 || code === 1905 || code === 1906) {
      return name
        ? `Printer '${name}' not found or disconnected`
        : "Printer not found or disconnected";
    }
    if (name) return `Print failed for '${name}'`;
    return safeFallback;
  } catch {
    const label = printerName ? String(printerName).trim() : "";
    return label ? `Print failed for '${label}'` : safeFallback;
  }
}

test("Win32 1801 maps to not found or disconnected", () => {
  const out = sanitizePrintAgentError(
    { message: "OpenPrinter failed for 'GLPrinter' (Win32=1801)" },
    "GLPrinter"
  );
  assert.equal(out, "Printer 'GLPrinter' not found or disconnected");
});

test("Win32 1905 maps to not found or disconnected", () => {
  const out = sanitizePrintAgentError(
    { message: "StartDocPrinter failed for 'cuisine' (Win32=1905)" },
    "cuisine"
  );
  assert.equal(out, "Printer 'cuisine' not found or disconnected");
});

test("sanitizePrintAgentError never throws on unexpected error shapes", () => {
  const throwing = {
    get message() {
      throw new Error("getter boom");
    },
    get stderr() {
      throw new Error("stderr boom");
    },
  };
  const out = sanitizePrintAgentError(throwing, "USB Receipt");
  assert.equal(out, "Print failed for 'USB Receipt'");
});
