/** Normalize #5126 / D-5126 / 0-5126 / P-5126 so search finds the shout number. */
export function ticketSearchTokens(value?: string | null): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const tokens = new Set<string>([raw.toLowerCase()]);
  const compact = raw.replace(/[#\s]/g, '').toLowerCase();
  if (compact) tokens.add(compact);
  const digits = compact.replace(/^[a-z]+-?/i, '').replace(/^0+/, '');
  if (digits) tokens.add(digits);
  const bare = raw.replace(/^#/, '').trim().toLowerCase();
  if (bare) tokens.add(bare);
  return [...tokens];
}

export function ticketQueryMatches(query: string, ...values: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const compactQ = q.replace(/[#\s]/g, '');
  const hayTokens = values.flatMap((v) => ticketSearchTokens(v));
  if (/^\d+$/.test(compactQ)) {
    return hayTokens.some((tok) => {
      const norm = tok.replace(/[#\s]/g, '').replace(/^[a-z]+-?/i, '');
      const digits = norm.replace(/^0+/, '') || norm;
      if (digits === compactQ || tok === compactQ || tok === `#${compactQ}`) return true;
      // Partial ticket / tab numbers (e.g. "39" → #3929).
      if (compactQ.length >= 2 && (digits.includes(compactQ) || norm.includes(compactQ))) {
        return true;
      }
      return false;
    });
  }
  const qTokens = ticketSearchTokens(q);
  const hay = hayTokens.join(' ');
  if (hay.includes(q)) return true;
  return qTokens.some((tok) => tok.length >= 3 && hay.includes(tok));
}
