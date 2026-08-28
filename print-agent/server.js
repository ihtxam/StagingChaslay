/**
 * Reborn Windows Print Agent
 * Exposes localhost HTTP API for WebPOS silent thermal printing (ESC/POS RAW).
 *
 * CLI:
 *   reborn-print-agent.exe              Run the agent (foreground)
 *   reborn-print-agent.exe --install    Install to LocalAppData + Windows Startup
 *   reborn-print-agent.exe --uninstall  Remove Startup entry (keeps files)
 *   chaslay-print-agent.exe --help
 */
const cors = require("cors");
const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PRINT_AGENT_PORT || 9101);
const VERSION = "1.8.2";
const APP_NAME = "RebornPrintAgent";
const LEGACY_APP_NAME = "ChaslayPrintAgent";
const EXE_NAME = "reborn-print-agent.exe";
const LEGACY_EXE_NAME = "chaslay-print-agent.exe";
const RUN_VALUE_NAME = "RebornPrintAgent";
const LEGACY_RUN_VALUE_NAME = "ChaslayPrintAgent";
const DISPLAY_NAME = "Reborn Print Agent";

const isPkg = typeof process.pkg !== "undefined";

function isWindows() {
  return process.platform === "win32";
}

/**
 * Detach from the console so setup/install doesn't leave a black CMD window open.
 * MessageBox is the user-facing UI; console is only a fallback.
 */
