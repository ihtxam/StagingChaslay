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
};

type MessagesState = {
  messages: PlatformMessage[];
  banner: PlatformMessage[];
  loginPopup: PlatformMessage[];
  whatsNew: PlatformMessage[];
  unreadCount: number;
};

const empty: MessagesState = {
  messages: [],
  banner: [],
  loginPopup: [],
  whatsNew: [],
  unreadCount: 0,
};

export function usePlatformMessages(enabled = true) {
  const [data, setData] = useState<MessagesState>(empty);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await api.get('/panel/messages');
      setData({
        messages: res.data.messages || [],
        banner: res.data.banner || [],
        loginPopup: res.data.loginPopup || [],
        whatsNew: res.data.whatsNew || res.data.messages || [],
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
      const ids = messageIds?.length ? messageIds : data.messages.map((m) => m.id);
      if (!ids.length) return;
      await api.post('/panel/messages/dismiss-all', { messageIds: ids });
      await refresh();
    },
    [data.messages, refresh]
  );

  return { ...data, loading, refresh, dismiss, dismissAll };
}
