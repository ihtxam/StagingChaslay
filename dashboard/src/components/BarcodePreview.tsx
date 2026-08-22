import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

type BarcodePreviewProps = {
  value: string;
  height?: number;
  width?: number;
  className?: string;
};

/** Renders a Code128 barcode in the DOM (reliable vs raw SVG innerHTML). */
export function BarcodePreview({ value, height = 36, width = 160, className }: BarcodePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const raw = String(value || '').trim();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (!raw) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, raw, {
        format: 'CODE128',
        displayValue: false,
        height,
        width: 2,
        margin: 2,
      });
      svg.setAttribute('width', String(width));
      svg.removeAttribute('height');
      svg.style.maxWidth = '100%';
      svg.style.height = 'auto';
      host.appendChild(svg);
    } catch {
      /* invalid barcode payload */
    }
  }, [raw, height, width]);

  if (!raw) return null;

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label={raw}
    />
  );
}
