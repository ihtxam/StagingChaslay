import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  TASK_NAME,
  buildHiddenLauncherVbs,
  buildWatchdogVbs,
  hiddenStartupCommand,
  watchdogTaskCreateArgs,
  watchdogTaskDeleteArgs,
} = require("../windows-native.js");

test("hidden launcher uses window style 0 and --run", () => {
  const vbs = buildHiddenLauncherVbs("C:\\Users\\Till\\AppData\\Local\\RebornPrintAgent\\reborn-print-agent.exe");
  assert.match(vbs, /--run/);
  assert.match(vbs, /, 0, False/);
  assert.match(vbs, /reborn-print-agent\.exe/);
});

test("hidden launcher escapes quotes in the EXE path", () => {
  const vbs = buildHiddenLauncherVbs('C:\\odd"name\\agent.exe');
  assert.match(vbs, /odd""name/);
});

test("watchdog pings localhost health and relaunches hidden", () => {
  const vbs = buildWatchdogVbs("C:\\agent\\reborn-print-agent.exe", 9101);
  assert.match(vbs, /127\.0\.0\.1:" & port & "\/health/);
  assert.match(vbs, /http\.Status <> 200/);
  assert.match(vbs, /, 0, False/);
  assert.match(vbs, /port = 9101/);
});

test("startup command uses wscript nologo", () => {
  const cmd = hiddenStartupCommand("C:\\Users\\Till\\AppData\\Local\\RebornPrintAgent\\start-hidden.vbs");
  assert.equal(
    cmd,
    'wscript.exe //nologo "C:\\Users\\Till\\AppData\\Local\\RebornPrintAgent\\start-hidden.vbs"'
  );
});

test("watchdog scheduled task is per-user every minute", () => {
  const args = watchdogTaskCreateArgs("C:\\agent\\watchdog.vbs");
  assert.equal(TASK_NAME, "RebornPrintAgent");
  assert.deepEqual(args.slice(0, 4), ["/Create", "/TN", TASK_NAME, "/TR"]);
  assert.ok(args.includes("/SC"));
  assert.ok(args.includes("MINUTE"));
  assert.ok(args.includes("/MO"));
  assert.ok(args.includes("1"));
  assert.deepEqual(watchdogTaskDeleteArgs(), ["/Delete", "/TN", TASK_NAME, "/F"]);
});
