import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Send } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  merchant?: { name?: string; email?: string };
  reseller?: { name?: string };
  assignedToSuperadminId?: string | null;
};

type Message = {
  id: string;
  authorRole: string;
  authorName?: string | null;
  body: string;
  createdAt: string;
};

type Agent = {
  id: string;
  name: string;
  handlesSupport?: boolean;
};

type Props = {
  mode: 'superadmin' | 'reseller';
};

export default function SupportInbox({ mode }: Props) {
  const { t } = useI18n();
  const base = mode === 'superadmin' ? '/superadmin/support' : '/reseller/support';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('open');
  const [active, setActive] = useState<(Ticket & { messages: Message[] }) | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await api.get(`${base}/tickets`, { params: { status: filter } });
      setTickets(res.data.tickets || []);
    } catch {
      setTickets([]);
    }
  }, [base, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === 'superadmin') {
      api.get('/superadmin/support/agents').then((r) => setAgents(r.data.agents || [])).catch(() => null);
    }
  }, [mode]);

  const open = async (id: string) => {
    const res = await api.get(`${base}/tickets/${id}`);
    setActive(res.data.ticket);
  };

  const sendReply = async (close?: boolean) => {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`${base}/tickets/${active.id}/reply`, { body: reply, close });
      setActive(res.data.ticket);
      setReply('');
      await load();
      toast.success(t('saved'));
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const assign = async (superadminId: string) => {
    if (!active) return;
    try {
      await api.patch(`/superadmin/support/tickets/${active.id}/assign`, {
        assignedToSuperadminId: superadminId || null,
      });
      toast.success(t('saved'));
      await open(active.id);
    } catch {
      toast.error('Assign failed');
    }
  };

  const agency = mode === 'reseller';

  return (
    <div className={`${agency ? '' : 'max-w-6xl mx-auto'} space-y-4`}>
      {agency ? null : (
        <div>
          <h1 className="text-xl font-bold">{t('supportInboxTitle')}</h1>
          <p className="text-sm text-stone-600">{t('supportInboxSaHint')}</p>
        </div>
      )}

      <div className={`grid gap-4 ${agency ? 'lg:grid-cols-[300px_1fr]' : 'lg:grid-cols-[280px_1fr]'}`}>
        <div className="space-y-2">
          {agency ? <p className="text-sm font-semibold text-stone-800">{t('supportInboxTitle')}</p> : null}
          <select className="input w-full text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">{t('supportFilterOpen')}</option>
            <option value="answered">{t('supportFilterAnswered')}</option>
            <option value="closed">{t('supportFilterClosed')}</option>
            <option value="all">{t('all')}</option>
          </select>
          <ul className="space-y-1 max-h-[520px] overflow-y-auto">
            {tickets.map((tk) => (
              <li key={tk.id}>
                <button
                  type="button"
                  onClick={() => void open(tk.id)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 text-sm border ${
                    active?.id === tk.id
                      ? agency
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-teal-500 bg-teal-50'
                      : 'border-stone-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{tk.merchant?.name || tk.subject}</p>
                    <span className="agency-pill bg-emerald-50 text-emerald-700">{tk.status}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-stone-500">{tk.subject}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className={`${agency ? 'agency-card' : 'rounded-xl border border-stone-200 bg-white'} min-h-[400px] flex flex-col`}>
          {active ? (
            <>
              <div className="border-b px-4 py-3 space-y-2">
                <h3 className="font-semibold">{active.subject}</h3>
                <p className="text-xs text-stone-500">
                  {active.merchant?.name} · {active.ticketNumber} · {active.status}
                </p>
                {mode === 'superadmin' && active.category === 'technical' ? (
                  <select
                    className="input text-xs w-full max-w-xs"
                    value={active.assignedToSuperadminId || ''}
                    onChange={(e) => void assign(e.target.value)}
                  >
                    <option value="">{t('supportUnassigned')}</option>
                    {agents.filter((a) => a.handlesSupport !== false).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {mode === 'superadmin' && active.category !== 'technical' ? (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{t('supportInfoOnly')}</p>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {active.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
                      m.authorRole === 'merchant' ? 'bg-stone-100' : m.authorRole === 'system' ? 'bg-amber-50 text-xs mx-auto text-center' : 'ml-auto bg-teal-600 text-white'
                    }`}
                  >
                    {m.authorName ? <p className="text-[10px] opacity-75">{m.authorName}</p> : null}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              {active.status !== 'closed' &&
              !(mode === 'superadmin' && active.category !== 'technical') ? (
                <div className="border-t p-3 flex flex-wrap gap-2">
                  <input className="input flex-1 min-w-[200px] text-sm" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={t('supportTypeReply')} />
                  <button
                    type="button"
                    className={`${agency ? 'inline-flex items-center gap-1.5 rounded-full bg-[#9f1239] px-3.5 py-2 text-sm font-semibold text-white' : 'btn-primary text-sm'}`}
                    disabled={busy}
                    onClick={() => void sendReply(false)}
                  >
                    <Send className="w-4 h-4" />
                    {agency ? t('agencySend') : null}
                  </button>
                  <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={() => void sendReply(true)}>
                    {t('supportReplyAndClose')}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-stone-500 p-8 text-center">{t('supportSelectTicket')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
