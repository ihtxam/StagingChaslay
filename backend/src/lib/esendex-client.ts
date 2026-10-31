/**
 * Esendex REST client — official v1.0 Message Dispatcher / headers / inbox.
 * @see https://developers.esendex.com/api-reference/
 * @see https://developers.esendex.com/quickstarts/
 */

export const ESENDEX_API_BASE = "https://api.esendex.com/v1.0";

export type EsendexCredentials = {
  user: string;
  password: string;
  accountRef: string;
  originator?: string | null;
};

export type EsendexSendInput = {
  to: string;
  body: string;
  originator?: string | null;
  characterSet?: "GSM" | "Unicode" | "Auto";
};

export type EsendexSendResult = {
  ok: true;
  providerId: string | null;
  batchId: string | null;
  rawStatus: number;
};

export type EsendexSendFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type EsendexDispatchResult = EsendexSendResult | EsendexSendFailure;

export type EsendexInboxMessage = {
  id: string;
  from: string;
  to?: string;
  body: string;
  receivedAt?: string | null;
};

export type EsendexFetch = (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{
  status: number;
  ok: boolean;
  text(): Promise<string>;
}>;

function trimOriginator(value?: string | null): string | undefined {
  const v = String(value || "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, 11);
  return v || undefined;
}

export function resolveEsendexCredentials(input?: {
  user?: string | null;
  password?: string | null;
  apiKey?: string | null;
  accountRef?: string | null;
  originator?: string | null;
  env?: NodeJS.ProcessEnv;
}): EsendexCredentials | null {
  const env = input?.env || process.env;
  const user = String(input?.user || env.ESENDEX_API_USER || "").trim();
  const password = String(
    input?.password || input?.apiKey || env.ESENDEX_API_PASSWORD || env.ESENDEX_API_KEY || ""
  ).trim();
  const accountRef = String(input?.accountRef || env.ESENDEX_ACCOUNT_REF || "").trim();
  const originator = trimOriginator(input?.originator || env.ESENDEX_DEFAULT_ORIGINATOR || "Reborn");
  if (!user || !password || !accountRef) return null;
  return { user, password, accountRef, originator };
}

export function esendexBasicAuth(creds: Pick<EsendexCredentials, "user" | "password">): string {
  return `Basic ${Buffer.from(`${creds.user}:${creds.password}`).toString("base64")}`;
}

export function mapEsendexHttpError(status: number, bodyText: string): EsendexSendFailure {
  const text = String(bodyText || "").slice(0, 400);
  const map: Record<number, { code: string; message: string }> = {
    400: { code: "request_invalid", message: text || "Invalid Esendex request" },
    401: { code: "unauthorized", message: "Esendex authentication failed" },
    402: { code: "payment_required", message: "Esendex account has no SMS credits" },
    403: { code: "forbidden", message: "Esendex rejected the request" },
    404: { code: "not_found", message: "Esendex resource not found" },
    406: { code: "empty_body", message: "Esendex rejected an empty message body" },
    415: { code: "unsupported_media", message: "Esendex rejected the content type" },
  };
  const mapped = map[status] || {
    code: "provider_error",
    message: text || `Esendex HTTP ${status}`,
  };
  return { ok: false, status, code: mapped.code, message: mapped.message };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractHeaderId(payload: unknown): { providerId: string | null; batchId: string | null } {
  const root = payload as {
    batch?: {
      batchid?: string;
      messageheaders?: Array<{ id?: string }>;
    };
    messageheaders?: { batchid?: string; messageheader?: { id?: string } | Array<{ id?: string }> };
  } | null;
  if (!root || typeof root !== "object") return { providerId: null, batchId: null };
  const batchId = root.batch?.batchid || root.messageheaders?.batchid || null;
  const headers = root.batch?.messageheaders;
  if (Array.isArray(headers) && headers[0]?.id) {
    return { providerId: String(headers[0].id), batchId };
  }
  const xmlish = root.messageheaders?.messageheader;
  if (Array.isArray(xmlish) && xmlish[0]?.id) return { providerId: String(xmlish[0].id), batchId };
  if (xmlish && !Array.isArray(xmlish) && xmlish.id) {
    return { providerId: String(xmlish.id), batchId };
  }
  return { providerId: null, batchId };
}

export class EsendexClient {
  constructor(
    private readonly creds: EsendexCredentials,
    private readonly fetchImpl: EsendexFetch = globalThis.fetch.bind(globalThis) as EsendexFetch
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: esendexBasicAuth(this.creds),
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  }

  async sendSms(input: EsendexSendInput): Promise<EsendexDispatchResult> {
    const body = String(input.body || "").trim();
    if (!body) return { ok: false, status: 406, code: "empty_body", message: "Empty message body" };
    const to = String(input.to || "").replace(/\D/g, "");
    if (!to) return { ok: false, status: 400, code: "request_invalid", message: "Missing recipient" };

    const originator = trimOriginator(input.originator || this.creds.originator);
    const payload: Record<string, unknown> = {
      accountreference: this.creds.accountRef,
      messages: [
        {
          to,
          body,
          type: "SMS",
          characterset: input.characterSet || "Auto",
          ...(originator ? { from: originator } : {}),
        },
      ],
    };

    const res = await this.fetchImpl(`${ESENDEX_API_BASE}/messagedispatcher`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) return mapEsendexHttpError(res.status, text);
    const parsed = extractHeaderId(parseJson(text));
    return {
      ok: true,
      providerId: parsed.providerId,
      batchId: parsed.batchId,
      rawStatus: res.status,
    };
  }

  async getMessageHeader(id: string): Promise<{ status: string | null; raw: unknown }> {
    const res = await this.fetchImpl(`${ESENDEX_API_BASE}/messageheaders/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: this.headers(),
    });
    const text = await res.text();
    if (!res.ok) return { status: null, raw: { error: text, http: res.status } };
    const raw = parseJson(text);
    const status =
      raw && typeof raw === "object"
        ? String((raw as { status?: string; messageheader?: { status?: string } }).status ||
            (raw as { messageheader?: { status?: string } }).messageheader?.status ||
            "") || null
        : null;
    return { status, raw };
  }

  async listInbox(opts?: { start?: string; finish?: string }): Promise<EsendexInboxMessage[]> {
    const qs = new URLSearchParams();
    if (opts?.start) qs.set("start", opts.start);
    if (opts?.finish) qs.set("finish", opts.finish);
    const suffix = qs.toString() ? `?${qs}` : "";
    const res = await this.fetchImpl(`${ESENDEX_API_BASE}/inbox/messages${suffix}`, {
      method: "GET",
      headers: this.headers(),
    });
    const text = await res.text();
    if (!res.ok) return [];
    const raw = parseJson(text) as {
      messageheaders?: {
        messageheader?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    } | null;
    const headers = raw?.messageheaders?.messageheader;
    const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
    return list.map((row) => ({
      id: String(row.id || row.Id || ""),
      from: String(row.from || row.originator || row.From || ""),
      to: row.to ? String(row.to) : undefined,
      body: String(
        (row.body && typeof row.body === "object"
          ? (row.body as { text?: string }).text
          : row.summary || row.body || "") || ""
      ),
      receivedAt: row.receivedat ? String(row.receivedat) : null,
    }));
  }
}
