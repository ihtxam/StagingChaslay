import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePlatformMessages, type PlatformMessage } from '@/hooks/usePlatformMessages';
import PlatformStatusBanner from '@/components/platform/PlatformStatusBanner';
import PlatformWhatsNewModal from '@/components/platform/PlatformWhatsNewModal';
import PlatformBellButton from '@/components/platform/PlatformBellButton';

type PlatformMessagesContextValue = {
  unreadCount: number;
  openWhatsNew: () => void;
  Bell: () => JSX.Element | null;
  banner: PlatformMessage[];
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
};

const PlatformMessagesContext = createContext<PlatformMessagesContextValue | null>(null);

export function usePlatformMessagesUi() {
  return useContext(PlatformMessagesContext);
}

/** Renders Hetzner-style status banner — place below panel header. */
export function PlatformStatusBannerSlot() {
  const ctx = usePlatformMessagesUi();
  if (!ctx?.banner.length) return null;
  return (
    <PlatformStatusBanner
      messages={ctx.banner}
      onDismiss={(id) => void ctx.dismiss(id)}
      onDismissAll={() => void ctx.dismissAll()}
    />
  );
}

const LOGIN_POPUP_KEY = 'platform_whats_new_shown';

export default function PlatformMessagesProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const { messages, banner, loginPopup, whatsNew, unreadCount, dismiss, dismissAll } =
    usePlatformMessages(enabled);
  const [modalOpen, setModalOpen] = useState(false);

  const modalMessages = useMemo(() => {
    const merged = [...whatsNew, ...messages.filter((m) => m.kind === 'incident')];
    const seen = new Set<string>();
    return merged.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [whatsNew, messages]);

  useEffect(() => {
    if (!enabled || !loginPopup.length) return;
    const shown = sessionStorage.getItem(LOGIN_POPUP_KEY);
    if (!shown) {
      setModalOpen(true);
      sessionStorage.setItem(LOGIN_POPUP_KEY, '1');
    }
  }, [enabled, loginPopup.length]);

  const handleDismiss = useCallback(
    async (id: string) => {
      await dismiss(id);
    },
    [dismiss]
  );

  const handleDismissAll = useCallback(async () => {
    await dismissAll(messages.map((m) => m.id));
  }, [dismissAll, messages]);

  const openWhatsNew = useCallback(() => setModalOpen(true), []);

  const Bell = useCallback(
    () =>
      enabled ? (
        <PlatformBellButton count={unreadCount} onClick={() => setModalOpen(true)} />
      ) : null,
    [enabled, unreadCount]
  );

  const ctx = useMemo(
    () => ({
      unreadCount,
      openWhatsNew,
      Bell,
      banner,
      dismiss: handleDismiss,
      dismissAll: handleDismissAll,
    }),
    [unreadCount, openWhatsNew, Bell, banner, handleDismiss, handleDismissAll]
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <PlatformMessagesContext.Provider value={ctx}>
      {children}
      <PlatformWhatsNewModal
        open={modalOpen}
        messages={modalMessages}
        onClose={() => setModalOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismissAll}
      />
    </PlatformMessagesContext.Provider>
  );
}
