import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { ExternalLink, LifeBuoy, Paperclip, Search, Send, X } from 'lucide-react';
import api from '@/lib/api';
import { useI18n, type Locale } from '@/lib/i18n';
import {
  getHelpCategories,
  LANG_FLAGS,
  searchHelpArticles,
  SUPPORT_SUBCATEGORIES,
} from '@/lib/help-center/chaslay-help';
import ProductGuidesPage from '../shared/ProductGuidesPage';

type Tab = 'help' | 'tickets';

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  status: string;
  lastMessageAt: string;
  autoCloseAt: string;
};

type TicketMessage = {
  id: string;
  authorRole: string;
  authorName?: string | null;
  body: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt: string;
};

type TicketDetail = Ticket & { messages: TicketMessage[] };

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
    const prevTouch = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouch;
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        {footer ? <div className="shrink-0 border-t border-stone-100 p-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function Support() {
  const { t, locale, setLocale } = useI18n();
  const [tab, setTab] = useState<Tab>('help');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketFilter, setTicketFilter] = useState('open');
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);

  const [formCategory, setFormCategory] = useState<(typeof CATEGORIES)[number]>('technical');
  const [formSub, setFormSub] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formFile, setFormFile] = useState<File | null>(null);

  const categories = useMemo(() => getHelpCategories(locale), [locale]);
  const searchResults = useMemo(
    () => (search.trim() ? searchHelpArticles(locale, search) : []),
    [locale, search]
  );
  const subcategories = SUPPORT_SUBCATEGORIES[formCategory]?.[locale] || [];

  const loadTickets = useCallback(async () => {
    try {
      const res = await api.get('/merchant/support/tickets', { params: { status: ticketFilter } });
      setTickets(res.data.tickets || []);
    } catch {
      setTickets([]);
    }
  }, [ticketFilter]);

  useEffect(() => {
    if (tab === 'tickets') void loadTickets();
  }, [tab, loadTickets]);

  const openTicket = async (id: string) => {
    try {
      const res = await api.get(`/merchant/support/tickets/${id}`);
      setActiveTicket(res.data.ticket);
      setReply('');
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load ticket'
      );
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
      const res = await api.post('/merchant/support/tickets', fd);
      toast.success(t('supportTicketCreated'));
      setFormSubject('');
      setFormBody('');
      setFormFile(null);
      setWizardStep(1);
      setNewOpen(false);
      setTab('tickets');
      setActiveTicket(res.data.ticket);
      await loadTickets();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create ticket'
      );
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!activeTicket || !reply.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`/merchant/support/tickets/${activeTicket.id}/reply`, { body: reply });
      setActiveTicket(res.data.ticket);
      setReply('');
      await loadTickets();
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send'
      );
    } finally {
      setBusy(false);
    }
  };

  const article = useMemo(() => {
    if (!selectedCategory || !selectedArticle) return null;
    const cat = categories.find((c) => c.id === selectedCategory);
    return cat?.articles.find((a) => a.id === selectedArticle) || null;
  }, [categories, selectedCategory, selectedArticle]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-10">
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('help')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === 'help' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          {t('supportHelpCenter')}
        </button>
        <button
          type="button"
          onClick={() => {
            setWizardStep(1);
            setNewOpen(true);
          }}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-stone-100 text-stone-700 hover:bg-stone-200"
        >
          {t('supportNewRequest')}
        </button>
        <button
          type="button"
          onClick={() => setTab('tickets')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === 'tickets' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          {t('supportMyTickets')}
        </button>
      </div>

      {tab === 'help' ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t('supportHelpCenter')}</p>
              <h1 className="text-xl font-bold text-stone-900">{t('supportHelpHero')}</h1>
              <p className="mt-1 max-w-2xl text-sm text-stone-600">{t('supportHelpHeroHint')}</p>
            </div>
            <div className="flex items-center gap-1">
              {(['en', 'fr', 'de'] as Locale[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  title={lang.toUpperCase()}
                  onClick={() => setLocale(lang)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg ${
                    locale === lang ? 'border-teal-500 bg-teal-50' : 'border-stone-200 bg-white'
                  }`}
                >
                  {LANG_FLAGS[lang]}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              className="input w-full pl-10"
              placeholder={t('supportSearchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {searchResults.length ? (
            <ul className="space-y-2">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-teal-200 bg-white p-4 text-left hover:bg-teal-50/50"
                    onClick={() => {
                      setSelectedCategory(r.categoryId);
                      setSelectedArticle(r.id);
                      setSearch('');
                    }}
                  >
                    <p className="text-xs text-teal-700">{r.categoryTitle}</p>
                    <p className="font-semibold text-stone-900">{r.title}</p>
                    <p className="mt-1 text-sm text-stone-600">{r.summary}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : article ? (
            <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-5">
              <button type="button" className="text-sm text-teal-600" onClick={() => setSelectedArticle(null)}>
                ← {t('back')}
              </button>
              <h2 className="text-lg font-bold">{article.title}</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{article.body}</p>
            </div>
          ) : (
            <>
              <ProductGuidesPage audience="merchant" embedded />
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-4 text-left transition-colors hover:border-teal-300"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedArticle(cat.articles[0]?.id || null);
                    }}
                  >
                    <h3 className="font-bold text-teal-900">{cat.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">{cat.summary}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div>
              <p className="text-xs font-semibold uppercase text-stone-500">{t('supportStatusTitle')}</p>
              <p className="text-sm text-stone-600">{t('supportStatusHint')}</p>
            </div>
            <a
              href="https://status.rebornsense.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium hover:bg-stone-100"
            >
              {t('supportCheckStatus')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      ) : null}

      {tab === 'tickets' ? (
        <div className="space-y-3">
          <select
            className="input w-full text-sm sm:max-w-xs"
            value={ticketFilter}
            onChange={(e) => setTicketFilter(e.target.value)}
          >
            <option value="open">{t('supportFilterOpen')}</option>
            <option value="answered">{t('supportFilterAnswered')}</option>
            <option value="closed">{t('supportFilterClosed')}</option>
            <option value="all">{t('all')}</option>
          </select>
          <ul className="space-y-2">
            {tickets.map((tk) => (
              <li key={tk.id}>
                <button
                  type="button"
                  onClick={() => void openTicket(tk.id)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-left hover:bg-stone-50"
                >
                  <p className="font-mono text-xs text-stone-500">{tk.ticketNumber}</p>
                  <p className="font-medium text-stone-900">{tk.subject}</p>
                  <p className="text-xs capitalize text-stone-500">{tk.status}</p>
                </button>
              </li>
            ))}
            {!tickets.length ? <p className="p-2 text-sm text-stone-500">{t('supportNoTickets')}</p> : null}
          </ul>
          <p className="px-1 text-[11px] text-stone-400">{t('supportAutoCloseHint')}</p>
        </div>
      ) : null}

      {activeTicket ? (
        <Sheet
          title={activeTicket.subject}
          subtitle={`${activeTicket.ticketNumber} · ${activeTicket.status}`}
          onClose={() => setActiveTicket(null)}
          footer={
            activeTicket.status !== 'closed' ? (
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder={t('supportTypeReply')}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void sendReply()}
                />
                <button type="button" className="btn-primary px-3" disabled={busy} onClick={() => void sendReply()}>
                  <Send className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-center text-sm text-stone-500">{t('supportTicketClosedHint')}</p>
            )
          }
        >
          <div className="space-y-3">
            {activeTicket.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.authorRole === 'merchant'
                    ? 'ml-auto bg-teal-600 text-white'
                    : m.authorRole === 'system'
                      ? 'mx-auto bg-stone-100 text-center text-xs text-stone-600'
                      : 'bg-stone-100 text-stone-800'
                }`}
              >
                {m.authorRole !== 'system' && m.authorName ? (
                  <p className="mb-0.5 text-[10px] opacity-80">{m.authorName}</p>
                ) : null}
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
            ))}
            {!activeTicket.messages.length ? (
              <div className="flex items-center justify-center gap-2 py-8 text-stone-400">
                <LifeBuoy className="h-5 w-5 opacity-40" />
                {t('supportSelectTicket')}
              </div>
            ) : null}
          </div>
        </Sheet>
      ) : null}

      {newOpen ? (
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
                      ? 'border-teal-600 bg-teal-50 text-stone-900'
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
