import assert from 'node:assert/strict';

// Inline copy of split patterns (keep in sync with webpos-receipt.ts RECEIPT_GLUED_* )
const RECEIPT_GLUED_VAT_SPLIT_RE = /(?<=[\w\d)])(?=(?:VAT|UID|TVA|MwSt|MWST)\s*:)/i;
const RECEIPT_GLUED_PHONE_SPLIT_RE =
  /(?<=[\wäöüÄÖÜßà-ÿ])(?=(?:Tel|Tél|Telephone|Téléphone|Phone)\s*:)/i;
const RECEIPT_GLUED_NUMBER_CITY_RE = /(?<=\d)(?=[A-Za-zÀ-ÿ]{2,})/;
const RECEIPT_GLUED_PLZ_AFTER_STREET_RE = /(?<=\d)(?=\d{4}\b)/;
const RECEIPT_GLUED_STREET_LABEL_RE =
  /(?<=[a-zà-ÿäöü])(?=(?:Rue|Rua|Route|Avenue|Av\.|Chemin|Place|Boulevard|Bd\.?|Rte)\b)/i;
const RECEIPT_GLUED_LOWERCASE_RUE_RE =
  /(?<=[a-zà-ÿäöü])(?=rue(?:\s+des)?\s)/;
const RECEIPT_GLUED_CAPS_STORE_STREET_RE =
  /(?<=[A-Z])(?=(?:Bahnhof|Haupt|Markt|Rue|Rua|Route|Avenue|Av\.|Chemin|Place|Boulevard|Bd\.?|Rte)\b)/i;
const RECEIPT_TAX_SPLIT_RE = /\s+(?=(?:VAT|UID|TVA|MwSt|MWST)\s*:)/i;
const RECEIPT_COUNTRY_SPLIT_RE =
  /(?:\s+|(?<=[a-zà-ÿ]))(?=(?:Suisse|Switzerland|Schweiz|France|Deutschland|Italy|Italia|Österreich|Austria)\b)/i;
const RECEIPT_DE_CH_STREET_SPLIT_RE =
  /(?<=[A-Za-zÀ-ÿäöüÄÖÜß])(?=(?:Bahnhof|Haupt|Markt|Neu|Alte|Obere|Untere)[A-Za-zÀ-ÿäöüÄÖÜß-]*(?:strasse|straße|Strasse|Straße|gasse|Gasse|weg|We|platz|Platz|allee|Allee)\b)/i;
const RECEIPT_DE_STREET_SPACED_RE =
  /\s+(?=(?:Bahnhof|Haupt|Markt|Neu|Alte|Obere|Untere)[A-Za-zÀ-ÿäöüÄÖÜß-]*(?:strasse|straße|Strasse|Straße|gasse|Gasse|weg|We|platz|Platz|allee|Allee)\b)/i;
const RECEIPT_STREET_SPLIT_RE =
  /\s+(?=(?:Rue|Rue des|Route|Avenue|Av\.|Chemin|Place|Boulevard|Bd\.?|Rte)\s+)/i;
const RECEIPT_STREET_SPLIT_CI_RE =
  /\s+(?=(?:rue|rue des|route|avenue|av\.|chemin|place|boulevard|bd\.?|rte)\s+)/i;
const RECEIPT_PLZ_SPLIT_RE = /\s+(?=\d{4}\s+[A-Za-zÀ-ÿ])/;
const RECEIPT_PHONE_LINE_RE =
  /\s+((?:tel|t[eé]l|telephone|t[eé]l[eé]phone|phone)\s*:\s*.+)$/i;

function splitReceiptHeaderSegment(line, pattern) {
  const text = String(line || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const parts = text.split(pattern).map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text];
}

function splitReceiptHeaderDetailLine(line) {
  const raw = String(line || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const spaced = raw.replace(
    /([^\s:])(?=(?:tel|t[eé]l|telephone|t[eé]l[eé]phone|phone|vat|tva|mwst|uid)\s*:)/gi,
    '$1 '
  );
  let parts = [spaced].filter(Boolean);
  for (const re of [
    RECEIPT_GLUED_VAT_SPLIT_RE,
    RECEIPT_GLUED_PHONE_SPLIT_RE,
    RECEIPT_GLUED_NUMBER_CITY_RE,
    RECEIPT_GLUED_PLZ_AFTER_STREET_RE,
    RECEIPT_GLUED_STREET_LABEL_RE,
    RECEIPT_GLUED_LOWERCASE_RUE_RE,
    RECEIPT_GLUED_CAPS_STORE_STREET_RE,
    RECEIPT_TAX_SPLIT_RE,
    RECEIPT_COUNTRY_SPLIT_RE,
    RECEIPT_DE_CH_STREET_SPLIT_RE,
    RECEIPT_DE_STREET_SPACED_RE,
    RECEIPT_STREET_SPLIT_RE,
    RECEIPT_STREET_SPLIT_CI_RE,
    RECEIPT_PLZ_SPLIT_RE,
  ]) {
    parts = parts.flatMap((p) => splitReceiptHeaderSegment(p, re));
  }
  const out = [];
  for (const part of parts) {
    const phoneMatch = part.match(RECEIPT_PHONE_LINE_RE);
    if (!phoneMatch) {
      out.push(part);
      continue;
    }
    const before = part.slice(0, phoneMatch.index).trim();
    const phone = phoneMatch[1].trim();
    if (before) out.push(before);
    out.push(phone);
  }
  return out.length ? out : [raw];
}

const nova = splitReceiptHeaderDetailLine(
  'Rue des Draizes 22SuisseRue des Draizes 44NeuchâtelTel: 032 558 45 65VAT: CHE-131.903.128'
);
assert.ok(nova.some((l) => /Rue des Draizes 22/i.test(l)));
assert.ok(nova.some((l) => /Tel:\s*032/.test(l)));
assert.ok(nova.some((l) => /VAT:\s*CHE-131/.test(l)));

const pola = splitReceiptHeaderDetailLine('pola polarue des saars 1152000 Neuchâtel');
assert.deepEqual(pola, ['pola pola', 'rue des saars 115', '2000 Neuchâtel']);

console.log('receipt-header-split.test.mjs ok', nova);
