import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { isPanelLocationSwitcherActive } from '@/lib/panel-scope-nav';
import { useLocationStore } from '@/store/location';

type SyncState = {
  hasPending: boolean;
  pendingCount: number;
};

export default function HqPendingCatalogBanner() {
  const { t } = useI18n();
  const { isHqView, locations, limits } = useLocationStore();
  const [state, setState] = useState<SyncState | null>(null);

  const multiLocation = isPanelLocationSwitcherActive({
    locationCount: locations.length,
    maxLocations: limits?.maxLocations,
  });

  const load = useCallback(async () => {
    if (!isHqView || !multiLocation) {
      setState(null);
      return;
    }
    try {
      const res = await api.get('/merchant/hq/catalog/sync-state');
      const s = res.data?.state;
      setState(
        s
          ? { hasPending: !!s.hasPending, pendingCount: Number(s.pendingCount) || 0 }
          : null
      );
    } catch {
      setState(null);
    }
  }, [isHqView, multiLocation]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isHqView || !multiLocation || !state?.hasPending) return null;

  return (
    <div
      className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
      role="status"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          {state.pendingCount > 0
            ? t('hqPendingCatalogBanner', { count: state.pendingCount })
            : t('hqPendingCatalogBannerGeneric')}
        </p>
      </div>
      <Link
        to="/merchant/hq/sync"
        className="btn-primary shrink-0 text-center text-sm !py-2 !px-4"
      >
        {t('hqPendingCatalogSyncCta')}
      </Link>
    </div>
  );
}
