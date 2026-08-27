"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINT_BRIDGE_APK_FILE = exports.LEGACY_PRINT_AGENT_SETUP_FILE = exports.PRINT_AGENT_SETUP_FILE = exports.DOWNLOADS_ROOT = void 0;
exports.downloadsFilePath = downloadsFilePath;
exports.readDownloadManifest = readDownloadManifest;
exports.fileMagicOk = fileMagicOk;
exports.describePrintBridgeApk = describePrintBridgeApk;
exports.describePrintAgentExe = describePrintAgentExe;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.DOWNLOADS_ROOT = path_1.default.join(__dirname, "..", "public", "downloads");
exports.PRINT_AGENT_SETUP_FILE = "reborn-print-agent-setup.exe";
exports.LEGACY_PRINT_AGENT_SETUP_FILE = "chaslayreborn-print-agent-setup.exe";
exports.PRINT_BRIDGE_APK_FILE = "reborn-print-bridge.apk";
function downloadsFilePath(filename) {
    const safe = path_1.default.basename(filename);
    return path_1.default.join(exports.DOWNLOADS_ROOT, safe);
}
function readDownloadManifest(baseName) {
    const manifestPath = path_1.default.join(exports.DOWNLOADS_ROOT, `${baseName}.json`);
    if (!fs_1.default.existsSync(manifestPath))
        return null;
    try {
        return JSON.parse(fs_1.default.readFileSync(manifestPath, "utf8"));
    }
    catch {
        return null;
    }
}
function fileMagicOk(filePath, kind) {
    if (!fs_1.default.existsSync(filePath))
        return false;
    const fd = fs_1.default.openSync(filePath, "r");
    const buf = Buffer.alloc(2);
    fs_1.default.readSync(fd, buf, 0, 2, 0);
    fs_1.default.closeSync(fd);
    if (kind === "apk")
        return buf[0] === 0x50 && buf[1] === 0x4b; // PK (ZIP/APK)
    return buf[0] === 0x4d && buf[1] === 0x5a; // MZ (PE/EXE)
}
function describePrintBridgeApk() {
    const filePath = downloadsFilePath(exports.PRINT_BRIDGE_APK_FILE);
    const manifest = readDownloadManifest("reborn-print-bridge");
    const valid = fileMagicOk(filePath, "apk");
    const stat = valid ? fs_1.default.statSync(filePath) : null;
    return {
        id: "print-bridge",
        name: "Reborn Print Bridge (Android)",
        filename: exports.PRINT_BRIDGE_APK_FILE,
        available: valid,
        sizeBytes: stat?.size ?? 0,
        version: typeof manifest?.version === "string" ? manifest.version : null,
        downloadUrl: valid ? `/downloads/${exports.PRINT_BRIDGE_APK_FILE}` : null,
        message: valid
            ? undefined
            : "Print Bridge APK is not published on this server yet. Build from print-agent-android/ or contact support.",
    };
}
function describePrintAgentExe() {
    const filePath = downloadsFilePath(exports.PRINT_AGENT_SETUP_FILE);
    const manifest = readDownloadManifest("reborn-print-agent");
    const valid = fileMagicOk(filePath, "exe");
    const stat = valid ? fs_1.default.statSync(filePath) : null;
    return {
        id: "print-agent",
        name: "Reborn Print Agent (Windows)",
        filename: exports.PRINT_AGENT_SETUP_FILE,
        available: valid,
        sizeBytes: stat?.size ?? 0,
        version: typeof manifest?.version === "string" ? manifest.version : null,
        downloadUrl: valid ? `/downloads/${exports.PRINT_AGENT_SETUP_FILE}` : null,
        message: valid
            ? undefined
            : "Print Agent installer is not published on this server yet.",
    };
}
//# sourceMappingURL=downloads.js.map