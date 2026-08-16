/** Detect Postgres "undefined column/relation" errors from Drizzle/pg. */
export function isMissingSchemaError(raw: string): boolean {
  return /does not exist|undefined column|unknown column|column .* does not exist/i.test(raw);
}

/** Extract snake_case column name from a Postgres missing-column error, if present. */
export function missingColumnFromError(raw: string): string | null {
  const m =
    raw.match(/column "([a-z0-9_]+)" (?:of relation "[^"]+" )?does not exist/i) ||
    raw.match(/column ([a-z0-9_]+) does not exist/i);
  return m?.[1] ?? null;
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
  for (const [key, hint] of Object.entries(COLUMN_HINTS)) {
    if (raw.includes(key)) return hint.message;
  }
  return raw || fallback;
}

export function migrateLogTag(raw: string): string | null {
  const col = missingColumnFromError(raw);
  if (col && COLUMN_HINTS[col]) return COLUMN_HINTS[col].logTag;
  for (const [key, hint] of Object.entries(COLUMN_HINTS)) {
    if (raw.includes(key)) return hint.logTag;
  }
  return isMissingSchemaError(raw) ? "unknown_column" : null;
}
