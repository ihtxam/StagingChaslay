import fs from "fs";
import path from "path";
import { readApkMeta } from "@/lib/apk-meta";

export const DOWNLOADS_ROOT = path.join(__dirname, "..", "..", "public", "downloads");
export const PRINT_AGENT_SETUP_FILE = "reborn-print-agent-setup.exe";
/** Old installer URL — redirects to PRINT_AGENT_SETUP_FILE */
export const LEGACY_PRINT_AGENT_SETUP_FILE = "chaslayreborn-print-agent-setup.exe";
export const PRINT_BRIDGE_APK_FILE = "reborn-print-bridge.apk";
export const REBORN_POS_SETUP_FILE = "reborn-pos-setup.exe";
export const REBORN_POS_ANDROID_APK_FILE = "reborn-pos-android.apk";

export function downloadsFilePath(filename: string, root: string = DOWNLOADS_ROOT): string {
  const safe = path.basename(filename);
  return path.join(root, safe);
}

export function readDownloadManifest(
  baseName: string,
  root: string = DOWNLOADS_ROOT
): Record<string, unknown> | null {
  const manifestPath = path.join(root, `${path.basename(baseName)}.json`);
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
  /** Version baked into the APK binary (what installs on the device). */
  version: string | null;
  /** Version recorded in reborn-print-bridge.json (may be ahead of the APK if deploy skipped rebuild). */
  declaredVersion?: string | null;
  versionMismatch?: boolean;
  downloadUrl: string | null;
  message?: string;
};

