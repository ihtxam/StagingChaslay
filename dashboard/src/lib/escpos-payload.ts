/** True when payload looks like ESC/POS (starts with ESC @). */
export function isEscPosBytePayload(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1b && bytes[1] === 0x40;
}

export function isEscPosBase64(dataBase64: string): boolean {
  const b64 = String(dataBase64 || '').trim();
  if (b64.length < 8) return false;
  try {
    const head = atob(b64.slice(0, Math.min(24, b64.length)));
    return head.charCodeAt(0) === 0x1b && head.charCodeAt(1) === 0x40;
  } catch {
    return false;
  }
}

/** ESC/POS cash drawer kick (pin 2): ESC p m t1 t2 — no ESC @ init. */
export function isDrawerKickBase64(dataBase64: string): boolean {
  const b64 = String(dataBase64 || '').trim();
  if (b64.length < 4) return false;
  try {
    const head = atob(b64.slice(0, Math.min(16, b64.length)));
    return (
      head.length >= 5 &&
      head.charCodeAt(0) === 0x1b &&
      head.charCodeAt(1) === 0x70 &&
      head.charCodeAt(2) === 0x00
    );
  } catch {
    return false;
  }
}

/** TSPL label jobs (SIZE …) sent RAW to Gprinter/TSC-style agents. */
export function isTsplRawBase64(dataBase64: string): boolean {
  const b64 = String(dataBase64 || '').trim();
  if (b64.length < 8) return false;
  try {
    const head = atob(b64.slice(0, Math.min(32, b64.length))).toUpperCase();
    return (
      head.startsWith('SIZE ') ||
      head.startsWith('CLS\r') ||
      head.startsWith('CLS\n') ||
      head.startsWith('GAP ') ||
      head.startsWith('DOWNLOAD ')
    );
  } catch {
    return false;
  }
}

/** Payloads safe to POST /print as raw bytes (ESC/POS tickets, drawer kick, TSPL). */
export function isValidAgentRawPrintBase64(dataBase64: string): boolean {
  return (
    isEscPosBase64(dataBase64) ||
    isDrawerKickBase64(dataBase64) ||
    isTsplRawBase64(dataBase64)
  );
}
