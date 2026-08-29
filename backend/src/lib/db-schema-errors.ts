/** Flatten DrizzleQueryError / pg error chains into one searchable string. */
export function dbErrorChain(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current != null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      if (current.message) parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join("\n");
}

/** Detect Postgres "undefined column/relation" errors from Drizzle/pg. */
export function isMissingSchemaError(raw: string): boolean {
  return /does not exist|undefined column|unknown column|column .* does not exist/i.test(raw);
}

export function isMissingSchemaErrorFrom(error: unknown): boolean {
  return isMissingSchemaError(dbErrorChain(error));
}

/** Extract snake_case column name from a Postgres missing-column error, if present. */
export function missingColumnFromError(raw: string): string | null {
  const m =
    raw.match(/column "([a-z0-9_]+)" (?:of relation "[^"]+" )?does not exist/i) ||
    raw.match(/column ([a-z0-9_]+) does not exist/i);
  return m?.[1] ?? null;
}

export function missingColumnFromDbError(error: unknown): string | null {
  return missingColumnFromError(dbErrorChain(error));
}

/** Extract table name from Postgres missing-column / missing-relation errors. */
export function missingTableFromError(raw: string): string | null {
  const colRel = raw.match(/column "[^"]+" of relation "([a-z0-9_]+)" does not exist/i);
  if (colRel?.[1]) return colRel[1];
  const rel = raw.match(/relation ["']?([a-z0-9_]+)["']? does not exist/i);
  return rel?.[1] ?? null;
}

export function missingTableColumnFromDbError(
  error: unknown
): { table: string | null; column: string | null } {
  const raw = dbErrorChain(error);
  return {
    table: missingTableFromError(raw),
    column: missingColumnFromError(raw),
  };
}

/** Detect missing multi-location tables (locations, HQ catalog, per-location stock, etc.). */
export function isLocationsSchemaError(raw: string): boolean {
  return /relation ["']?(locations|merchant_staff_locations|hq_catalog_versions|location_catalog_links|location_product_overrides|pricing_bulk_jobs|hq_menus|inventory_location_stock|inventory_transfers|pos_shifts|pos_cash_movements)["']? does not exist/i.test(
    raw
  );
}

type MigrateHint = { message: string; logTag: string };

const COLUMN_HINTS: Record<string, MigrateHint> = {
  shifts_enabled: {
    logTag: "shifts",
    message:
      "Database is missing cash-shift columns. Run drizzle-kit push or backend/sql/ensure-shifts.sql.",
  },
  pos_color_theme: {
    logTag: "shifts",
    message:
      "Database is missing cash-shift columns. Run drizzle-kit push or backend/sql/ensure-shifts.sql.",
  },
  pos_shifts: {
    logTag: "shifts",
    message:
      "Database is missing pos_shifts. Run drizzle-kit push or backend/sql/ensure-shifts.sql.",
  },
  pos_cash_movements: {
    logTag: "cash_movements",
    message:
      "Database is missing pos_cash_movements. Run backend/sql/ensure-cash-movements.sql or drizzle-kit push.",
  },
  delivery_platform_settings: {
    logTag: "delivery_platforms",
    message:
      "Database is missing delivery_platform_settings. Run backend/sql/ensure-delivery-platforms.sql",
  },
  vat_after_discount: {
    logTag: "vat_after_discount",
    message:
      "Database is missing vat_after_discount. Run backend/sql/ensure-vat-after-discount.sql",
  },
  report_email_settings: {
    logTag: "report_email",
    message:
      "Database is missing report_email_settings. Run backend/sql/ensure-report-email-settings.sql",
  },
  email_brevo_settings: {
    logTag: "brevo",
    message:
      "Database is missing email_brevo_settings. Run backend/sql/ensure-merchant-brevo-settings.sql",
  },
  edition_id: {
    logTag: "editions",
    message:
      "Database is missing edition_id. Run backend/sql/ensure-editions-resellers.sql or drizzle-kit push.",
  },
};

/**
 * Map a raw DB error to a user-facing migration hint when we recognize the missing object.
 */
export function formatDbMigrateError(raw: string, fallback = "Failed to load settings"): string {
  if (!isMissingSchemaError(raw)) return raw || fallback;
  const col = missingColumnFromError(raw);
  if (col && COLUMN_HINTS[col]) return COLUMN_HINTS[col].message;
  const table = missingTableFromError(raw);
  if (table && COLUMN_HINTS[table]) return COLUMN_HINTS[table].message;
  return raw || fallback;
}

export function migrateLogTag(raw: string): string | null {
  const col = missingColumnFromError(raw);
  if (col && COLUMN_HINTS[col]) return COLUMN_HINTS[col].logTag;
  const table = missingTableFromError(raw);
  if (table && COLUMN_HINTS[table]) return COLUMN_HINTS[table].logTag;
  return isMissingSchemaError(raw) ? "unknown_column" : null;
}
