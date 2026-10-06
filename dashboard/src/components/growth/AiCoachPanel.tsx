import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Insight = {
  id: string;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
};

export default function AiCoachPanel() {
  const [periodLabel, setPeriodLabel] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const res = await api.get(`/merchant/growth/ai-coach/brief${refresh ? '?refresh=1' : ''}`);
      const brief = res.data.brief || {};
      setInsights(brief.insights || []);
      setPeriodLabel(brief.periodLabel || '');
      setGeneratedAt(brief.generatedAt || null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string; error?: string } } };
      if (err.response?.data?.code !== 'AI_COACH_ADDON') {
        toast.error(err.response?.data?.error || 'Failed to load coach brief');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.post('/merchant/growth/ai-coach/refresh');
      const brief = res.data.brief || {};
      setInsights(brief.insights || []);
      setPeriodLabel(brief.periodLabel || '');
      setGeneratedAt(brief.generatedAt || null);
      toast.success('Insights refreshed');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <p className="text-sm text-stone-500">Loading AI coach…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">AI insights coach</h3>
          <p className="text-xs text-stone-500">
            {periodLabel || 'Weekly brief'} · {generatedAt ? new Date(generatedAt).toLocaleString() : 'Not generated yet'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary text-sm" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <ul className="space-y-3">
        {insights.map((i) => (
          <li key={i.id} className="rounded border border-stone-100 p-3">
            <p className="text-xs font-semibold uppercase text-stone-500">{i.priority}</p>
            <p className="font-medium text-stone-900">{i.title}</p>
            <p className="text-sm text-stone-600">{i.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
