import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { startQrCameraScan } from '@/lib/qr-camera-scan';

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'];

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
};

export default function BarcodeScanModal({ open, onClose, onScan }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef<{ stop: () => void } | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    scanRef.current?.stop();
    scanRef.current = null;
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const submitCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (code.length < 3) return false;
      onScan(code);
      onClose();
      return true;
    },
    [onClose, onScan]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setManualCode('');
      setCameraError(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('storekeeperScanCameraUnavailable'));
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.setAttribute('playsinline', 'true');
        video.srcObject = stream;
        await video.play();
        setScanning(true);
        scanRef.current = startQrCameraScan(video, submitCode, BARCODE_FORMATS);
      } catch {
        if (!cancelled) setCameraError(t('storekeeperScanCameraDenied'));
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, submitCode, stopCamera, t]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-stone-900">
            <Camera size={18} />
            {t('storekeeperScanTitle')}
          </div>
          <button type="button" className="rounded-lg p-1 hover:bg-stone-100" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm text-stone-600">{t('storekeeperScanHint')}</p>

          {cameraError ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {cameraError}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
              {scanning ? (
                <p className="bg-stone-900 px-3 py-2 text-center text-xs font-medium text-white">
                  {t('storekeeperScanAiming')}
                </p>
              ) : null}
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitCode(manualCode);
            }}
          >
            <input
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              placeholder={t('storekeeperBarcodePlaceholder')}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
            <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white">
              {t('ok')}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
