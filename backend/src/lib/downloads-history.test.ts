/**
 * App download version history — run: cd backend && npx tsx src/lib/downloads-history.test.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compareAppVersions, describePrintBridgeApk, listAppVersionHistory } from "./downloads";

function writeFake(filePath: string, kind: "apk" | "exe", extra = "payload"): void {
  const header = kind === "apk" ? Buffer.from([0x50, 0x4b]) : Buffer.from([0x4d, 0x5a]);
  fs.writeFileSync(filePath, Buffer.concat([header, Buffer.from(extra)]));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "app-dl-hist-"));

try {
  fs.writeFileSync(
    path.join(root, "reborn-print-bridge.json"),
    JSON.stringify({
      version: "0.4.29",
      builtAt: "2026-10-10T12:00:00Z",
      signed: true,
    })
  );
  writeFake(path.join(root, "reborn-print-bridge.apk"), "apk", "latest");
  writeFake(path.join(root, "reborn-print-bridge-0.4.29.apk"), "apk", "v429");
  writeFake(path.join(root, "reborn-print-bridge-0.4.28.apk"), "apk", "v428");
  writeFake(path.join(root, "RebornPrint-0.3.9.apk"), "apk", "v39");

  fs.writeFileSync(
    path.join(root, "reborn-pos-setup.json"),
    JSON.stringify({
      version: "0.1.3",
      builtAt: "2026-09-22T21:03:54Z",
      signed: false,
    })
  );
  writeFake(path.join(root, "reborn-pos-setup.exe"), "exe", "pos");

  fs.writeFileSync(
    path.join(root, "reborn-print-agent.json"),
    JSON.stringify({
      version: "1.10.6",
      builtAt: null,
    })
  );
  writeFake(path.join(root, "reborn-print-agent-setup.exe"), "exe", "agent");
  writeFake(path.join(root, "reborn-print-agent-setup-1.10.5.exe"), "exe", "agent-old");

  const products = listAppVersionHistory(root);
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));

  assert.ok(byId["print-bridge"], "bridge product present");
  assert.equal(byId["print-bridge"].currentVersion, "0.4.29");
  assert.equal(byId["print-bridge"].latestAvailable, true);
  assert.deepEqual(
    byId["print-bridge"].releases.map((r) => r.version),
    ["0.4.29", "0.4.28", "0.3.9"]
  );
  const latestBridge = byId["print-bridge"].releases[0];
  assert.equal(latestBridge.isLatest, true);
  assert.equal(latestBridge.filename, "reborn-print-bridge-0.4.29.apk");
  assert.equal(latestBridge.downloadUrl, "/downloads/reborn-print-bridge-0.4.29.apk");
  assert.equal(latestBridge.builtAt, "2026-10-10T12:00:00Z");
  assert.equal(latestBridge.signed, true);

  const oldAlias = byId["print-bridge"].releases.find((r) => r.version === "0.3.9");
  assert.equal(oldAlias?.filename, "RebornPrint-0.3.9.apk");
  assert.equal(oldAlias?.isLatest, false);
  assert.equal(oldAlias?.downloadUrl, "/downloads/RebornPrint-0.3.9.apk");

  assert.ok(byId["pos-windows"], "POS product present");
  assert.equal(byId["pos-windows"].currentVersion, "0.1.3");
  assert.equal(byId["pos-windows"].releases.length, 1);
  assert.equal(byId["pos-windows"].releases[0].filename, "reborn-pos-setup.exe");
  assert.equal(byId["pos-windows"].releases[0].isLatest, true);
  assert.equal(byId["pos-windows"].releases[0].downloadUrl, "/downloads/reborn-pos-setup.exe");

  assert.ok(byId["print-agent"], "agent product present");
  assert.equal(byId["print-agent"].currentVersion, "1.10.6");
  assert.deepEqual(
    byId["print-agent"].releases.map((r) => r.version),
    ["1.10.6", "1.10.5"]
  );
  assert.equal(byId["print-agent"].releases[0].filename, "reborn-print-agent-setup.exe");
  assert.equal(byId["print-agent"].releases[1].downloadUrl, "/downloads/reborn-print-agent-setup-1.10.5.exe");

  writeFake(path.join(root, "reborn-print-bridge-0.4.28.apk"), "apk", "stale-main");
  writeFake(path.join(root, "reborn-print-bridge.apk"), "apk", "stale-main");
  const merchantBridge = describePrintBridgeApk(root);
  assert.equal(merchantBridge.version, "0.4.29");
  assert.equal(merchantBridge.available, true);
  assert.equal(merchantBridge.downloadUrl?.includes("0.4.29"), true);

  assert.ok(compareAppVersions("0.4.29", "0.4.28") > 0);
  assert.ok(compareAppVersions("1.10.6", "1.10.5") > 0);

  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "app-dl-empty-"));
  try {
    fs.writeFileSync(path.join(emptyRoot, "reborn-pos-setup.json"), JSON.stringify({ version: "0.1.1" }));
    const onlyManifest = listAppVersionHistory(emptyRoot);
    assert.equal(onlyManifest.length, 1);
    assert.equal(onlyManifest[0].id, "pos-windows");
    assert.equal(onlyManifest[0].releases[0].downloadUrl, null);
    assert.equal(onlyManifest[0].latestAvailable, false);
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }

  console.log("downloads-history.test.ts ok");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
