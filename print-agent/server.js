/**
 * ChaslayReborn Windows Print Agent
 * Exposes localhost HTTP API for WebPOS silent thermal printing (ESC/POS RAW).
 *
 * CLI:
 *   chaslay-print-agent.exe              Run the agent (foreground)
 *   chaslay-print-agent.exe --install    Install to LocalAppData + Windows Startup
 *   chaslay-print-agent.exe --uninstall  Remove Startup entry (keeps files)
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
const VERSION = "1.5.0";
const { findLatestReading } = require("./aclas-scale");
const APP_NAME = "ChaslayPrintAgent";
const EXE_NAME = "chaslay-print-agent.exe";
const RUN_VALUE_NAME = "ChaslayPrintAgent";

const isPkg = typeof process.pkg !== "undefined";

/** Persistent PowerShell worker — avoids 3–6s Add-Type cold start per print. */
let printWorker = null;
let printWorkerReady = null;
let printWorkerReadyTimer = null;
let printWorkerBuf = "";
const printJobQueue = [];
let printJobActive = false;

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
    });
    appendInstallLog("taskkill: stopped running chaslay-print-agent.exe");
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
    `Open Task Manager → end "chaslay-print-agent.exe", then run setup again.\n\n` +
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

function ensureAssetOnDisk(filename) {
  const dest = path.join(runtimeDir(), filename);
  if (fs.existsSync(dest)) return dest;
  try {
    const bundled = path.join(__dirname, filename);
    if (fs.existsSync(bundled)) {
      fs.copyFileSync(bundled, dest);
      return dest;
    }
  } catch {
    /* ignore */
  }
  return dest;
}

function ensurePs1OnDisk() {
  return ensureAssetOnDisk("win-raw-print.ps1");
}

function ensureWorkerPs1OnDisk() {
  return ensureAssetOnDisk("win-raw-print-worker.ps1");
}

function killPrintWorker() {
  if (printWorkerReadyTimer) {
    clearTimeout(printWorkerReadyTimer);
    printWorkerReadyTimer = null;
  }
  if (!printWorker) return;
  try {
    printWorker.kill();
  } catch {
    /* ignore */
  }
  printWorker = null;
  printWorkerReady = null;
  printWorkerBuf = "";
  // Fail any in-flight waiter so callers can fall back.
  while (printJobQueue.length) {
    const job = printJobQueue.shift();
    try {
      job.reject(new Error("Print worker stopped"));
    } catch {
      /* ignore */
    }
  }
  printJobActive = false;
}

function pumpPrintJobs() {
  if (printJobActive || !printJobQueue.length || !printWorker || !printWorker.stdin.writable) {
    return;
  }
  printJobActive = true;
  const job = printJobQueue[0];
  const payload = JSON.stringify({
    cmd: "print",
    printerName: job.printerName || "",
    dataBase64: job.dataBase64,
  });
  try {
    printWorker.stdin.write(payload + "\n");
  } catch (e) {
    printJobQueue.shift();
    printJobActive = false;
    job.reject(e);
    killPrintWorker();
    return;
  }
}

function onPrintWorkerLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  if (msg.ready && printWorkerReady) {
    if (printWorkerReadyTimer) {
      clearTimeout(printWorkerReadyTimer);
      printWorkerReadyTimer = null;
    }
    printWorkerReady.resolve(true);
    printWorkerReady = null;
    return;
  }
  if (!printJobQueue.length) return;
  const job = printJobQueue.shift();
  printJobActive = false;
  if (msg.ok) {
    job.resolve(msg.printer || job.printerName || "default");
  } else {
    job.reject(new Error(msg.error || "Print worker failed"));
  }
  pumpPrintJobs();
}

function ensurePrintWorker() {
  if (!isWindows()) {
    return Promise.reject(new Error("Print worker is Windows-only"));
  }
  if (printWorker && printWorker.stdin && printWorker.stdin.writable) {
    return Promise.resolve();
  }
  if (printWorkerReady) return printWorkerReady.promise;

  let resolveReady;
  let rejectReady;
  const promise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  printWorkerReady = { promise, resolve: resolveReady, reject: rejectReady };

  const scriptPath = ensureWorkerPs1OnDisk();
  if (!fs.existsSync(scriptPath)) {
    const err = new Error(`win-raw-print-worker.ps1 not found at ${scriptPath}`);
    printWorkerReady = null;
    rejectReady(err);
    return promise;
  }

  printWorkerBuf = "";
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
    ],
    {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }
  );
  printWorker = child;

  printWorkerReadyTimer = setTimeout(() => {
    if (printWorkerReady) {
      printWorkerReady.reject(new Error("Print worker startup timeout"));
      printWorkerReady = null;
      killPrintWorker();
    }
  }, 15000);

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    printWorkerBuf += chunk;
    let idx;
    while ((idx = printWorkerBuf.indexOf("\n")) >= 0) {
      const line = printWorkerBuf.slice(0, idx);
      printWorkerBuf = printWorkerBuf.slice(idx + 1);
      onPrintWorkerLine(line);
    }
  });
  child.stderr.on("data", (chunk) => {
    const msg = String(chunk || "").trim();
    if (msg) console.warn("[print-agent] worker:", msg);
  });
  child.on("exit", () => {
    if (printWorkerReadyTimer) {
      clearTimeout(printWorkerReadyTimer);
      printWorkerReadyTimer = null;
    }
    if (printWorkerReady) {
      printWorkerReady.reject(new Error("Print worker exited during startup"));
      printWorkerReady = null;
    }
    printWorker = null;
    printWorkerBuf = "";
    while (printJobQueue.length) {
      const job = printJobQueue.shift();
      try {
        job.reject(new Error("Print worker exited"));
      } catch {
        /* ignore */
      }
    }
    printJobActive = false;
  });

  return promise;
}

