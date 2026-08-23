import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import {
  buildNewsletterEmailHtml,
  defaultNativeNewsletter,
  isNativeNewsletterDesign,
  type NativeNewsletterDesign,
} from '@/lib/newsletter/email-html';

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
  designJson?: NativeNewsletterDesign | { engine?: string; html?: string } | null;
  status: string;
  audience: string;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  selectedEmails?: string[] | null;
  sentAt?: string | null;
  createdAt?: string;
};

function designFromCampaign(c: Campaign): NativeNewsletterDesign {
  if (isNativeNewsletterDesign(c.designJson)) return { ...c.designJson };
  return defaultNativeNewsletter(c.title || 'Newsletter');
}

export default function Newsletter() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ configured?: boolean; provider?: string | null }>(
    {}
  );
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [title, setTitle] = useState('Newsletter');
  const [subject, setSubject] = useState('');
  const [design, setDesign] = useState<NativeNewsletterDesign>(() => defaultNativeNewsletter());
  const [audienceMode, setAudienceMode] = useState<'all' | 'selected'>('all');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');

  const bodyHtml = useMemo(() => buildNewsletterEmailHtml(design), [design]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, c, s] = await Promise.all([
        api.get('/merchant/marketing/audience'),
        api.get('/merchant/marketing/campaigns'),
        api.get('/merchant/marketing/email-status'),
      ]);
      setAudience(a.data.audience || []);
      setCampaigns(c.data.campaigns || []);
      setEmailStatus(s.data.status || {});
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
    const html = buildNewsletterEmailHtml({ ...design, headline: design.headline || title });
    const res = await api.post('/merchant/marketing/campaigns', {
      id: campaignId || undefined,
      title,
      subject,
      bodyHtml: html,
      designJson: { ...design, headline: design.headline || title, engine: 'native' },
      audience: audienceMode,
      selectedEmails: audienceMode === 'selected' ? selectedEmails : undefined,
    });
    setCampaignId(res.data.campaign.id);
    return { id: res.data.campaign.id as string, html };
  };

  const saveDraft = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!subject.trim() || !design.body.trim()) {
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
    if (!subject.trim() || !design.body.trim()) {
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

  const loadCampaign = (c: Campaign) => {
    setCampaignId(c.id);
    setTitle(c.title || 'Newsletter');
    setSubject(c.subject || '');
    setDesign(designFromCampaign(c));
    setAudienceMode(c.audience === 'selected' ? 'selected' : 'all');
    const next: Record<string, boolean> = {};
    (c.selectedEmails || []).forEach((e) => {
      next[String(e || '').trim().toLowerCase()] = true;
    });
    setSelected(next);
  };

  const newCampaign = () => {
    setCampaignId(null);
    setTitle('Newsletter');
    setSubject('');
    setDesign(defaultNativeNewsletter('Newsletter'));
    setAudienceMode('all');
    setSelected({});
  };

  if (loading) {
    return <div className="text-center py-12 muted text-sm">{t('loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t('newsletter')}</h1>
          <p className="page-sub">{t('newsletterHint')}</p>
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={newCampaign}>
          {t('newsletterNew')}
        </button>
      </div>

      {!emailStatus.configured ? (
        <div className="card border-amber-200 bg-amber-50 text-amber-950 text-sm">
          {t('newsletterEmailNotConfigured')}
        </div>
      ) : (
        <p className="text-xs muted">
          {t('newsletterEmailReady')} ({emailStatus.provider || 'brevo'})
        </p>
      )}

      <form onSubmit={saveDraft} className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-4">
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
            <textarea
              className="input min-h-[160px] font-sans"
              value={design.body}
              onChange={(e) => patchDesign({ body: e.target.value })}
              placeholder={t('newsletterBodyPlaceholder')}
              required
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
        </div>

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
      </form>

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
                <button type="button" className="btn-secondary text-xs" onClick={() => loadCampaign(c)}>
                  {t('newsletterLoad')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
