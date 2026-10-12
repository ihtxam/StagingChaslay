import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BookOpen, ExternalLink, LifeBuoy, Paperclip, Search, Send } from 'lucide-react';
import api from '@/lib/api';
import { useI18n, type Locale } from '@/lib/i18n';
import {
  getHelpCategories,
  LANG_FLAGS,
  searchHelpArticles,
  SUPPORT_SUBCATEGORIES,
} from '@/lib/help-center/chaslay-help';
import { searchGuideChapters } from '@/lib/product-guides';
import { parseSupportTicketIdFromPath } from '@/lib/support-ticket-alert';
import { usePlatformMessagesUi } from '@/components/platform/PlatformMessagesProvider';
import ProductGuidesPage from '../shared/ProductGuidesPage';
import SoftwareUpdates from './SoftwareUpdates';

type Tab = 'help' | 'new' | 'tickets' | 'updates';

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
const TABS: Tab[] = ['help', 'new', 'tickets', 'updates'];

function parseTab(raw: string | null, ticket: string | null): Tab {
  if (ticket) return 'tickets';
  return raw && (TABS as string[]).includes(raw) ? (raw as Tab) : 'help';
}

export default function Support() {
  const { t, locale, setLocale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const platformUi = usePlatformMessagesUi();
  const ticketFromQuery = searchParams.get('ticket');
  const tab = parseTab(searchParams.get('tab'), ticketFromQuery);
  const setTab = useCallback(
    (next: Tab) => {
      const nextParams = new URLSearchParams(searchParams);
      if (next === 'help') nextParams.delete('tab');
      else nextParams.set('tab', next);
      if (next !== 'tickets') nextParams.delete('ticket');
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [guideChapterId, setGuideChapterId] = useState<string | null>(null);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketFilter, setTicketFilter] = useState('open');
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

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
  const guideResults = useMemo(
    () => (search.trim() ? searchGuideChapters('merchant', search, locale) : []),
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

  const refreshAlerts = platformUi?.refresh;
  const openTicket = useCallback(
    async (id: string) => {
      try {
        const res = await api.get(`/merchant/support/tickets/${id}`);
        setActiveTicket(res.data.ticket);
        setReply('');
        setTab('tickets');
        void refreshAlerts?.();
      } catch (e: unknown) {
        toast.error(
          (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to load ticket'
        );
      }
    },
    [refreshAlerts, setTab]
  );

  useEffect(() => {
    const fromQuery =
      ticketFromQuery ||
      parseSupportTicketIdFromPath(`${window.location.pathname}${window.location.search}`);
    if (!fromQuery) return;
    void openTicket(fromQuery);
  }, [ticketFromQuery, openTicket]);

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
      setTicketFilter('open');
      setTab('tickets');
      setActiveTicket(res.data.ticket);
      try {
        const list = await api.get('/merchant/support/tickets', { params: { status: 'open' } });
        setTickets(list.data.tickets || []);
      } catch {
        setTickets([]);
      }
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

  const ticketStatusLabel = (status: string) => {
    if (status === 'closed') return t('supportFilterClosed');
    if (status === 'answered') return t('supportFilterAnswered');
    return t('supportFilterOpen');
  };

  const closeTicket = async () => {
    if (!activeTicket || activeTicket.status === 'closed') return;
    if (!window.confirm(t('supportCloseTicketConfirm'))) return;
    setBusy(true);
    try {
      const res = await api.post(`/merchant/support/tickets/${activeTicket.id}/close`);
      setActiveTicket(res.data.ticket);
      setReply('');
      await loadTickets();
      toast.success(t('supportTicketClosedToast'));
    } catch (e: unknown) {
      toast.error(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          t('supportCloseTicketFailed')
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

  const searching = Boolean(search.trim());

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-10">
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-2">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === key ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {key === 'help'
              ? t('supportHelpCenter')
              : key === 'new'
                ? t('supportNewRequest')
                : key === 'tickets'
                  ? t('supportMyTickets')
                  : t('softwareUpdatesNav')}
          </button>
        ))}
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

          {searching ? (
            <div className="space-y-4">
              {guideResults.length ? (
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-800">
                    <BookOpen className="h-3.5 w-3.5" />
                    {t('supportGuidesHeading')}
                  </p>
                  <ul className="space-y-2">
                    {guideResults.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-rose-200 bg-white p-4 text-left hover:bg-rose-50/50"
                          onClick={() => {
                            setGuideChapterId(r.id);
                            setSelectedArticle(null);
                            setSelectedCategory(null);
                            setSearch('');
                          }}
                        >
                          <p className="text-xs text-rose-800">{t('supportGuidesHeading')}</p>
                          <p className="font-semibold text-stone-900">{r.title}</p>
                          <p className="mt-1 text-sm text-stone-600">{r.summary}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
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
                          setGuideChapterId(null);
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
              ) : null}
              {!guideResults.length && !searchResults.length ? (
                <p className="text-sm text-stone-500">{t('supportNoSearchResults')}</p>
              ) : null}
            </div>
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
              <ProductGuidesPage
                audience="merchant"
                embedded
                initialChapterId={guideChapterId || undefined}
              />
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

      {tab === 'new' ? (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-700">{t('supportNewRequest')}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setFormCategory(cat);
                  setFormSub('');
                }}
                className={`relative rounded-xl border-2 p-4 text-sm font-semibold capitalize transition-colors ${
                  formCategory === cat
                    ? 'border-red-500 bg-red-50/30 text-stone-900'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                }`}
              >
                {formCategory === cat ? (
                  <span className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    ✓
                  </span>
                ) : null}
                {t(`supportCat_${cat}` as 'supportCat_technical')}
              </button>
            ))}
          </div>

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

          <div>
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
            {formFile ? <p className="mt-1 text-xs text-stone-500">{formFile.name}</p> : null}
            <p className="mt-1 text-xs text-stone-400">.txt, .jpg, .png, .bmp, .gif, .pdf</p>
          </div>

          <button type="button" className="btn-primary w-full px-8 sm:w-auto" disabled={busy} onClick={() => void submitTicket()}>
            {t('send')}
          </button>
        </div>
      ) : null}

      {tab === 'tickets' ? (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-2">
            <select className="input w-full text-sm" value={ticketFilter} onChange={(e) => setTicketFilter(e.target.value)}>
              <option value="open">{t('supportFilterOpen')}</option>
              <option value="answered">{t('supportFilterAnswered')}</option>
              <option value="closed">{t('supportFilterClosed')}</option>
              <option value="all">{t('all')}</option>
            </select>
            <ul className="max-h-[480px] space-y-1 overflow-y-auto">
              {tickets.map((tk) => (
                <li key={tk.id}>
                  <button
                    type="button"
                    onClick={() => void openTicket(tk.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      activeTicket?.id === tk.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <p className="font-mono text-xs text-stone-500">{tk.ticketNumber}</p>
                    <p className="truncate font-medium">{tk.subject}</p>
                    <p className="text-xs capitalize text-stone-500">{ticketStatusLabel(tk.status)}</p>
                  </button>
                </li>
              ))}
              {!tickets.length ? <p className="p-2 text-sm text-stone-500">{t('supportNoTickets')}</p> : null}
            </ul>
            <p className="px-1 text-[11px] text-stone-400">{t('supportAutoCloseHint')}</p>
          </div>

          <div className="flex min-h-[360px] flex-col rounded-xl border border-stone-200 bg-white">
            {activeTicket ? (
              <>
                <div className="border-b border-stone-100 px-4 py-3">
                  <h3 className="font-semibold">{activeTicket.subject}</h3>
                  <p className="text-xs text-stone-500">
                    {activeTicket.ticketNumber} · {ticketStatusLabel(activeTicket.status)}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
                </div>
                {activeTicket.status !== 'closed' ? (
                  <div className="flex flex-col gap-2 border-t border-stone-100 p-3">
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
                    <button
                      type="button"
                      className="btn-secondary self-start text-sm"
                      disabled={busy}
                      onClick={() => void closeTicket()}
                    >
                      {t('supportCloseTicket')}
                    </button>
                  </div>
                ) : (
                  <p className="p-4 text-center text-sm text-stone-500">{t('supportTicketClosedHint')}</p>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-stone-400">
                <LifeBuoy className="mr-2 h-8 w-8 opacity-40" />
                {t('supportSelectTicket')}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'updates' ? <SoftwareUpdates embedded /> : null}
    </div>
  );
}
