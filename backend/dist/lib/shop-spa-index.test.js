"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop SPA index loader — run: cd backend && npx tsx src/lib/shop-spa-index.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const shop_spa_index_ts_1 = require("./shop-spa-index.ts");
function htmlRes(body, status = 200, etag) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: (name) => (name.toLowerCase() === "etag" ? etag || null : null) },
        text: async () => body,
    };
}
async function main() {
    (0, shop_spa_index_ts_1.clearShopSpaIndexCache)();
    {
        let fetches = 0;
        const live = `<!doctype html><html><head></head><body><script src="/assets/index-LIVE.js"></script></body></html>`;
        const stale = `<!doctype html><html><head></head><body><script src="/assets/index-STALE.js"></script></body></html>`;
        const html = await (0, shop_spa_index_ts_1.loadShopSpaIndexHtml)({
            dashboardOrigin: "http://dashboard",
            ttlMs: 5000,
            now: () => 1000,
            fetchImpl: async () => {
                fetches += 1;
                return htmlRes(live, 200, '"abc"');
            },
            readFileSync: () => stale,
            statSync: () => ({ mtimeMs: 1 }),
        });
        strict_1.default.equal(html?.includes("index-LIVE.js"), true);
        strict_1.default.equal(fetches, 1);
        const cached = await (0, shop_spa_index_ts_1.loadShopSpaIndexHtml)({
            dashboardOrigin: "http://dashboard",
            ttlMs: 5000,
            now: () => 2000,
            fetchImpl: async () => {
                fetches += 1;
                return htmlRes("should-not-fetch");
            },
            readFileSync: () => stale,
            statSync: () => ({ mtimeMs: 1 }),
        });
        strict_1.default.equal(cached?.includes("index-LIVE.js"), true);
        strict_1.default.equal(fetches, 1);
    }
    (0, shop_spa_index_ts_1.clearShopSpaIndexCache)();
    {
        const fileHtml = `<!doctype html><html><head></head><body><script src="/assets/index-FILE.js"></script></body></html>`;
        const html = await (0, shop_spa_index_ts_1.loadShopSpaIndexHtml)({
            dashboardOrigin: "http://dashboard",
            fetchImpl: async () => {
                throw new Error("dashboard down");
            },
            readFileSync: () => fileHtml,
            statSync: () => ({ mtimeMs: 10 }),
            filePath: "/tmp/shop-index.html",
        });
        strict_1.default.equal(html?.includes("index-FILE.js"), true);
    }
    (0, shop_spa_index_ts_1.clearShopSpaIndexCache)();
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
            statSync: () => ({ mtimeMs: mtime }),
        };
        const a = await (0, shop_spa_index_ts_1.loadShopSpaIndexHtml)(deps);
        strict_1.default.equal(a?.includes("a.js"), true);
        contents = second;
        const stillA = await (0, shop_spa_index_ts_1.loadShopSpaIndexHtml)(deps);
        strict_1.default.equal(stillA?.includes("a.js"), true);
        mtime = 2;
        const b = await (0, shop_spa_index_ts_1.loadShopSpaIndexHtml)(deps);
        strict_1.default.equal(b?.includes("b.js"), true);
    }
    console.log("shop-spa-index.test.ts: ok");
}
void main();
//# sourceMappingURL=shop-spa-index.test.js.map