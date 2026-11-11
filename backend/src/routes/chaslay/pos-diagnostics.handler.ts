import { Request, Response } from "express";

type PosDiagnosticBody = {
  subject?: string;
  body?: string;
  auto?: boolean | string;
  deviceId?: string;
  device_id?: string;
  appVersion?: string;
  app_version?: string;
  merchantId?: string;
  merchant_id?: string;
  model?: string;
  manufacturer?: string;
  logs?: string;
  crashStack?: string;
  crash_stack?: string;
  sessionSnapshot?: string;
  session_snapshot?: string;
  menuDesign?: string;
  menu_design?: string;
  productPhotosEnabled?: boolean | string;
  product_photos_enabled?: boolean | string;
};

function pickStr(...values: unknown[]): string | null {
  for (const v of values) {
    const s = v == null ? "" : String(v).trim();
    if (s) return s;
  }
  return null;
}

function pickBool(...values: unknown[]): boolean | null {
  for (const v of values) {
    if (v === true || v === "true" || v === "1") return true;
    if (v === false || v === "false" || v === "0") return false;
  }
  return null;
}

/** Shared handler: Android POS diagnostics → platform System Logs (+ optional support ticket when not auto). */
export async function handleChaslayPosDiagnosticPost(req: Request, res: Response) {
  try {
    const b = (req.body || {}) as PosDiagnosticBody;
    const subject = pickStr(b.subject);
    const mainBody = pickStr(b.body, b.logs);
    if (!subject || !mainBody) {
      return res.status(400).json({ error: "Subject and body (or logs) are required" });
    }

    const auto = pickBool(b.auto) ?? false;
    const deviceId = pickStr(b.deviceId, b.device_id);
    const appVersion = pickStr(b.appVersion, b.app_version);
    const merchantId = pickStr(b.merchantId, b.merchant_id);
    const model = pickStr(b.model);
    const manufacturer = pickStr(b.manufacturer);
    const crashStack = pickStr(b.crashStack, b.crash_stack);
    const sessionSnapshot = pickStr(b.sessionSnapshot, b.session_snapshot);
    const menuDesign = pickStr(b.menuDesign, b.menu_design);
    const photos = pickBool(b.productPhotosEnabled, b.product_photos_enabled);

    const header = [
      "--- Chaslay Android POS diagnostics ---",
      JSON.stringify(
        {
          merchantId: merchantId ? merchantId.slice(0, 64) : req.chaslayMerchantId || null,
          deviceId: deviceId ? deviceId.slice(0, 64) : null,
          appVersion: appVersion ? appVersion.slice(0, 64) : null,
          manufacturer: manufacturer ? manufacturer.slice(0, 64) : null,
          model: model ? model.slice(0, 64) : null,
          menuDesign: menuDesign ? menuDesign.slice(0, 32) : null,
          productPhotosEnabled: photos,
          auto,
        },
        null,
        2
      ),
      sessionSnapshot ? `--- Session ---\n${sessionSnapshot.slice(0, 16_000)}` : null,
      crashStack ? `--- Crash stack ---\n${crashStack.slice(0, 48_000)}` : null,
      "--- Log ---",
    ]
      .filter(Boolean)
      .join("\n");

    const composedBody = `${header}\n${mainBody}`.slice(0, 120_000);

    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const log = await SupportTicketService.createDiagnosticReport(req.chaslayMerchantId!, {
      source: "android",
      subject: subject.slice(0, 255),
      body: composedBody,
      auto,
      authorName: "Android POS",
    });
    res.json({ ok: true, success: true, logId: log.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to submit report" });
  }
}
