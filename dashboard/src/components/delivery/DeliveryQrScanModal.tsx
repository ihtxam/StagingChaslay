import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { parseDriverClaimUrl } from '@/lib/delivery-claim-url';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (orderId: string, token: string) => void;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export default function DeliveryQrScanModal({ open, onClose, onScan }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const stopCamera = useCallback(() => {
    if (loopRef.current != null) {
      window.cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const handleParsed = useCallback(
    (raw: string) => {
      const parsed = parseDriverClaimUrl(raw);
      if (!parsed) return false;
      onScan(parsed.orderId, parsed.token);
      onClose();
      return true;
    },
    [onClose, onScan]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setPasteValue('');
      setCameraError(null);
      return;
    }

    const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
      .BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('deliveryScanCameraUnavailable'));
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
        video.srcObject = stream;
        await video.play();
        setScanning(true);
        const detector = new Detector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            for (const code of codes) {
              if (code.rawValue && handleParsed(code.rawValue)) return;
            }
          } catch {
            /* frame skip */
          }
          loopRef.current = window.requestAnimationFrame(() => void tick());
        };
        loopRef.current = window.requestAnimationFrame(() => void tick());
      } catch {
        if (!cancelled) setCameraError(t('deliveryScanCameraDenied'));
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, handleParsed, stopCamera, t]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2 font-bold text-stone-900">
            <Camera size={18} />
            {t('deliveryScanQrTitle')}
          </div>
          <button type="button" className="rounded-lg p-1 hover:bg-stone-100" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm text-stone-600">{t('deliveryScanQrHint')}</p>

          {cameraError ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {cameraError}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-black">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted />
              {scanning ? (
                <p className="bg-stone-900 px-3 py-2 text-center text-xs font-medium text-white">
                  {t('deliveryScanQrAiming')}
                </p>
              ) : null}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-600">{t('deliveryScanPasteLabel')}</label>
            <textarea
              className="input min-h-[4rem] w-full text-sm"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder={t('deliveryScanPastePlaceholder')}
            />
            <button
              type="button"
              className="mt-2 w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-40"
              disabled={!pasteValue.trim()}
              onClick={() => {
                if (!handleParsed(pasteValue.trim())) {
                  setCameraError(t('deliveryScanInvalidQr'));
                }
              }}
            >
              {t('deliveryScanConfirmPaste')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
