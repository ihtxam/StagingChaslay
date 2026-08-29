/** Multi-location / HQ addon — 0 = unlimited, 1 = single shop (default). */
export function isMultiLocationLicensed(input: {
  maxLocations?: number | null;
} | null | undefined): boolean {
  if (!input) return false;
  const n = Number(input.maxLocations);
  if (!Number.isFinite(n)) return false;
  return n === 0 || n > 1;
}
