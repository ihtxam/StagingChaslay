import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, LayoutGrid, Type, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';

export type SlideType = 'menu' | 'image' | 'image_text';

export type SlideDraft = {
  tempId: string;
  type: SlideType;
  durationSec: number;
  categoryIds: string[];
  headline: string;
  body: string;
  showPrices: boolean;
  showPhotos: boolean;
  imageFile?: File;
  imagePreviewUrl?: string;
  imageUrl?: string;
};

type Category = { id: string; name: string };

type Props = {
  open: boolean;
  categories: Category[];
  initial?: SlideDraft | null;
  onClose: () => void;
  onSave: (draft: SlideDraft) => void;
};

function newTempId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptySlideDraft(type: SlideType = 'menu', categories: Category[] = []): SlideDraft {
  return {
    tempId: newTempId(),
    type,
    durationSec: type === 'menu' ? 12 : 8,
    categoryIds: type === 'menu' ? categories.slice(0, 3).map((c) => c.id) : [],
    headline: '',
    body: '',
    showPrices: true,
    showPhotos: true,
  };
}

export function slideDraftLabel(draft: SlideDraft, t: (k: string) => string, categories: Category[]): string {
  if (draft.type === 'menu') {
    const names = draft.categoryIds
      .map((id) => categories.find((c) => c.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2);
    return names.length ? `${t('signageAddMenuSlide')}: ${names.join(', ')}` : t('signageAddMenuSlide');
  }
  if (draft.headline.trim()) return draft.headline.trim();
  if (draft.imageFile || draft.imageUrl) return t('signageAddImageSlide');
  return draft.type === 'image_text' ? t('signageAddImageTextSlide') : t('signageAddImageSlide');
}

export default function SignageSlideWizard({ open, categories, initial, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<SlideDraft>(() => emptySlideDraft('menu', categories));

  useEffect(() => {
    if (!open) return;
    setStep(initial ? 2 : 1);
    setDraft(initial ? { ...initial } : emptySlideDraft('menu', categories));
  }, [open, initial, categories]);

  useEffect(() => {
    return () => {
      if (draft.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(draft.imagePreviewUrl);
    };
  }, [draft.imagePreviewUrl]);

  if (!open) return null;

  const setType = (type: SlideType) => {
    setDraft((prev) => ({
      ...prev,
      type,
      durationSec: type === 'menu' ? 12 : 8,
      categoryIds: type === 'menu' && !prev.categoryIds.length
        ? categories.slice(0, 3).map((c) => c.id)
        : prev.categoryIds,
    }));
  };

  const toggleCategory = (catId: string) => {
    setDraft((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(catId)
        ? prev.categoryIds.filter((id) => id !== catId)
        : [...prev.categoryIds, catId],
    }));
  };

  const pickImage = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('signageImageTooLarge'));
      return;
    }
    setDraft((prev) => {
      if (prev.imagePreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(prev.imagePreviewUrl);
      return {
        ...prev,
        imageFile: file,
        imagePreviewUrl: URL.createObjectURL(file),
      };
    });
  };

  const save = () => {
    if (draft.type === 'menu' && !draft.categoryIds.length) {
      toast.error(t('signageSlideCategoriesRequired'));
      return;
    }
    if (draft.type !== 'menu' && !draft.imageFile && !draft.imageUrl) {
      toast.error(t('signageSlideImageRequired'));
      return;
    }
    onSave(draft);
    onClose();
  };

  const preview = draft.imagePreviewUrl || draft.imageUrl;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-bold">{initial ? t('signageEditSlide') : t('signageAddSlide')}</h2>
            <p className="text-xs text-stone-500">
              {t('signageWizardStep').replace('{n}', String(step)).replace('{total}', '2')}
            </p>
          </div>
          <button type="button" className="p-2 rounded-lg hover:bg-stone-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-stone-600">{t('signageSlideWizardStep1')}</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { type: 'menu' as const, icon: LayoutGrid, label: t('signageAddMenuSlide') },
                { type: 'image' as const, icon: ImageIcon, label: t('signageAddImageSlide') },
                { type: 'image_text' as const, icon: Type, label: t('signageAddImageTextSlide') },
              ]).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-xl border-2 p-3 text-xs font-semibold flex flex-col items-center gap-2 ${
                    draft.type === type ? 'border-teal-500 bg-teal-50' : 'border-stone-200'
                  }`}
                  onClick={() => setType(type)}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <p className="text-sm text-stone-600">{t('signageSlideWizardStep2')}</p>
            <label className="block text-xs">
              {t('signageDuration')}
              <input
                className="input mt-1 w-full"
                type="number"
                min={5}
                max={30}
                value={draft.durationSec}
                onChange={(e) => setDraft((p) => ({ ...p, durationSec: Number(e.target.value) || 8 }))}
              />
            </label>

            {draft.type === 'menu' ? (
              <>
                <p className="text-xs font-medium text-stone-600">{t('signageChooseCategories')}</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`rounded-lg px-2 py-1 text-xs ${
                        draft.categoryIds.includes(c.id) ? 'bg-teal-600 text-white' : 'bg-stone-100'
                      }`}
                      onClick={() => toggleCategory(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.showPrices}
                    onChange={(e) => setDraft((p) => ({ ...p, showPrices: e.target.checked }))}
                  />
                  {t('signageShowPrices')}
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.showPhotos}
                    onChange={(e) => setDraft((p) => ({ ...p, showPhotos: e.target.checked }))}
                  />
                  {t('signageShowPhotos')}
                </label>
              </>
            ) : (
              <>
                <label className="block text-xs">
                  {t('signageUploadImage')}
                  <input
                    className="input mt-1 w-full text-sm"
                    type="file"
                    accept="image/*"
                    onChange={(e) => pickImage(e.target.files?.[0])}
                  />
                </label>
                {preview ? (
                  <img src={preview} alt="" className="max-h-32 rounded-lg border object-contain" />
                ) : null}
                <input
                  className="input w-full"
                  placeholder={t('signageHeadline')}
                  value={draft.headline}
                  onChange={(e) => setDraft((p) => ({ ...p, headline: e.target.value }))}
                />
                {draft.type === 'image_text' ? (
                  <textarea
                    className="input w-full"
                    rows={3}
                    placeholder={t('signageBody')}
                    value={draft.body}
                    onChange={(e) => setDraft((p) => ({ ...p, body: e.target.value }))}
                  />
                ) : null}
              </>
            )}
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
            <button type="button" className="btn-primary text-sm inline-flex items-center gap-1" onClick={() => setStep(2)}>
              {t('next')} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="btn-primary text-sm" onClick={save}>
              {initial ? t('save') : t('signageAddSlide')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
