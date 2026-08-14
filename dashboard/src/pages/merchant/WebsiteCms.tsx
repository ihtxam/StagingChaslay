import { FormEvent, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import OpenPageEmbed from '@/components/OpenPageEmbed';
import {
  emptyOpenPageBlocks,
  isOpenPageBlocks,
  resolveOpenPageConfig,
  withLocaleBundle,
  type CmsLocale,
  type OpenPageBlocks,
  type OpenPageSiteConfig,
} from '@/lib/cms/openpage-types';
import { starterForTemplate } from '@/lib/cms/openpage-starters';

const CMS_LOCALES: CmsLocale[] = ['en', 'fr', 'de'];

type CmsPage = {
  id: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  status: string;
  templateKey?: string | null;
  blocks: OpenPageBlocks | unknown;
  theme?: Record<string, unknown> | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

type Template = { key: string; name: string; description: string };

type Site = {
  customDomain: string | null;
  cmsHomepageEnabled: boolean;
  shopEnabled: boolean;
  slug?: string | null;
  subdomain?: string | null;
  name?: string;
  shopCustomDomainUrl?: string | null;
};

function asOpenPage(blocks: unknown, title = 'Homepage'): OpenPageBlocks {
  if (isOpenPageBlocks(blocks)) return blocks;
  return emptyOpenPageBlocks(title);
}

function themeStr(theme: Record<string, unknown> | null | undefined, key: string, fallback: string): string {
  const v = theme?.[key];
  return typeof v === 'string' ? v : fallback;
}

export default function WebsiteCms() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [site, setSite] = useState<Site | null>(null);
  const [customDomain, setCustomDomain] = useState('');
  const [savingSite, setSavingSite] = useState(false);
  const [editing, setEditing] = useState<CmsPage | null>(null);
  const [draft, setDraft] = useState<OpenPageBlocks>(emptyOpenPageBlocks());
  const [editLocale, setEditLocale] = useState<CmsLocale>('en');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Homepage');
  const [newTemplate, setNewTemplate] = useState('food_truck');
  const [asHomepage, setAsHomepage] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pagesRes, templatesRes, siteRes] = await Promise.all([
        api.get('/merchant/cms/pages'),
        api.get('/merchant/cms/templates'),
        api.get('/merchant/cms/site'),
      ]);
      const nextPages = (pagesRes.data.pages || []) as CmsPage[];
      setPages(nextPages);
      setTemplates(templatesRes.data.templates || []);
      const s = siteRes.data.site as Site;
      setSite(s);
      setCustomDomain(s.customDomain || '');
      if (!nextPages.length) {
        setCreateOpen(true);
        setAsHomepage(true);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSite = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSite(true);
    try {
      const res = await api.put('/merchant/cms/site', {
        customDomain: customDomain.trim() || null,
        cmsHomepageEnabled: site?.cmsHomepageEnabled,
      });
      setSite((prev) => ({ ...(prev || ({} as Site)), ...res.data.site }));
      toast.success(t('saved'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    } finally {
      setSavingSite(false);
    }
  };

  const createPage = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const title = newTitle.trim() || 'Homepage';
      // Use the selected template (food truck by default) — do not always send blank.
      const starter = starterForTemplate(newTemplate, title);
      const res = await api.post('/merchant/cms/pages', {
        title,
        isHomepage: asHomepage,
        templateKey: newTemplate,
        status: 'draft',
        blocks: starter,
      });
      const page = res.data.page as CmsPage;
      setCreateOpen(false);
      setEditing(page);
      setDraft(asOpenPage(page.blocks, page.title));
      await load();
      toast.success(t('cmsPageCreated'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  const openEditor = async (pageId: string) => {
    try {
      const res = await api.get(`/merchant/cms/pages/${pageId}`);
      const page = res.data.page as CmsPage;
      const blocks = asOpenPage(page.blocks, page.title);
      setEditing(page);
      setDraft(blocks);
      setEditLocale(blocks.defaultLocale || 'en');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsLoadFailed'));
    }
  };

  const persistPage = async (data: OpenPageBlocks, status?: 'draft' | 'published') => {
    if (!editing) return false;
    try {
      const res = await api.put(`/merchant/cms/pages/${editing.id}`, {
        title: editing.title,
        slug: editing.slug,
        isHomepage: editing.isHomepage,
        blocks: data,
        theme: data.config.theme || editing.theme || null,
        status: status || editing.status,
      });
      const page = res.data.page as CmsPage;
      setEditing(page);
      setDraft(asOpenPage(page.blocks, page.title));
      await load();
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
      return false;
    }
  };

  const onBuilderSaved = async (payload: { config: OpenPageSiteConfig; html: string }) => {
    setBusy(true);
    try {
      const next = withLocaleBundle(draft, editLocale, {
        config: payload.config,
        html: payload.html,
      });
      setDraft(next);
      const ok = await persistPage(next);
      if (ok) toast.success(`${t('saved')} (${editLocale.toUpperCase()})`);
    } finally {
      setBusy(false);
    }
  };

  const switchEditLocale = (locale: CmsLocale) => {
    if (locale === editLocale) return;
    setEditLocale(locale);
  };

  const publish = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const ok = await persistPage(draft, 'published');
      if (ok) toast.success(t('cmsPublished'));
    } finally {
      setBusy(false);
    }
  };

  const deletePage = async (pageId: string) => {
    if (!confirm(t('cmsDeleteConfirm'))) return;
    try {
      await api.delete(`/merchant/cms/pages/${pageId}`);
      if (editing?.id === pageId) {
        setEditing(null);
        setDraft(emptyOpenPageBlocks());
      }
      await load();
      toast.success(t('deleted'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('cmsSaveFailed'));
    }
  };

  if (loading) {
    return <div className="p-4 text-sm muted">{t('loading')}</div>;
  }

  if (editing) {
    const pageTheme = resolveOpenPageConfig(draft, editLocale).theme;
    const shellBg = themeStr(pageTheme, 'bg0', '#171210');
    const shellPanel = themeStr(pageTheme, 'bg1', '#1e1816');
    const shellBorder = themeStr(pageTheme, 'borderDefault', '#352e28');
    const shellText = themeStr(pageTheme, 'text0', '#faf6f0');
    const shellMuted = themeStr(pageTheme, 'text2', '#a89a88');
    const shellAccent = themeStr(pageTheme, 'accent', '#e8a838');

    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex flex-col"
        style={{ backgroundColor: shellBg, color: shellText }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
          style={{ backgroundColor: shellPanel, borderBottom: `1px solid ${shellBorder}` }}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <button
              type="button"
              className="shrink-0 text-sm hover:underline"
              style={{ color: shellMuted }}
              onClick={() => setEditing(null)}
            >
              ← {t('cmsBackToPages')}
            </button>
            <input
              className="input max-w-[220px] text-sm"
              style={{
                borderColor: shellBorder,
                backgroundColor: shellBg,
                color: shellText,
              }}
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs" style={{ color: shellMuted }}>
              <input
                type="checkbox"
                checked={!!editing.isHomepage}
                onChange={(e) => setEditing({ ...editing, isHomepage: e.target.checked })}
              />
              {t('cmsIsHomepage')}
            </label>
            <span className="shrink-0 text-xs" style={{ color: shellMuted }}>
              {editing.status}
            </span>
            <div
              className="inline-flex overflow-hidden rounded-lg"
              style={{ border: `1px solid ${shellBorder}` }}
            >
              {CMS_LOCALES.map((loc) => {
                const has = !!draft.locales?.[loc]?.html || (loc === (draft.defaultLocale || 'en') && !!draft.html);
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => switchEditLocale(loc)}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase"
                    style={
                      editLocale === loc
                        ? { backgroundColor: shellAccent, color: '#171210' }
                        : { backgroundColor: shellBg, color: shellMuted }
                    }
                    title={has ? t('cmsLocaleReady') : t('cmsLocaleMissing')}
                  >
                    {loc}
                    {has ? '' : ' ·'}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              className="text-xs underline"
              style={{ color: shellMuted }}
              href="/openpage/?embed=1#/editor"
              target="_blank"
              rel="noreferrer"
            >
              {t('cmsOpenInNewTab')}
            </a>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => void persistPage(draft).then((ok) => ok && toast.success(t('saved')))}
            >
              {t('cmsSaveDraft')}
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy}
              onClick={() => void publish()}
            >
              {t('cmsPublish')}
            </button>
          </div>
        </div>
        <p
          className="px-3 py-1.5 text-[11px]"
          style={{
            borderBottom: `1px solid ${shellBorder}`,
            backgroundColor: `${shellAccent}22`,
            color: shellText,
          }}
        >
          {t('cmsBuilderSaveHint')} {t('cmsLocaleHint').replace('{lang}', editLocale.toUpperCase())}
        </p>
        <div className="relative min-h-0 flex-1 overflow-hidden" style={{ backgroundColor: shellBg }}>
          <OpenPageEmbed
            key={`${editing.id}-${editLocale}`}
            mode="page"
            title={editing.title}
            config={resolveOpenPageConfig(draft, editLocale)}
            className="relative h-full min-h-0 w-full rounded-none border-0"
            shellBg={shellBg}
            onSaved={(payload) => void onBuilderSaved(payload)}
          />
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">{t('cmsWebsite')}</h1>
        <p className="text-sm muted mt-1">{t('cmsWebsiteHint')}</p>
        <p className="text-xs muted mt-1">{t('cmsOpenPageHint')}</p>
      </div>

      <form onSubmit={saveSite} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
        <h2 className="text-sm font-semibold">{t('cmsCustomDomain')}</h2>
        <p className="text-xs muted">{t('cmsDnsGoCreate')}</p>
        <table className="w-full max-w-md text-xs border border-[var(--border)]">
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium w-24">Type</th>
              <td className="px-2 py-1.5 font-mono">CNAME</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">Host</th>
              <td className="px-2 py-1.5 font-mono">www</td>
            </tr>
            <tr>
              <th className="bg-[var(--bg-muted)] px-2 py-1.5 text-left font-medium">Points to</th>
              <td className="px-2 py-1.5 font-mono">shop.chaslay.com</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs muted">{t('cmsDnsThenEnter')}</p>
        <input
          className="input max-w-md"
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          placeholder="www.mycafe.ch"
        />
        {site?.shopCustomDomainUrl ? (
          <p className="text-xs">
            <a className="underline" href={site.shopCustomDomainUrl} target="_blank" rel="noreferrer">
              {site.shopCustomDomainUrl}
            </a>
          </p>
        ) : null}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={savingSite}>
            {savingSite ? t('saving') : t('save')}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t('cmsPages')}</h2>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setCreateOpen(true);
            setAsHomepage(pages.length === 0);
          }}
        >
          {t('cmsNewPage')}
        </button>
      </div>

      {createOpen ? (
        <form
          onSubmit={createPage}
          className="rounded-md border-2 border-[var(--accent)] bg-[var(--bg)] p-4 space-y-3 shadow-sm"
        >
          <h3 className="text-sm font-semibold">{t('cmsCreatePageTitle')}</h3>
          <p className="text-xs muted">{t('cmsCreatePageHint')}</p>
          <label className="text-xs font-medium block">{t('title')}</label>
          <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
          <label className="text-xs font-medium block">{t('cmsTemplate')}</label>
          <select className="input" value={newTemplate} onChange={(e) => setNewTemplate(e.target.value)}>
            {templates.map((tpl) => (
              <option key={tpl.key} value={tpl.key}>
                {tpl.name} - {tpl.description}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={asHomepage} onChange={(e) => setAsHomepage(e.target.checked)} />
            {t('cmsIsHomepage')}
          </label>
          <div className="flex gap-2 justify-end">
            {pages.length > 0 ? (
              <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
                {t('cancel')}
              </button>
            ) : null}
            <button type="submit" className="btn-primary">
              {t('cmsCreateAndEdit')}
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-2">
        {pages.length === 0 && !createOpen ? (
          <div className="border border-dashed border-[var(--border)] rounded-md p-6 text-center space-y-3">
            <p className="text-sm muted">{t('cmsNoPages')}</p>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
              {t('cmsCreateHomepage')}
            </button>
          </div>
        ) : null}
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-4 py-3"
          >
            <div>
              <p className="font-medium text-sm">
                {page.title}
                {page.isHomepage ? (
                  <span className="ml-2 text-xs font-normal muted">({t('cmsHomepageBadge')})</span>
                ) : null}
              </p>
              <p className="text-xs muted">
                /{page.slug} · {page.status}
                {isOpenPageBlocks(page.blocks) ? ' · OpenPage' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => void openEditor(page.id)}>
                {t('cmsOpenBuilder')}
              </button>
              <button type="button" className="text-sm text-red-600 px-2" onClick={() => void deletePage(page.id)}>
                {t('delete')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
