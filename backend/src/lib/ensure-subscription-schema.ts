import { ensureSubscriptionPlansSchema } from "@/lib/ensure-merchant-schema";

let startupPatchPromise: Promise<void> | null = null;

/** Apply editions + subscription_plans column patches via raw pg (Drizzle execute often no-ops). */
export function ensureSubscriptionSchemaAtStartup(): void {
  if (startupPatchPromise) return;
  startupPatchPromise = ensureSubscriptionPlansSchema().catch((err) => {
    console.warn("[schema] subscription startup patch failed:", err);
    startupPatchPromise = null;
  });
}