async function hideConsoleForUi() {
  if (!isWindows() || !isPkg) return;
  try {
    const ps = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class ChaslayConsole {
  [DllImport("kernel32.dll")] public static extern bool FreeConsole();
}
"@
[void][ChaslayConsole]::FreeConsole()
`;
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true, timeout: 5000 }
    );
  } catch {
    /* ignore — older Windows / policy may block; MessageBox still works */
  }
}

/** Stop a previously installed agent so we can overwrite its EXE (avoids EBUSY). */
async function stopInstalledAgent() {
  if (!isWindows()) return;
  appendInstallLog("Stopping running agent (if any) before install copy…");
  try {
    await execFileAsync("taskkill", ["/F", "/IM", EXE_NAME, "/T"], {
      windowsHide: true,
      timeout: 15000,
    }).catch(() => {});
    await execFileAsync("taskkill", ["/F", "/IM", LEGACY_EXE_NAME, "/T"], {
      windowsHide: true,
      timeout: 15000,
    }).catch(() => {});
    appendInstallLog("taskkill: stopped running print agent (if any)");
  } catch (e) {
    // Exit code 128 = process not found — fine.
    appendInstallLog(`taskkill: ${e.message || e}`);
  }
  await new Promise((r) => setTimeout(r, 600));
}

function copyFileRetry(src, dest, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (e) {
      lastErr = e;
      const code = e && e.code;
      if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
        // Caller should have stopped the agent; brief wait then retry.
        const start = Date.now();
        while (Date.now() - start < 400) {
          /* spin briefly without async */
        }
        continue;
      }
      throw e;
    }
  }
  const hint =
    `Could not update ${dest}.\n\n` +
    `The Print Agent is still running or locked.\n` +
    `Open Task Manager → end "${EXE_NAME}" or "${LEGACY_EXE_NAME}", then run setup again.\n\n` +
    `(${lastErr && lastErr.message ? lastErr.message : lastErr})`;
  const err = new Error(hint);
  err.code = lastErr && lastErr.code;
  throw err;
}

/** Virtual / GDI PDF drivers that cannot usefully accept ESC/POS RAW bytes. */
function isUnsuitableRawPrinter(name) {
  const n = String(name || "").toLowerCase();
  if (!n.trim()) return false;
  return /onenote|microsoft print to pdf|microsoft xps|send to onenote|\bfax\b|adobe pdf|foxit|nitro pdf|cutepdf|pdfcreator|dopdf|bullzip|print to pdf|microsoft shared fax/.test(
    n
  );
}

function unsuitablePrinterError(name) {
  return (
    `Select a receipt/ESC-POS thermal printer, not OneNote/PDF/XPS ('${name}'). ` +
    `Raw ESC/POS bytes cannot render on virtual PDF drivers.`
  );
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function waitForHealth(attempts = 15, delayMs = 400) {
  for (let i = 0; i < attempts; i++) {
    const health = await checkHealth();
    if (health?.ok) return health;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

function runtimeDir() {
  if (isPkg) return path.dirname(process.execPath);
  return __dirname;
}

function installDir() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(base, APP_NAME);
}

function legacyInstallDir() {
  const base = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(base, LEGACY_APP_NAME);
}

function migrateLegacyInstallIfNeeded(targetDir) {
  const legacy = legacyInstallDir();
  if (path.resolve(legacy) === path.resolve(targetDir)) return;
  if (!fs.existsSync(legacy)) return;
  fs.mkdirSync(targetDir, { recursive: true });
  for (const name of fs.readdirSync(legacy)) {
    const from = path.join(legacy, name);
    const to = path.join(targetDir, name);
    if (fs.existsSync(to)) continue;
    try {
      fs.copyFileSync(from, to);
      appendInstallLog(`Migrated ${name} from legacy ${legacy}`);
    } catch (e) {
      appendInstallLog(`Legacy migrate skip ${name}: ${e.message || e}`);
    }
  }
}

function installLogPath() {
  return path.join(installDir(), "install.log");
}

function appendInstallLog(line) {
  try {
    const dir = installDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(installLogPath(), `[${new Date().toISOString()}] ${line}\n`, "utf8");
  } catch (e) {
    console.warn("[print-agent] install.log write failed:", e.message || e);
  }
}

function assetPath(filename) {
  // Prefer files next to the installed EXE (extracted at --install).
  const besideExe = path.join(runtimeDir(), filename);
  if (fs.existsSync(besideExe)) return besideExe;
  const besideSource = path.join(__dirname, filename);
  if (fs.existsSync(besideSource)) return besideSource;
  return besideExe;
}

function ensurePs1OnDisk() {
  const dest = path.join(runtimeDir(), "win-raw-print.ps1");
  const bundled = path.join(__dirname, "win-raw-print.ps1");
  if (fs.existsSync(bundled)) {
    try {
      fs.copyFileSync(bundled, dest);
    } catch {
      /* keep existing dest if copy fails (locked) */
    }
  }
  return dest;
}

/** Resolve win-scale-read.ps1 (install dir, pkg asset dir, or dev source). */
function ensureScaleScriptOnDisk() {
  const installDest = path.join(installDir(), "win-scale-read.ps1");
  if (fs.existsSync(installDest)) return installDest;

  const candidates = [
    path.join(runtimeDir(), "win-scale-read.ps1"),
    path.join(__dirname, "win-scale-read.ps1"),
  ];
  for (const src of candidates) {
    if (!fs.existsSync(src)) continue;
    try {
      fs.mkdirSync(installDir(), { recursive: true });
      fs.copyFileSync(src, installDest);
      appendInstallLog(`Copied win-scale-read.ps1 to ${installDest}`);
      return installDest;
    } catch {
      return src;
    }
  }
  return installDest;
}

/** Windows COM10+ needs \\.\COM10 prefix; COM1–COM9 use plain COMn. */
function normalizeComPort(port) {
  const raw = String(port || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/^\\\\\.\\/i, "").toUpperCase();
  const m = stripped.match(/^COM(\d+)$/);
  if (!m) return raw;
  const num = parseInt(m[1], 10);
  const com = `COM${num}`;
  return num >= 10 ? `\\\\.\\${com}` : com;
}

/**
 * Show a blocking Windows MessageBox (awaited so process.exit does not kill it).
 * Title/body are passed via UTF-8 temp files to avoid quoting/encoding issues.
 */
async function showMessage(title, body) {
  appendInstallLog(`MessageBox: ${title} — ${String(body).replace(/\s+/g, " ").slice(0, 200)}`);
  if (!isWindows()) {
    console.log(`${title}: ${body}`);
    return;
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reborn-msg-"));
  const titleFile = path.join(tmpDir, "title.txt");
  const bodyFile = path.join(tmpDir, "body.txt");
  try {
    fs.writeFileSync(titleFile, String(title), { encoding: "utf8" });
    fs.writeFileSync(bodyFile, String(body), { encoding: "utf8" });
    const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
$t = [System.IO.File]::ReadAllText('${titleFile.replace(/'/g, "''")}', [System.Text.UTF8Encoding]::new($false))
$b = [System.IO.File]::ReadAllText('${bodyFile.replace(/'/g, "''")}', [System.Text.UTF8Encoding]::new($false))
[void][System.Windows.MessageBox]::Show($b, $t)
`;
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true, timeout: 300000, maxBuffer: 1024 * 1024 }
    );
  } catch (e) {
    console.log(`${title}: ${body}`);
    appendInstallLog(`MessageBox failed: ${e.message || e}`);
  } finally {
    try {
      fs.unlinkSync(titleFile);
      fs.unlinkSync(bodyFile);
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore */
    }
  }
}