function printViaWorker({ printerName, dataBase64 }) {
  return ensurePrintWorker().then(
    () =>
      new Promise((resolve, reject) => {
        printJobQueue.push({
          printerName: printerName || "",
          dataBase64,
          resolve,
          reject,
        });
        pumpPrintJobs();
      })
  );
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chaslay-msg-"));
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

  for (const ps1Name of ["win-raw-print.ps1", "win-raw-print-worker.ps1", "win-scale-read.ps1"]) {
    const ps1Src = path.join(__dirname, ps1Name);
    const ps1Dest = path.join(dir, ps1Name);
    if (fs.existsSync(ps1Src)) {
      try {
        fs.copyFileSync(ps1Src, ps1Dest);
      } catch {
        copyFileRetry(ps1Src, ps1Dest);
      }
      appendInstallLog(`Copied ${ps1Name}`);
    } else {
      appendInstallLog(`WARNING: ${ps1Name} missing at ${ps1Src}`);
    }
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
      `Chaslay Print Agent installed and running on port ${PORT}.\n\n` +
      `Installed to:\n${dir}\n\n` +
      `It will also start automatically when you log in to Windows.\n\n` +
      `Log: ${installLogPath()}`;
    console.log(msg);
    appendInstallLog("Install success (running)");
    await showMessage("Chaslay Print Agent", msg);
    return;
  }

  const warn =
    `Chaslay Print Agent files were installed to:\n${dir}\n\n` +
    `Startup registration succeeded, but the agent is not responding on port ${PORT} yet.\n` +
    `Try running:\n${launchPath}\n\n` +
    `Log: ${installLogPath()}`;
  console.warn(warn);
  appendInstallLog("Install finished (not healthy yet)");
  await showMessage("Chaslay Print Agent — Warning", warn);
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
  await showMessage("Chaslay Print Agent", msg);
}

