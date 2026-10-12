import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePlatformMessages, type PlatformMessage, type PlatformTrayMessage } from '@/hooks/usePlatformMessages';
import PlatformStatusBanner from '@/components/platform/PlatformStatusBanner';
import PlatformWhatsNewModal from '@/components/platform/PlatformWhatsNewModal';
import PlatformBellButton from '@/components/platform/PlatformBellButton';
import SupportTicketAlertBanner from '@/components/platform/SupportTicketAlertBanner';
import { SUPPORT_TICKET_ALERT_KIND } from '@/lib/support-ticket-alert';

type PlatformMessagesContextValue = {
  unreadCount: number;
  openWhatsNew: () => void;
  Bell: () => JSX.Element | null;
  banner: PlatformMessage[];
  dismiss: (id: string) => Promise<void>;
  dismissAll: () => Promise<void>;
  refresh: () => Promise<void>;
};

const PlatformMessagesContext = createContext<PlatformMessagesContextValue | null>(null);

export function usePlatformMessagesUi() {
  return useContext(PlatformMessagesContext);
}

/** Renders Hetzner-style status banner — place below panel header. */
export function PlatformStatusBannerSlot() {
  const ctx = usePlatformMessagesUi();
  if (!ctx?.banner.length) return null;
  const ticketAlerts = ctx.banner.filter((m) => m.kind === SUPPORT_TICKET_ALERT_KIND);
  const other = ctx.banner.filter((m) => m.kind !== SUPPORT_TICKET_ALERT_KIND);
  return (
    <>
      {ticketAlerts.length ? (
        <SupportTicketAlertBanner
          messages={ticketAlerts}
          onDismiss={(id) => void ctx.dismiss(id)}
        />
      ) : null}
      {other.length ? (
        <PlatformStatusBanner
          messages={other}
          onDismiss={(id) => void ctx.dismiss(id)}
          onDismissAll={() => void ctx.dismissAll()}
        />
      ) : null}
    </>
  );
}

const LOGIN_POPUP_KEY = 'platform_whats_new_shown';

function buildModalTray(
  tray: PlatformTrayMessage[],
  whatsNew: PlatformMessage[],
  messages: PlatformMessage[]
): PlatformTrayMessage[] {
  if (tray.length) return tray;
  const merged = [...whatsNew, ...messages.filter((m) => m.kind === 'incident')];
  const seen = new Set<string>();
  return merged
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .map((m) => ({ ...m, unread: true }));
}

export default function PlatformMessagesProvider({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const { messages, banner, loginPopup, whatsNew, tray, unreadCount, loading, dismiss, dismissAll, refresh } =
    usePlatformMessages(enabled);
  const [modalOpen, setModalOpen] = useState(false);

  const modalMessages = useMemo(
    () => buildModalTray(tray, whatsNew, messages),
    [tray, whatsNew, messages]
  );

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
    await dismissAll();
  }, [dismissAll]);

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
      refresh,
    }),
    [unreadCount, openWhatsNew, Bell, banner, handleDismiss, handleDismissAll, refresh]
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
        loading={loading}
        onClose={() => setModalOpen(false)}
        onDismiss={handleDismiss}
        onDismissAll={handleDismissAll}
      />
    </PlatformMessagesContext.Provider>
  );
}
