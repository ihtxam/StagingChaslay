import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSrc = fs.readFileSync(path.join(here, "../server.js"), "utf8");
const start = serverSrc.indexOf("function isShellDump");
const end = serverSrc.indexOf("async function runPowerShell");
assert.ok(start >= 0 && end > start, "sanitize helpers must exist in server.js");
const { sanitizePrintAgentError } = new Function(
  `${serverSrc.slice(start, end)}; return { isShellDump, extractUsefulPrintLine, sanitizePrintAgentError };`
)();

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

test("Niimbot WritePrinter Win32 is kept instead of Print failed for name", () => {
  const dump = [
    "Command failed: powershell.exe -NoProfile -File C:\\Users\\x\\win-niimbot-print.ps1",
    "win-niimbot-print.ps1 : WritePrinter failed for 'NIIMBOT K3' (Win32=5).",
    "At C:\\Users\\x\\win-niimbot-print.ps1:95 char:9",
    "+         throw \"WritePrinter failed for 'NIIMBOT K3' (Win32=5).\"",
    "    + CategoryInfo          : OperationStopped",
    "    + FullyQualifiedErrorId : WritePrinter failed for 'NIIMBOT K3' (Win32=5).",
  ].join("\n");
  const out = sanitizePrintAgentError({ message: dump }, "NIIMBOT K3");
  assert.equal(out, "WritePrinter failed for 'NIIMBOT K3' (Win32=5)");
});

test("missing win-niimbot-print.ps1 is kept", () => {
  const out = sanitizePrintAgentError(
    { message: "win-niimbot-print.ps1 not found at C:\\Users\\x\\AppData\\Local\\RebornPrintAgent\\win-niimbot-print.ps1" },
    "NIIMBOT K3"
  );
  assert.match(out, /win-niimbot-print\.ps1 not found/);
});

test("Niimbot COM access denied is kept", () => {
  const out = sanitizePrintAgentError(
    { message: "Niimbot COM3 is in use or access denied (close NIIMBOT.exe)" },
    "NIIMBOT K3"
  );
  assert.match(out, /COM3 is in use or access denied/);
});