function printHelp() {
  console.log(`ChaslayReborn Print Agent v${VERSION}
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
        await showMessage("Chaslay Print Agent — Error", e.message || String(e));
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
      await showMessage("Chaslay Print Agent — Error", e.message || String(e));
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
        await showMessage("Chaslay Print Agent — Error", e.message || String(e));
      }
      process.exit(1);
    }
  }
}

async function runPowerShell(scriptPath, args) {
  const psArgs = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    ...args,
  ];
  const { stdout, stderr } = await execFileAsync("powershell.exe", psArgs, {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });
  if (stderr && stderr.trim()) {
    console.warn("[print-agent]", stderr.trim());
  }
  return stdout.trim();
}

async function listPrinters() {
  if (!isWindows()) {
    return [];
  }
  // Force UTF-8 JSON on stdout so French printer names (é, è, …) survive into Node.
  const ps = `
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$items = Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
  [PSCustomObject]@{
    name = $_.Name
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
  return list.map((p) => ({
    ...p,
    unsuitableForRaw: isUnsuitableRawPrinter(p.name),
  }));
}

async function printRawFallback({ printerName, dataBase64 }) {
  const name = printerName && String(printerName).trim() ? String(printerName).trim() : "";
  const bytes = Buffer.from(dataBase64, "base64");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manupos-print-"));
  const tmpFile = path.join(tmpDir, "receipt.bin");
  const nameFile = path.join(tmpDir, "printer-name.txt");
  fs.writeFileSync(tmpFile, bytes);

  try {
    const scriptPath = ensurePs1OnDisk();
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`win-raw-print.ps1 not found at ${scriptPath}`);
    }
    const args = ["-FilePath", tmpFile];
    if (name) {
      const bom = Buffer.from([0xef, 0xbb, 0xbf]);
      fs.writeFileSync(nameFile, Buffer.concat([bom, Buffer.from(name, "utf8")]));
      args.push("-PrinterNameFile", nameFile);
    }
    const usedPrinter = await runPowerShell(scriptPath, args);
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

async function printRaw({ printerName, dataBase64 }) {
  if (!isWindows()) {
    throw new Error("ChaslayReborn Print Agent supports Windows only.");
  }
  if (!dataBase64) {
    throw new Error("dataBase64 is required.");
  }

  const name = printerName && String(printerName).trim() ? String(printerName).trim() : "";
  if (name && isUnsuitableRawPrinter(name)) {
    throw new Error(unsuitablePrinterError(name));
  }
  if (name.includes("?")) {
    throw new Error(
      `Printer name looks corrupted ('${name}'). Re-select the printer in WebPOS (accents must not become '?').`
    );
  }

  // Fast path: warm PowerShell worker (Add-Type once).
  try {
    const usedPrinter = await printViaWorker({ printerName: name, dataBase64 });
    const resolved = usedPrinter || name || "default";
    if (isUnsuitableRawPrinter(resolved)) {
      throw new Error(unsuitablePrinterError(resolved));
    }
    return resolved;
  } catch (workerErr) {
    console.warn(
      "[print-agent] warm worker failed, falling back to one-shot script:",
      workerErr && workerErr.message ? workerErr.message : workerErr
    );
    killPrintWorker();
    return printRawFallback({ printerName: name, dataBase64 });
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
      warmWorker: !!(printWorker && printWorker.stdin && printWorker.stdin.writable),
      features: [
        "print",
        "printers",
        "drawer",
        "scale",
        "install",
        "unicode-printer-names",
        "virtual-printer-guard",
        "warm-print-worker",
      ],
    });
  });

  /** List Windows COM ports (Aclas USB-serial usually appears as COMx). */
  app.get("/scale/ports", async (_req, res) => {
    try {
      if (!isWindows()) {
        return res.json({ ok: true, ports: [] });
      }
      const scriptPath = ensureAssetOnDisk("win-scale-read.ps1");
      const stdout = await runPowerShell(scriptPath, ["-ListPorts"]);
      const parsed = JSON.parse(String(stdout || "{}").replace(/^\uFEFF/, ""));
      res.json({ ok: true, ports: parsed.ports || [] });
    } catch (error) {
      console.error("[print-agent] scale ports failed:", error);
      res.status(500).json({ error: error.message || "Failed to list scale ports" });
    }
  });

  /** Read one Aclas frame from a COM port (manual weight still available in WebPOS). */
  app.get("/scale/reading", async (req, res) => {
    try {
      if (!isWindows()) {
        return res.status(400).json({ error: "Scale reading is Windows-only" });
      }
      const port = String(req.query.port || "").trim();
      if (!port) {
        return res.status(400).json({ error: "port query required (e.g. COM3)" });
      }
      const timeoutMs = Math.min(Math.max(Number(req.query.timeoutMs || 2500), 500), 8000);
      const scriptPath = ensureAssetOnDisk("win-scale-read.ps1");
      const stdout = await runPowerShell(scriptPath, [
        "-PortName",
        port,
        "-TimeoutMs",
        String(timeoutMs),
      ]);
      const parsed = JSON.parse(String(stdout || "{}").replace(/^\uFEFF/, ""));
      if (!parsed.ok) {
        return res.status(500).json({ error: parsed.error || "Scale read failed" });
      }
      const raw = parsed.dataBase64
        ? Buffer.from(parsed.dataBase64, "base64")
        : Buffer.alloc(0);
      const reading = findLatestReading(raw);
      if (!reading) {
        return res.json({
          ok: true,
          port,
          reading: null,
          message: "No scale frame yet — place item and keep USB scale powered",
        });
      }
      res.json({ ok: true, port, reading });
    } catch (error) {
      console.error("[print-agent] scale reading failed:", error);
      res.status(500).json({ error: error.message || "Scale read failed" });
    }
  });

  app.get("/printers", async (_req, res) => {
    try {
      const printers = await listPrinters();
      res.json({ printers });
    } catch (error) {
      console.error("[print-agent] list printers failed:", error);
      res.status(500).json({ error: error.message || "Failed to list printers" });
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
      console.error("[print-agent] print failed:", error);
      res.status(500).json({ error: error.message || "Print failed" });
    }
  });

  /** ESC/POS cash drawer kick (pin 2, on-time 25 × 2ms, off-time 250 × 2ms) */
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
      console.error("[print-agent] drawer failed:", error);
      res.status(500).json({ error: error.message || "Drawer failed" });
    }
  });

  app.listen(PORT, "127.0.0.1", () => {
    console.log(`ChaslayReborn Print Agent v${VERSION} listening on http://127.0.0.1:${PORT}`);
    if (!isWindows()) {
      console.warn("Warning: RAW thermal printing is only supported on Windows.");
    } else {
      // Warm the worker so the first WebPOS print is not a cold PowerShell start.
      ensurePrintWorker().catch((e) => {
        console.warn("[print-agent] warm worker preload failed:", e.message || e);
      });
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
    await showMessage("Chaslay Print Agent — Error", err.message || String(err));
  } catch {
    /* ignore */
  }
  process.exit(1);
});
