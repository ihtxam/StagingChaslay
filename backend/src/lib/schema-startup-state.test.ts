/**
 * npx tsx backend/src/lib/schema-startup-state.test.ts
 */
import assert from "node:assert/strict";
import type { Request, Response, NextFunction } from "express";
import {
  getMerchantSchemaStartupState,
  merchantSchemaStartupMiddleware,
} from "./schema-startup-state";

function mockReq(path: string): Request {
  return { path } as Request;
}

function runMiddleware(path: string): { status?: number; body?: unknown; next: boolean } {
  const req = mockReq(path);
  let status: number | undefined;
  let body: unknown;
  let next = false;
  const res = {
    status(code: number) {
      status = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
  } as Response;
  const nextFn: NextFunction = () => {
    next = true;
  };
  merchantSchemaStartupMiddleware(req, res, nextFn);
  return { status, body, next };
}

// Module loads with pending state until background kickoff completes (not run in this test).
assert.equal(getMerchantSchemaStartupState(), "pending");

const blocked = runMiddleware("/api/auth/login");
assert.equal(blocked.next, false);
assert.equal(blocked.status, 503);
assert.equal((blocked.body as { code?: string }).code, "SCHEMA_WARMUP");

const health = runMiddleware("/api/health");
assert.equal(health.next, true);

const shallowHealth = runMiddleware("/health");
assert.equal(shallowHealth.next, true);

const downloads = runMiddleware("/downloads/foo");
assert.equal(downloads.next, true);

console.log("schema-startup-state: ok");
