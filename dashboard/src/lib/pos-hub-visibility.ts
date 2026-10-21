import { hasEditionFeature, type EditionFeatureKey } from './edition-features';
import { isMultiLocationLicensed } from './locations-addon';

export type ReservationsVisibilityInput = {
  isRetail?: boolean | null;
  reservationsEnabled?: boolean | null;
  editionFeatures?: readonly string[] | null;
};

/**
 * Existing reservations gate used by POS bookings UI:
 * restaurant only, module/addon on (`reservationsEnabled`), edition `reservations`
 * (null editionFeatures = legacy full catalog).
 */
export function shouldShowOnlineReservationsToggle(
  input: ReservationsVisibilityInput
): boolean {
  if (input.isRetail) return false;
  if (!input.reservationsEnabled) return false;
  return hasEditionFeature(
    (input.editionFeatures ?? null) as EditionFeatureKey[] | null,
    'reservations'
  );
}

/** Settings Reservations tab / search: licensed restaurant, even if the module is still off. */
export function shouldShowReservationsSettings(input: ReservationsVisibilityInput): boolean {
  if (input.isRetail) return false;
  return hasEditionFeature(
    (input.editionFeatures ?? null) as EditionFeatureKey[] | null,
    'reservations'
  );
}

/** Hide location / till / terminal / POS-post pickers when there is nothing to choose. */
export function shouldShowPosOptionChooser(
  optionCount: number,
  maxPosPosts?: number | null
): boolean {
  const count = Number(optionCount) || 0;
  if (count <= 1) return false;
  const maxPosts = Number(maxPosPosts);
  if (Number.isFinite(maxPosts) && maxPosts === 1) return false;
  return true;
}

/** Location switcher: 2+ branches, or licensed HQ addon with room to add another branch. */
export function shouldShowLocationSwitcher(input: {
  locationCount: number;
  maxLocations?: number | null;
  maxPosPosts?: number | null;
}): boolean {
  const count = Number(input.locationCount) || 0;
  if (count > 1) {
    const maxPosts = Number(input.maxPosPosts);
    if (Number.isFinite(maxPosts) && maxPosts === 1) return false;
    return true;
  }
  if (!shouldShowPosOptionChooser(input.locationCount, input.maxPosPosts)) return false;
  if (input.maxLocations == null) return false;
  return isMultiLocationLicensed({ maxLocations: input.maxLocations });
}
