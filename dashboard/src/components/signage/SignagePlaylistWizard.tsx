import { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, LayoutGrid, Pencil, Plus, Trash2, Type, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { compressImageIfNeeded } from '@/lib/compress-image';
import { useI18n } from '@/lib/i18n';
import { defaultScheduleWindow, type SignageScheduleWindow } from '@/lib/signage-schedule';
import SignageScheduleEditor, { buildScheduleFromEditor } from './SignageScheduleEditor';
import SignageTemplatePreview, { SIGNAGE_TEMPLATES } from './SignageTemplatePreview';
import SignageSlideWizard, {
  slideDraftLabel,
  type SlideDraft,
} from './SignageSlideWizard';

type Category = { id: string; name: string };

type Props = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (playlistId: string) => void;
};

async function uploadImage(file: File): Promise<string> {
  const compressed = await compressImageIfNeeded(file, {
    maxBytes: 400 * 1024,
    maxWidth: 1920,
    targetBytes: 700 * 1024,
  });
  const fd = new FormData();
  fd.append('file', compressed);
  const res = await api.post('/merchant/media', fd);
  const url = res.data?.url as string;
  if (!url) throw new Error('Upload failed');
  return url;
}

export default function SignagePlaylistWizard({ open, categories, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('dark_pizza');
  const [scheduleType, setScheduleType] = useState<'always' | 'weekdays' | 'daypart' | 'windows'>('always');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [daypart, setDaypart] = useState<'lunch' | 'dinner'>('lunch');
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('14:30');
  const [windows, setWindows] = useState<SignageScheduleWindow[]>([
    defaultScheduleWindow('lunch'),
    defaultScheduleWindow('dinner'),
  ]);
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [slideWizardOpen, setSlideWizardOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<SlideDraft | null>(null);

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setName('');
    setTemplate('dark_pizza');
    setScheduleType('always');
    setWeekdays([1, 2, 3, 4, 5]);
    setDaypart('lunch');
    setStartTime('11:00');
    setEndTime('14:30');
    setWindows([defaultScheduleWindow('lunch'), defaultScheduleWindow('dinner')]);
    setSlides([]);
    setEditingSlide(null);
    setSlideWizardOpen(false);
  };

  const schedule = buildScheduleFromEditor({
    scheduleType,
    weekdays,
    daypart,
    startTime,
    endTime,
    windows,
  });

  const saveSlideDraft = (draft: SlideDraft) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.tempId === draft.tempId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = draft;
        return next;
      }
      return [...prev, draft];
    });
    setEditingSlide(null);
  };

  const finish = async () => {
    if (!name.trim()) {
      toast.error(t('signagePlaylistNameRequired'));
      return;
    }
    if (!slides.length) {
      toast.error(t('signageSlideListEmpty'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/merchant/signage/playlists', { name: name.trim(), template, schedule });
      const playlistId = res.data?.playlist?.id as string;
      if (!playlistId) throw new Error('Failed');

      for (const slide of slides) {
        let imageUrl = slide.imageUrl;
        if (slide.imageFile) imageUrl = await uploadImage(slide.imageFile);
        await api.post(`/merchant/signage/playlists/${playlistId}/slides`, {
          type: slide.type,
          durationSec: slide.durationSec,
          showPrices: slide.showPrices,
          showPhotos: slide.showPhotos,
          categoryIds: slide.type === 'menu' ? slide.categoryIds : [],
          headline: slide.type !== 'menu' ? slide.headline || t('signageDefaultHeadline') : undefined,
          body: slide.type === 'image_text' ? slide.body : undefined,
          imageUrl: slide.type !== 'menu' ? imageUrl : undefined,
        });
      }

      toast.success(t('signageSaved'));
      reset();
      onCreated(playlistId);
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const slideTypeIcon = (type: SlideDraft['type']) => {
    if (type === 'menu') return LayoutGrid;
    if (type === 'image_text') return Type;
    return ImageIcon;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-elevated)] shadow-xl max-h-[90dvh] overflow-y-auto">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 className="font-bold">{t('signageWizardTitle')}</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {t('signageWizardStep').replace('{n}', String(step)).replace('{total}', '2')}
              </p>
            </div>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-[var(--bg-muted)]"
              onClick={() => {
                reset();
                onClose();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {step === 1 ? (
            <div className="p-4 space-y-4">
              <p className="text-sm text-[var(--text-muted)]">{t('signagePlaylistHelp')}</p>
              <label className="block text-sm">
                {t('signagePlaylistName')}
                <input
                  className="input mt-1 w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('signagePlaylistNamePh')}
                />
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
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <p className="text-sm text-[var(--text-muted)]">{t('signageWizardStep2Slides')}</p>
              {slides.length ? (
                <ul className="space-y-2">
                  {slides.map((slide, idx) => {
                    const Icon = slideTypeIcon(slide.type);
                    return (
                      <li
                        key={slide.tempId}
                        className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-teal-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--text-muted)]">
                            {t('signageSlideN').replace('{n}', String(idx + 1))}
                          </p>
                          <p className="text-sm truncate">{slideDraftLabel(slide, t, categories)}</p>
                        </div>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-[var(--bg-muted)]"
                          title={t('edit')}
                          onClick={() => {
                            setEditingSlide(slide);
                            setSlideWizardOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                          title={t('delete')}
                          onClick={() => setSlides((prev) => prev.filter((s) => s.tempId !== slide.tempId))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">{t('signageSlideListEmpty')}</p>
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
          )}

          <div className="flex justify-between gap-2 border-t px-4 py-3">
            {step > 1 ? (
              <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4" /> {t('back')}
              </button>
            ) : (
              <span />
            )}
            {step === 1 ? (
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-1"
                disabled={!name.trim()}
                onClick={() => setStep(2)}
              >
                {t('next')} <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary text-sm inline-flex items-center gap-1"
                disabled={busy || !slides.length}
                onClick={() => void finish()}
              >
                <Plus className="h-4 w-4" /> {t('signageWizardCreate')}
              </button>
            )}
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
        onSave={saveSlideDraft}
      />
    </>
  );
}
