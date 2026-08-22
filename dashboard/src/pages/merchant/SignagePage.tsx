import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, LayoutGrid, Pencil, Plus, QrCode, RefreshCw, Trash2, Type, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { compressImageIfNeeded } from '@/lib/compress-image';
import { useI18n } from '@/lib/i18n';
import { qrImageUrl } from '@/lib/qr';
import { signageScreenLimitOf } from '@/lib/signage-addon';

import SignageTemplatePreview, { SIGNAGE_SCREEN_SIZES, SIGNAGE_TEMPLATES } from '@/components/signage/SignageTemplatePreview';
import SignagePlaylistWizard from '@/components/signage/SignagePlaylistWizard';
import SignageScheduleEditor, {
  buildScheduleFromEditor,
  scheduleEditorStateFromSchedule,
} from '@/components/signage/SignageScheduleEditor';
import SignageSlideWizard, {
  emptySlideDraft,
  slideDraftLabel,
  type SlideDraft,
} from '@/components/signage/SignageSlideWizard';
import { scheduleSummaryKey, type SignageSchedule, type SignageScheduleWindow } from '@/lib/signage-schedule';

type Screen = {
  id: string;
  name: string;
  token: string;
  shortCode?: string | null;
  orientation: 'landscape' | 'portrait';
  template: string;
  screenSizeIn?: number;
  playlistId: string | null;
};

type Schedule = SignageSchedule;

type Slide = {
  id: string;
  type: 'menu' | 'image' | 'image_text';
  durationSec: number;
  sortOrder: number;
  categoryIds: string[];
  headline?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  showPrices: boolean;
  showPhotos: boolean;
};

type Playlist = {
  id: string;
  name: string;
  template: string;
  schedule: Schedule;
  slides: Slide[];
};

type Category = { id: string; name: string };

const TEMPLATES = SIGNAGE_TEMPLATES;

function slideToDraft(slide: Slide): SlideDraft {
  return {
    tempId: slide.id,
    type: slide.type,
    durationSec: slide.durationSec,
    categoryIds: slide.categoryIds || [],
    headline: slide.headline || '',
    body: slide.body || '',
    showPrices: slide.showPrices,
    showPhotos: slide.showPhotos,
    imageUrl: slide.imageUrl || undefined,
  };
}

function signagePublicUrl(screen: Pick<Screen, 'shortCode' | 'token'>): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com');
  const code = (screen.shortCode || screen.token).trim();
  return `${origin.replace(/\/$/, '')}/tv/${code}`;
}

