import { useEffect, useState } from 'react';
import { Image as ImageIcon, LayoutGrid, Pencil, Plus, Trash2, Type, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { compressImageIfNeeded } from '@/lib/compress-image';
import { useI18n } from '@/lib/i18n';
import type { SignageSchedule, SignageScheduleWindow } from '@/lib/signage-schedule';
import SignageScheduleEditor, {
  buildScheduleFromEditor,
  scheduleEditorStateFromSchedule,
} from './SignageScheduleEditor';
import SignageSlideWizard, { slideDraftLabel, type SlideDraft } from './SignageSlideWizard';
import SignageTemplatePreview, { SIGNAGE_TEMPLATES } from './SignageTemplatePreview';

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

export type SignagePlaylist = {
  id: string;
  name: string;
  template: string;
  schedule: SignageSchedule;
  slides: Slide[];
};

type Category = { id: string; name: string };

type Props = {
  open: boolean;
  playlist: SignagePlaylist | null;
  categories: Category[];
  onClose: () => void;
  onChanged: () => void;
};

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

export default function SignagePlaylistEditModal({ open, playlist, categories, onClose, onChanged }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('dark_pizza');
  const [scheduleType, setScheduleType] = useState<SignageSchedule['type']>('always');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [daypart, setDaypart] = useState<'lunch' | 'dinner'>('lunch');
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('14:30');
  const [windows, setWindows] = useState<SignageScheduleWindow[]>([]);
  const [slideWizardOpen, setSlideWizardOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideDraft | null>(null);

  useEffect(() => {
    if (!open || !playlist) return;
    setName(playlist.name);
    setTemplate(playlist.template || 'dark_pizza');
    const st = scheduleEditorStateFromSchedule(playlist.schedule);
    setScheduleType(st.scheduleType);
    setWeekdays(st.weekdays);
    setDaypart(st.daypart);
    setStartTime(st.startTime);
    setEndTime(st.endTime);
    setWindows(st.windows);
    setEditingSlide(null);
    setSlideWizardOpen(false);
  }, [open, playlist]);

  if (!open || !playlist) return null;

  const saveMeta = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('signagePlaylistNameRequired'));
      return;
    }
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
      await api.put(`/merchant/signage/playlists/${playlist.id}`, {
        name: trimmed,
        template,
        schedule,
      });
      toast.success(t('signageSaved'));
      onChanged();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const saveSlideFromWizard = async (draft: SlideDraft) => {
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

      const isEdit = playlist.slides.some((s) => s.id === draft.tempId);
      if (isEdit) {
        await api.put(`/merchant/signage/slides/${draft.tempId}`, body);
      } else {
        await api.post(`/merchant/signage/playlists/${playlist.id}/slides`, body);
      }
      toast.success(t('signageSaved'));
      onChanged();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const removeSlide = async (id: string) => {
    if (!window.confirm(t('signageDeleteSlideConfirm'))) return;
    try {
      await api.delete(`/merchant/signage/slides/${id}`);
      onChanged();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  const removePlaylist = async () => {
    if (!window.confirm(t('signageDeletePlaylistConfirm'))) return;
    try {
      await api.delete(`/merchant/signage/playlists/${playlist.id}`);
      toast.success(t('signageSaved'));
      onClose();
      onChanged();
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
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-bold">{t('signageEditPlaylist')}</h2>
              <p className="text-xs text-stone-500">{playlist.name}</p>
            </div>
            <button type="button" className="p-2 rounded-lg hover:bg-stone-100" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <label className="block text-sm">
              {t('signagePlaylistName')}
              <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              {t('signageTemplate')}
              <select className="input mt-1 w-full" value={template} onChange={(e) => setTemplate(e.target.value)}>
                {SIGNAGE_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {t(tpl.key)}
                  </option>
                ))}
              </select>
            </label>
            <SignageTemplatePreview templateId={template} />
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

            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">{t('signageSlides')}</p>
              {(playlist.slides || []).length ? (
                <ul className="space-y-2">
                  {(playlist.slides || []).map((slide, idx) => {
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
                className="btn-secondary text-sm inline-flex items-center gap-1 w-full justify-center"
                onClick={() => {
                  setEditingSlide(null);
                  setSlideWizardOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> {t('signageAddSlide')}
              </button>
            </div>
          </div>

          <div className="flex justify-between gap-2 border-t px-4 py-3">
            <button type="button" className="btn-secondary text-sm text-red-700" onClick={() => void removePlaylist()}>
              {t('delete')}
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={onClose}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void saveMeta()}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      </div>

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
    </>
  );
}
