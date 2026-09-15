"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const media_upload_service_1 = require("./media-upload.service");
(0, node_test_1.default)("sniffImageMime detects PNG magic bytes", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    strict_1.default.equal((0, media_upload_service_1.sniffImageMime)(png), "image/png");
});
(0, node_test_1.default)("resolveImageMime falls back from empty MIME to filename extension", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    strict_1.default.equal((0, media_upload_service_1.resolveImageMime)("", jpeg, "logo.jpg"), "image/jpeg");
});
(0, node_test_1.default)("resolveImageMime rejects unknown bytes", () => {
    strict_1.default.throws(() => (0, media_upload_service_1.resolveImageMime)("application/octet-stream", Buffer.from("hello"), "notes.txt"), /Only JPEG, PNG, WebP, or GIF/);
});
//# sourceMappingURL=media-upload.service.test.js.map