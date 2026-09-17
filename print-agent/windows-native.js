/**
 * Silent Windows install helpers for the Print Agent.
 * Browser POS talks to 127.0.0.1:9101; this keeps that listener hidden
 * (no CMD window) and restarts it if a cashier kills the process.
 */

const TASK_NAME = "RebornPrintAgent";
const HIDDEN_LAUNCHER = "start-hidden.vbs";
const WATCHDOG_VBS = "watchdog.vbs";

function vbsLiteral(value) {
  return String(value || "").replace(/"/g, '""');
}

function buildHiddenLauncherVbs(exePath) {
  const exe = vbsLiteral(exePath);
  return [
    "' Reborn Print Agent — hidden launcher (window style 0 = no console).",
    "Set sh = CreateObject(\"WScript.Shell\")",
    `sh.Run """${exe}"" --run", 0, False`,
    "",
  ].join("\r\n");
}

function buildWatchdogVbs(exePath, port) {
  const exe = vbsLiteral(exePath);
  const listenPort = Number(port) || 9101;
  return [
    "' Reborn Print Agent — restart if http://127.0.0.1:<port>/health is down.",
    "On Error Resume Next",
    `Dim http, sh, exe, port`,
    `exe = "${exe}"`,
    `port = ${listenPort}`,
    "Set http = CreateObject(\"MSXML2.XMLHTTP\")",
    'http.Open "GET", "http://127.0.0.1:" & port & "/health", False',
    'http.setRequestHeader "Cache-Control", "no-cache"',
    "http.Send",
    "If Err.Number <> 0 Then",
    "  Err.Clear",
    "  Set sh = CreateObject(\"WScript.Shell\")",
    `  sh.Run """" & exe & """ --run", 0, False`,
    "  WScript.Quit 0",
    "End If",
    "If http.Status <> 200 Then",
    "  Set sh = CreateObject(\"WScript.Shell\")",
    `  sh.Run """" & exe & """ --run", 0, False`,
    "End If",
    "",
  ].join("\r\n");
}

function hiddenStartupCommand(vbsPath) {
  return `wscript.exe //nologo "${vbsPath}"`;
}

function watchdogTaskCreateArgs(vbsPath) {
  return [
    "/Create",
    "/TN",
    TASK_NAME,
    "/TR",
    hiddenStartupCommand(vbsPath),
    "/SC",
    "MINUTE",
    "/MO",
    "1",
    "/F",
    "/RL",
    "LIMITED",
  ];
}

function watchdogTaskDeleteArgs() {
  return ["/Delete", "/TN", TASK_NAME, "/F"];
}

module.exports = {
  TASK_NAME,
  HIDDEN_LAUNCHER,
  WATCHDOG_VBS,
  vbsLiteral,
  buildHiddenLauncherVbs,
  buildWatchdogVbs,
  hiddenStartupCommand,
  watchdogTaskCreateArgs,
  watchdogTaskDeleteArgs,
};
