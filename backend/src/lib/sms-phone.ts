/**
 * E.164 phone normalisation for Esendex (MSISDN, no leading +).
 * Default country is CH unless the merchant overrides it.
 */

const DEFAULT_COUNTRY = "CH";

const COUNTRY_DIAL: Record<string, string> = {
  CH: "41",
  DE: "49",
  FR: "33",
  AT: "43",
  IT: "39",
  GB: "44",
  UK: "44",
  BE: "32",
  NL: "31",
  ES: "34",
  PT: "351",
  US: "1",
  CA: "1",
};

export type NormalizePhoneResult =
  | { ok: true; e164: string; display: string }
  | { ok: false; error: string };

function digitsOnly(raw: string): string {
  return String(raw || "").replace(/[^\d]/g, "");
}

export function defaultDialPrefix(country?: string | null): string {
  const key = String(country || DEFAULT_COUNTRY)
    .trim()
    .toUpperCase();
  return COUNTRY_DIAL[key] || COUNTRY_DIAL[DEFAULT_COUNTRY];
}

/**
 * Returns digits-only international MSISDN (no +), as Esendex REST expects.
 * Accepts +4179…, 004179…, 079… (with default country), or already-international 4179…
 */
export function normalizeE164(
  raw: string | null | undefined,
  defaultCountry: string = DEFAULT_COUNTRY
): NormalizePhoneResult {
  const input = String(raw || "").trim();
  if (!input) return { ok: false, error: "Phone number is required" };

  let digits = digitsOnly(input);
  if (input.startsWith("00")) {
    digits = digits.slice(2);
  } else if (input.startsWith("+")) {
    digits = digitsOnly(input.slice(1));
  } else if (digits.startsWith("0") && digits.length >= 8 && digits.length <= 12) {
    digits = `${defaultDialPrefix(defaultCountry)}${digits.slice(1)}`;
  }

  if (!/^\d{8,15}$/.test(digits)) {
    return { ok: false, error: "Enter a valid international phone number" };
  }
  return { ok: true, e164: digits, display: `+${digits}` };
}

export function phonesEqual(
  a: string | null | undefined,
  b: string | null | undefined,
  defaultCountry?: string
): boolean {
  const left = normalizeE164(a, defaultCountry);
  const right = normalizeE164(b, defaultCountry);
  return left.ok && right.ok && left.e164 === right.e164;
}

/** True if the inbound SMS body is an unsubscribe keyword (STOP / ARRET / STOPP). */
export function isSmsStopKeyword(body: string | null | undefined): boolean {
  const t = String(body || "")
    .trim()
    .toUpperCase()
    .replace(/[.!]+$/g, "");
  return (
    t === "STOP" ||
    t === "ARRET" ||
    t === "ARRÊT" ||
    t === "STOPP" ||
    t === "UNSUBSCRIBE" ||
    t === "STOP ALL"
  );
}
