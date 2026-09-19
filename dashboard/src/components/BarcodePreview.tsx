import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

type BarcodePreviewProps = {
  value: string;
  height?: number;
  width?: number;
  className?: string;
  /** Human-readable digits under the bars (edit form / print preview). */
  displayValue?: boolean;
};

/** Renders a Code128-B barcode in the DOM (reliable vs raw SVG innerHTML). */
export function BarcodePreview({
  value,
  height = 36,
  width = 160,
  className,
  displayValue = false,
}: BarcodePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [invalid, setInvalid] = useState(false);
  const raw = String(value || '').trim();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    setInvalid(false);
    if (!raw) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, raw, {
        format: 'CODE128B',
        displayValue,
        fontSize: 14,
        textMargin: 1,
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
      setInvalid(true);
    }
  }, [raw, height, width, displayValue]);

  if (!raw) return null;

  if (invalid) {
    return (
      <span className={`text-[10px] font-mono text-amber-700 ${className || ''}`} title={raw}>
        {raw}
      </span>
    );
  }

  return <div ref={hostRef} className={className} role="img" aria-label={raw} />;
}
