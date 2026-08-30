export function isCameraAvailable(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Prefer rear camera when present; fall back to any camera (kiosk tablets, USB webcams). */
export async function acquireCameraStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export function describeCameraAccessError(err: unknown): string {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera access denied. Allow camera in your browser settings, then tap Scan again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera found on this device. Use a USB scanner or skip.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera is in use by another app. Close it and try again.';
  }
  if (name === 'SecurityError') {
    return 'Camera requires a secure connection (HTTPS). Open the kiosk over HTTPS.';
  }
  if (name === 'OverconstrainedError') {
    return 'Could not open the camera. Check device permissions and try again.';
  }
  return 'Could not access the camera. Check permissions and try again.';
}
