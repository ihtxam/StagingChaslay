import fs from "fs";
import path from "path";

export type ShopSpaIndexDeps = {
  fetchImpl?: typeof fetch;
  readFileSync?: typeof fs.readFileSync;
  statSync?: typeof fs.statSync;
  dashboardOrigin?: string;
  filePath?: string;
  now?: () => number;
  ttlMs?: number;
};

type DashCache = { html: string; etag: string | null; fetchedAt: number };
type FileCache = { html: string; mtimeMs: number; path: string };

let dashCache: DashCache | null = null;
let fileCache: FileCache | null = null;

const DEFAULT_TTL_MS = 5_000;

export function clearShopSpaIndexCache() {
  dashCache = null;
  fileCache = null;
}

function defaultFilePath(): string {
  return (
    process.env.SHOP_SPA_INDEX_PATH || path.join(process.cwd(), "shop-spa", "index.html")
  );
}

function defaultDashboardOrigin(): string {
  return String(process.env.SHOP_SPA_DASHBOARD_ORIGIN || "http://dashboard").replace(/\/$/, "");
}

function looksLikeHtml(html: string): boolean {
  return /<html[\s>]/i.test(html) && /<script[\s>]/i.test(html);
}

function loadFromFile(deps: ShopSpaIndexDeps): string | null {
  const filePath = deps.filePath || defaultFilePath();
  const statSync = deps.statSync || fs.statSync;
  const readFileSync = deps.readFileSync || fs.readFileSync;
  try {
    const st = statSync(filePath);
    const mtimeMs = Number(st.mtimeMs || st.mtime?.getTime?.() || 0);
    if (fileCache && fileCache.path === filePath && fileCache.mtimeMs === mtimeMs) {
      return fileCache.html;
    }
    const html = readFileSync(filePath, "utf8");
    if (!html) return null;
    fileCache = { html, mtimeMs, path: filePath };
    return html;
  } catch {
    return fileCache?.path === filePath ? fileCache.html : null;
  }
}

/** Live dashboard index.html (hashed asset names). Falls back to bind-mounted file. */
export async function loadShopSpaIndexHtml(deps: ShopSpaIndexDeps = {}): Promise<string | null> {
  const now = deps.now ? deps.now() : Date.now();
  const ttlMs = deps.ttlMs ?? DEFAULT_TTL_MS;
  const origin = (deps.dashboardOrigin ?? defaultDashboardOrigin()).replace(/\/$/, "");
  const fetchImpl = deps.fetchImpl || (typeof fetch === "function" ? fetch : null);

  if (origin && fetchImpl) {
    if (dashCache && now - dashCache.fetchedAt < ttlMs) return dashCache.html;
    try {
      const headers: Record<string, string> = { Accept: "text/html" };
      if (dashCache?.etag) headers["If-None-Match"] = dashCache.etag;
      const res = await fetchImpl(`${origin}/index.html`, {
        headers,
        cache: "no-store",
      } as RequestInit);
      if (res.status === 304 && dashCache) {
        dashCache = { ...dashCache, fetchedAt: now };
        return dashCache.html;
      }
      if (res.ok) {
        const html = await res.text();
        if (looksLikeHtml(html)) {
          dashCache = {
            html,
            etag: res.headers?.get?.("etag") || null,
            fetchedAt: now,
          };
          return html;
        }
      }
    } catch {
      /* dashboard may not be up yet */
    }
  }

  return loadFromFile(deps);
}
