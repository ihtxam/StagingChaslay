import { useCallback, useEffect, useState } from 'react';
import { APP_NAME } from '@/lib/brand';

type ComponentStatus = {
  status: 'ok' | 'error';
  latencyMs?: number;
};

type StatusPayload = {
  status: 'operational' | 'degraded';
  updatedAt: string;
  components: Record<string, ComponentStatus>;
};

const SERVICES = [
  { key: 'api', label: 'API', hint: 'app.chaslay.com / api.chaslay.com' },
  { key: 'database', label: 'Database', hint: 'PostgreSQL' },
  { key: 'dashboard', label: 'Admin panel', hint: 'app.chaslay.com' },
  { key: 'shop', label: 'Online shop', hint: 'shop.chaslay.com' },
  { key: 'pay', label: 'Digital receipts', hint: 'pay.chaslay.com' },
] as const;

function statusLabel(status: 'ok' | 'error' | 'loading') {
  if (status === 'loading') return 'Checking…';
  return status === 'ok' ? 'Operational' : 'Issue detected';
}

function statusClass(status: 'ok' | 'error' | 'loading') {
  if (status === 'loading') return 'bg-stone-100 text-stone-600';
  return status === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800';
}

export default function StatusPage() {
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/public/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPayload((await res.json()) as StatusPayload);
    } catch {
      setError('Could not reach the status API.');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const overall = error ? 'degraded' : payload?.status || (loading ? 'operational' : 'degraded');

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-xl px-4 py-10">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{APP_NAME}</p>
          <h1 className="mt-1 text-2xl font-bold">System status</h1>
          <p className="mt-2 text-sm text-stone-600">
            Live health for Chaslay POS, shop, and receipts.
          </p>
        </header>

        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
            overall === 'operational'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          {loading && !payload ? 'Checking services…' : overall === 'operational' ? 'All systems operational' : 'Some services need attention'}
        </div>

        <ul className="mt-6 space-y-3">
          {SERVICES.map(({ key, label, hint }) => {
            const comp = payload?.components[key];
            const state: 'ok' | 'error' | 'loading' = loading && !comp
              ? 'loading'
              : comp?.status === 'ok'
                ? 'ok'
                : comp
                  ? 'error'
                  : 'error';
            return (
              <li key={key} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-stone-500">{hint}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(state)}`}>
                    {statusLabel(state)}
                  </span>
                  {comp?.latencyMs != null ? (
                    <p className="mt-1 text-[11px] text-stone-400">{comp.latencyMs} ms</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-stone-500">
          {payload?.updatedAt ? (
            <span>Updated {new Date(payload.updatedAt).toLocaleString()}</span>
          ) : null}
          <button type="button" className="text-teal-700 font-medium hover:underline" onClick={() => void load()}>
            Refresh
          </button>
          <a href="https://app.chaslay.com/" className="text-teal-700 font-medium hover:underline">
            Back to app
          </a>
        </div>
      </div>
    </div>
  );
}
