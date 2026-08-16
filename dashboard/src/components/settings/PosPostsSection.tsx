import { useCallback, useEffect, useState } from 'react';
import { Loader2, MonitorSmartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';
import {
  fetchActivePosSessions,
  kickPosSession,
  type ActivePosSession,
} from '@/lib/pos-session';

type Props = {
  maxPosPosts: number;
  maxWaiterPosts: number;
  onMaxPosPostsChange: (n: number) => void;
  onMaxWaiterPostsChange: (n: number) => void;
};

function platformLabel(platform: string, t: (k: string) => string) {
  if (platform === 'webpos') return t('posPostsPlatformWebpos');
  if (platform === 'waiter_web') return t('posPostsPlatformWaiterWeb');
  if (platform === 'android') return t('posPostsPlatformAndroid');
  return platform;
}

function SessionList({
  rows,
  onKick,
  kickingId,
  t,
}: {
  rows: ActivePosSession[];
  onKick: (id: string) => void;
  kickingId: string | null;
  t: (k: string) => string;
}) {
  if (!rows.length) {
    return <p className="text-sm muted">{t('posPostsNone')}</p>;
  }
  return (
    <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
      {rows.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium truncate">
              {s.deviceLabel || s.deviceId}
              {s.staffName ? ` · ${s.staffName}` : ''}
            </p>
            <p className="text-xs muted">
              {platformLabel(s.platform, t)} ·{' '}
              {new Date(s.lastHeartbeat).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            disabled={kickingId === s.id}
            onClick={() => onKick(s.id)}
            className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs"
          >
            {kickingId === s.id ? '…' : t('posPostsKick')}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function PosPostsSection({
  maxPosPosts,
  maxWaiterPosts,
  onMaxPosPostsChange,
  onMaxWaiterPostsChange,
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [main, setMain] = useState<ActivePosSession[]>([]);
  const [waiter, setWaiter] = useState<ActivePosSession[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchActivePosSessions();
      setMain(data.sessions.main || []);
      setWaiter(data.sessions.waiter || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), 30_000);
    return () => window.clearInterval(id);
  }, [reload]);

  const kick = async (sessionId: string) => {
    setKickingId(sessionId);
    try {
      await kickPosSession(sessionId);
      await reload();
      toast.success(t('posPostsKick'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally {
      setKickingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm muted">{t('posPostsHint')}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">{t('posPostsMaxMain')}</span>
          <input
            type="number"
            min={0}
            max={99}
            value={maxPosPosts}
            onChange={(e) => onMaxPosPostsChange(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
          <span className="text-xs muted">{t('posPostsUnlimited')} = 0</span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">{t('posPostsMaxWaiter')}</span>
          <input
            type="number"
            min={0}
            max={99}
            value={maxWaiterPosts}
            onChange={(e) => onMaxWaiterPostsChange(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2"
          />
          <span className="text-xs muted">{t('posPostsUnlimited')} = 0</span>
        </label>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        <MonitorSmartphone className="h-4 w-4" aria-hidden />
        {t('posPostsActiveMain')}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>
      <SessionList rows={main} onKick={(id) => void kick(id)} kickingId={kickingId} t={t} />

      <div className="text-sm font-medium">{t('posPostsActiveWaiter')}</div>
      <SessionList rows={waiter} onKick={(id) => void kick(id)} kickingId={kickingId} t={t} />
    </div>
  );
}
