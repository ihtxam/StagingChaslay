import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Rule = {
  id: string;
  tag: string;
  type: 'min_lifetime_spend' | 'min_orders' | 'lapsed_days';
  threshold: number;
  enabled: boolean;
};

export default function SmartSegmentsPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [lastAppliedAt, setLastAppliedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/growth/smart-segments/settings');
      setRules(res.data.settings?.rules || []);
      setLastAppliedAt(res.data.settings?.lastAppliedAt || null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string } } };
      if (err.response?.data?.code !== 'SMART_SEGMENTS_ADDON') {
        toast.error('Failed to load segment rules');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/merchant/growth/smart-segments/settings', { settings: { rules, lastAppliedAt } });
      toast.success('Segment rules saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const res = await api.post('/merchant/growth/smart-segments/apply');
      setLastAppliedAt(res.data.lastAppliedAt || null);
      toast.success(`Applied tags to ${res.data.updated} guests`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const addRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        tag: 'VIP',
        type: 'min_lifetime_spend',
        threshold: 200,
        enabled: true,
      },
    ]);
  };

  if (loading) return <p className="text-sm text-stone-500">Loading segments…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">Smart segments</h3>
        <p className="text-xs text-stone-500">Auto-tag guests for CRM and campaigns. Last applied: {lastAppliedAt || 'never'}.</p>
      </div>
      {rules.map((r, idx) => (
        <div key={r.id} className="grid gap-2 rounded border border-stone-100 p-3 sm:grid-cols-4">
          <input
            className="input text-sm"
            value={r.tag}
            onChange={(e) => {
              const tag = e.target.value;
              setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, tag } : x)));
            }}
            placeholder="Tag"
          />
          <select
            className="input text-sm"
            value={r.type}
            onChange={(e) => {
              const type = e.target.value as Rule['type'];
              setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, type } : x)));
            }}
          >
            <option value="min_lifetime_spend">Min spend (CHF)</option>
            <option value="min_orders">Min orders</option>
            <option value="lapsed_days">Lapsed (days)</option>
          </select>
          <input
            type="number"
            className="input text-sm"
            value={r.threshold}
            onChange={(e) => {
              const threshold = Number(e.target.value) || 0;
              setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, threshold } : x)));
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={r.enabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setRules((prev) => prev.map((x, i) => (i === idx ? { ...x, enabled } : x)));
              }}
            />
            Active
          </label>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={addRule}>
          Add rule
        </button>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          Save rules
        </button>
        <button type="button" className="btn btn-primary" disabled={applying} onClick={() => void apply()}>
          {applying ? 'Applying…' : 'Apply tags now'}
        </button>
      </div>
    </div>
  );
}
