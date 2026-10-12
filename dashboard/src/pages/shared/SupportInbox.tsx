import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Paperclip, Send, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { SUPPORT_SUBCATEGORIES } from '@/lib/help-center/chaslay-help';
import { isResellerOwnedTicket, supportTicketOwnerTitle } from '@/lib/support-ticket-owner';
import ProductGuidesPage from './ProductGuidesPage';

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  requesterRole?: string | null;
  merchantId?: string | null;
  merchant?: { name?: string; email?: string };
  reseller?: { name?: string };
  assignedToSuperadminId?: string | null;
};

type Message = {
  id: string;
  authorRole: string;
  authorName?: string | null;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
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

const CATEGORIES = ['technical', 'accounting', 'miscellaneous'] as const;

function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-stone-950/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-sheet-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-[min(86dvh,40rem)] sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-100 px-4 py-3">
          <div className="min-w-0">
            <h3 id="support-sheet-title" className="font-semibold text-stone-900">
              {title}
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-stone-100"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4">{children}</div>
        {footer ? <div className="shrink-0 border-t border-stone-100 p-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function SupportInbox({ mode }: Props) {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const base = mode === 'superadmin' ? '/superadmin/support' : '/reseller/support';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState('open');
  const [active, setActive] = useState<(Ticket & { messages: Message[] }) | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [formCategory, setFormCategory] = useState<(typeof CATEGORIES)[number]>('technical');
  const [formSub, setFormSub] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  const subcategories = SUPPORT_SUBCATEGORIES[formCategory]?.[locale] || [];

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

  const open = useCallback(
    async (id: string) => {
      try {
        const res = await api.get(`${base}/tickets/${id}`);
        setActive(res.data.ticket);
        setReply('');
      } catch (e: unknown) {
        toast.error(
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load ticket'
        );
      }
    },
    [base]
  );

  useEffect(() => {
    const id = searchParams.get('ticket')?.trim();
    if (id) void open(id);
  }, [open, searchParams]);

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

  const submitTicket = async () => {
    if (!formSubject.trim() || !formBody.trim() || !formSub) {
      toast.error(t('supportFormIncomplete'));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('category', formCategory);
      fd.append('subcategory', formSub);
      fd.append('subject', formSubject);
      fd.append('body', formBody);
      if (formFile) fd.append('attachment', formFile);
      const res = await api.post(`${base}/tickets`, fd);
      toast.success(t('supportTicketCreated'));
      setFormSubject('');
      setFormBody('');
      setFormFile(null);
      setWizardStep(1);
      setNewOpen(false);
      setActive(res.data.ticket);
      await load();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create ticket'
      );
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
  const activeIsAgency = active ? isResellerOwnedTicket(active) : false;
  const saCanReply =
    mode !== 'superadmin' || activeIsAgency || active?.category === 'technical';

  return (
    <div className={`${agency ? '' : 'max-w-6xl mx-auto'} space-y-4`}>
      {agency ? (
        <details className="rounded-2xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-800">
            {t('supportGuidesHeading')}
          </summary>
          <div className="mt-4">
            <ProductGuidesPage audience="reseller" embedded />
          </div>
        </details>
      ) : (
        <div>
          <h1 className="text-xl font-bold">{t('supportInboxTitle')}</h1>
          <p className="text-sm text-stone-600">{t('supportInboxSaHint')}</p>
        </div>
      )}

      <div className={`grid gap-4 ${agency ? 'lg:grid-cols-[300px_1fr]' : 'lg:grid-cols-[280px_1fr]'}`}>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {agency ? <p className="text-sm font-semibold text-stone-800">{t('supportInboxTitle')}</p> : null}
            {agency ? (
              <button
                type="button"
                className="inline-flex items-center rounded-full bg-[#9f1239] px-3 py-1.5 text-xs font-semibold text-white"
                onClick={() => {
                  setWizardStep(1);
                  setNewOpen(true);
                }}
              >
                {t('supportNewRequest')}
              </button>
            ) : null}
          </div>
          {agency ? <p className="text-xs text-stone-500">{t('supportInboxResellerHint')}</p> : null}
          <select className="input w-full text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="open">{t('supportFilterOpen')}</option>
            <option value="answered">{t('supportFilterAnswered')}</option>
            <option value="closed">{t('supportFilterClosed')}</option>
            <option value="all">{t('all')}</option>
          </select>
          <ul className="space-y-1 lg:max-h-[520px] lg:overflow-y-auto">
            {tickets.map((tk) => {
              const agencyOwned = isResellerOwnedTicket(tk);
              return (
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
                      <p className="font-medium truncate">{supportTicketOwnerTitle(tk)}</p>
                      <span className="agency-pill bg-emerald-50 text-emerald-700">{tk.status}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-stone-500">{tk.subject}</p>
                    {agencyOwned ? (
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-700">
                        {t('supportAgencyTicket')}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {!tickets.length ? <p className="p-2 text-sm text-stone-500">{t('supportNoTickets')}</p> : null}
          </ul>
        </div>

        <div className={`${agency ? 'agency-card' : 'rounded-xl border border-stone-200 bg-white'} min-h-[400px] flex flex-col`}>
          {active ? (
            <>
              <div className="border-b px-4 py-3 space-y-2">
                <h3 className="font-semibold">{active.subject}</h3>
                <p className="text-xs text-stone-500">
                  {supportTicketOwnerTitle(active)} · {active.ticketNumber} · {active.status}
                  {activeIsAgency ? ` · ${t('supportAgencyTicket')}` : ''}
                </p>
                {mode === 'superadmin' && (active.category === 'technical' || activeIsAgency) ? (
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
                {mode === 'superadmin' && !activeIsAgency && active.category !== 'technical' ? (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">{t('supportInfoOnly')}</p>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {active.messages.map((m) => {
                  const mine =
                    mode === 'reseller' ? m.authorRole === 'reseller' : m.authorRole === 'superadmin';
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-sm max-w-[90%] ${
                        m.authorRole === 'system'
                          ? 'bg-amber-50 text-xs mx-auto text-center'
                          : mine
                            ? 'ml-auto bg-teal-600 text-white'
                            : 'bg-stone-100'
                      }`}
                    >
                      {m.authorName ? <p className="text-[10px] opacity-75">{m.authorName}</p> : null}
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {m.attachmentUrl ? (
                        <a
                          href={m.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs underline"
                        >
                          {m.attachmentName || t('supportAttachment')}
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {active.status !== 'closed' && saCanReply ? (
                <div className="border-t p-3 flex flex-wrap gap-2">
                  <input
                    className="input flex-1 min-w-[200px] text-sm"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={t('supportTypeReply')}
                  />
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

      {agency && newOpen ? (
        <Sheet
          title={t('supportNewRequest')}
          subtitle={wizardStep === 1 ? t('supportWizardCategory') : t('supportWizardDetails')}
          onClose={() => setNewOpen(false)}
          footer={
            <div className="flex justify-between gap-2">
              {wizardStep === 2 ? (
                <button type="button" className="btn-secondary text-sm" onClick={() => setWizardStep(1)}>
                  {t('back')}
                </button>
              ) : (
                <button type="button" className="btn-secondary text-sm" onClick={() => setNewOpen(false)}>
                  {t('cancel')}
                </button>
              )}
              {wizardStep === 1 ? (
                <button type="button" className="btn-primary text-sm" onClick={() => setWizardStep(2)}>
                  {t('next')}
                </button>
              ) : (
                <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void submitTicket()}>
                  {t('send')}
                </button>
              )}
            </div>
          }
        >
          {wizardStep === 1 ? (
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setFormCategory(cat);
                    setFormSub('');
                  }}
                  className={`rounded-xl border-2 p-4 text-left text-sm font-semibold capitalize ${
                    formCategory === cat
                      ? 'border-rose-700 bg-rose-50 text-stone-900'
                      : 'border-stone-200 bg-white text-stone-600'
                  }`}
                >
                  {t(`supportCat_${cat}` as 'supportCat_technical')}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-stone-700">
                {t('supportSubcategoryLabel')}
                <select className="input mt-1 w-full" value={formSub} onChange={(e) => setFormSub(e.target.value)}>
                  <option value="">{t('supportChooseSubcategory')}</option>
                  {subcategories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <input
                className="input w-full"
                placeholder={t('supportSubjectPlaceholder')}
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
              />
              <textarea
                className="input min-h-[140px] w-full"
                placeholder={t('supportDescribeIssue')}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-4 py-2 text-sm hover:bg-stone-100">
                <Paperclip className="h-4 w-4" />
                {t('supportAddAttachment')}
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.jpg,.jpeg,.png,.bmp,.gif,.pdf"
                  onChange={(e) => setFormFile(e.target.files?.[0] || null)}
                />
              </label>
              {formFile ? <p className="text-xs text-stone-500">{formFile.name}</p> : null}
            </div>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}
