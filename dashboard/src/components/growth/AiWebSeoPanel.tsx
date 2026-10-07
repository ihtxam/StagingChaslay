import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Suggestion = {
  id: string;
  title: string;
  detail: string;
  priority: string;
};

type Settings = {
  autopilotEnabled?: boolean;
  targetKeywords?: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  lastScanAt?: string | null;
  suggestions?: Suggestion[];
};

export default function AiWebSeoPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [keywords, setKeywords] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/growth/ai-web-seo/settings');
      const s = res.data.settings || {};
      setSettings(s);
      setKeywords((s.targetKeywords || []).join(', '));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string; error?: string } } };
      if (err.response?.data?.code !== 'AI_WEB_SEO_ADDON') {
        toast.error(err.response?.data?.error || 'Failed to load SEO settings');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const targetKeywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await api.put('/merchant/growth/ai-web-seo/settings', {
        settings: { ...settings, targetKeywords },
      });
      setSettings(res.data.settings);
      toast.success('SEO settings saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      const res = await api.post('/merchant/growth/ai-web-seo/scan');
      setSettings(res.data.settings);
      toast.success('SEO scan complete');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  if (loading) return null;
  if (!settings) return null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-4 mb-6">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">AI website &amp; SEO</h2>
        <p className="text-xs text-stone-500">
          Autopilot checklist for your shop site and search snippets (CHF 28/mo add-on).
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={settings.autopilotEnabled === true}
          onChange={(e) => setSettings({ ...settings, autopilotEnabled: e.target.checked })}
        />
        Enable SEO autopilot reminders
      </label>
      <div>
        <label className="block text-sm font-medium mb-1">Target keywords (comma-separated)</label>
        <input className="input w-full" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Suggested meta title</label>
          <input
            className="input w-full"
            value={settings.metaTitle || ''}
            onChange={(e) => setSettings({ ...settings, metaTitle: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Suggested meta description</label>
          <textarea
            className="input min-h-[72px] w-full"
            value={settings.metaDescription || ''}
            onChange={(e) => setSettings({ ...settings, metaDescription: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn-secondary" disabled={scanning} onClick={() => void scan()}>
          {scanning ? 'Scanning…' : 'Run SEO scan'}
        </button>
        {settings.lastScanAt ? (
          <span className="text-xs text-stone-500 self-center">
            Last scan: {new Date(settings.lastScanAt).toLocaleString()}
          </span>
        ) : null}
      </div>
      {(settings.suggestions || []).length > 0 ? (
        <ul className="space-y-2 border-t pt-3">
          {(settings.suggestions || []).map((s) => (
            <li key={s.id} className="rounded border border-stone-100 p-2 text-sm">
              <span className="font-medium">{s.title}</span>
              <span className="ml-2 text-xs uppercase text-stone-400">{s.priority}</span>
              <p className="text-stone-600 mt-1">{s.detail}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
