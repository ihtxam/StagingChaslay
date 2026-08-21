import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Plus, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { compressImageIfNeeded } from '@/lib/compress-image';
import { useI18n } from '@/lib/i18n';
import { qrImageUrl } from '@/lib/qr';
import { signageScreenLimitOf } from '@/lib/signage-addon';

type Screen = {
  id: string;
  name: string;
  token: string;
  orientation: 'landscape' | 'portrait';
  template: string;
  playlistId: string | null;
};

type Schedule = {
  type: 'always' | 'weekdays' | 'daypart';
  weekdays?: number[];
  daypart?: 'lunch' | 'dinner';
  startTime?: string;
  endTime?: string;
};

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

const TEMPLATES = [
  { id: 'dark_pizza', key: 'signageTemplateDarkPizza' },
  { id: 'kebab_green', key: 'signageTemplateKebabGreen' },
  { id: 'cafe_cream', key: 'signageTemplateCafeCream' },
  { id: 'portrait_poster', key: 'signageTemplatePortraitPoster' },
  { id: 'lunch_special', key: 'signageTemplateLunchSpecial' },
] as const;

const WEEKDAYS = [
  { n: 1, key: 'signageMon' },
  { n: 2, key: 'signageTue' },
  { n: 3, key: 'signageWed' },
  { n: 4, key: 'signageThu' },
  { n: 5, key: 'signageFri' },
  { n: 6, key: 'signageSat' },
  { n: 7, key: 'signageSun' },
] as const;

