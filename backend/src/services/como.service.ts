import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureComoSchema } from "@/lib/ensure-merchant-schema";
import {
  COMO_API_BASE_LIVE,
  getComoPublic,
  isComoReady,
  mergeComoSettings,
  normalizeComoSettings,
  type ComoSettings,
  type ComoSettingsPublic,
} from "@/lib/como-settings";
import {
  buildComoCustomerBody,
  buildComoPurchase,
  classifyComoIdentifier,
  hasComoIdentifier,
  isComoCustomerNotFound,
  mergeComoIdentifier,
  parseComoBenefits,
  parseComoConfirmation,
  parseComoMember,
  sanitizeComoError,
  type ComoCartLineInput,
  type ComoIdentifier,
  type ComoMemberSnapshot,
  type ComoPurchase,
} from "@/lib/como-api";

export type ComoChannel = "pos" | "kiosk";

export type ComoSessionInput = {
  identifier?: string;
  phone?: string;
  email?: string;
  membershipKey?: string;
  transactionId?: string;
  orderType?: string;
  items?: ComoCartLineInput[];
  totalMajor?: number;
  assetKeys?: string[];
  channel?: ComoChannel;
};

type ComoApiResult = {
  ok: boolean;
  status: number;
  body: unknown;
  error?: string;
};

function firstRow(result: unknown): Record<string, unknown> | undefined {
  if (!result) return undefined;
  if (Array.isArray(result)) return result[0] as Record<string, unknown> | undefined;
  const r = result as { rows?: Record<string, unknown>[] };
  if (Array.isArray(r.rows)) return r.rows[0];
  return undefined;
}

