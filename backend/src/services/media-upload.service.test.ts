import assert from "node:assert/strict";
import test from "node:test";
import { resolveImageMime, sniffImageMime } from "./media-upload.service";

test("sniffImageMime detects PNG magic bytes", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(sniffImageMime(png), "image/png");
});

test("resolveImageMime falls back from empty MIME to filename extension", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(resolveImageMime("", jpeg, "logo.jpg"), "image/jpeg");
});

test("resolveImageMime rejects unknown bytes", () => {
  assert.throws(
    () => resolveImageMime("application/octet-stream", Buffer.from("hello"), "notes.txt"),
    /Only JPEG, PNG, WebP, or GIF/
  );
});
