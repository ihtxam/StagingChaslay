import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called when the reader finishes a scan (Enter). Receives the full UID. */
  onScanComplete?: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

const SCAN_GAP_MS = 100;

/**
 * HID keyboard-wedge RFID readers type the UID then send Enter.
 * Rapid key bursts are buffered locally; parent onChange is not called until Enter
 * (or manual typing with gaps longer than SCAN_GAP_MS).
 */
export default function RfidScanInput({
  value,
  onChange,
  onScanComplete,
  placeholder = 'Tap RFID card on reader…',
  className = 'input',
  autoFocus,
}: Props) {
  const [buffer, setBuffer] = useState('');
  const lastKeyAt = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const display = buffer || value;

  return (
    <input
      ref={inputRef}
      className={className}
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const now = Date.now();
        const gap = now - lastKeyAt.current;
        lastKeyAt.current = now;
        const wedge = gap < SCAN_GAP_MS || buffer.length > 0;
        if (wedge) {
          setBuffer(e.target.value);
        } else {
          onChange(e.target.value);
          setBuffer('');
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const scanned = (buffer || value).trim();
          if (scanned) {
            onChange(scanned);
            onScanComplete?.(scanned);
            setBuffer('');
          }
        }
      }}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
