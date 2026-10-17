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