async function setStartup(enabled, exePath) {
  if (!isWindows()) return;
  const runKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
  if (enabled) {
    const quoted = `"${exePath}"`;
    await execFileAsync("reg", ["add", runKey, "/v", RUN_VALUE_NAME, "/t", "REG_SZ", "/d", quoted, "/f"], {
      windowsHide: true,
    });
  } else {
    await execFileAsync("reg", ["delete", runKey, "/v", RUN_VALUE_NAME, "/f"], {
      windowsHide: true,
    }).catch(() => {});
    await execFileAsync("reg", ["delete", runKey, "/v", LEGACY_RUN_VALUE_NAME, "/f"], {
      windowsHide: true,
    }).catch(() => {});
  }
}

async function doInstall() {
  if (!isWindows()) {
    throw new Error("Install is only supported on Windows.");
  }
  await hideConsoleForUi();
  appendInstallLog(`Install start (v${VERSION}, pkg=${isPkg})`);
  const dir = installDir();
  fs.mkdirSync(dir, { recursive: true });
  migrateLegacyInstallIfNeeded(dir);

  const targetExe = path.join(dir, EXE_NAME);
  const sourceExe = isPkg ? process.execPath : path.join(__dirname, "dist", EXE_NAME);

  // Always stop a previous install before overwriting — running EXE causes EBUSY.
  if (fs.existsSync(targetExe)) {
    await stopInstalledAgent();
  }

  if (isPkg) {
    if (path.resolve(process.execPath) !== path.resolve(targetExe)) {
      try {
        copyFileRetry(process.execPath, targetExe);
        appendInstallLog(`Copied EXE to ${targetExe}`);
      } catch (e) {
        if (e.code === "EBUSY" || e.code === "EPERM" || e.code === "EACCES") {
          await stopInstalledAgent();
          copyFileRetry(process.execPath, targetExe);
          appendInstallLog(`Copied EXE to ${targetExe} after stop retry`);
        } else {
          throw e;
        }
      }
    } else {
      appendInstallLog(`Already running from install dir ${targetExe}`);
    }
  } else if (fs.existsSync(sourceExe)) {
    copyFileRetry(sourceExe, targetExe);
    appendInstallLog(`Copied built EXE to ${targetExe}`);
  } else {
    // Dev fallback: write a start.cmd that launches node server.js
    const cmd = `@echo off\r\ncd /d "${__dirname}"\r\nnode server.js --run\r\n`;
    fs.writeFileSync(path.join(dir, "start-agent.cmd"), cmd);
    appendInstallLog(`Wrote start-agent.cmd (dev fallback)`);
  }

  const ps1Src = path.join(__dirname, "win-raw-print.ps1");
  const ps1Dest = path.join(dir, "win-raw-print.ps1");
  if (fs.existsSync(ps1Src)) {
    try {
      fs.copyFileSync(ps1Src, ps1Dest);
    } catch {
      copyFileRetry(ps1Src, ps1Dest);
    }
    appendInstallLog(`Copied win-raw-print.ps1`);
  } else {
    appendInstallLog(`WARNING: win-raw-print.ps1 missing at ${ps1Src}`);
  }

  const scalePs1Src = path.join(__dirname, "win-scale-read.ps1");
  const scalePs1Dest = path.join(dir, "win-scale-read.ps1");
  if (fs.existsSync(scalePs1Src)) {
    try {
      fs.copyFileSync(scalePs1Src, scalePs1Dest);
    } catch {
      copyFileRetry(scalePs1Src, scalePs1Dest);
    }
    appendInstallLog(`Copied win-scale-read.ps1`);
  } else {
    appendInstallLog(`WARNING: win-scale-read.ps1 missing at ${scalePs1Src}`);
  }

  const launchPath = fs.existsSync(targetExe) ? targetExe : path.join(dir, "start-agent.cmd");
  await setStartup(true, launchPath);
  appendInstallLog(`Registered Startup: ${launchPath}`);

  // Start agent in background if not already listening
  let running = false;
  const existing = await checkHealth();
  if (existing?.ok) {
    running = true;
    appendInstallLog(`Agent already healthy on port ${PORT}`);
  } else {
    const spawnArgs = launchPath.toLowerCase().endsWith(".exe") ? ["--run"] : [];
    const child = spawn(launchPath, spawnArgs, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      cwd: dir,
    });
    child.unref();
    appendInstallLog(`Spawned agent pid=${child.pid || "?"}`);
    const health = await waitForHealth();
    running = !!health?.ok;
    appendInstallLog(running ? `Agent healthy on port ${PORT}` : `Agent did not become healthy on port ${PORT}`);
  }

  if (running) {
    const msg =
      `Reborn Print Agent installed and running on port ${PORT}.\n\n` +
      `Installed to:\n${dir}\n\n` +
      `It will also start automatically when you log in to Windows.\n\n` +
      `Log: ${installLogPath()}`;
    console.log(msg);
    appendInstallLog("Install success (running)");
    await showMessage("Reborn Print Agent", msg);
    return;
  }

  const warn =
    `Reborn Print Agent files were installed to:\n${dir}\n\n` +
    `Startup registration succeeded, but the agent is not responding on port ${PORT} yet.\n` +
    `Try running:\n${launchPath}\n\n` +
    `Log: ${installLogPath()}`;
  console.warn(warn);
  appendInstallLog("Install finished (not healthy yet)");
  await showMessage("Reborn Print Agent — Warning", warn);
  // Files + Startup are in place; do not throw a second dialog. Exit non-zero from CLI.
  const err = new Error(`Installed but agent is not running on port ${PORT}. See ${installLogPath()}`);
  err.alreadyShown = true;
  throw err;
}

