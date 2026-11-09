export type PanelLang = "en" | "fr" | "de";

export function normalizePanelLang(locale?: string | null): PanelLang {
  const l = String(locale || "en")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (l === "fr") return "fr";
  if (l === "de") return "de";
  return "en";
}

export function panelIntlLocale(locale?: string | null): string {
  const lang = normalizePanelLang(locale);
  if (lang === "fr") return "fr-CH";
  if (lang === "de") return "de-CH";
  return "en-CH";
}

export function reportLocaleFromQuery(value: unknown): PanelLang | undefined {
  const l = String(value || "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (l === "fr" || l === "de" || l === "en") return l;
  return undefined;
}
