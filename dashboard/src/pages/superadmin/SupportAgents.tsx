import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Agent = {
  id: string;
  name: string;
  email: string;
  role?: string;
  handlesSupport: boolean;
};

export default function SupportAgents() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/superadmin/support/agents');
      setAgents(res.data.agents || []);
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Load failed'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (agent: Agent) => {
    setSavingId(agent.id);
    try {
      const res = await api.patch(`/superadmin/support/agents/${agent.id}`, {
        handlesSupport: !agent.handlesSupport,
      });
      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, ...res.data.agent } : a))
      );
      toast.success(t('saved'));
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Save failed'
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('supportAgentsTitle')}</h1>
        <p className="text-sm text-stone-600 mt-1">{t('supportAgentsHint')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">{t('loading')}</p>
      ) : (
        <ul className="space-y-2">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-stone-900">{agent.name}</p>
                <p className="text-xs text-stone-500 truncate">{agent.email}</p>
                {agent.role ? (
                  <p className="text-[10px] uppercase tracking-wide text-stone-400 mt-0.5">{agent.role}</p>
                ) : null}
              </div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="rounded border-stone-300"
                  checked={!!agent.handlesSupport}
                  disabled={savingId === agent.id}
                  onChange={() => void toggle(agent)}
                />
                {t('supportAgentsToggle')}
              </label>
            </li>
          ))}
          {!agents.length ? <p className="text-sm text-stone-500">—</p> : null}
        </ul>
      )}
    </div>
  );
}