export default function SignagePage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'screens' | 'playlists'>('screens');
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [screenLimit, setScreenLimit] = useState(2);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [screenOrientation, setScreenOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [screenTemplate, setScreenTemplate] = useState('dark_pizza');
  const [screenSizeIn, setScreenSizeIn] = useState(32);
  const [screenPlaylistId, setScreenPlaylistId] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistTemplate, setPlaylistTemplate] = useState('dark_pizza');
  const [scheduleType, setScheduleType] = useState<Schedule['type']>('always');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [daypart, setDaypart] = useState<'lunch' | 'dinner'>('lunch');
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('14:30');
  const [windows, setWindows] = useState<SignageScheduleWindow[]>([]);
  const [slideWizardOpen, setSlideWizardOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideDraft | null>(null);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) || null,
    [playlists, activePlaylistId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        api.get('/merchant/signage/screens'),
        api.get('/merchant/signage/playlists'),
        api.get('/merchant/signage/catalog'),
      ]);
      setScreens(sRes.data?.screens || []);
      setScreenLimit(signageScreenLimitOf(sRes.data));
      const pls = (pRes.data?.playlists || []) as Playlist[];
      setPlaylists(pls);
      setCategories(cRes.data?.categories || []);
      setActivePlaylistId((prev) => prev || pls[0]?.id || null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyUrl = async (screen: Pick<Screen, 'shortCode' | 'token'>) => {
    const url = signagePublicUrl(screen);
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('signageUrlCopied'));
    } catch {
      toast.error(url);
    }
  };

  const saveScreen = async () => {
    const name = screenName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const body = {
        name,
        orientation: screenOrientation,
        template: screenTemplate,
        screenSizeIn,
        playlistId: screenPlaylistId || null,
      };
      if (editingScreenId) {
        await api.put(`/merchant/signage/screens/${editingScreenId}`, body);
      } else {
        await api.post('/merchant/signage/screens', body);
      }
      setScreenName('');
      setEditingScreenId(null);
      toast.success(t('signageSaved'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const editScreen = (s: Screen) => {
    setEditingScreenId(s.id);
    setScreenName(s.name);
    setScreenOrientation(s.orientation === 'portrait' ? 'portrait' : 'landscape');
    setScreenTemplate(s.template || 'dark_pizza');
    setScreenSizeIn(s.screenSizeIn || 32);
    setScreenPlaylistId(s.playlistId || '');
    setTab('screens');
  };

  const rotateToken = async (id: string) => {
    try {
      await api.post(`/merchant/signage/screens/${id}/rotate-token`);
      toast.success(t('signageTokenRotated'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const removeScreen = async (id: string) => {
    if (!window.confirm(t('signageDeleteScreenConfirm'))) return;
    try {
      await api.delete(`/merchant/signage/screens/${id}`);
      toast.success(t('signageSaved'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const savePlaylistMeta = async () => {
    const name = playlistName.trim() || activePlaylist?.name;
    if (!name) return;
    const schedule = buildScheduleFromEditor({
      scheduleType,
      weekdays,
      daypart,
      startTime,
      endTime,
      windows,
    });
    setBusy(true);
    try {
      if (activePlaylist) {
        await api.put(`/merchant/signage/playlists/${activePlaylist.id}`, {
          name,
          template: playlistTemplate,
          schedule,
        });
      } else {
        const res = await api.post('/merchant/signage/playlists', {
          name,
          template: playlistTemplate,
          schedule,
        });
        setActivePlaylistId(res.data?.playlist?.id || null);
      }
      toast.success(t('signageSaved'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const startNewPlaylist = () => {
    setActivePlaylistId(null);
    setPlaylistName('');
    setPlaylistTemplate('dark_pizza');
    setScheduleType('always');
    setWeekdays([1, 2, 3, 4, 5]);
    setDaypart('lunch');
    setStartTime('11:00');
    setEndTime('14:30');
    setTab('playlists');
  };

  useEffect(() => {
    if (!activePlaylist) return;
    setPlaylistName(activePlaylist.name);
    setPlaylistTemplate(activePlaylist.template || 'dark_pizza');
    const st = scheduleEditorStateFromSchedule(activePlaylist.schedule);
    setScheduleType(st.scheduleType);
    setWeekdays(st.weekdays);
    setDaypart(st.daypart);
    setStartTime(st.startTime);
    setEndTime(st.endTime);
    setWindows(st.windows);
  }, [activePlaylist]);

  const saveSlideFromWizard = async (draft: SlideDraft) => {
    if (!activePlaylist) {
      toast.error(t('signageSavePlaylistFirst'));
      return;
    }
    try {
      let imageUrl = draft.imageUrl;
      if (draft.imageFile) {
        if (draft.imageFile.size > 5 * 1024 * 1024) {
          toast.error(t('signageImageTooLarge'));
          return;
        }
        const compressed = await compressImageIfNeeded(draft.imageFile, {
          maxBytes: 400 * 1024,
          maxWidth: 1920,
          targetBytes: 700 * 1024,
        });
        const fd = new FormData();
        fd.append('file', compressed);
        const res = await api.post('/merchant/media', fd);
        imageUrl = res.data?.url as string;
      }

      const body = {
        type: draft.type,
        durationSec: draft.durationSec,
        showPrices: draft.showPrices,
        showPhotos: draft.showPhotos,
        categoryIds: draft.type === 'menu' ? draft.categoryIds : [],
        headline: draft.type !== 'menu' ? draft.headline || t('signageDefaultHeadline') : undefined,
        body: draft.type === 'image_text' ? draft.body : undefined,
        imageUrl: draft.type !== 'menu' ? imageUrl : undefined,
      };

      const isEdit = activePlaylist.slides.some((s) => s.id === draft.tempId);
      if (isEdit) {
        await api.put(`/merchant/signage/slides/${draft.tempId}`, body);
      } else {
        await api.post(`/merchant/signage/playlists/${activePlaylist.id}/slides`, body);
      }
      toast.success(t('signageSaved'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const removeSlide = async (id: string) => {
    if (!window.confirm(t('signageDeleteSlideConfirm'))) return;
    try {
      await api.delete(`/merchant/signage/slides/${id}`);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const removePlaylist = async (id: string) => {
    if (!window.confirm(t('signageDeletePlaylistConfirm'))) return;
    try {
      await api.delete(`/merchant/signage/playlists/${id}`);
      setActivePlaylistId(null);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const slideTypeIcon = (type: Slide['type']) => {
    if (type === 'menu') return LayoutGrid;
    if (type === 'image_text') return Type;
    return ImageIcon;
  };

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">{t('signageTitle')}</h1>
        <p className="mt-1 text-sm text-stone-500">{t('signageHint')}</p>
        <p className="mt-1 text-xs text-stone-400">{t('signageSaveLiveHint')}</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === 'screens' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700'
          }`}
          onClick={() => setTab('screens')}
        >
          {t('signageScreens')} ({screens.length}/{screenLimit})
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            tab === 'playlists' ? 'bg-teal-600 text-white' : 'bg-stone-100 text-stone-700'
          }`}
          onClick={() => setTab('playlists')}
        >
          {t('signagePlaylists')}
        </button>
      </div>

      {loading ? <p className="text-sm text-stone-500">{t('loading')}</p> : null}

      {tab === 'screens' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium">
              {editingScreenId ? t('signageEditScreen') : t('signageAddScreen')}
            </p>
            <input
              className="input w-full"
              value={screenName}
              onChange={(e) => setScreenName(e.target.value)}
              placeholder={t('signageScreenNamePh')}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                {t('signageOrientation')}
                <select
                  className="input mt-1"
                  value={screenOrientation}
                  onChange={(e) =>
                    setScreenOrientation(e.target.value === 'portrait' ? 'portrait' : 'landscape')
                  }
                >
                  <option value="landscape">{t('signageLandscape')}</option>
                  <option value="portrait">{t('signagePortrait')}</option>
                </select>
              </label>
              <label className="text-sm">
                {t('signageScreenSize')}
                <select className="input mt-1" value={screenSizeIn} onChange={(e) => setScreenSizeIn(Number(e.target.value))}>
                  {SIGNAGE_SCREEN_SIZES.map((n) => (
                    <option key={n} value={n}>{n}"</option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                {t('signageTemplate')}
                <select
                  className="input mt-1"
                  value={screenTemplate}
                  onChange={(e) => setScreenTemplate(e.target.value)}
                >
                  {TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {t(tpl.key)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SignageTemplatePreview templateId={screenTemplate} className="max-w-xs" />
            <label className="text-sm block">
              {t('signagePlaylist')}
              <select
                className="input mt-1 w-full max-w-md"
                value={screenPlaylistId}
                onChange={(e) => setScreenPlaylistId(e.target.value)}
              >
                <option value="">{t('signageNoPlaylist')}</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !screenName.trim() || (!editingScreenId && screens.length >= screenLimit)}
                onClick={() => void saveScreen()}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {editingScreenId ? t('save') : t('signageAddScreen')}
              </button>
              {editingScreenId ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingScreenId(null);
                    setScreenName('');
                  }}
                >
                  {t('cancel')}
                </button>
              ) : null}
            </div>
            {!editingScreenId && screens.length >= screenLimit ? (
              <p className="text-xs text-amber-700">{t('signageLimitReached')}</p>
            ) : null}
          </div>

          {!screens.length ? (
            <p className="text-sm text-stone-500">{t('signageNoScreens')}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {screens.map((s) => {
                const url = signagePublicUrl(s);
                const code = s.shortCode || s.token.slice(0, 8);
                return (
                  <li key={s.id} className="rounded-xl border border-stone-200 bg-white p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-stone-900">{s.name}</p>
                        <p className="mt-1 text-2xl font-mono font-bold tracking-wider text-teal-700">{code}</p>
                        <p className="mt-1 text-xs text-stone-500 break-all">{url}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600">
                        {s.screenSizeIn || 32}"
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">
                      {s.orientation === 'portrait' ? t('signagePortrait') : t('signageLandscape')}
                      {' · '}
                      {t(TEMPLATES.find((x) => x.id === s.template)?.key || 'signageTemplateDarkPizza')}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <button type="button" className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-semibold hover:bg-stone-50" onClick={() => editScreen(s)}>
                        {t('edit')}
                      </button>
                      <button type="button" className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50" title={t('signageCopyUrl')} onClick={() => void copyUrl(s)}>
                        <Copy className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50" title={t('signagePreviewQr')} onClick={() => setQrToken(s.shortCode || s.token)}>
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-lg border border-stone-300 p-1.5 hover:bg-stone-50" title={t('signageRotateToken')} onClick={() => void rotateToken(s.id)}>
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button type="button" className="rounded-lg border border-red-200 p-1.5 text-red-700 hover:bg-red-50" title={t('delete')} onClick={() => void removeScreen(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-4">
            <p className="text-sm font-medium text-teal-900">{t('signagePlaylistWhatTitle')}</p>
            <p className="mt-1 text-sm text-teal-800/90">{t('signagePlaylistHelp')}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-stone-700">{t('signagePlaylists')}</h2>
            <button type="button" className="btn-primary text-sm inline-flex items-center gap-1" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" /> {t('signageAddPlaylist')}
            </button>
          </div>

          {!playlists.length ? (
            <p className="text-sm text-stone-500">{t('signageNoPlaylists')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((p) => {
                const slideCount = p.slides?.length || 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePlaylistId(p.id)}
                    className={`text-left rounded-xl border p-4 transition-shadow hover:shadow-md ${
                      p.id === activePlaylistId ? 'border-teal-500 ring-2 ring-teal-200 bg-teal-50/30' : 'border-stone-200 bg-white'
                    }`}
                  >
                    <p className="font-semibold text-stone-900">{p.name}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {t(TEMPLATES.find((x) => x.id === p.template)?.key || 'signageTemplateDarkPizza')}
                    </p>
                    <p className="mt-2 text-xs text-stone-600">
                      {slideCount} {t('signageSlides').toLowerCase()} · {t(scheduleSummaryKey(p.schedule))}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                {t('signagePlaylistName')}
                <input
                  className="input mt-1"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                />
              </label>
              <label className="text-sm">
                {t('signageTemplate')}
                <select
                  className="input mt-1"
                  value={playlistTemplate}
                  onChange={(e) => setPlaylistTemplate(e.target.value)}
                >
                  {TEMPLATES.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {t(tpl.key)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SignageTemplatePreview templateId={playlistTemplate} className="max-w-xs" />
            <SignageScheduleEditor
              scheduleType={scheduleType}
              onScheduleTypeChange={setScheduleType}
              weekdays={weekdays}
              onWeekdaysChange={setWeekdays}
              daypart={daypart}
              onDaypartChange={setDaypart}
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              windows={windows}
              onWindowsChange={setWindows}
            />
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void savePlaylistMeta()}>
                {t('save')}
              </button>
              {activePlaylist ? (
                <button
                  type="button"
                  className="btn-secondary text-sm text-red-700"
                  onClick={() => void removePlaylist(activePlaylist.id)}
                >
                  {t('delete')}
                </button>
              ) : null}
            </div>

            {activePlaylist ? (
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">{t('signageSlides')}</p>
                {(activePlaylist.slides || []).length ? (
                  <ul className="space-y-2">
                    {(activePlaylist.slides || []).map((slide, idx) => {
                      const Icon = slideTypeIcon(slide.type);
                      const draft = slideToDraft(slide);
                      return (
                        <li
                          key={slide.id}
                          className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-teal-600" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-stone-500">
                              {t('signageSlideN').replace('{n}', String(idx + 1))}
                            </p>
                            <p className="text-sm truncate">{slideDraftLabel(draft, t, categories)}</p>
                          </div>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg hover:bg-stone-100"
                            title={t('edit')}
                            onClick={() => {
                              setEditingSlide(draft);
                              setSlideWizardOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                            title={t('delete')}
                            onClick={() => void removeSlide(slide.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-stone-500">{t('signageSlideListEmpty')}</p>
                )}
                <button
                  type="button"
                  className="btn-secondary text-sm inline-flex items-center gap-1"
                  onClick={() => {
                    setEditingSlide(null);
                    setSlideWizardOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> {t('signageAddSlide')}
                </button>
              </div>
            ) : (
              <p className="text-sm text-stone-500">{t('signageNoPlaylists')}</p>
            )}
          </div>
        </div>
      )}

      <SignagePlaylistWizard
        open={wizardOpen}
        categories={categories}
        onClose={() => setWizardOpen(false)}
        onCreated={(id) => {
          setActivePlaylistId(id);
          void load();
        }}
      />

      <SignageSlideWizard
        open={slideWizardOpen}
        categories={categories}
        initial={editingSlide}
        onClose={() => {
          setSlideWizardOpen(false);
          setEditingSlide(null);
        }}
        onSave={(draft) => void saveSlideFromWizard(draft)}
      />

      {qrToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center space-y-3">
            <h2 className="font-bold">{t('signagePreviewQr')}</h2>
            <img
              src={qrImageUrl(signagePublicUrl({ shortCode: qrToken.length <= 8 ? qrToken : null, token: qrToken }), 240)}
              alt=""
              className="mx-auto h-56 w-56"
            />
            <p className="font-mono text-2xl font-bold text-teal-700">{qrToken.length <= 8 ? qrToken : qrToken.slice(0, 8)}</p>
            <p className="break-all font-mono text-xs text-stone-500">{signagePublicUrl({ shortCode: qrToken.length <= 8 ? qrToken : null, token: qrToken })}</p>
            <div className="flex justify-center gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => void copyUrl({ shortCode: qrToken.length <= 8 ? qrToken : null, token: qrToken })}>
                {t('signageCopyUrl')}
              </button>
              <button type="button" className="btn-primary text-sm" onClick={() => setQrToken(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
