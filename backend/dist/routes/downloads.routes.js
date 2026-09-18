"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const downloads_1 = require("@/lib/downloads");
const router = (0, express_1.Router)();
function sendBinary(res, filePath, filename, contentType, disposition = "attachment") {
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Content-Encoding", "identity");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const cacheControl = filename.endsWith(".apk") ? "no-cache, must-revalidate" : "public, max-age=3600";
    res.setHeader("Cache-Control", cacheControl);
    res.sendFile(filePath);
}
router.get("/reborn-print-bridge.json", (_req, res) => {
    res.json({ success: true, ...(0, downloads_1.describePrintBridgeApk)() });
});
router.get("/reborn-print-agent.json", (_req, res) => {
    const manifest = (0, downloads_1.readDownloadManifest)("reborn-print-agent");
    res.json({
        success: true,
        ...(0, downloads_1.describePrintAgentExe)(),
        ...(manifest || {}),
    });
});
/** @deprecated legacy manifest filename */
router.get("/chaslayreborn-print-agent.json", (_req, res) => {
    res.redirect(302, "/downloads/reborn-print-agent.json");
});
/** @deprecated legacy installer filename — redirect to Reborn download */
router.get(`/${downloads_1.LEGACY_PRINT_AGENT_SETUP_FILE}`, (_req, res) => {
    res.redirect(302, `/downloads/${downloads_1.PRINT_AGENT_SETUP_FILE}`);
});
function sendPrintAgentExe(res, downloadName) {
    const filePath = (0, downloads_1.downloadsFilePath)(downloads_1.PRINT_AGENT_SETUP_FILE);
    if (!(0, downloads_1.fileMagicOk)(filePath, "exe")) {
        return res.status(404).type("text/plain").send("Reborn Print Agent installer is not available on this server.");
    }
    sendBinary(res, filePath, downloadName, "application/octet-stream");
}
router.get(`/${downloads_1.PRINT_AGENT_SETUP_FILE}`, (_req, res) => {
    sendPrintAgentExe(res, downloads_1.PRINT_AGENT_SETUP_FILE);
});
function sendPrintBridgeApk(res) {
    const filePath = (0, downloads_1.downloadsFilePath)(downloads_1.PRINT_BRIDGE_APK_FILE);
    const desc = (0, downloads_1.describePrintBridgeApk)();
    if (!(0, downloads_1.fileMagicOk)(filePath, "apk") || !desc.available) {
        return res
            .status(404)
            .type("text/plain")
            .send(desc.message ||
            [
                "Reborn Print Bridge APK is not available on this server.",
                "",
                "Ask your administrator to build print-agent-android/ and deploy:",
                "  backend/public/downloads/reborn-print-bridge.apk",
            ].join("\n"));
    }
    const filename = `reborn-print-bridge-${desc.version || "latest"}.apk`;
    sendBinary(res, filePath, filename, "application/vnd.android.package-archive", "attachment");
}
router.get("/reborn-print-bridge.apk", (_req, res) => {
    sendPrintBridgeApk(res);
});
/** Versioned filename so Android Chrome cannot reuse a stale Downloads copy. */
router.get("/reborn-print-bridge-:version.apk", (req, res) => {
    const desc = (0, downloads_1.describePrintBridgeApk)();
    const requested = String(req.params.version || "").trim();
    if (desc.version && requested && requested !== desc.version && requested !== "latest") {
        return res
            .status(404)
            .type("text/plain")
            .send(`This server has Bridge v${desc.version}, not v${requested}. Download /downloads/reborn-print-bridge-${desc.version}.apk`);
    }
    sendPrintBridgeApk(res);
});
router.use(express_2.default.static(downloads_1.DOWNLOADS_ROOT, {
    fallthrough: true,
    maxAge: "1h",
    setHeaders(res, filePath) {
        if (filePath.endsWith(".exe")) {
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Encoding", "identity");
        }
        else if (filePath.endsWith(".apk")) {
            res.setHeader("Content-Type", "application/vnd.android.package-archive");
            res.setHeader("Content-Encoding", "identity");
        }
        res.setHeader("X-Content-Type-Options", "nosniff");
        if (filePath.endsWith(".apk")) {
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
        else {
            res.setHeader("Cache-Control", "public, max-age=3600");
        }
    },
}));
router.use((_req, res) => {
    res.status(404).type("text/plain").send("Download not found");
});
exports.default = router;
//# sourceMappingURL=downloads.routes.js.map