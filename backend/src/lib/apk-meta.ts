import fs from "fs";
import zlib from "zlib";

const LOCAL_FILE_HEADER = 0x04034b50;

/** Read one entry from a ZIP/APK without external dependencies. */
function readZipEntry(apkPath: string, entryName: string): Buffer | null {
  const buf = fs.readFileSync(apkPath);
  let offset = 0;
  while (offset < buf.length - 30) {
    if (buf.readUInt32LE(offset) !== LOCAL_FILE_HEADER) {
      offset += 1;
      continue;
    }
    const compMethod = buf.readUInt16LE(offset + 8);
    const compSize = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const entry = buf.subarray(nameStart, nameStart + nameLen).toString("utf8");
    const dataStart = nameStart + nameLen + extraLen;
    if (entry === entryName) {
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (compMethod === 0) return data;
      if (compMethod === 8) return zlib.inflateRawSync(data);
      return null;
    }
    offset = dataStart + compSize;
  }
  return null;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

/** Scan Android binary XML for UTF-16LE semver strings (versionName values). */
function scanUtf16Semver(manifest: Buffer): string | null {
  const found = new Set<string>();
  for (let i = 0; i < manifest.length - 6; i++) {
    if (manifest[i] !== 0x30 || manifest[i + 1] !== 0) continue;
    if (manifest[i + 2] !== 0x2e || manifest[i + 3] !== 0) continue;
    let s = "";
    let j = i;
    while (j + 1 < manifest.length) {
      const lo = manifest[j];
      const hi = manifest[j + 1];
      if (hi !== 0) break;
      if (lo === 0) break;
      if ((lo >= 0x30 && lo <= 0x39) || lo === 0x2e) {
        s += String.fromCharCode(lo);
        j += 2;
      } else {
        break;
      }
    }
    if (/^0\.\d+\.\d+$/.test(s)) found.add(s);
  }
  if (!found.size) return null;
  return [...found].sort(compareSemver).pop() ?? null;
}

export type ApkMeta = {
  versionName: string | null;
};

/** Read versionName embedded in an APK's AndroidManifest.xml. */
export function readApkMeta(apkPath: string): ApkMeta {
  if (!fs.existsSync(apkPath)) return { versionName: null };
  try {
    const manifest = readZipEntry(apkPath, "AndroidManifest.xml");
    if (!manifest) return { versionName: null };
    return { versionName: scanUtf16Semver(manifest) };
  } catch {
    return { versionName: null };
  }
}
