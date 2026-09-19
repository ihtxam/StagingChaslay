import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { Data } from '@measured/puck';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import HugeRteEditor from '@/components/editor/HugeRteEditor';
import NewsletterPuckEditor from '@/components/newsletter/NewsletterPuckEditor';
import {
  defaultNewsletterPuckData,
  isPuckNewsletterDesign,
  newsletterCopyFromT,
  newsletterPuckDataOrDefault,
  type NewsletterPuckCopy,
} from '@/components/newsletter/newsletter-puck-config';
import {
  buildNewsletterEmailHtml,
  defaultNativeNewsletter,
  isNativeNewsletterDesign,
  type NativeNewsletterDesign,
} from '@/lib/newsletter/email-html';
import { buildPuckNewsletterEmailHtml } from '@/lib/newsletter/puck-email-html';

type AudienceRow = {
  id: string | null;
  email: string;
  name: string;
  lastOrderAt?: string | null;
};

type Campaign = {
  id: string;
  title: string;
  subject: string;
  bodyHtml: string;
  designJson?: NativeNewsletterDesign | Data | { engine?: string; html?: string } | null;
  status: string;
  audience: string;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  selectedEmails?: string[] | null;
  sentAt?: string | null;
  createdAt?: string;
};

type MarketingSettings = {
  reorderReminderEnabled?: boolean;
  reorderReminderDays?: number;
  reorderReminderSubject?: string | null;
  reorderReminderBody?: string | null;
};

function puckFromStored(raw: unknown, copy?: Partial<NewsletterPuckCopy>): Data {
  if (!raw || typeof raw !== 'object') return defaultNewsletterPuckData(copy);
  const { engine: _engine, ...rest } = raw as Record<string, unknown>;
  return newsletterPuckDataOrDefault(rest as Data, copy);
}

function designFromCampaign(
  c: Campaign,
  copy?: Partial<NewsletterPuckCopy>
): {
  mode: 'simple' | 'visual';
  native: NativeNewsletterDesign;
  puck: Data;
} {
  if (isPuckNewsletterDesign(c.designJson)) {
    return {
      mode: 'visual',
      native: defaultNativeNewsletter(c.title || 'Newsletter'),
      puck: puckFromStored(c.designJson, copy),
    };
  }
  if (isNativeNewsletterDesign(c.designJson)) {
    return {
      mode: 'simple',
      native: { ...c.designJson },
      puck: defaultNewsletterPuckData(copy),
    };
  }
  const native = defaultNativeNewsletter(c.title || 'Newsletter');
  return { mode: 'simple', native, puck: defaultNewsletterPuckData(copy) };
}

