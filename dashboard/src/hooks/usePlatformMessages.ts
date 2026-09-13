import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

export type PlatformMessage = {
  id: string;
  kind: 'announcement' | 'incident' | 'whats_new';
  audience: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  externalUrl?: string | null;
  externalLabel?: string | null;
  showOnLogin: boolean;
  showInBanner: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on tray rows from GET /panel/messages */
  unread?: boolean;
};

export type PlatformTrayMessage = PlatformMessage & { unread: boolean };

type MessagesState = {
  messages: PlatformMessage[];
  banner: PlatformMessage[];
  loginPopup: PlatformMessage[];
  whatsNew: PlatformMessage[];
  tray: PlatformTrayMessage[];
  unreadCount: number;
};

const empty: MessagesState = {
  messages: [],
  banner: [],
  loginPopup: [],
  whatsNew: [],
  tray: [],
  unreadCount: 0,
};

function normalizeTray(
  tray: PlatformMessage[] | undefined,
  fallback: PlatformMessage[]
): PlatformTrayMessage[] {
  const source = Array.isArray(tray) && tray.length ? tray : fallback;
  return source.map((m) => ({
    ...m,
    unread: m.unread !== false,
  }));
}

export function usePlatformMessages(enabled = true) {
  const [data, setData] = useState<MessagesState>(empty);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get('/panel/messages');
      const messages: PlatformMessage[] = res.data.messages || [];
      const whatsNew: PlatformMessage[] = res.data.whatsNew || messages;
      setData({
        messages,
        banner: res.data.banner || [],
        loginPopup: res.data.loginPopup || [],
        whatsNew,
        tray: normalizeTray(res.data.tray, whatsNew.length ? whatsNew : messages),
        unreadCount: Number(res.data.unreadCount) || 0,
      });
    } catch {
      setData(empty);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(
    async (messageId: string) => {
      await api.post(`/panel/messages/${messageId}/dismiss`);
      await refresh();
    },
    [refresh]
  );

  const dismissAll = useCallback(
    async (messageIds?: string[]) => {
      const unreadIds = data.tray.filter((m) => m.unread).map((m) => m.id);
      const ids =
        messageIds?.length ? messageIds : unreadIds.length ? unreadIds : data.messages.map((m) => m.id);
      if (!ids.length) return;
      await api.post('/panel/messages/dismiss-all', { messageIds: ids });
      await refresh();
    },
    [data.messages, data.tray, refresh]
  );

  return { ...data, loading, refresh, dismiss, dismissAll };
}
