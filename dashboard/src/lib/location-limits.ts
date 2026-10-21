export type LocationLimits = {
  maxLocations: number;
  currentCount: number;
};

/** Edition/license gate for creating another branch. maxLocations 0 = unlimited. */
export function canAddLocation(limits: LocationLimits | null | undefined): boolean {
  if (!limits) return true;
  if (limits.maxLocations <= 0) return true;
  return limits.currentCount < limits.maxLocations;
}

export function isAtLocationLimit(limits: LocationLimits | null | undefined): boolean {
  if (!limits) return false;
  if (limits.maxLocations <= 0) return false;
  return limits.currentCount >= limits.maxLocations;
}
