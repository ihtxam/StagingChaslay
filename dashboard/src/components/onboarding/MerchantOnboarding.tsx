import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SetupProgressPill from './SetupProgressPill';
import SetupChecklistDrawer from './SetupChecklistDrawer';
import { useMerchantSetupProgress } from './useMerchantSetupProgress';

type Props = {
  enabled?: boolean;
};

/** KüBBan-style merchant onboarding: header pill + setup checklist drawer. */
export default function MerchantOnboarding({ enabled = true }: Props) {
  const location = useLocation();
  const progress = useMerchantSetupProgress();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!enabled || progress.loading || progress.dismissed || progress.allComplete) return;
    const onOverview = location.pathname === '/merchant' || location.pathname === '/merchant/';
    if (onOverview) setDrawerOpen(true);
  }, [enabled, location.pathname, progress.loading, progress.dismissed, progress.allComplete]);

  if (!enabled || progress.loading || progress.dismissed || progress.allComplete) {
    return null;
  }

  return (
    <>
      <SetupProgressPill
        percent={progress.percent}
        completedCount={progress.completedCount}
        totalCount={progress.totalCount}
        onClick={() => setDrawerOpen(true)}
      />
      <SetupChecklistDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        steps={progress.steps}
        completedCount={progress.completedCount}
        totalCount={progress.totalCount}
        percent={progress.percent}
      />
    </>
  );
}
