import type { NextFunction, Request, Response } from "express";
import { ensureMerchantSchemaAtStartup } from "@/lib/ensure-merchant-schema";
import { isLazyMerchantSchemaBootstrap } from "@/lib/schema-bootstrap-mode";

export type MerchantSchemaStartupState = "pending" | "ready" | "failed";

let startupState: MerchantSchemaStartupState = "pending";
let kickoffStarted = false;

function isWarmupExemptPath(req: Request): boolean {
  const path = req.path || "";
  if (path === "/health" || path === "/api/health") return true;
  if (path.startsWith("/health/")) return true;
  if (path.startsWith("/downloads")) return true;
  return false;
}

/** Start merchant schema patches in the background (do not block HTTP listen). */
export function kickOffMerchantSchemaStartup(): void {
  if (kickoffStarted) return;
  kickoffStarted = true;
  if (isLazyMerchantSchemaBootstrap()) {
    startupState = "ready";
    console.log(
      "[schema] MERCHANT_SCHEMA_BOOTSTRAP=lazy — skipping boot-time ensureAllMerchantSchema (lazy heal only)"
    );
    return;
  }
  console.log("[schema] merchant schema patches running in background…");
  void ensureMerchantSchemaAtStartup()
    .then(() => {
      startupState = "ready";
      console.log("[schema] merchant schema background patches complete");
    })
    .catch((err) => {
      startupState = "failed";
      console.warn("[schema] merchant background patch failed (API accepting traffic):", err);
    });
}

export function getMerchantSchemaStartupState(): MerchantSchemaStartupState {
  return startupState;
}

export function isMerchantSchemaReady(): boolean {
  return startupState === "ready" || startupState === "failed";
}

export function merchantSchemaStartupMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (isMerchantSchemaReady() || isWarmupExemptPath(req)) {
    next();
    return;
  }
  res.status(503).json({
    error: "Service is starting. Please retry in a few seconds.",
    code: "SCHEMA_WARMUP",
    schemaStartup: startupState,
  });
}
