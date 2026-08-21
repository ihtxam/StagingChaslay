import api from '@/lib/api';
import { webPosDeviceId } from '@/lib/webpos-print-relay';

const SESSION_KEY = 'manupos_pos_session';

export const POS_SESSION_KICKED_EVENT = 'pos-session:kicked';

export type PosSessionKind = 'main' | 'waiter';
export type PosSessionPlatform = 'webpos' | 'waiter_web' | 'android';

type StoredPosSession = {
  sessionId: string;
  sessionKind: PosSessionKind;
  heartbeatIntervalSec: number;
};

let heartbeatTimer: number | null = null;
let visibilityHookInstalled = false;

function readStored(): StoredPosSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPosSession;
    if (!parsed?.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(session: StoredPosSession | null) {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

function stopHeartbeat() {
  if (heartbeatTimer != null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function notifySessionKicked() {
  stopHeartbeat();
  writeStored(null);
  window.dispatchEvent(new CustomEvent(POS_SESSION_KICKED_EVENT));
}

async function sendHeartbeat(sessionId: string) {
  try {
    await api.post('/merchant/pos/sessions/heartbeat', { sessionId });
  } catch (e: any) {
    const code = e?.response?.data?.code;
    if (code === 'POS_SESSION_EXPIRED' || e?.response?.status === 410) {
      notifySessionKicked();
    }
  }
}

function installVisibilityHeartbeat() {
  if (visibilityHookInstalled || typeof document === 'undefined') return;
  visibilityHookInstalled = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const stored = readStored();
    if (stored) void sendHeartbeat(stored.sessionId);
  });
}

function startHeartbeat(session: StoredPosSession) {
  stopHeartbeat();
  installVisibilityHeartbeat();
  const intervalMs = Math.max(15, session.heartbeatIntervalSec || 45) * 1000;
  void sendHeartbeat(session.sessionId);
  heartbeatTimer = window.setInterval(() => {
    void sendHeartbeat(session.sessionId);
  }, intervalMs);
}

export function posSessionDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Browser';
  const ua = navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobile/i.test(ua)) return 'Phone';
  return 'Browser POS';
}

export type RegisterPosSessionResult =
  | { ok: true; sessionId: string; kickedSessionIds: string[] }
  | { ok: false; error?: string };

/** Register or refresh a POS station session (last login wins when at post limit). */
export async function registerPosSession(opts: {
  sessionKind: PosSessionKind;
  platform: PosSessionPlatform;
  staffId?: string | null;
  staffName?: string | null;
  deviceLabel?: string;
}): Promise<RegisterPosSessionResult> {
  try {
    const res = await api.post('/merchant/pos/sessions/register', {
      sessionKind: opts.sessionKind,
      platform: opts.platform,
      deviceId: webPosDeviceId(),
      deviceLabel: opts.deviceLabel || posSessionDeviceLabel(),
      staffId: opts.staffId || null,
      staffName: opts.staffName || null,
    });
    const sessionId = String(res.data?.sessionId || '');
    if (!sessionId) {
      return { ok: false, error: 'Missing session id' };
    }
    const kickedSessionIds = Array.isArray(res.data?.kickedSessionIds)
      ? (res.data.kickedSessionIds as string[]).filter(Boolean)
      : [];
    const stored: StoredPosSession = {
      sessionId,
      sessionKind: opts.sessionKind,
      heartbeatIntervalSec: Number(res.data?.heartbeatIntervalSec) || 45,
    };
    writeStored(stored);
    startHeartbeat(stored);
    return { ok: true, sessionId, kickedSessionIds };
  } catch (e: any) {
    const error = e?.response?.data?.error || e?.message || 'Register failed';
    console.warn('[pos-session] register failed', e);
    return { ok: false, error: String(error) };
  }
}

export async function revokePosSession(): Promise<void> {
  const stored = readStored();
  stopHeartbeat();
  writeStored(null);
  if (!stored?.sessionId) return;
  try {
    await api.delete(`/merchant/pos/sessions/${stored.sessionId}`);
  } catch {
    /* best-effort */
  }
}

export function resumePosSessionHeartbeat(): void {
  const stored = readStored();
  if (stored) startHeartbeat(stored);
}

/** Stop heartbeat and drop local session (e.g. before PIN reclaim). */
export function clearPosSessionLocal(): void {
  stopHeartbeat();
  writeStored(null);
}

export type ActivePosSession = {
  id: string;
  sessionKind: PosSessionKind;
  platform: PosSessionPlatform;
  deviceId: string;
  deviceLabel?: string | null;
  staffName?: string | null;
  lastHeartbeat: string;
  createdAt: string;
};

export async function fetchActivePosSessions(): Promise<{
  limits: { maxPosPosts: number; maxWaiterPosts: number };
  sessions: { main: ActivePosSession[]; waiter: ActivePosSession[] };
}> {
  const res = await api.get('/merchant/pos/sessions');
  return {
    limits: res.data?.limits || { maxPosPosts: 0, maxWaiterPosts: 0 },
    sessions: res.data?.sessions || { main: [], waiter: [] },
  };
}

export async function kickPosSession(sessionId: string): Promise<void> {
  await api.delete(`/merchant/pos/sessions/${sessionId}`);
}
