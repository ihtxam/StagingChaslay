/** Strip whitespace so wrapped/stored base64 still decodes. */
export function normalizeAgentPrintBase64(dataBase64: string): string {
  return String(dataBase64 || '')
    .replace(/\s+/g, '')
    .trim();
}

/** True when payload looks like ESC/POS (starts with ESC @). */
export function isEscPosBytePayload(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1b && bytes[1] === 0x40;
}

export function isEscPosBase64(dataBase64: string): boolean {
  const b64 = normalizeAgentPrintBase64(dataBase64);
  if (b64.length < 4) return false;
  try {
    const head = atob(b64.slice(0, Math.min(24, b64.length)));
    return head.length >= 2 && head.charCodeAt(0) === 0x1b && head.charCodeAt(1) === 0x40;
  } catch {
    return false;
  }
}

/** ESC/POS cash drawer kick: ESC p m t1 t2 — no ESC @ init (pin 2 = 0x00, pin 5 = 0x01). */
export function isDrawerKickBase64(dataBase64: string): boolean {
  const b64 = normalizeAgentPrintBase64(dataBase64);
  if (b64.length < 4) return false;
  try {
    const head = atob(b64.slice(0, Math.min(16, b64.length)));
    const pin = head.charCodeAt(2);
    return (
      head.length >= 5 &&
      head.charCodeAt(0) === 0x1b &&
      head.charCodeAt(1) === 0x70 &&
      (pin === 0x00 || pin === 0x01)
    );
  } catch {
    return false;
  }
}

/** Feed + cut trailer (legacy BT follow-up jobs without a full ticket). */
export function isEscPosCutTrailerBase64(dataBase64: string): boolean {
  const b64 = normalizeAgentPrintBase64(dataBase64);
  if (b64.length < 4) return false;
  try {
    const head = atob(b64.slice(0, Math.min(16, b64.length)));
    if (head.length >= 2 && head.charCodeAt(0) === 0x1d && head.charCodeAt(1) === 0x56) return true;
    if (
      head.length >= 3 &&
      head.charCodeAt(0) === 0x1b &&
      head.charCodeAt(1) === 0x64 &&
      head.charCodeAt(2) <= 0x0a
    ) {
      return head.includes(String.fromCharCode(0x1d, 0x56));
    }
    return false;
  } catch {
    return false;
  }
}

/** TSPL label jobs (SIZE …) sent RAW to Gprinter/TSC-style agents. */
export function isTsplRawBase64(dataBase64: string): boolean {
  const b64 = normalizeAgentPrintBase64(dataBase64);
  if (b64.length < 8) return false;
  try {
    const head = atob(b64.slice(0, Math.min(48, b64.length))).toUpperCase();
    return (
      head.startsWith('SIZE ') ||
      head.startsWith('CLS\r') ||
      head.startsWith('CLS\n') ||
      head.startsWith('GAP ') ||
      head.startsWith('DOWNLOAD ') ||
      head.startsWith('DIRECTION ') ||
      head.startsWith('REFERENCE ') ||
      head.startsWith('CODEPAGE ') ||
      head.startsWith('BITMAP ')
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
    isEscPosCutTrailerBase64(dataBase64) ||
    isTsplRawBase64(dataBase64)
  );
}

export type AgentPrintValidationIssue = 'empty' | 'invalid_base64' | 'not_raw_print';

/** Classify why agent raw print validation failed (for clearer operator toasts). */
export function classifyAgentPrintBase64(dataBase64: string): AgentPrintValidationIssue | null {
  const b64 = normalizeAgentPrintBase64(dataBase64);
  if (!b64) return 'empty';
  if (isValidAgentRawPrintBase64(b64)) return null;
  try {
    atob(b64.slice(0, Math.min(24, b64.length)));
  } catch {
    return 'invalid_base64';
  }
  return 'not_raw_print';
}

export function agentPrintValidationErrorMessage(issue: AgentPrintValidationIssue): string {
  if (issue === 'empty') {
    return 'Print payload is empty — hard-refresh Web POS and print again.';
  }
  if (issue === 'invalid_base64') {
    return 'Print data is corrupt (invalid base64). Hard-refresh Web POS and print again.';
  }
  return 'Print data is not valid ESC/POS (corrupt or truncated). Hard-refresh Web POS and print again.';
}
