/**
 * Shop SPA index loader — run: cd backend && npx tsx src/lib/shop-spa-index.test.ts
 */
import assert from "node:assert/strict";
import { clearShopSpaIndexCache, loadShopSpaIndexHtml } from "./shop-spa-index.ts";

function htmlRes(body: string, status = 200, etag?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === "etag" ? etag || null : null) },
    text: async () => body,
  } as Response;
}

async function main() {
  clearShopSpaIndexCache();

  {
    let fetches = 0;
    const live = `<!doctype html><html><head></head><body><script src="/assets/index-LIVE.js"></script></body></html>`;
    const stale = `<!doctype html><html><head></head><body><script src="/assets/index-STALE.js"></script></body></html>`;
    const html = await loadShopSpaIndexHtml({
      dashboardOrigin: "http://dashboard",
      ttlMs: 5_000,
      now: () => 1_000,
      fetchImpl: async () => {
        fetches += 1;
        return htmlRes(live, 200, '"abc"');
      },
      readFileSync: () => stale,
      statSync: () => ({ mtimeMs: 1 }) as unknown as ReturnType<typeof import("fs").statSync>,
    });
    assert.equal(html?.includes("index-LIVE.js"), true);
    assert.equal(fetches, 1);

    const cached = await loadShopSpaIndexHtml({
      dashboardOrigin: "http://dashboard",
      ttlMs: 5_000,
      now: () => 2_000,
      fetchImpl: async () => {
        fetches += 1;
        return htmlRes("should-not-fetch");
      },
      readFileSync: () => stale,
      statSync: () => ({ mtimeMs: 1 }) as unknown as ReturnType<typeof import("fs").statSync>,
    });
    assert.equal(cached?.includes("index-LIVE.js"), true);
    assert.equal(fetches, 1);
  }

  clearShopSpaIndexCache();

  {
    const fileHtml = `<!doctype html><html><head></head><body><script src="/assets/index-FILE.js"></script></body></html>`;
    const html = await loadShopSpaIndexHtml({
      dashboardOrigin: "http://dashboard",
      fetchImpl: async () => {
        throw new Error("dashboard down");
      },
      readFileSync: () => fileHtml,
      statSync: () => ({ mtimeMs: 10 }) as unknown as ReturnType<typeof import("fs").statSync>,
      filePath: "/tmp/shop-index.html",
    });
    assert.equal(html?.includes("index-FILE.js"), true);
  }

  clearShopSpaIndexCache();

  {
    const first = `<!doctype html><html><head></head><body><script src="/assets/a.js"></script></body></html>`;
    const second = `<!doctype html><html><head></head><body><script src="/assets/b.js"></script></body></html>`;
    let mtime = 1;
    let contents = first;
    const deps = {
      dashboardOrigin: "",
      fetchImpl: undefined,
      filePath: "/tmp/shop-index.html",
      readFileSync: () => contents,
      statSync: () => ({ mtimeMs: mtime }) as unknown as ReturnType<typeof import("fs").statSync>,
    };
    const a = await loadShopSpaIndexHtml(deps);
    assert.equal(a?.includes("a.js"), true);
    contents = second;
    const stillA = await loadShopSpaIndexHtml(deps);
    assert.equal(stillA?.includes("a.js"), true);
    mtime = 2;
    const b = await loadShopSpaIndexHtml(deps);
    assert.equal(b?.includes("b.js"), true);
  }

  console.log("shop-spa-index.test.ts: ok");
}

void main();
