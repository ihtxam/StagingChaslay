import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import KioskSlideEditor from '@/components/kiosk/KioskSlideEditor';
import type { KioskPromoSlide } from '@/lib/kiosk-api';
import { useI18n } from '@/lib/i18n';

type Props = {
  slides: KioskPromoSlide[];
  saving?: boolean;
  onChange: (slides: KioskPromoSlide[]) => void;
  onPersist: (slides: KioskPromoSlide[]) => void;
};

export default function KioskPromoSlidesPanel({ slides, saving, onChange, onPersist }: Props) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<KioskPromoSlide>({ title: '', subtitle: '' });

  const openNew = () => {
    setEditIndex(null);
    setDraft({ title: '', subtitle: '' });
    setModalOpen(true);
  };

  const openEdit = (idx: number) => {
    setEditIndex(idx);
    setDraft({ ...slides[idx] });
    setModalOpen(true);
  };

  const removeAt = (idx: number) => {
    const next = slides.filter((_, i) => i !== idx);
    onChange(next);
    onPersist(next);
  };

  const commitModal = () => {
    const cleaned = {
      ...draft,
      title: draft.title?.trim() || '',
      subtitle: draft.subtitle?.trim() || '',
    };
    const next =
      editIndex == null ? [...slides, cleaned] : slides.map((s, i) => (i === editIndex ? cleaned : s));
    onChange(next);
    onPersist(next);
    setModalOpen(false);
  };

  return (
    <>
      <div className="space-y-2">
        {slides.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] rounded-lg border border-dashed border-[var(--border)] p-4">
            {t('cdsPromoSlidesEmpty')}
          </p>
        ) : (
          <ul className="space-y-2">
            {slides.map((slide, idx) => (
              <li
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/40 p-2"
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-stone-100">
                  {slide.imageUrl ? (
                    <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-stone-400">
                      {t('cdsSlideNoImage')}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{slide.title || t('cdsSlideUntitled')}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {slide.subtitle || slide.overlayText || '—'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary !py-1.5 !px-2"
                  onClick={() => openEdit(idx)}
                  aria-label={t('edit')}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="btn-secondary !py-1.5 !px-2 text-red-600"
                  onClick={() => removeAt(idx)}
                  aria-label={t('remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />
          {t('cdsAddPromoSlide')}
        </button>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-sm font-semibold mb-3">
              {editIndex == null ? t('cdsAddPromoSlide') : t('cdsEditPromoSlide')}
            </h3>
            <KioskSlideEditor
              slides={[draft]}
              editable
              mode="merchant"
              singleSlide
              onChange={(next) => setDraft(next[0] || { title: '', subtitle: '' })}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                {t('cancel')}
              </button>
              <button type="button" className="btn-primary" disabled={saving} onClick={commitModal}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