async function doUninstall() {
  await setStartup(false);
  appendInstallLog("Uninstall: removed Startup entry");
  const msg =
    "Removed Windows Startup entry.\n" +
    `Files remain in ${installDir()} — delete that folder manually if desired.`;
  console.log(msg);
  await showMessage("Reborn Print Agent", msg);
}

function printHelp() {
  console.log(`Reborn Print Agent v${VERSION}
Usage:
  --install      Install permanently and register Windows Startup
  --uninstall    Remove Startup registration
  --help         Show this help
  (no flags)     Run the local print HTTP server on port ${PORT}
`);
}

async function runCli() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  if (args.includes("--install")) {
    await hideConsoleForUi();
    try {
      await doInstall();
      process.exit(0);
    } catch (e) {
      console.error(e);
      appendInstallLog(`Install error: ${e.message || e}`);
      if (!e.alreadyShown) {
        await showMessage("Reborn Print Agent — Error", e.message || String(e));
      }
      process.exit(1);
    }
  }
  if (args.includes("--uninstall")) {
    await hideConsoleForUi();
    try {
      await doUninstall();
      process.exit(0);
    } catch (e) {
      console.error(e);
      appendInstallLog(`Uninstall error: ${e.message || e}`);
      await showMessage("Reborn Print Agent — Error", e.message || String(e));
      process.exit(1);
    }
  }

  // When the downloaded setup EXE is double-clicked (pkg build named *-setup*), install then exit.
  const base = path.basename(isPkg ? process.execPath : process.argv[1] || "", ".exe").toLowerCase();
  if (isPkg && base.includes("setup") && !args.includes("--run")) {
    await hideConsoleForUi();
    try {
      await doInstall();
      process.exit(0);
    } catch (e) {
      console.error(e);
      appendInstallLog(`Setup error: ${e.message || e}`);
      if (!e.alreadyShown) {
        await showMessage("Reborn Print Agent — Error", e.message || String(e));
      }
      process.exit(1);
    }
  }
}

function isShellDump(text) {
  return /command failed|powershell\.exe|-noprofile|executionpolicy|win-raw-print|win-scale-read|categoryinfo|fullyqualifiederrorid|reborn-print-|manupos-print-|chaslayprintagent|at c:\\|\.ps1\b/i.test(
    String(text || "")
  );
}

