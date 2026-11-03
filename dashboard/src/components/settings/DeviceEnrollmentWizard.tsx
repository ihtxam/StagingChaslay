import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Smartphone } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { isPanelLocationSwitcherActive } from '@/lib/panel-scope-nav';
import { useLocationStore } from '@/store/location';
import {
  clearDeviceEnrollment,
  enrollCurrentDevice,
  fetchDeviceRuntimeConfig,
  type DeviceEnrollmentSnapshot,
} from '@/lib/device-enrollment';
import { webPosDeviceId } from '@/lib/webpos-print-relay';

type Terminal = { id: string; terminalId: string; terminalName: string };

export default function DeviceEnrollmentWizard() {
  const { t } = useI18n();
  const { locationId, isHqView, locations, limits } = useLocationStore();
  const branchSwitcher = isPanelLocationSwitcherActive({
    locationCount: locations.length,
    maxLocations: limits?.maxLocations,
  });

  const [profileId, setProfileId] = useState('');
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [lockEnrollment, setLockEnrollment] = useState(true);
  const [current, setCurrent] = useState<DeviceEnrollmentSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (branchSwitcher && (isHqView || !locationId)) {
      setProfileId('');
      setTerminals([]);
      return;
    }
    try {
      const params = locationId ? { locationId } : undefined;
      const [pRes, cfg] = await Promise.all([
        api.get('/merchant/payment-profiles', { params }),
        fetchDeviceRuntimeConfig(),
      ]);
      const list = (pRes.data?.profiles || []) as { id: string }[];
      const pid = cfg?.paymentProfileId || list[0]?.id || '';
      setProfileId(pid);
      setCurrent(cfg?.enrollment || null);
      if (!pid) {
        setTerminals([]);
        return;
      }
      const tRes = await api.get('/merchant/payment-profiles/terminals', {
        params: { paymentProfileId: pid, ...(locationId ? { locationId } : {}) },
      });
      const terms = (tRes.data?.terminals || []) as Terminal[];
      setTerminals(terms);
      setTerminalId(cfg?.fixedTerminalId || terms[0]?.terminalId || '');
    } catch {
      /* ignore */
    }
  }, [branchSwitcher, isHqView, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async () => {
    const enrollLocationId = locationId;
    if (!enrollLocationId) {
      toast.error(t('deviceEnrollPickLocation'));
      return;
    }
    if (!profileId) {
      toast.error(t('deviceEnrollPickTerminal'));
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
        locationId: enrollLocationId,
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

  if (!branchSwitcher) {
    return null;
  }

  if (branchSwitcher && isHqView) {
    return null;
  }

  if (branchSwitcher && !locationId) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        {t('hqSettingsPickBranch')}
      </p>
    );
  }

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
