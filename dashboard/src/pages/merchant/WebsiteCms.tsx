import { FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import OpenPageEmbed from '@/components/OpenPageEmbed';
import {
  emptyOpenPageBlocks,
  isOpenPageBlocks,
  type OpenPageBlocks,
  type OpenPageSiteConfig,
} from '@/lib/cms/openpage-types';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Homepage');
  const [newTemplate, setNewTemplate] = useState('blank');
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
      const starter = emptyOpenPageBlocks(newTitle.trim() || 'Homepage');
      const res = await api.post('/merchant/cms/pages', {
        title: newTitle.trim() || 'Homepage',
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
      setEditing(page);
      setDraft(asOpenPage(page.blocks, page.title));
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
      const next: OpenPageBlocks = {
        engine: 'openpage',
        config: payload.config,
        html: payload.html,
      };
      setDraft(next);
      const ok = await persistPage(next);
      if (ok) toast.success(t('saved'));
    } finally {
      setBusy(false);
    }
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
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[var(--bg)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2 bg-[var(--bg)]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="text-sm muted hover:underline shrink-0"
              onClick={() => setEditing(null)}
            >
              ← {t('cmsBackToPages')}
            </button>
            <input
              className="input text-sm max-w-[220px]"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <label className="flex items-center gap-1.5 text-xs shrink-0">
              <input
                type="checkbox"
                checked={!!editing.isHomepage}
                onChange={(e) => setEditing({ ...editing, isHomepage: e.target.checked })}
              />
              {t('cmsIsHomepage')}
            </label>
            <span className="text-xs muted shrink-0">{editing.status}</span>
            <span className="text-xs muted shrink-0">OpenPage</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={busy}
              onClick={() => void persistPage(draft).then((ok) => ok && toast.success(t('saved')))}
            >
              {t('cmsSaveDraft')}
            </button>
            <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void publish()}>
              {t('cmsPublish')}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <OpenPageEmbed
            mode="page"
            title={editing.title}
            config={draft.config}
            className="h-full w-full border-0 rounded-none"
            onSaved={(payload) => void onBuilderSaved(payload)}
          />
        </div>
        <p className="border-t border-[var(--border)] px-3 py-1.5 text-[11px] muted">
          {t('cmsOpenPageHint')}
        </p>
      </div>
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