function signagePublicUrl(token: string): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined) ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com');
  return `${origin.replace(/\/$/, '')}/tv/${token}`;
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
  const [screenPlaylistId, setScreenPlaylistId] = useState('');
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

  const copyUrl = async (token: string) => {
    const url = signagePublicUrl(token);
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
    const schedule: Schedule =
      scheduleType === 'weekdays'
        ? { type: 'weekdays', weekdays }
        : scheduleType === 'daypart'
          ? { type: 'daypart', daypart, startTime, endTime }
          : { type: 'always' };
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
    const s = activePlaylist.schedule || { type: 'always' };
    setScheduleType(s.type || 'always');
    setWeekdays(s.weekdays?.length ? s.weekdays : [1, 2, 3, 4, 5]);
    setDaypart(s.daypart === 'dinner' ? 'dinner' : 'lunch');
    setStartTime(s.startTime || (s.daypart === 'dinner' ? '17:00' : '11:00'));
    setEndTime(s.endTime || (s.daypart === 'dinner' ? '22:00' : '14:30'));
  }, [activePlaylist]);

  const addSlide = async (type: Slide['type']) => {
    if (!activePlaylist) {
      toast.error(t('signageSavePlaylistFirst'));
      return;
    }
    try {
      await api.post(`/merchant/signage/playlists/${activePlaylist.id}/slides`, {
        type,
        durationSec: type === 'menu' ? 12 : 8,
        showPrices: true,
        showPhotos: true,
        categoryIds: type === 'menu' ? categories.slice(0, 3).map((c) => c.id) : [],
      });
      toast.success(t('signageSaved'));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const patchSlide = async (id: string, patch: Partial<Slide>) => {
    try {
      await api.put(`/merchant/signage/slides/${id}`, patch);
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

  const uploadSlideImage = async (slideId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('signageImageTooLarge'));
      return;
    }
    try {
      const compressed = await compressImageIfNeeded(file, {
        maxBytes: 400 * 1024,
        maxWidth: 1920,
        targetBytes: 700 * 1024,
      });
      const fd = new FormData();
      fd.append('file', compressed);
      const res = await api.post('/merchant/media', fd);
      const url = res.data?.url as string;
      await patchSlide(slideId, { imageUrl: url });
      toast.success(t('signageSaved'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const toggleWeekday = (n: number) => {
    setWeekdays((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n]));
  };

  const toggleCategory = (slide: Slide, catId: string) => {
    const next = slide.categoryIds.includes(catId)
      ? slide.categoryIds.filter((id) => id !== catId)
      : [...slide.categoryIds, catId];
    void patchSlide(slide.id, { categoryIds: next });
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
            <div className="grid gap-3 sm:grid-cols-3">
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
              <label className="text-sm">
                {t('signagePlaylist')}
                <select
                  className="input mt-1"
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
            </div>
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
            <ul className="space-y-3">
              {screens.map((s) => {
                const url = signagePublicUrl(s.token);
                return (
                  <li key={s.id} className="rounded-xl border border-stone-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="mt-1 break-all font-mono text-xs text-stone-500">{url}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {s.orientation === 'portrait' ? t('signagePortrait') : t('signageLandscape')}
                          {' · '}
                          {t(TEMPLATES.find((x) => x.id === s.template)?.key || 'signageTemplateDarkPizza')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-stone-300 px-2 py-2 text-xs font-semibold hover:bg-stone-50"
                          onClick={() => editScreen(s)}
                        >
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                          title={t('signageCopyUrl')}
                          onClick={() => void copyUrl(s.token)}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                          title={t('signagePreviewQr')}
                          onClick={() => setQrToken(s.token)}
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-stone-300 p-2 hover:bg-stone-50"
                          title={t('signageRotateToken')}
                          onClick={() => void rotateToken(s.id)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50"
                          title={t('delete')}
                          onClick={() => void removeScreen(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <button type="button" className="btn-secondary w-full text-sm" onClick={startNewPlaylist}>
              {t('signageAddPlaylist')}
            </button>
            {playlists.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  p.id === activePlaylistId ? 'bg-teal-600 text-white' : 'bg-stone-100 hover:bg-stone-200'
                }`}
                onClick={() => setActivePlaylistId(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
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
            <label className="text-sm block">
              {t('signageSchedule')}
              <select
                className="input mt-1"
                value={scheduleType}
                onChange={(e) => {
                  const v = e.target.value;
                  setScheduleType(v === 'weekdays' || v === 'daypart' ? v : 'always');
                }}
              >
                <option value="always">{t('signageScheduleAlways')}</option>
                <option value="weekdays">{t('signageScheduleWeekdays')}</option>
                <option value="daypart">{t('signageScheduleDaypart')}</option>
              </select>
            </label>
            {scheduleType === 'weekdays' ? (
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      weekdays.includes(d.n) ? 'bg-teal-600 text-white' : 'bg-stone-100'
                    }`}
                    onClick={() => toggleWeekday(d.n)}
                  >
                    {t(d.key)}
                  </button>
                ))}
              </div>
            ) : null}
            {scheduleType === 'daypart' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  className="input"
                  value={daypart}
                  onChange={(e) => {
                    const next = e.target.value === 'dinner' ? 'dinner' : 'lunch';
                    setDaypart(next);
                    if (next === 'dinner') {
                      setStartTime('17:00');
                      setEndTime('22:00');
                    } else {
                      setStartTime('11:00');
                      setEndTime('14:30');
                    }
                  }}
                >
                  <option value="lunch">{t('signageLunch')}</option>
                  <option value="dinner">{t('signageDinner')}</option>
                </select>
                <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            ) : null}
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
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary text-xs" onClick={() => void addSlide('menu')}>
                    {t('signageAddMenuSlide')}
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => void addSlide('image')}>
                    {t('signageAddImageSlide')}
                  </button>
                  <button type="button" className="btn-secondary text-xs" onClick={() => void addSlide('image_text')}>
                    {t('signageAddImageTextSlide')}
                  </button>
                </div>
                {(activePlaylist.slides || []).map((slide) => (
                  <div key={slide.id} className="rounded-lg border border-stone-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {slide.type === 'menu'
                          ? t('signageAddMenuSlide')
                          : slide.type === 'image'
                            ? t('signageAddImageSlide')
                            : t('signageAddImageTextSlide')}
                      </p>
                      <button
                        type="button"
                        className="text-red-600 p-1"
                        onClick={() => void removeSlide(slide.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <label className="text-xs">
                      {t('signageDuration')}
                      <input
                        className="input mt-1"
                        type="number"
                        min={5}
                        max={30}
                        defaultValue={slide.durationSec}
                        onBlur={(e) => {
                          const n = Number(e.target.value);
                          if (n !== slide.durationSec) void patchSlide(slide.id, { durationSec: n });
                        }}
                      />
                    </label>
                    {slide.type === 'menu' ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={`rounded-lg px-2 py-1 text-xs ${
                                slide.categoryIds.includes(c.id)
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-stone-100'
                              }`}
                              onClick={() => toggleCategory(slide, c.id)}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={slide.showPrices}
                            onChange={(e) => {
                              void patchSlide(slide.id, { showPrices: e.target.checked });
                            }}
                          />
                          {t('signageShowPrices')}
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={slide.showPhotos}
                            onChange={(e) => {
                              void patchSlide(slide.id, { showPhotos: e.target.checked });
                            }}
                          />
                          {t('signageShowPhotos')}
                        </label>
                      </>
                    ) : (
                      <>
                        <input
                          className="input"
                          placeholder={t('signageHeadline')}
                          defaultValue={slide.headline || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (slide.headline || '')) {
                              void patchSlide(slide.id, { headline: e.target.value });
                            }
                          }}
                        />
                        {slide.type === 'image_text' ? (
                          <textarea
                            className="input"
                            rows={3}
                            placeholder={t('signageBody')}
                            defaultValue={slide.body || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (slide.body || '')) {
                                void patchSlide(slide.id, { body: e.target.value });
                              }
                            }}
                          />
                        ) : null}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadSlideImage(slide.id, file);
                          }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500">{t('signageNoPlaylists')}</p>
            )}
          </div>
        </div>
      )}

      {qrToken ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center space-y-3">
            <h2 className="font-bold">{t('signagePreviewQr')}</h2>
            <img
              src={qrImageUrl(signagePublicUrl(qrToken), 240)}
              alt=""
              className="mx-auto h-56 w-56"
            />
            <p className="break-all font-mono text-xs text-stone-500">{signagePublicUrl(qrToken)}</p>
            <div className="flex justify-center gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => void copyUrl(qrToken)}>
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