/** Short user-facing print errors — never leak PowerShell stacks, argv, or temp paths. */
function sanitizePrintAgentError(error, printerName, fallback) {
  const safeFallback = fallback || "Print failed";
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
  if (
    code === 1801 ||
    code === 1905 ||
    code === 1906 ||
    /ERROR_INVALID_PRINTER_NAME|ERROR_PRINTER_DELETED|ERROR_INVALID_PRINTER_STATE|OpenPrinter failed|StartDocPrinter failed|\bGLPrinter\b/i.test(
      raw
    )
  ) {
    return name
      ? `Printer '${name}' not found or disconnected`
      : "Printer not found or disconnected";
  }
  const cleanLine = raw
    .split(/\r?\n/)
    .map((l) => String(l).trim())
    .find(
      (l) =>
        l &&
        /Printer '|OpenPrinter|StartDocPrinter|WritePrinter|not found or disconnected|corrupted|Select a receipt|No default printer/i.test(
          l
        ) &&
        !isShellDump(l)
    );
  if (cleanLine) {
    return cleanLine.replace(/^.*Exception:\s*/i, "").slice(0, 220);
  }
  if (isShellDump(raw)) {
    return name ? `Print failed for '${name}'` : safeFallback;
  }
  if (name && /print failed/i.test(raw)) return `Print failed for '${name}'`;
  if (raw && !isShellDump(raw) && raw.length <= 220) {
    return raw.split(/\r?\n/)[0].slice(0, 220);
  }
  if (name) return `Print failed for '${name}'`;
  return safeFallback;
}

async function runPowerShell(scriptPath, args, printerName) {
  const psArgs = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    ...args,
  ];
  try {
    const { stdout, stderr } = await execFileAsync("powershell.exe", psArgs, {
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
      encoding: "utf8",
    });
    if (stderr && stderr.trim()) {
      console.warn("[print-agent]", stderr.trim());
    }
    return stdout.trim();
  } catch (error) {
    throw new Error(sanitizePrintAgentError(error, printerName));
  }
}

