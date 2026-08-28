import assert from "node:assert/strict";
import test from "node:test";

/** Mirror of Extract-ComPort in win-com-raw-print.ps1 */
function extractComPort(text) {
  if (!text || !String(text).trim()) return "";
  const t = String(text).trim();
  let m = t.match(/\(COM(\d+)\)/i);
  if (m) return `COM${m[1]}`;
  m = t.match(/[·•\u00B7]\s*(COM\d+)\s*:?\s*$/i);
  if (m) return m[1].toUpperCase();
  m = t.match(/(?:^|\\\\\.\\)(COM\d+)\s*:?\s*$/i);
  if (m) return m[1].toUpperCase();
  m = t.match(/\b(COM\d+)\b/i);
  if (m) return m[1].toUpperCase();
  return "";
}

const cases = [
  ["COM4", "COM4"],
  ["COM4:", "COM4"],
  ["com12:", "COM12"],
  ["\\\\.\\COM10", "COM10"],
  ["RPP02 (COM7)", "COM7"],
  ["cuisine · COM4", "COM4"],
  ["cuisines · COM4:", "COM4"],
  ["cuisine · COM3:", "COM3"],
  ["USB001", ""],
  ["Standard TCP/IP Port", ""],
  ["Bluetooth serial · COM5", "COM5"],
];

test("Extract-ComPort handles kitchen printer name patterns", () => {
  for (const [input, expected] of cases) {
    assert.equal(extractComPort(input), expected, `input=${JSON.stringify(input)}`);
  }
});
