import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ymdZurich, zurichDayBounds } from "@/lib/vacation";

type Db = ReturnType<typeof getDb>;

const SHORT_WEB_RE = /^WEB-(\d{1,6})$/;
const SCOPED_WEB_RE = /^WEB-([A-Z0-9]{4})-(\d{1,6})$/;
const LEGACY_WEB_RE = /^WEB-(\d{10,})(?:-([A-F0-9]{4,8}))?$/i;

/** Stable 4-char merchant code for globally unique WEB order numbers. */
export function merchantWebOrderCode(merchantId: string): string {
  const compact = String(merchantId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  if (compact.length >= 4) return compact.slice(-4);
  return compact.padStart(4, "0");
}

/** Display-friendly web order number — shortens legacy WEB-{timestamp}-{suffix} values. */
export function formatWebOrderNumberDisplay(orderNumber: string): string {
  const n = String(orderNumber || "").trim();
  if (!n) return n;
  if (SHORT_WEB_RE.test(n)) return n;
  const scoped = n.match(SCOPED_WEB_RE);
  if (scoped) return `WEB-${scoped[2]}`;
  const legacy = n.match(LEGACY_WEB_RE);
  if (legacy) {
    if (legacy[2]) return `WEB-${legacy[2]}`;
    return `WEB-${legacy[1].slice(-4)}`;
  }
  return n;
}

function parseShortWebSeq(orderNumber: string): number | null {
  const scoped = orderNumber.match(SCOPED_WEB_RE);
  if (scoped) {
    const seq = parseInt(scoped[2], 10);
    return Number.isFinite(seq) ? seq : null;
  }
  const m = orderNumber.match(SHORT_WEB_RE);
  if (!m) return null;
  const seq = parseInt(m[1], 10);
  return Number.isFinite(seq) ? seq : null;
}

function scopedWebOrderNumber(merchantId: string, seq: number): string {
  return `WEB-${merchantWebOrderCode(merchantId)}-${seq}`;
}

/** Next short WEB-xxxx number for a merchant (daily sequence, Europe/Zurich). */
export async function generateWebOrderNumber(db: Db, merchantId: string): Promise<string> {
  const { start, end } = zurichDayBounds(ymdZurich());
  const merchantCode = merchantWebOrderCode(merchantId);

  const rows = await db
    .select({ orderNumber: schema.orders.orderNumber })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.merchantId, merchantId),
        inArray(schema.orders.orderType, ["web_shop", "online"]),
        gte(schema.orders.createdAt, start),
        lte(schema.orders.createdAt, end)
      )
    );

  let maxSeq = 0;
  for (const row of rows) {
    const seq = parseShortWebSeq(row.orderNumber);
    if (seq != null) maxSeq = Math.max(maxSeq, seq);
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const seq = maxSeq + 1 + attempt;
    const candidate = scopedWebOrderNumber(merchantId, seq);
    const exists = await db.query.orders.findFirst({
      where: eq(schema.orders.orderNumber, candidate),
    });
    if (!exists) return candidate;
  }

  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `WEB-${merchantCode}-${maxSeq + 1}${rand}`;
}
