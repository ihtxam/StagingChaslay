type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export type QrCameraScanHandle = {
  stop: () => void;
};

export function startQrCameraScan(
  video: HTMLVideoElement,
  onCode: (raw: string) => boolean,
  formats: string[] = ['qr_code']
): QrCameraScanHandle {
  let stopped = false;
  let loopId: number | null = null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const Detector = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  const detector = Detector ? new Detector({ formats }) : null;

  let jsQrDecode: ((data: Uint8ClampedArray, width: number, height: number) => { data: string } | null) | null =
    null;

  const stop = () => {
    stopped = true;
    if (loopId != null) {
      window.cancelAnimationFrame(loopId);
      loopId = null;
    }
  };

  const tickBarcodeDetector = async () => {
    if (stopped) return;
    try {
      const codes = await detector!.detect(video);
      for (const code of codes) {
        if (code.rawValue && onCode(code.rawValue)) {
          stop();
          return;
        }
      }
    } catch {
      /* frame skip */
    }
    loopId = window.requestAnimationFrame(() => void tickBarcodeDetector());
  };

  const tickJsQr = () => {
    if (stopped) return;
    if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && ctx && jsQrDecode) {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width > 0 && height > 0) {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQrDecode(imageData.data, imageData.width, imageData.height);
        if (code?.data && onCode(code.data)) {
          stop();
          return;
        }
      }
    }
    loopId = window.requestAnimationFrame(tickJsQr);
  };

  if (detector) {
    loopId = window.requestAnimationFrame(() => void tickBarcodeDetector());
  } else {
    void import('jsqr').then(({ default: jsQR }) => {
      if (stopped) return;
      jsQrDecode = (data, width, height) =>
        jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
      loopId = window.requestAnimationFrame(tickJsQr);
    });
  }

  return { stop };
}
