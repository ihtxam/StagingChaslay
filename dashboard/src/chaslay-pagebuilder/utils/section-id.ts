/** Normalize a section anchor id (no leading #). */
export function resolveSectionId(sectionId: string | undefined | null, fallback: string): string {
  const raw = String(sectionId || fallback).trim().replace(/^#/, '');
  return raw || fallback;
}
