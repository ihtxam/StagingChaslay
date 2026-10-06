import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Campaign = {
  id: string;
  code: string;
  name: string;
  perkLabel?: string | null;
  message?: string | null;
  clickCount: number;
  bookingCount: number;
  active: boolean;
};

export default function ReservationCampaignsPanel() {
  const slug = useAuthStore((s) => s.merchant?.slug);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [perkLabel, setPerkLabel] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/growth/reservation-campaigns');
      setCampaigns(res.data.campaigns || []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { code?: string } } };
      if (err.response?.data?.code !== 'RESERVATION_CAMPAIGNS_ADDON') {
        toast.error('Failed to load campaigns');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    try {
      await api.post('/merchant/growth/reservation-campaigns', {
        name,
        code: code || undefined,
        perkLabel,
        message,
        active: true,
      });
      setName('');
      setCode('');
      setPerkLabel('');
      setMessage('');
      toast.success('Campaign created');
      void load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Create failed');
    }
  };

  const invitePath = (c: Campaign) =>
    slug ? `/shop/${slug}/reservations?campaign=${encodeURIComponent(c.code)}` : `?campaign=${c.code}`;

  if (loading) return <p className="text-sm text-stone-500">Loading campaigns…</p>;

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-stone-900">Reservation campaigns</h3>
        <p className="text-xs text-stone-500">Trackable invite links with perks (pass <code className="text-xs">campaignCode</code> when booking).</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input text-sm" placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input text-sm" placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} />
        <input className="input text-sm" placeholder="Perk label" value={perkLabel} onChange={(e) => setPerkLabel(e.target.value)} />
        <input className="input text-sm" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={() => void create()}>
        Create campaign
      </button>
      <ul className="divide-y divide-stone-100 text-sm">
        {campaigns.map((c) => (
          <li key={c.id} className="py-3">
            <p className="font-medium">{c.name} · <span className="text-stone-500">{c.code}</span></p>
            <p className="text-xs text-stone-500">
              Clicks {c.clickCount} · Bookings {c.bookingCount}
              {c.perkLabel ? ` · ${c.perkLabel}` : ''}
            </p>
            <p className="mt-1 break-all text-xs text-teal-800">{invitePath(c)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