export default function Newsletter() {
  const { t } = useI18n();
  const puckCopy = useMemo(() => newsletterCopyFromT(t), [t]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ configured?: boolean; provider?: string | null }>(
    {}
  );
  const [mainPanel, setMainPanel] = useState<'campaigns' | 'reminders'>('campaigns');
  const [designMode, setDesignMode] = useState<'simple' | 'visual'>('simple');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [title, setTitle] = useState('Newsletter');
  const [subject, setSubject] = useState('');
  const [design, setDesign] = useState<NativeNewsletterDesign>(() => defaultNativeNewsletter());
  const [puckData, setPuckData] = useState<Data>(() => defaultNewsletterPuckData(puckCopy));
  const [audienceMode, setAudienceMode] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [reminders, setReminders] = useState<MarketingSettings>({
    reorderReminderEnabled: false,
    reorderReminderDays: 5,
    reorderReminderSubject: '',
    reorderReminderBody: '',
  });

  const bodyHtml = useMemo(() => {
    if (designMode === 'visual') {
      return buildPuckNewsletterEmailHtml(puckData, title);
    }
    return buildNewsletterEmailHtml({ ...design, headline: design.headline || title });
  }, [design, designMode, puckData, title]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, c, s, settingsRes] = await Promise.all([
        api.get('/merchant/marketing/audience'),
        api.get('/merchant/marketing/campaigns'),
        api.get('/merchant/marketing/email-status'),
        api.get('/merchant/settings'),
      ]);
      setAudience(a.data.audience || []);
      setCampaigns(c.data.campaigns || []);
      setEmailStatus(s.data.status || {});
      const ms = settingsRes.data?.settings?.marketingSettings || {};
      setReminders({
        reorderReminderEnabled: !!ms.reorderReminderEnabled,
        reorderReminderDays: Number(ms.reorderReminderDays) || 5,
        reorderReminderSubject: ms.reorderReminderSubject || '',
        reorderReminderBody: ms.reorderReminderBody || '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('newsletterLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAudience = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return audience;
    return audience.filter(
      (r) => r.email.includes(q) || (r.name || '').toLowerCase().includes(q)
    );
  }, [audience, filter]);

  const selectedEmails = useMemo(
    () =>
      Object.keys(selected)
        .filter((e) => selected[e])
        .map((e) => e.trim().toLowerCase()),
    [selected]
  );

  const toggleRecipient = (email: string, checked: boolean) => {
    const key = email.trim().toLowerCase();
    setSelected((prev) => ({ ...prev, [key]: checked }));
  };

  const patchDesign = (partial: Partial<NativeNewsletterDesign>) => {
    setDesign((prev) => ({ ...prev, ...partial, engine: 'native' }));
  };

  const persistCampaign = async () => {
    const html =
      designMode === 'visual'
        ? buildPuckNewsletterEmailHtml(puckData, title)
        : buildNewsletterEmailHtml({ ...design, headline: design.headline || title });
    const designJson =
      designMode === 'visual'
        ? { ...puckData, engine: 'puck' }
        : { ...design, headline: design.headline || title, engine: 'native' };
    const res = await api.post('/merchant/marketing/campaigns', {
      id: campaignId || undefined,
      title,
      subject,
      bodyHtml: html,
      designJson,
      audience: audienceMode,
      selectedEmails: audienceMode === 'selected' ? selectedEmails : undefined,
    });
    setCampaignId(res.data.campaign.id);
    return { id: res.data.campaign.id as string, html };
  };

  const campaignValid = () => {
    if (!subject.trim()) return false;
    if (designMode === 'visual') {
      return (puckData.content?.length || 0) > 0;
    }
    return !!design.body.trim();
  };

  const saveDraft = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!campaignValid()) {
      toast.error(t('newsletterNeedSubjectBody'));
      return;
    }
    setSaving(true);
    try {
      await persistCampaign();
      toast.success(t('newsletterDraftSaved'));
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || t('newsletterSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    if (!emailStatus.configured) {
      toast.error(t('newsletterEmailNotConfigured'));
      return;
    }
    if (!campaignValid()) {
      toast.error(t('newsletterNeedSubjectBody'));
      return;
    }
    if (audienceMode === 'selected' && selectedEmails.length === 0) {
      toast.error(t('newsletterNeedRecipients'));
      return;
    }
    if (!window.confirm(t('newsletterSendConfirm'))) return;
    setSending(true);
    try {
      const { id } = await persistCampaign();
      const res = await api.post(`/merchant/marketing/campaigns/${id}/send`, {
        audience: audienceMode,
        selectedEmails: audienceMode === 'selected' ? selectedEmails : undefined,
      });
      toast.success(
        t('newsletterSent')
          .replace('{sent}', String(res.data.campaign.sentCount || 0))
          .replace('{failed}', String(res.data.campaign.failedCount || 0))
      );
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || t('newsletterSendFailed'));
    } finally {
      setSending(false);
    }
  };

  const saveReminders = async (e?: FormEvent) => {
    e?.preventDefault();
    setSavingReminders(true);
    try {
      await api.put('/merchant/settings', {
        marketingSettings: {
          reorderReminderEnabled: !!reminders.reorderReminderEnabled,
          reorderReminderDays: Number(reminders.reorderReminderDays) || 5,
          reorderReminderSubject: reminders.reorderReminderSubject || '',
          reorderReminderBody: reminders.reorderReminderBody || '',
        },
      });
      toast.success(t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('saveFailed'));
    } finally {
      setSavingReminders(false);
    }
  };

  const loadCampaign = (c: Campaign) => {
    const parsed = designFromCampaign(c, puckCopy);
    setDesignMode(parsed.mode);
    setDesign(parsed.native);
    setPuckData(parsed.puck);
    setCampaignId(c.id);
    setTitle(c.title || 'Newsletter');
    setSubject(c.subject || '');
    setAudienceMode(c.audience === 'selected' ? 'selected' : 'all');
    const next: Record<string, boolean> = {};
    (c.selectedEmails || []).forEach((e) => {
      next[String(e || '').trim().toLowerCase()] = true;
    });
    setSelected(next);
    setMainPanel('campaigns');
  };

  const newCampaign = () => {
    setCampaignId(null);
    setTitle('Newsletter');
    setSubject('');
    setDesign(defaultNativeNewsletter('Newsletter'));
    setPuckData(defaultNewsletterPuckData(puckCopy));
    setDesignMode('simple');
    setAudienceMode('all');
    setSelected({});
    setMainPanel('campaigns');
  };

  if (loading) {
    return <div className="text-center py-12 muted text-sm">{t('loading')}</div>;
  }

  return (
    <div
      className={
        designMode === 'visual' ? 'mx-auto max-w-[1600px] space-y-4' : 'mx-auto max-w-6xl space-y-4'
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t('newsletter')}</h1>
          <p className="page-sub">{t('newsletterHint')}</p>
        </div>
        {mainPanel === 'campaigns' ? (
          <button type="button" className="btn-secondary text-sm" onClick={newCampaign}>
            {t('newsletterNew')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={mainPanel === 'campaigns' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
          onClick={() => setMainPanel('campaigns')}
        >
          {t('newsletterCampaigns')}
        </button>
        <button
          type="button"
          className={mainPanel === 'reminders' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
          onClick={() => setMainPanel('reminders')}
        >
          {t('reorderReminder')}
        </button>
      </div>

      {!emailStatus.configured ? (
        <div className="card border-amber-200 bg-amber-50 text-amber-950 text-sm">
          {t('newsletterEmailNotConfigured')}
        </div>
      ) : (
        <p className="text-xs muted">
          {t('newsletterEmailReady')} ({emailStatus.provider || 'mailco'})
        </p>
      )}

      {mainPanel === 'reminders' ? (
        <form onSubmit={saveReminders} className="card max-w-2xl space-y-4">
          <p className="text-sm muted">{t('reorderReminderHint')}</p>
          <label className="flex items-start gap-2.5 rounded-md border border-[var(--border)] px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={!!reminders.reorderReminderEnabled}
              onChange={(e) =>
                setReminders((r) => ({ ...r, reorderReminderEnabled: e.target.checked }))
              }
            />
            <span>
              <span className="font-medium block">{t('reorderReminderEnable')}</span>
              <span className="text-xs muted">{t('reorderReminderEnableHint')}</span>
            </span>
          </label>
          <label className="block space-y-1 text-sm max-w-[10rem]">
            <span className="font-medium">{t('reorderReminderDays')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={90}
              value={reminders.reorderReminderDays ?? 5}
              onChange={(e) =>
                setReminders((r) => ({
                  ...r,
                  reorderReminderDays: Number(e.target.value) || 5,
                }))
              }
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('reorderReminderSubject')}</span>
            <input
              className="input"
              value={reminders.reorderReminderSubject || ''}
              onChange={(e) =>
                setReminders((r) => ({ ...r, reorderReminderSubject: e.target.value }))
              }
              placeholder="We miss you — order again from {{businessName}}"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('reorderReminderBody')}</span>
            <HugeRteEditor
              value={reminders.reorderReminderBody || ''}
              onChange={(html) => setReminders((r) => ({ ...r, reorderReminderBody: html }))}
              minHeight={260}
            />
            <span className="text-[11px] muted">{t('newsletterPlaceholders')}</span>
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={savingReminders}>
              {savingReminders ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={designMode === 'simple' ? 'btn-secondary text-xs' : 'text-xs underline'}
              onClick={() => setDesignMode('simple')}
            >
              {t('newsletterSimpleEditor')}
            </button>
            <button
              type="button"
              className={designMode === 'visual' ? 'btn-secondary text-xs' : 'text-xs underline'}
              onClick={() => {
                setDesignMode('visual');
                setPuckData((prev) => newsletterPuckDataOrDefault(prev, puckCopy));
              }}
            >
              {t('newsletterVisualEditor')}
            </button>
          </div>

          <div
            className={designMode === 'visual' ? 'space-y-4' : 'grid gap-4 lg:grid-cols-2'}
          >
            <div className="card space-y-4">
              <form onSubmit={saveDraft} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium">{t('newsletterTitle')}</span>
                  <input
                    className="input"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!design.headline || design.headline === 'Newsletter') {
                        patchDesign({ headline: e.target.value });
                      }
                    }}
                  />
                </label>
                <label className="block space-y-1 text-sm sm:col-span-2">
                  <span className="font-medium">{t('newsletterSubject')}</span>
                  <input
                    className="input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="{{businessName}} — news"
                    required
                  />
                </label>
              </div>

              {designMode === 'simple' ? (
                <>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t('newsletterHeadline')}</span>
                    <input
                      className="input"
                      value={design.headline}
                      onChange={(e) => patchDesign({ headline: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t('newsletterIntro')}</span>
                    <input
                      className="input"
                      value={design.intro}
                      onChange={(e) => patchDesign({ intro: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t('newsletterBody')}</span>
                    <HugeRteEditor
                      value={design.body}
                      onChange={(html) => patchDesign({ body: html })}
                      minHeight={200}
                    />
                    <span className="text-[11px] muted">{t('newsletterBodyHint')}</span>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{t('newsletterCtaLabel')}</span>
                      <input
                        className="input"
                        value={design.ctaLabel}
                        onChange={(e) => patchDesign({ ctaLabel: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{t('newsletterCtaUrl')}</span>
                      <input
                        className="input"
                        value={design.ctaUrl}
                        onChange={(e) => patchDesign({ ctaUrl: e.target.value })}
                        placeholder="{{shopUrl}}"
                      />
                    </label>
                  </div>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">{t('newsletterFooterNote')}</span>
                    <input
                      className="input"
                      value={design.footerNote}
                      onChange={(e) => patchDesign({ footerNote: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-1 text-sm max-w-[12rem]">
                    <span className="font-medium">{t('newsletterAccent')}</span>
                    <input
                      type="color"
                      className="h-10 w-full cursor-pointer rounded border border-[var(--border)] bg-white"
                      value={design.accentColor}
                      onChange={(e) => patchDesign({ accentColor: e.target.value })}
                    />
                  </label>
                </>
              ) : null}
              </form>

              {designMode === 'visual' ? (
                <>
                  <NewsletterPuckEditor
                    key={campaignId ?? 'new'}
                    data={puckData}
                    onChange={setPuckData}
                    fullPage
                    headerTitle={title || t('newsletter')}
                  />
                  <div className="space-y-2 border-t border-[var(--border)] pt-4 !bg-stone-100 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-stone-800">
                        {t('newsletterPreview')}
                      </h2>
                      <span className="text-[11px] text-stone-500">{t('newsletterPreviewHint')}</span>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                      <iframe
                        title="Newsletter preview"
                        className="h-[min(480px,50vh)] w-full border-0 bg-white"
                        srcDoc={bodyHtml}
                        sandbox=""
                      />
                    </div>
                  </div>
                </>
              ) : null}

              <form onSubmit={saveDraft} className="space-y-4">
              <p className="text-[11px] muted">{t('newsletterPlaceholders')}</p>

              <div className="space-y-2">
                <p className="text-sm font-medium">{t('newsletterAudience')}</p>
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={audienceMode === 'all'}
                      onChange={() => setAudienceMode('all')}
                    />
                    {t('newsletterAllCustomers')} ({audience.length})
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={audienceMode === 'selected'}
                      onChange={() => setAudienceMode('selected')}
                    />
                    {t('newsletterSelected')} ({selectedEmails.length})
                  </label>
                </div>
              </div>

              {audienceMode === 'selected' ? (
                <div className="space-y-2">
                  <input
                    className="input"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('newsletterFilterAudience')}
                  />
                  <div className="max-h-48 overflow-y-auto rounded border border-[var(--border)] divide-y divide-[var(--border)]">
                    {filteredAudience.map((row) => (
                      <label key={row.email} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!selected[row.email.trim().toLowerCase()]}
                          onChange={(e) => toggleRecipient(row.email, e.target.checked)}
                        />
                        <span className="truncate">{row.name || row.email}</span>
                        <span className="ml-auto text-xs muted truncate">{row.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 justify-end pt-1">
                <button type="submit" className="btn-secondary" disabled={saving}>
                  {saving ? t('saving') : t('newsletterSaveDraft')}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={sending}
                  onClick={() => void sendNow()}
                >
                  {sending ? t('sending') : t('newsletterSend')}
                </button>
              </div>
              </form>
            </div>

            {designMode === 'simple' ? (
              <div className="card space-y-2 !bg-stone-100">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-stone-800">{t('newsletterPreview')}</h2>
                  <span className="text-[11px] text-stone-500">{t('newsletterPreviewHint')}</span>
                </div>
                <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
                  <iframe
                    title="Newsletter preview"
                    className="h-[min(720px,70vh)] w-full border-0 bg-white"
                    srcDoc={bodyHtml}
                    sandbox=""
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="card space-y-2">
            <h2 className="text-sm font-semibold">{t('newsletterCampaigns')}</h2>
            {campaigns.length === 0 ? (
              <p className="text-sm muted">{t('newsletterNoCampaigns')}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {campaigns.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-xs muted truncate">
                        {c.subject} · {c.status}
                        {c.sentCount != null ? ` · ${c.sentCount} sent` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => loadCampaign(c)}
                    >
                      {t('newsletterLoad')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
