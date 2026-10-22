import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Smartphone } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getSelectedLocationId } from '@/store/location';
import {
  clearDeviceEnrollment,
  enrollCurrentDevice,
  fetchDeviceRuntimeConfig,
  type DeviceEnrollmentSnapshot,
} from '@/lib/device-enrollment';
import { webPosDeviceId } from '@/lib/webpos-print-relay';

type Profile = { id: string; name: string };
type Terminal = { id: string; terminalId: string; terminalName: string };

export default function DeviceEnrollmentWizard() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [profileId, setProfileId] = useState('');
  const [terminalId, setTerminalId] = useState('');
  const [lockEnrollment, setLockEnrollment] = useState(true);
  const [current, setCurrent] = useState<DeviceEnrollmentSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, cfg] = await Promise.all([
        api.get('/merchant/payment-profiles'),
        fetchDeviceRuntimeConfig(),
      ]);
      const list = (pRes.data?.profiles || []) as Profile[];
      setProfiles(list);
      setCurrent(cfg?.enrollment || null);
      const pid = cfg?.paymentProfileId || list[0]?.id || '';
      setProfileId(pid);
      const tRes = await api.get('/merchant/payment-profiles/terminals', {
        params: { paymentProfileId: pid },
      });
      const terms = (tRes.data?.terminals || []) as Terminal[];
      setTerminals(terms);
      setTerminalId(cfg?.fixedTerminalId || terms[0]?.terminalId || '');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profileId) return;
    void api
      .get('/merchant/payment-profiles/terminals', { params: { paymentProfileId: profileId } })
      .then((res) => {
        const terms = (res.data?.terminals || []) as Terminal[];
        setTerminals(terms);
        if (!terms.some((x) => x.terminalId === terminalId)) {
          setTerminalId(terms[0]?.terminalId || '');
        }
      })
      .catch(() => undefined);
  }, [profileId, terminalId]);

  const enroll = async () => {
    const locationId = getSelectedLocationId();
    if (!locationId) {
      toast.error(t('deviceEnrollPickLocation'));
      return;
    }
    const terminal = terminals.find((x) => x.terminalId === terminalId);
    if (!terminal) {
      toast.error(t('deviceEnrollPickTerminal'));
      return;
    }
    setBusy(true);
    try {
      const row = await enrollCurrentDevice({
        locationId,
        paymentProfileId: profileId,
        paymentTerminalId: terminal.id,
        lockEnrollment,
      });
      setCurrent(row);
      toast.success(t('deviceEnrollSaved'));
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { error?: string } } }).response?.data?.error || '')
          : '';
      toast.error(msg || t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const unenroll = async () => {
    setBusy(true);
    try {
      await clearDeviceEnrollment();
      setCurrent(null);
      toast.success(t('deviceEnrollCleared'));
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/20 p-4">
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-5 w-5" aria-hidden />
        <div>
          <h3 className="text-sm font-semibold">{t('deviceEnrollTitle')}</h3>
          <p className="text-xs text-[var(--text-muted)]">{t('deviceEnrollHint')}</p>
          <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
            {t('deviceEnrollDeviceId')}: {webPosDeviceId()}
          </p>
          {current ? (
            <p className="mt-1 text-xs text-teal-800">
              {t('deviceEnrollActive').replace('{terminal}', current.terminalName || current.terminalId)}
            </p>
          ) : null}
        </div>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-medium">{t('paymentProfilesTitle')}</span>
        <select className="input mt-1 w-full" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-xs font-medium">{t('webPosPaymentTerminal')}</span>
        <select
          className="input mt-1 w-full"
          value={terminalId}
          onChange={(e) => setTerminalId(e.target.value)}
        >
          {terminals.map((term) => (
            <option key={term.id} value={term.terminalId}>
              {term.terminalName || term.terminalId}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="rounded"
          checked={lockEnrollment}
          onChange={(e) => setLockEnrollment(e.target.checked)}
        />
        {t('deviceEnrollLockFloorStaff')}
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void enroll()}>
          {t('deviceEnrollSave')}
        </button>
        {current ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void unenroll()}>
            {t('deviceEnrollClear')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
