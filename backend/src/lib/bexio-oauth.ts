import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  mergeAccountingIntegrationSettings,
  normalizeAccountingIntegrationSettings,
} from "@/lib/accounting-integration-settings";

const BEXIO_AUTH = "https://auth.bexio.com/realms/bexio/protocol/openid-connect";
const DEFAULT_SCOPES =
  "openid profile email offline_access accounting accounting_settings_show";

function oauthStateSecret(): string {
  return (
    process.env.BEXIO_OAUTH_STATE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "chaslay-bexio-oauth-dev"
  );
}

export function bexioOAuthConfigured(): boolean {
  return !!(process.env.BEXIO_OAUTH_CLIENT_ID && process.env.BEXIO_OAUTH_CLIENT_SECRET);
}

export function bexioOAuthRedirectUri(): string {
  const explicit = process.env.BEXIO_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = (process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
  if (base) return `${base}/api/oauth/bexio/callback`;
  return `http://localhost:${process.env.PORT || 3000}/api/oauth/bexio/callback`;
}

export function merchantDashboardAccountingUrl(query: Record<string, string> = {}): string {
  const base = (
    process.env.MERCHANT_DASHBOARD_URL ||
    process.env.SUPERADMIN_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
  const params = new URLSearchParams({ tab: "accounting", ...query });
  return `${base}/merchant/settings?${params.toString()}`;
}

export function signBexioOAuthState(payload: { merchantId: string; exp: number; nonce: string }) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyBexioOAuthState(state: string): { merchantId: string } | null {
  const parts = String(state || "").split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      merchantId?: string;
      exp?: number;
    };
    if (!parsed.merchantId || !parsed.exp || parsed.exp < Date.now()) return null;
    return { merchantId: parsed.merchantId };
  } catch {
    return null;
  }
}

export function buildBexioAuthorizeUrl(merchantId: string): string {
  const clientId = process.env.BEXIO_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("BEXIO_OAUTH_CLIENT_ID is not configured");
  const state = signBexioOAuthState({
    merchantId,
    exp: Date.now() + 15 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString("hex"),
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: bexioOAuthRedirectUri(),
    response_type: "code",
    scope: process.env.BEXIO_OAUTH_SCOPES || DEFAULT_SCOPES,
    state,
  });
  return `${BEXIO_AUTH}/auth?${params.toString()}`;
}

async function tokenRequest(body: URLSearchParams) {
  const clientId = process.env.BEXIO_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BEXIO_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Bexio OAuth client credentials are not configured");
  }
  const res = await fetch(`${BEXIO_AUTH}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Bexio token error: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const msg =
      typeof data.error_description === "string"
        ? data.error_description
        : typeof data.error === "string"
          ? data.error
          : text.slice(0, 200);
    throw new Error(`Bexio OAuth ${res.status}: ${msg}`);
  }
  return data;
}

export async function exchangeBexioOAuthCode(code: string) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: bexioOAuthRedirectUri(),
  });
  return tokenRequest(params);
}

export async function refreshBexioOAuthToken(refreshToken: string) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return tokenRequest(params);
}

function applyTokenResponse(
  prev: ReturnType<typeof normalizeAccountingIntegrationSettings>,
  tokenData: Record<string, unknown>
) {
  const accessToken =
    typeof tokenData.access_token === "string" ? tokenData.access_token : null;
  const refreshToken =
    typeof tokenData.refresh_token === "string"
      ? tokenData.refresh_token
      : prev.bexio?.oauthRefreshToken || null;
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scope = typeof tokenData.scope === "string" ? tokenData.scope : prev.bexio?.oauthScope;
  return mergeAccountingIntegrationSettings(prev, {
    bexio: {
      oauthAccessToken: accessToken,
      oauthRefreshToken: refreshToken,
      oauthExpiresAt: expiresAt,
      oauthScope: scope || null,
      oauthConnectedAt: prev.bexio?.oauthConnectedAt || new Date().toISOString(),
      lastPushError: null,
    },
  });
}

export async function storeBexioOAuthTokens(merchantId: string, tokenData: Record<string, unknown>) {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { accountingIntegrationSettings: true },
  });
  const prev = normalizeAccountingIntegrationSettings(merchant?.accountingIntegrationSettings);
  const next = applyTokenResponse(prev, tokenData);
  await db
    .update(schema.merchants)
    .set({ accountingIntegrationSettings: next, updatedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
}

export async function clearBexioOAuthTokens(merchantId: string) {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { accountingIntegrationSettings: true },
  });
  const next = mergeAccountingIntegrationSettings(merchant?.accountingIntegrationSettings, {
    bexio: {
      oauthAccessToken: null,
      oauthRefreshToken: null,
      oauthExpiresAt: null,
      oauthScope: null,
      oauthConnectedAt: null,
    },
  });
  await db
    .update(schema.merchants)
    .set({ accountingIntegrationSettings: next, updatedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
}

/** PAT takes precedence when set; otherwise OAuth access token with refresh. */
export async function getBexioAccessToken(merchantId: string): Promise<string> {
  const db = getDb();
  const merchant = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
    columns: { accountingIntegrationSettings: true },
  });
  const settings = normalizeAccountingIntegrationSettings(merchant?.accountingIntegrationSettings);
  const pat = settings.bexio?.personalAccessToken;
  if (pat) return pat;

  const access = settings.bexio?.oauthAccessToken;
  const refresh = settings.bexio?.oauthRefreshToken;
  if (!access && !refresh) {
    throw new Error("Connect Bexio via OAuth or add a personal access token");
  }

  const expiresAt = settings.bexio?.oauthExpiresAt
    ? Date.parse(settings.bexio.oauthExpiresAt)
    : 0;
  if (access && (!expiresAt || expiresAt > Date.now() + 60_000)) {
    return access;
  }
  if (!refresh) {
    throw new Error("Bexio OAuth session expired; reconnect Bexio");
  }

  const tokenData = await refreshBexioOAuthToken(refresh);
  const prev = normalizeAccountingIntegrationSettings(merchant?.accountingIntegrationSettings);
  const next = applyTokenResponse(prev, tokenData);
  await db
    .update(schema.merchants)
    .set({ accountingIntegrationSettings: next, updatedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));

  const newAccess = next.bexio?.oauthAccessToken;
  if (!newAccess) throw new Error("Bexio OAuth refresh did not return an access token");
  return newAccess;
}
