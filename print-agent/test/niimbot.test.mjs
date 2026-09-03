import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildNiimbotJobPackets,
  niimbotPacket,
  extractComPort,
  extractWindowsUsbPort,
} = require("../niimbot-client.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.0";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.0 in package.json, server.js, and download manifest", () => {
  const pkg = JSON.parse(read("../package.json"));
  const server = read("../server.js");
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(here, "..", "..", "backend", "public", "downloads", "reborn-print-agent.json"),
      "utf8"
    )
  );
  assert.equal(pkg.version, VERSION);
  assert.match(server, new RegExp(`const VERSION = "${VERSION}"`));
  assert.equal(manifest.version, VERSION);
  assert.equal(JSON.parse(read("../package.json")).pkg.assets.includes("win-niimbot-print.ps1"), true);
});

test("win-niimbot-print.ps1 writes one packet per WritePrinter (no ESC/POS trailer)", () => {
  const src = read("../win-niimbot-print.ps1");
  assert.match(src, /Write-OnePacket/);
  assert.match(src, /0x54/);
  assert.match(src, /Get-PacketDelayMs/);
  assert.equal(src.includes("Get-BtCutTrailer"), false);
  assert.equal(src.includes("0x1D, 0x56"), false);
  assert.equal(src.includes("Split-CutSuffix"), false);
  assert.match(src, /foreach \(\$pkt in \$packets\)/);
});

test("niimbot packets are framed and raster lines use type 0x85", () => {
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const packets = buildNiimbotJobPackets(bitmap, w, h, 3);
  assert.ok(packets.length > h + 4);
  for (const pkt of packets) {
    assert.equal(pkt[0], 0x55);
    assert.equal(pkt[1], 0x55);
    assert.equal(pkt[pkt.length - 2], 0xaa);
    assert.equal(pkt[pkt.length - 1], 0xaa);
  }
  const raster = packets.filter((p) => p[2] === 0x85);
  assert.equal(raster.length, h);
  const start = packets.find((p) => p[2] === 0x01);
  assert.ok(start);
  assert.equal(start[3], 2);
  assert.deepEqual([start[4], start[5]], [0, 1]);
  const dim = packets.find((p) => p[2] === 0x13);
  assert.ok(dim);
  assert.equal(dim[3], 6);
});

test("niimbotPacket checksum matches frame length", () => {
  const pkt = niimbotPacket(0x21, [3]);
  assert.equal(pkt.length, 4 + 1 + 3);
  assert.equal(pkt[2], 0x21);
  assert.equal(pkt[3], 1);
});

test("port extractors recognize COM and USB spooler ports", () => {
  assert.equal(extractComPort("Niimbot K3 (COM7)"), "COM7");
  assert.equal(extractWindowsUsbPort("USB005"), "USB005");
  assert.equal(extractWindowsUsbPort("NIIMBOT K3 on USB005"), "USB005");
});

test("server wires dedicated Niimbot Windows packet print path", () => {
  const server = read("../server.js");
  assert.match(server, /printNiimbotWindows/);
  assert.match(server, /win-niimbot-print\.ps1/);
  assert.match(server, /discoverNiimbotComPorts/);
  assert.match(server, /printWindowsPacketsFn: printNiimbotWindows/);
});
