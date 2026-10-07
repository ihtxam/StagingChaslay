import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type Review = {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
  replyDraft?: string | null;
  status: string;
};

type Settings = {
  googlePlaceId?: string | null;
  autoReplyEnabled?: boolean;
  replyTone?: 'professional' | 'friendly' | 'warm';
  managerEmail?: string | null;
  notifyOnNewReview?: boolean;
  reviews?: Review[];
};

export default function GoogleReputationPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoAuthor, setDemoAuthor] = useState('Google user');
  const [demoRating, setDemoRating] = useState(5);
  const [demoText, setDemoText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/growth/google-reputation/settings');
      setSettings(res.data.settings || {});
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string; error?: string } } };
      if (err.response?.data?.code !== 'GOOGLE_REPUTATION_ADDON') {
        toast.error(err.response?.data?.error || 'Failed to load Google reputation');
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
      const res = await api.put('/merchant/growth/google-reputation/settings', { settings });
      setSettings(res.data.settings);
      toast.success('Google reputation settings saved');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addDemoReview = async () => {
    if (!demoText.trim()) {
      toast.error('Enter review text');
      return;
    }
    try {
      const res = await api.post('/merchant/growth/google-reputation/reviews', {
        authorName: demoAuthor,
        rating: demoRating,
        text: demoText,
      });
      setSettings(res.data.settings);
      setDemoText('');
      toast.success('Review added to inbox');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Could not add review');
    }
  };

  const draftReply = async (reviewId: string) => {
    try {
      const res = await api.post(`/merchant/growth/google-reputation/reviews/${reviewId}/draft-reply`);
      setSettings(res.data.settings);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Draft failed');
    }
  };

  if (loading) return null;
  if (!settings) return null;

  const reviews = settings.reviews || [];

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-xl font-bold">Google reputation</h2>
        <p className="text-sm text-gray-600">
          Reviews inbox, reply tone rules, and manager alerts (CHF 28/mo add-on).
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Google Place ID</label>
          <input
            className="input w-full"
            value={settings.googlePlaceId || ''}
            onChange={(e) => setSettings({ ...settings, googlePlaceId: e.target.value })}
            placeholder="ChIJ…"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Manager email</label>
          <input
            className="input w-full"
            type="email"
            value={settings.managerEmail || ''}
            onChange={(e) => setSettings({ ...settings, managerEmail: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.autoReplyEnabled === true}
            onChange={(e) => setSettings({ ...settings, autoReplyEnabled: e.target.checked })}
          />
          Auto-draft replies for new reviews
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.notifyOnNewReview !== false}
            onChange={(e) => setSettings({ ...settings, notifyOnNewReview: e.target.checked })}
          />
          Email manager on new reviews
        </label>
        <label className="flex items-center gap-2">
          Tone
          <select
            className="input"
            value={settings.replyTone || 'professional'}
            onChange={(e) =>
              setSettings({
                ...settings,
                replyTone: e.target.value as Settings['replyTone'],
              })
            }
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="warm">Warm</option>
          </select>
        </label>
      </div>
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>

      <div className="border-t pt-4 space-y-3">
        <h3 className="text-sm font-semibold">Inbox ({reviews.length})</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="input"
            placeholder="Author"
            value={demoAuthor}
            onChange={(e) => setDemoAuthor(e.target.value)}
          />
          <input
            className="input"
            type="number"
            min={1}
            max={5}
            value={demoRating}
            onChange={(e) => setDemoRating(Number(e.target.value))}
          />
          <button type="button" className="btn-secondary text-sm" onClick={() => void addDemoReview()}>
            Log sample review
          </button>
        </div>
        <textarea
          className="input min-h-[60px] w-full"
          placeholder="Paste a Google review to practice replies…"
          value={demoText}
          onChange={(e) => setDemoText(e.target.value)}
        />
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded border border-stone-200 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {r.authorName} · {r.rating}★
                  </span>
                  <span className="text-xs text-gray-500">{r.status}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{r.text}</p>
                {r.replyDraft ? (
                  <p className="mt-2 rounded bg-stone-50 p-2 text-xs whitespace-pre-wrap">{r.replyDraft}</p>
                ) : null}
                <button
                  type="button"
                  className="mt-2 text-teal-700 text-xs font-semibold hover:underline"
                  onClick={() => void draftReply(r.id)}
                >
                  Draft reply
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