/** Merchant + JSON manifest: prefer newest published Bridge APK (same files Superadmin lists). */
export function describePrintBridgeApk(root: string = DOWNLOADS_ROOT): DownloadDescriptor {
  const manifest = readDownloadManifest("reborn-print-bridge", root);
  const declaredVersion =
    typeof manifest?.version === "string" ? manifest.version.trim() || null : null;

  const bridgeProduct = listAppVersionHistory(root).find((p) => p.id === "print-bridge");
  const latestRelease =
    bridgeProduct?.releases.find((r) => r.isLatest && r.downloadUrl) ||
    bridgeProduct?.releases.find((r) => r.downloadUrl);

  const canonicalFilename = latestRelease?.filename || PRINT_BRIDGE_APK_FILE;
  const filePath = downloadsFilePath(canonicalFilename, root);
  const valid = fileMagicOk(filePath, "apk");
  const stat = valid ? fs.statSync(filePath) : null;
  const apkVersion = valid ? readApkMeta(filePath).versionName : null;
  const version =
    latestRelease?.version || apkVersion || bridgeProduct?.currentVersion || declaredVersion;
  const legacyMainPath = downloadsFilePath(PRINT_BRIDGE_APK_FILE, root);
  const legacyMainVersion = fileMagicOk(legacyMainPath, "apk")
    ? readApkMeta(legacyMainPath).versionName
    : null;
  const versionMismatch =
    !!legacyMainVersion &&
    !!version &&
    legacyMainVersion !== version &&
    canonicalFilename === PRINT_BRIDGE_APK_FILE;

  const cacheBust = stat
    ? `?v=${encodeURIComponent(version || String(stat.mtimeMs))}`
    : "";
  const downloadPath = latestRelease?.downloadUrl
    ? `${latestRelease.downloadUrl}${cacheBust}`
    : valid && version
      ? `/downloads/reborn-print-bridge-${version}.apk${cacheBust}`
      : null;

  return {
    id: "print-bridge",
    name: "Reborn Print Bridge (Android)",
    filename: canonicalFilename,
    available: valid && !!downloadPath,
    sizeBytes: stat?.size ?? 0,
    version,
    declaredVersion: declaredVersion || bridgeProduct?.currentVersion || version,
    versionMismatch,
    downloadUrl: downloadPath,
    message: valid
      ? versionMismatch
        ? `Legacy ${PRINT_BRIDGE_APK_FILE} is still v${legacyMainVersion}; download uses v${version} (${canonicalFilename}).`
        : undefined
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

export function describeRebornPosAndroidApk(root: string = DOWNLOADS_ROOT): DownloadDescriptor {
  const manifest = readDownloadManifest("reborn-pos-android", root);
  const declaredVersion =
    typeof manifest?.version === "string" ? manifest.version.trim() || null : null;

  const posProduct = listAppVersionHistory(root).find((p) => p.id === "pos-android");
  const latestRelease =
    posProduct?.releases.find((r) => r.isLatest && r.downloadUrl) ||
    posProduct?.releases.find((r) => r.downloadUrl);

  const canonicalFilename = latestRelease?.filename || REBORN_POS_ANDROID_APK_FILE;
  const filePath = downloadsFilePath(canonicalFilename, root);
  const valid = fileMagicOk(filePath, "apk");
  const stat = valid ? fs.statSync(filePath) : null;
  const apkVersion = valid ? readApkMeta(filePath).versionName : null;
  const version =
    latestRelease?.version || apkVersion || posProduct?.currentVersion || declaredVersion;
  const displayName =
    typeof manifest?.displayName === "string" && manifest.displayName.trim()
      ? manifest.displayName.trim()
      : "RebornPOS (Android)";

  const cacheBust = stat
    ? `?v=${encodeURIComponent(version || String(stat.mtimeMs))}`
    : "";
  const downloadPath = latestRelease?.downloadUrl
    ? `${latestRelease.downloadUrl}${cacheBust}`
    : valid && version
      ? `/downloads/reborn-pos-android-${version}.apk${cacheBust}`
      : null;

  return {
    id: "pos-android",
    name: displayName,
    filename: canonicalFilename,
    available: valid && !!downloadPath,
    sizeBytes: stat?.size ?? 0,
    version,
    declaredVersion: declaredVersion || posProduct?.currentVersion || version,
    downloadUrl: downloadPath,
    message: valid
      ? undefined
      : "RebornPOS Android APK is not published on this server yet. Build from app/ or contact support.",
  };
}

export function describeRebornPosExe(): DownloadDescriptor {
  const filePath = downloadsFilePath(REBORN_POS_SETUP_FILE);
  const manifest = readDownloadManifest("reborn-pos-setup");
  const valid = fileMagicOk(filePath, "exe");
  const stat = valid ? fs.statSync(filePath) : null;
  const version =
    typeof manifest?.version === "string" && manifest.version.trim()
      ? manifest.version.trim()
      : null;
  const displayName =
    typeof manifest?.displayName === "string" && manifest.displayName.trim()
      ? manifest.displayName.trim()
      : "RebornPOS";
  return {
    id: "reborn-pos",
    name: `${displayName} (Windows)`,
    filename: REBORN_POS_SETUP_FILE,
    available: valid,
    sizeBytes: stat?.size ?? 0,
    version,
    downloadUrl: valid ? `/downloads/${REBORN_POS_SETUP_FILE}` : null,
    message: valid
      ? undefined
      : "RebornPOS desktop installer is not published on this server yet.",
  };
}

export type AppReleasePlatform = "android" | "windows";

export type AppRelease = {
  version: string;
  filename: string;
  downloadUrl: string | null;
  sizeBytes: number;
  builtAt: string | null;
  isLatest: boolean;
  signed: boolean | null;
  platform: AppReleasePlatform;
};

export type AppProductHistory = {
  id: string;
  name: string;
  platform: AppReleasePlatform;
  currentVersion: string | null;
  latestFilename: string | null;
  latestAvailable: boolean;
  releases: AppRelease[];
};

type ProductSpec = {
  id: string;
  name: string;
  platform: AppReleasePlatform;
  kind: "apk" | "exe";
  latestFiles: string[];
  versionedPatterns: RegExp[];
  manifests: string[];
};

const APP_PRODUCTS: ProductSpec[] = [
  {
    id: "print-bridge",
    name: "RebornPrint / Print Bridge",
    platform: "android",
    kind: "apk",
    latestFiles: ["reborn-print-bridge.apk", "RebornPrint.apk"],
    versionedPatterns: [
      /^reborn-print-bridge-(.+)\.apk$/i,
      /^RebornPrint-(.+)\.apk$/i,
    ],
    manifests: ["reborn-print-bridge"],
  },
  {
    id: "pos-android",
    name: "RebornPOS (Android)",
    platform: "android",
    kind: "apk",
    latestFiles: ["reborn-pos-android.apk"],
    versionedPatterns: [
      /^reborn-pos-android-(.+)\.apk$/i,
      /^chaslaypos-(.+)\.apk$/i,
    ],
    manifests: ["reborn-pos-android"],
  },
  {
    id: "pos-windows",
    name: "RebornPOS (Windows)",
    platform: "windows",
    kind: "exe",
    latestFiles: ["reborn-pos-setup.exe"],
    versionedPatterns: [
      /^reborn-pos-setup[-_](.+)\.exe$/i,
      /^reborn-pos-(.+)[-_]setup\.exe$/i,
    ],
    manifests: ["reborn-pos-setup", "reborn-pos-update"],
  },
  {
    id: "print-agent",
    name: "Reborn Print Agent (Windows)",
    platform: "windows",
    kind: "exe",
    latestFiles: ["reborn-print-agent-setup.exe"],
    versionedPatterns: [
      /^reborn-print-agent-setup[-_](.+)\.exe$/i,
    ],
    manifests: ["reborn-print-agent"],
  },
];

export function compareAppVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return a.localeCompare(b);
}

function manifestString(manifest: Record<string, unknown> | null, key: string): string | null {
  const value = manifest?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function manifestBool(manifest: Record<string, unknown> | null, key: string): boolean | null {
  const value = manifest?.[key];
  return typeof value === "boolean" ? value : null;
}

function isSemverLike(value: string): boolean {
  return /^\d+(?:\.\d+)+$/.test(value.trim());
}

function filenamePreference(filename: string, spec: ProductSpec): number {
  const lower = filename.toLowerCase();
  const isVersioned = spec.versionedPatterns.some((re) => re.test(filename));
  if (spec.id === "print-bridge") {
    if (/^reborn-print-bridge-\d/.test(lower)) return 40;
    if (/^rebornprint-\d/.test(lower)) return 30;
    if (lower === "reborn-print-bridge.apk") return 20;
    if (lower === "rebornprint.apk") return 10;
  }
  if (spec.id === "pos-android") {
    if (/^reborn-pos-android-\d/.test(lower)) return 40;
    if (/^chaslaypos-\d/.test(lower)) return 30;
    if (lower === "reborn-pos-android.apk") return 20;
  }
  return isVersioned ? 25 : 15;
}

function listDownloadFilenames(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  try {
    return fs.readdirSync(root).filter((name) => {
      try {
        return fs.statSync(path.join(root, name)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function fileBuiltAt(filePath: string): string | null {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

/**
 * Scan published installers on disk plus JSON manifests.
 * Used by Superadmin app-download history — not a hardcoded list.
 */
export function listAppVersionHistory(root: string = DOWNLOADS_ROOT): AppProductHistory[] {
  const files = listDownloadFilenames(root);
  const products: AppProductHistory[] = [];

  for (const spec of APP_PRODUCTS) {
    const manifests = spec.manifests
      .map((name) => readDownloadManifest(name, root))
      .filter((m): m is Record<string, unknown> => !!m);
    const primaryManifest = manifests[0] || null;
    const declaredVersion =
      manifests.map((m) => manifestString(m, "version")).find(Boolean) || null;
    const declaredBuiltAt =
      manifests.map((m) => manifestString(m, "builtAt") || manifestString(m, "pub_date")).find(Boolean) ||
      null;
    const declaredSigned = manifests.map((m) => manifestBool(m, "signed")).find((v) => v !== null) ?? null;

    const byVersion = new Map<
      string,
      {
        version: string;
        filename: string;
        sizeBytes: number;
        builtAt: string | null;
        available: boolean;
        score: number;
      }
    >();

    const consider = (filename: string, versionHint: string | null, isLatestName: boolean) => {
      const filePath = downloadsFilePath(filename, root);
      const valid = fileMagicOk(filePath, spec.kind);
      if (!valid && !fs.existsSync(filePath)) return;
      const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
      let version = versionHint && isSemverLike(versionHint) ? versionHint : null;
      if (!version && spec.kind === "apk" && valid) {
        version = readApkMeta(filePath).versionName;
      }
      if (!version && isLatestName) version = declaredVersion;
      if (!version && isLatestName && valid) version = "current";
      if (!version) return;
      const score = filenamePreference(filename, spec) + (valid ? 5 : 0);
      const existing = byVersion.get(version);
      if (existing && existing.score >= score) return;
      byVersion.set(version, {
        version,
        filename,
        sizeBytes: valid ? stat?.size ?? 0 : 0,
        builtAt: declaredVersion === version ? declaredBuiltAt || fileBuiltAt(filePath) : fileBuiltAt(filePath),
        available: valid,
        score,
      });
    };

    for (const latestName of spec.latestFiles) {
      if (files.includes(latestName) || fs.existsSync(downloadsFilePath(latestName, root))) {
        consider(latestName, declaredVersion, true);
      }
    }

    for (const filename of files) {
      if (spec.latestFiles.includes(filename)) continue;
      for (const re of spec.versionedPatterns) {
        const match = filename.match(re);
        if (!match) continue;
        const raw = String(match[1] || "").trim();
        if (!raw || raw.toLowerCase() === "latest") continue;
        consider(filename, raw, false);
        break;
      }
    }

    if (!byVersion.size && declaredVersion) {
      byVersion.set(declaredVersion, {
        version: declaredVersion,
        filename: spec.latestFiles[0],
        sizeBytes: 0,
        builtAt: declaredBuiltAt,
        available: false,
        score: 0,
      });
    }

    if (!byVersion.size && !primaryManifest) continue;

    const versions = [...byVersion.keys()].sort((a, b) => compareAppVersions(b, a));
    const currentVersion = declaredVersion || versions[0] || null;
    const latestEntry = currentVersion ? byVersion.get(currentVersion) : undefined;

    const releases: AppRelease[] = versions.map((version) => {
      const row = byVersion.get(version)!;
      return {
        version,
        filename: row.filename,
        downloadUrl: row.available ? `/downloads/${row.filename}` : null,
        sizeBytes: row.sizeBytes,
        builtAt: row.builtAt,
        isLatest: version === currentVersion,
        signed: version === declaredVersion ? declaredSigned : null,
        platform: spec.platform,
      };
    });

    products.push({
      id: spec.id,
      name: spec.name,
      platform: spec.platform,
      currentVersion,
      latestFilename: latestEntry?.filename || spec.latestFiles[0] || null,
      latestAvailable: !!latestEntry?.available,
      releases,
    });
  }

  return products;
}
