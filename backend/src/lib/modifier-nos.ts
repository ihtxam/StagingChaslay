/** Modifier groups that represent removals / exclusions (Oracle Simphony-style "No's"). */
export function isNosModifierGroup(title: string): boolean {
  const key = title.trim().toLowerCase().replace(/['']/g, "'");
  return key === "no's" || key === "nos" || key === "no" || key === "removals";
}

/** Ticket / kitchen label: ensure exclusion modifiers read as "No …". */
export function ensureNosTicketName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return trimmed;
  if (/^no[\s\-.]/i.test(trimmed) || /^no$/i.test(trimmed)) return trimmed;
  return `No ${trimmed}`;
}

export function modifierOptionTicketName(name: string, groupTitle: string): string {
  return isNosModifierGroup(groupTitle) ? ensureNosTicketName(name) : name;
}
