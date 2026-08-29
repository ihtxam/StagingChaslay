import fs from "fs";
import path from "path";

export const DOWNLOADS_ROOT = path.join(__dirname, "..", "..", "public", "downloads");
export const PRINT_AGENT_SETUP_FILE = "reborn-print-agent-setup.exe";
/** Old installer URL — redirects to PRINT_AGENT_SETUP_FILE */
export const LEGACY_PRINT_AGENT_SETUP_FILE = "chaslayreborn-print-agent-setup.exe";
export const PRINT_BRIDGE_APK_FILE = "reborn-print-bridge.apk";

export function downloadsFilePath(filename: string): string {
  const safe = path.basename(filename);
  return path.join(DOWNLOADS_ROOT, safe);
}

export function readDownloadManifest(baseName: string): Record<string, unknown> | null {
  const manifestPath = path.join(DOWNLOADS_ROOT, `${baseName}.json`);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function fileMagicOk(filePath: string, kind: "apk" | "exe"): boolean {
  if (!fs.existsSync(filePath)) return false;
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(2);
  fs.readSync(fd, buf, 0, 2, 0);
  fs.closeSync(fd);
  if (kind === "apk") return buf[0] === 0x50 && buf[1] === 0x4b; // PK (ZIP/APK)
  return buf[0] === 0x4d && buf[1] === 0x5a; // MZ (PE/EXE)
}

export type DownloadDescriptor = {
  id: string;
  name: string;
  filename: string;
  available: boolean;
  sizeBytes: number;
  version: string | null;
  downloadUrl: string | null;
  message?: string;
};

export function describePrintBridgeApk(): DownloadDescriptor {
  const filePath = downloadsFilePath(PRINT_BRIDGE_APK_FILE);
  const manifest = readDownloadManifest("reborn-print-bridge");
  const valid = fileMagicOk(filePath, "apk");
  const stat = valid ? fs.statSync(filePath) : null;
  return {
    id: "print-bridge",
    name: "Reborn Print Bridge (Android)",
    filename: PRINT_BRIDGE_APK_FILE,
    available: valid,
    sizeBytes: stat?.size ?? 0,
    version: typeof manifest?.version === "string" ? manifest.version : null,
    downloadUrl: valid ? `/downloads/${PRINT_BRIDGE_APK_FILE}` : null,
    message: valid
      ? undefined
      : "Print Bridge APK is not published on this server yet. Build from print-agent-android/ or contact support.",
  };
}

export function describePrintAgentExe(): DownloadDescriptor {
  const filePath = downloadsFilePath(PRINT_AGENT_SETUP_FILE);
  const manifest = readDownloadManifest("reborn-print-agent");
  const valid = fileMagicOk(filePath, "exe");
  const stat = valid ? fs.statSync(filePath) : null;
  return {
    id: "print-agent",
    name: "Reborn Print Agent (Windows)",
    filename: PRINT_AGENT_SETUP_FILE,
    available: valid,
    sizeBytes: stat?.size ?? 0,
    version: typeof manifest?.version === "string" ? manifest.version : null,
    downloadUrl: valid ? `/downloads/${PRINT_AGENT_SETUP_FILE}` : null,
    message: valid
      ? undefined
      : "Print Agent installer is not published on this server yet.",
  };
}