async function listPrinters() {
  if (!isWindows()) {
    return [];
  }
  // Force UTF-8 JSON on stdout so French printer names (é, è, …) survive into Node.
  const ps = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$items = Get-CimInstance -ClassName Win32_Printer | Where-Object {
  $_.WorkOffline -ne $true -and [int]$_.PrinterStatus -ne 7
} | ForEach-Object {
  $hint = [regex]::Replace([string]$_.Name, '\s*\(COM\d+\)\s*', ' ')
  $hint = $hint.Trim()
  [PSCustomObject]@{
    name = $_.Name
    portName = [string]$_.PortName
    driverName = [string]$_.DriverName
    matchHint = $hint
    isDefault = [bool]$_.Default
    status = [string]$_.PrinterStatus
    unsuitableForRaw = $false
  }
}
# Mark virtual printers for the UI (computed in Node too; keep field for older clients)
$json = ($items | ConvertTo-Json -Compress -Depth 4)
[Console]::Out.Write($json)
`;
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, maxBuffer: 4 * 1024 * 1024, encoding: "utf8" }
  );
  const raw = stdout.trim();
  if (!raw) return [];
  // Strip BOM if present
  const cleaned = raw.replace(/^\uFEFF/, "");
  const parsed = JSON.parse(cleaned);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const seen = new Set();
  return list
    .map((p) => ({
      ...p,
      name: String(p.name || ""),
      portName: p.portName ? String(p.portName) : "",
      driverName: p.driverName ? String(p.driverName) : "",
      matchHint: p.matchHint ? String(p.matchHint) : String(p.name || "").replace(/\s*\(COM\d+\)\s*/gi, " ").trim(),
      unsuitableForRaw: isUnsuitableRawPrinter(p.name),
    }))
    .filter((p) => {
      if (!p.name || seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });
}

function stableDeviceKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\(com\d+\)/gi, "")
    .replace(/com\d+/gi, "")
    .replace(/[^a-z0-9]+/g, "");
}

function scoreDeviceMatch(configured, candidate) {
  const cfg = stableDeviceKey(configured);
  const cand = stableDeviceKey(candidate);
  if (!cfg || !cand) return 0;
  if (cfg === cand) return 20;
  if (cand.includes(cfg) || cfg.includes(cand)) return 12;
  return 0;
}

async function resolvePrinterName(requested) {
  const want = String(requested || "").trim();
  if (!want) return "";
  const printers = await listPrinters();
  const exact = printers.find((p) => p.name === want);
  if (exact) return exact.name;
  const ci = printers.find((p) => p.name.toLowerCase() === want.toLowerCase());
  if (ci) return ci.name;
  const wantPort = want.toUpperCase().match(/^COM\d+$/) ? want.toUpperCase() : "";
  if (wantPort) {
    const byPort = printers.find((p) => String(p.portName || "").toUpperCase() === wantPort);
    if (byPort) return byPort.name;
  }
  const scored = printers
    .map((p) => ({
      p,
      score: Math.max(
        scoreDeviceMatch(want, p.name),
        scoreDeviceMatch(want, p.matchHint),
        scoreDeviceMatch(want, p.driverName)
      ),
    }))
    .filter((x) => x.score >= 12)
    .sort((a, b) => b.score - a.score);
  return scored[0] ? scored[0].p.name : want;
}

async function printRaw({ printerName, dataBase64 }) {
  if (!isWindows()) {
    throw new Error("Reborn Print Agent supports Windows only.");
  }
  if (!dataBase64) {
    throw new Error("dataBase64 is required.");
  }

  const requested = printerName && String(printerName).trim() ? String(printerName).trim() : "";
  const name = requested ? await resolvePrinterName(requested) : "";
  if (name && isUnsuitableRawPrinter(name)) {
    throw new Error(unsuitablePrinterError(name));
  }
  if (name.includes("?")) {
    throw new Error(
      `Printer name looks corrupted ('${name}'). Re-select the printer in WebPOS (accents must not become '?').`
    );
  }

  const bytes = Buffer.from(dataBase64, "base64");
  // 1.6.0+: reborn-print-* (older installed EXEs still used manupos-print-*).
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reborn-print-"));
  const tmpFile = path.join(tmpDir, "receipt.bin");
  const nameFile = path.join(tmpDir, "printer-name.txt");
  fs.writeFileSync(tmpFile, bytes);

  try {
    const scriptPath = ensurePs1OnDisk();
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`win-raw-print.ps1 not found at ${scriptPath}`);
    }
    // Pass printer name via UTF-8 file (not argv) so OpenPrinterW gets real Unicode.
    const args = ["-FilePath", tmpFile];
    if (name) {
      // UTF-8 BOM so PowerShell/.NET always detect UTF-8 (accents/dashes intact).
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      fs.writeFileSync(nameFile, Buffer.concat([bom, Buffer.from(name, "utf8")]));
      args.push("-PrinterNameFile", nameFile);
    }
    const usedPrinter = await runPowerShell(scriptPath, args, name || undefined);
    const resolved = usedPrinter || name || "default";
    if (isUnsuitableRawPrinter(resolved)) {
      throw new Error(unsuitablePrinterError(resolved));
    }
    return resolved;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
      if (fs.existsSync(nameFile)) fs.unlinkSync(nameFile);
      fs.rmdirSync(tmpDir);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

function startServer() {
  const app = express();

  app.use(
    cors({
      origin: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      version: VERSION,
      port: PORT,
      platform: process.platform,
      windows: isWindows(),
      installDir: installDir(),
      features: [
        "print",
        "printers",
        "drawer",
        "scale",
        "install",
        "unicode-printer-names",
        "virtual-printer-guard",
        "device-name-match",
        "bt-com-chunked-raw",
      ],
    });
  });

  app.get("/printers", async (_req, res) => {
    try {
      const printers = await listPrinters();
      res.json({ printers });
    } catch (error) {
      const safe = sanitizePrintAgentError(error, undefined, "Failed to list printers");
      console.error("[print-agent] list printers failed:", safe);
      res.status(500).json({ error: safe });
    }
  });

  app.post("/print", async (req, res) => {
    try {
      const usedPrinter = await printRaw(req.body || {});
      res.json({
        ok: true,
        printer: usedPrinter,
        unsuitableForRaw: isUnsuitableRawPrinter(usedPrinter),
      });
    } catch (error) {
      const safe = sanitizePrintAgentError(error, req.body && req.body.printerName);
      console.error("[print-agent] print failed:", safe);
      res.status(500).json({ error: safe });
    }
  });

  /** POST /drawer — ESC/POS cash drawer kick */
  app.post("/drawer", async (req, res) => {
    try {
      const name = req.body?.printerName;
      if (name && isUnsuitableRawPrinter(name)) {
        throw new Error(unsuitablePrinterError(name));
      }
      const drawerBytes = Buffer.from([0x1b, 0x40, 0x1b, 0x70, 0x00, 0x19, 0xfa]);
      const usedPrinter = await printRaw({
        printerName: name,
        dataBase64: drawerBytes.toString("base64"),
      });
      res.json({ ok: true, printer: usedPrinter });
    } catch (error) {
      const safe = sanitizePrintAgentError(error, req.body && req.body.printerName);
      console.error("[print-agent] drawer failed:", safe);
      res.status(500).json({ error: safe });
    }
  });

  /** GET /scale/ports — list Windows COM ports (optional; skip when port is fixed in panel). */
  app.get("/scale/ports", async (_req, res) => {
    try {
      if (!isWindows()) {
        return res.json({ ok: true, ports: [] });
      }
      const scriptPath = ensureScaleScriptOnDisk();
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
          error: `win-scale-read.ps1 not found at ${scriptPath}. Reinstall Reborn Print Agent.`,
        });
      }
      const stdout = await runPowerShell(scriptPath, ["-ListPorts"]);
      const parsed = JSON.parse(stdout || "{}");
      const devices = Array.isArray(parsed.devices) ? parsed.devices : [];
      const ports = Array.isArray(parsed.ports)
        ? parsed.ports
        : devices.map((d) => d.port).filter(Boolean);
      res.json({ ok: true, ports, devices });
    } catch (error) {
      const safe = sanitizePrintAgentError(error, undefined, "Failed to list scale ports");
      console.error("[print-agent] scale ports failed:", safe);
      res.status(500).json({ error: safe });
    }
  });

  /** GET /scale/reading?port=COM3&timeoutMs=800 — one Aclas reading */
  app.get("/scale/reading", async (req, res) => {
    try {
      if (!isWindows()) {
        return res.json({ ok: true, reading: null, message: "Scale supported on Windows only" });
      }
      const port = normalizeComPort(String(req.query.port || "").trim());
      const hint = String(req.query.hint || req.query.deviceName || "").trim();
      const pnp = String(req.query.pnp || req.query.deviceId || "").trim();
      if (!port && !hint && !pnp) {
        return res.status(400).json({ error: "port, hint, or deviceId query param required" });
      }
      const timeoutMs = Math.min(
        5000,
        Math.max(300, Number(req.query.timeoutMs || 1200) || 1200)
      );
      const scriptPath = ensureScaleScriptOnDisk();
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
          error: `win-scale-read.ps1 not found at ${scriptPath}. Reinstall Reborn Print Agent.`,
        });
      }
      const args = ["-TimeoutMs", String(timeoutMs)];
      if (port) args.push("-PortName", port);
      if (hint) args.push("-Hint", hint);
      if (pnp) args.push("-PnpDeviceId", pnp);
      const stdout = await runPowerShell(scriptPath, args);
      const parsed = JSON.parse(stdout || "{}");
      if (!parsed.ok) {
        return res.status(500).json({ error: parsed.error || "Scale read failed" });
      }
      const { findLatestReading } = require("./aclas-scale");
      const bytes = parsed.dataBase64 ? Buffer.from(parsed.dataBase64, "base64") : Buffer.alloc(0);
      const reading = findLatestReading(bytes);
      res.json({
        ok: true,
        reading,
        resolvedPort: parsed.resolvedPort ? String(parsed.resolvedPort) : parsed.port ? String(parsed.port) : undefined,
        message: reading ? undefined : "No stable frame yet — place item on scale",
      });
    } catch (error) {
      const safe = sanitizePrintAgentError(error, undefined, "Scale read failed");
      console.error("[print-agent] scale reading failed:", safe);
      res.status(500).json({ error: safe });
    }
  });

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`Reborn Print Agent v${VERSION} listening on http://127.0.0.1:${PORT}`);
    if (!isWindows()) {
      console.warn("Warning: RAW thermal printing is only supported on Windows.");
    }
  });
}

(async () => {
  await runCli();
  // If CLI installed/uninstalled it already exited. Otherwise start the server.
  startServer();
})().catch(async (err) => {
  console.error(err);
  appendInstallLog(`Fatal: ${err.message || err}`);
  try {
    await showMessage("Reborn Print Agent — Error", err.message || String(err));
  } catch {
    /* ignore */
  }
  process.exit(1);
});