function newTransactionId(): string {
  return `reborn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveIdentifier(input: ComoSessionInput): ComoIdentifier {
  return mergeComoIdentifier(
    input.identifier ? classifyComoIdentifier(input.identifier) : null,
    {
      phoneNumber: input.phone?.trim() || undefined,
      email: input.email?.trim() || undefined,
      membershipKey: input.membershipKey?.trim() || undefined,
    }
  );
}

export class ComoService {
  static async readSettings(merchantId: string): Promise<ComoSettings> {
    await ensureComoSchema();
    const db = getDb();
    const result = await db.execute(
      sql`SELECT como_settings FROM merchants WHERE id = ${merchantId} LIMIT 1`
    );
    const row = firstRow(result);
    return normalizeComoSettings((row?.como_settings ?? row?.comoSettings) as ComoSettings | null);
  }

  static async readPublic(merchantId: string): Promise<ComoSettingsPublic> {
    await ensureComoSchema();
    const db = getDb();
    const result = await db.execute(
      sql`SELECT como_settings FROM merchants WHERE id = ${merchantId} LIMIT 1`
    );
    const row = firstRow(result);
    return getComoPublic((row?.como_settings ?? row?.comoSettings) as ComoSettings | null);
  }

  static async saveSettings(
    merchantId: string,
    patch: ComoSettings | Record<string, unknown>
  ): Promise<ComoSettingsPublic> {
    await ensureComoSchema();
    const current = await this.readSettings(merchantId);
    const merged = mergeComoSettings(current, patch);
    const db = getDb();
    await db.execute(
      sql`UPDATE merchants SET como_settings = ${JSON.stringify(merged)}::jsonb, updated_at = NOW() WHERE id = ${merchantId}`
    );
    return getComoPublic(merged);
  }

  static async markTestOk(merchantId: string): Promise<ComoSettingsPublic> {
    return this.saveSettings(merchantId, { lastTestOkAt: new Date().toISOString() });
  }

  private static async call(
    settings: ComoSettings,
    path: string,
    opts: { method?: "GET" | "POST"; body?: Record<string, unknown>; query?: string } = {}
  ): Promise<ComoApiResult> {
    if (!settings.apiKey) {
      return { ok: false, status: 0, body: null, error: "Como API key is not configured" };
    }
    const url = `${COMO_API_BASE_LIVE}${path.startsWith("/") ? path : `/${path}`}${opts.query || ""}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Key": settings.apiKey,
    };
    if (settings.branchId) headers["X-Branch-Id"] = settings.branchId;
    headers["X-Source-Name"] = "RebornPOS";
    try {
      const res = await fetch(url, {
        method: opts.method || "POST",
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      const text = await res.text();
      let body: unknown = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { message: text.slice(0, 400) };
        }
      }
      if (!res.ok) {
        const raw =
          (body && typeof body === "object" && "message" in body
            ? String((body as { message?: unknown }).message || "")
            : "") || text;
        return {
          ok: false,
          status: res.status,
          body,
          error: sanitizeComoError(raw || `Como HTTP ${res.status}`),
        };
      }
      return { ok: true, status: res.status, body };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        body: null,
        error: sanitizeComoError(err instanceof Error ? err.message : "Como request failed"),
      };
    }
  }

  private static requestBody(
    settings: ComoSettings,
    identifier: ComoIdentifier,
    purchase: ComoPurchase,
    extra?: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      customer: buildComoCustomerBody(identifier),
      purchase,
      ...extra,
    };
  }

  static async testConnection(merchantId: string): Promise<{
    ok: boolean;
    configured: boolean;
    error?: string;
  }> {
    const settings = await this.readSettings(merchantId);
    if (!isComoReady(settings)) {
      return { ok: false, configured: false, error: "Enable Como and save an API key first" };
    }
    const purchase = buildComoPurchase({
      transactionId: `reborn-test-${Date.now()}`,
      posId: settings.posId,
      orderType: "pos",
      items: [{ lineId: "1", itemCode: "TEST", quantity: 1, unitPrice: 0 }],
      totalMajor: 0,
    });
    const result = await this.call(
      settings,
      "/getMemberDetails",
      {
        body: this.requestBody(settings, { phoneNumber: "0000000000" }, purchase),
        query: "?returnAssets=active&expand=assets.redeemable",
      }
    );
    if (result.status === 401 || result.status === 403) {
      return { ok: false, configured: true, error: result.error || "Como rejected the API key" };
    }
    if (result.ok || isComoCustomerNotFound(result.error || "")) {
      await this.markTestOk(merchantId);
      return { ok: true, configured: true };
    }
    return { ok: false, configured: true, error: result.error || "Como test failed" };
  }

  static async identify(merchantId: string, input: ComoSessionInput) {
    const settings = await this.readSettings(merchantId);
    if (!isComoReady(settings)) {
      throw new Error("Como is not enabled or the API key is missing");
    }
    const identifier = resolveIdentifier(input);
    if (!hasComoIdentifier(identifier)) {
      throw new Error("Enter a phone number, email, or membership / QR code");
    }
    const transactionId = input.transactionId || newTransactionId();
    const purchase = buildComoPurchase({
      transactionId,
      posId: settings.posId,
      orderType: input.orderType || input.channel || "pos",
      items: input.items || [],
      totalMajor: input.totalMajor,
    });
    const details = await this.call(settings, "/getMemberDetails", {
      body: this.requestBody(settings, identifier, purchase),
      query: "?returnAssets=active&expand=assets.redeemable",
    });
    let member = parseComoMember(details.body);
    if (!details.ok && isComoCustomerNotFound(details.error || "")) {
      member = { ...member, notFound: true, assets: [] };
    } else if (!details.ok) {
      throw new Error(details.error || "Como identify failed");
    }

    let gifts: unknown = null;
    if (!member.notFound) {
      const giftsRes = await this.call(settings, "/getGifts", {
        body: this.requestBody(settings, identifier, purchase),
      });
      if (giftsRes.ok) gifts = giftsRes.body;
    }

    return {
      transactionId,
      member,
      gifts,
      purchase,
    };
  }

  static async getBenefits(merchantId: string, input: ComoSessionInput) {
    const settings = await this.readSettings(merchantId);
    if (!isComoReady(settings)) {
      throw new Error("Como is not enabled or the API key is missing");
    }
    const identifier = resolveIdentifier(input);
    if (!hasComoIdentifier(identifier)) {
      throw new Error("Identify a Como member first");
    }
    const transactionId = input.transactionId || newTransactionId();
    const purchase = buildComoPurchase({
      transactionId,
      posId: settings.posId,
      orderType: input.orderType || input.channel || "pos",
      items: input.items || [],
      totalMajor: input.totalMajor,
    });
    const extra: Record<string, unknown> = {};
    if (input.assetKeys?.length) {
      extra.assets = input.assetKeys.map((key) => ({ key }));
    }
    const result = await this.call(settings, "/getBenefits", {
      body: this.requestBody(settings, identifier, purchase, extra),
    });
    if (!result.ok) {
      throw new Error(result.error || "Como getBenefits failed");
    }
    const parsed = parseComoBenefits(result.body);
    return {
      transactionId,
      purchase,
      ...parsed,
      raw: result.body,
    };
  }

  static async submitPurchase(
    merchantId: string,
    input: ComoSessionInput & { orderId?: string }
  ) {
    const settings = await this.readSettings(merchantId);
    if (!isComoReady(settings)) {
      throw new Error("Como is not enabled or the API key is missing");
    }
    const identifier = resolveIdentifier(input);
    if (!hasComoIdentifier(identifier)) {
      throw new Error("Identify a Como member first");
    }
    const transactionId = input.transactionId || newTransactionId();
    const purchase = buildComoPurchase({
      transactionId,
      posId: settings.posId,
      orderType: input.orderType || input.channel || "pos",
      items: input.items || [],
      totalMajor: input.totalMajor,
    });
    const extra: Record<string, unknown> = {};
    if (input.assetKeys?.length) {
      extra.assets = input.assetKeys.map((key) => ({ key }));
    }
    const result = await this.call(settings, "/submitPurchase", {
      body: this.requestBody(settings, identifier, purchase, extra),
    });
    if (!result.ok) {
      throw new Error(result.error || "Como submitPurchase failed");
    }
    const conf = parseComoConfirmation(result.body);
    if (input.orderId) {
      await this.persistMapping(merchantId, {
        orderId: input.orderId,
        transactionId: conf.transactionId || transactionId,
        confirmation: conf.confirmation || conf.purchaseKey || null,
        membershipKey: identifier.membershipKey || null,
        status: "submitted",
        selectedAssets: input.assetKeys || [],
      });
    }
    return {
      transactionId: conf.transactionId || transactionId,
      confirmation: conf.confirmation || conf.purchaseKey || null,
      raw: result.body,
    };
  }

  static async voidPurchase(
    merchantId: string,
    input: ComoSessionInput & { orderId?: string; confirmation?: string }
  ) {
    const settings = await this.readSettings(merchantId);
    if (!isComoReady(settings)) {
      throw new Error("Como is not enabled or the API key is missing");
    }
    let identifier = resolveIdentifier(input);
    let transactionId = input.transactionId;
    let confirmation = input.confirmation;
    if (input.orderId && (!transactionId || !hasComoIdentifier(identifier))) {
      const mapped = await this.findMapping(merchantId, input.orderId);
      if (mapped) {
        transactionId = transactionId || mapped.como_transaction_id;
        confirmation = confirmation || mapped.como_confirmation;
        identifier = mergeComoIdentifier(identifier, {
          membershipKey: mapped.membership_key || undefined,
        });
      }
    }
    if (!transactionId) {
      throw new Error("No Como transaction to void");
    }
    const purchase = buildComoPurchase({
      transactionId,
      posId: settings.posId,
      orderType: input.orderType || input.channel || "pos",
      items: input.items || [],
      totalMajor: input.totalMajor,
    });
    const extra: Record<string, unknown> = {};
    if (confirmation) extra.confirmation = confirmation;
    const result = await this.call(settings, "/voidPurchase", {
      body: this.requestBody(settings, identifier, purchase, extra),
    });
    if (!result.ok) {
      throw new Error(result.error || "Como voidPurchase failed");
    }
    if (input.orderId) {
      await this.persistMapping(merchantId, {
        orderId: input.orderId,
        transactionId,
        confirmation: confirmation || null,
        membershipKey: identifier.membershipKey || null,
        status: "voided",
        selectedAssets: input.assetKeys || [],
      });
    }
    return { ok: true, transactionId };
  }

  static async voidForOrder(merchantId: string, orderId: string): Promise<void> {
    const mapped = await this.findMapping(merchantId, orderId);
    if (!mapped || mapped.status === "voided") return;
    await this.voidPurchase(merchantId, {
      orderId,
      transactionId: mapped.como_transaction_id,
      confirmation: mapped.como_confirmation || undefined,
      membershipKey: mapped.membership_key || undefined,
    });
  }

  static async persistMapping(
    merchantId: string,
    row: {
      orderId: string;
      transactionId: string;
      confirmation?: string | null;
      membershipKey?: string | null;
      status: "submitted" | "voided";
      selectedAssets?: string[];
    }
  ) {
    await ensureComoSchema();
    const db = getDb();
    await db.execute(sql`
      INSERT INTO como_transactions (
        merchant_id, order_id, como_transaction_id, como_confirmation,
        membership_key, status, selected_assets, updated_at
      ) VALUES (
        ${merchantId}, ${row.orderId}, ${row.transactionId}, ${row.confirmation || null},
        ${row.membershipKey || null}, ${row.status},
        ${JSON.stringify(row.selectedAssets || [])}::jsonb, NOW()
      )
      ON CONFLICT (merchant_id, order_id)
      DO UPDATE SET
        como_transaction_id = EXCLUDED.como_transaction_id,
        como_confirmation = EXCLUDED.como_confirmation,
        membership_key = EXCLUDED.membership_key,
        status = EXCLUDED.status,
        selected_assets = EXCLUDED.selected_assets,
        updated_at = NOW()
    `);
    await db.execute(sql`
      UPDATE orders
      SET como_loyalty = ${JSON.stringify({
        transactionId: row.transactionId,
        confirmation: row.confirmation || null,
        membershipKey: row.membershipKey || null,
        status: row.status,
      })}::jsonb
      WHERE id = ${row.orderId} AND merchant_id = ${merchantId}
    `);
  }

  static async findMapping(merchantId: string, orderId: string) {
    await ensureComoSchema();
    const db = getDb();
    const result = await db.execute(sql`
      SELECT como_transaction_id, como_confirmation, membership_key, status
      FROM como_transactions
      WHERE merchant_id = ${merchantId} AND order_id = ${orderId}
      LIMIT 1
    `);
    return firstRow(result) as
      | {
          como_transaction_id: string;
          como_confirmation?: string | null;
          membership_key?: string | null;
          status?: string;
        }
      | undefined;
  }
}

export type { ComoMemberSnapshot };
