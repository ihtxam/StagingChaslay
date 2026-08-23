/** Parse comma-separated or array ID lists (shared with dashboard CMS). */
export function parseIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw === 'string') return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
  return []
}
