import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import KioskAdminPanel from '@/components/kiosk/KioskAdminPanel';

import {
  isKioskAdminUnlocked,
  setKioskAdminUnlocked,
} from '@/lib/kiosk-admin-session';
export default function KioskTokenAdminPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setUnlocked(isKioskAdminUnlocked(token));
    setChecking(false);
  }, [token]);

  const submitPin = async () => {
    setSubmitting(true);
    try {
      await axios.post(`/api/kiosk/${token}/verify-admin-pin`, { pin });
      setKioskAdminUnlocked(token, pin);
      setUnlocked(true);
      toast.success('Back panel unlocked');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-900 px-6 text-white">
        <h1 className="text-2xl font-bold">Kiosk back panel</h1>
        <p className="mt-2 text-stone-400">Enter admin code to configure this kiosk</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className="mt-8 w-full max-w-xs rounded-2xl border-2 border-stone-600 bg-stone-800 px-6 py-4 text-center text-3xl tracking-widest"
          placeholder="••••"
          autoFocus
        />
        <button
          type="button"
          disabled={pin.length < 4 || submitting}
          onClick={() => void submitPin()}
          className="mt-6 rounded-2xl bg-emerald-600 px-10 py-4 text-lg font-bold disabled:opacity-40"
        >
          {submitting ? 'Checking…' : 'Unlock'}
        </button>
        <button type="button" className="mt-4 text-sm text-stone-400 underline" onClick={() => navigate(`/kiosk/${token}`)}>
          Back to customer mode
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-stone-100">
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <p className="font-semibold">Kiosk back panel</p>
        <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`/kiosk/${token}`)}>
          Return to customer mode
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <KioskAdminPanel mode="token" accessToken={token} showOwnerExtras={false} />
      </div>
    </div>
  );
}
