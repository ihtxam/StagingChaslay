export type GeolocationErrorKey =
  | 'deliveryGeoDenied'
  | 'deliveryGeoDeniedHint'
  | 'deliveryGeoTimeout'
  | 'deliveryGeoUnavailable'
  | 'deliveryGeoInsecure';

export function geolocationErrorKey(error: GeolocationPositionError): GeolocationErrorKey {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'deliveryGeoDenied';
    case error.TIMEOUT:
      return 'deliveryGeoTimeout';
    case error.POSITION_UNAVAILABLE:
      return 'deliveryGeoUnavailable';
    default:
      return 'deliveryGeoUnavailable';
  }
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs =
    navigator.platform === 'MacIntel' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return (isAppleMobile || isIpadOs) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function queryGeolocationPermission(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return null;
  }
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** iOS Safari needs getCurrentPosition in the tap handler before watchPosition. */
export async function acquireDriverPosition(): Promise<GeolocationPosition> {
  if (!window.isSecureContext) {
    throw Object.assign(new Error('insecure'), { geoKey: 'deliveryGeoInsecure' as const });
  }
  if (!navigator.geolocation) {
    throw Object.assign(new Error('unsupported'), { geoKey: 'deliveryGeoUnavailable' as const });
  }

  const perm = await queryGeolocationPermission();
  if (perm === 'denied') {
    throw Object.assign(new Error('denied'), { geoKey: 'deliveryGeoDenied' as const });
  }

  const highAccuracy: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 20000,
  };
  const lowAccuracy: PositionOptions = {
    enableHighAccuracy: false,
    maximumAge: 60000,
    timeout: 25000,
  };

  try {
    return await getCurrentPosition(highAccuracy);
  } catch (first) {
    const err = first as GeolocationPositionError;
    if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
      return getCurrentPosition(lowAccuracy);
    }
    throw first;
  }
}

export function startDriverPositionWatch(
  onPosition: (pos: GeolocationPosition) => void,
  onFatalError: (error: GeolocationPositionError) => void
): number {
  return navigator.geolocation.watchPosition(
    onPosition,
    (error) => {
      if (error.code === error.PERMISSION_DENIED) onFatalError(error);
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
  );
}
