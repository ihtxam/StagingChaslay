import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Journey = {
  id: string;
  trigger: 'order_paid' | 'reservation_confirmed';
  enabled: boolean;
  subject: string;
  bodyHtml: string;
};

export default function MarketingAutomationPanel() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/growth/marketing-automation/settings');
      setJourneys(res.data.settings?.journeys || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string; error?: string } } };
      if (err.response?.data?.code !== 'MARKETING_AUTOMATION_ADDON') {
        toast.error(err.response?.data?.error || 'Failed to load automations');
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
      const res = await api.put('/merchant/growth/marketing-automation/settings', { settings: { journeys } });
      setJourneys(res.data.settings?.journeys || journeys);
      toast.success('Automations saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const update = (id: string, patch: Partial<Journey>) => {
    setJourneys((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  if (loading) return <p className="text-sm text-stone-500">Loading automations…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">Marketing automations</h3>
        <p className="text-xs text-stone-500">Triggered emails after orders and confirmed reservations (CHF 28/mo add-on).</p>
      </div>
      {journeys.map((j) => (
        <div key={j.id} className="space-y-2 rounded border border-stone-100 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={j.enabled}
              onChange={(e) => update(j.id, { enabled: e.target.checked })}
            />
            {j.trigger === 'order_paid' ? 'After paid order' : 'After confirmed reservation'}
          </label>
          <input
            className="input w-full text-sm"
            value={j.subject}
            onChange={(e) => update(j.id, { subject: e.target.value })}
            placeholder="Email subject"
          />
          <textarea
            className="input min-h-[80px] w-full text-sm"
            value={j.bodyHtml}
            onChange={(e) => update(j.id, { bodyHtml: e.target.value })}
            placeholder="HTML body — placeholders: {{name}} {{shopUrl}} {{businessName}}"
          />
        </div>
      ))}
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save automations'}
      </button>
    </div>
  );
}
