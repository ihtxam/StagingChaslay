import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import axios from 'axios';
import { compressImageIfNeeded } from '@/lib/compress-image';
import type { KioskPromoSlide } from '@/lib/kiosk-api';
import { getKioskAdminPin } from '@/lib/kiosk-admin-session';

async function uploadKioskImage(
  file: File,
  mode: 'merchant' | 'token',
  accessToken?: string
): Promise<string> {
  const compressed = await compressImageIfNeeded(file, {
    maxBytes: 400 * 1024,
    maxWidth: 1920,
    targetBytes: 700 * 1024,
  });
  const fd = new FormData();
  fd.append('file', compressed);
  if (mode === 'merchant') {
    const res = await api.post('/merchant/media', fd);
    const url = res.data?.url as string;
    if (!url) throw new Error('Upload failed');
    return url;
  }
  const pin = getKioskAdminPin(accessToken || '');
  if (!pin) throw new Error('Admin session expired');
  fd.append('pin', pin);
  const res = await axios.post(`/api/kiosk/${accessToken}/upload`, fd);
  const url = res.data?.url as string;
  if (!url) throw new Error('Upload failed');
  return url;
}

type Props = {
  slides: KioskPromoSlide[];
  editable: boolean;
  mode: 'merchant' | 'token';
  accessToken?: string;
  onChange: (slides: KioskPromoSlide[]) => void;
};

export default function KioskSlideEditor({ slides, editable, mode, accessToken, onChange }: Props) {
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const updateSlide = (idx: number, patch: Partial<KioskPromoSlide>) => {
    const next = [...slides];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const pickFile = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    try {
      const url = await uploadKioskImage(file, mode, accessToken);
      updateSlide(idx, { imageUrl: url });
      toast.success('Image uploaded');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      toast.error(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploadingIdx(null);
    }
  };

  return (
    <div className="space-y-4">
      {slides.map((slide, idx) => (
        <div key={idx} className="rounded-lg border border-[var(--border)] p-3 space-y-3">
          <div className="flex flex-wrap items-start gap-3">
            <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
              {slide.imageUrl ? (
                <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-stone-400">No image</div>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {editable ? (
                <>
                  <input
                    ref={(el) => {
                      fileRefs.current[idx] = el;
                    }}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void pickFile(idx, file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary inline-flex w-fit items-center gap-2"
                    disabled={uploadingIdx === idx}
                    onClick={() => fileRefs.current[idx]?.click()}
                  >
                    {uploadingIdx === idx ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    Upload image
                  </button>
                </>
              ) : null}
              <input
                className="input"
                placeholder="Or paste image URL"
                value={slide.imageUrl || ''}
                disabled={!editable}
                onChange={(e) => updateSlide(idx, { imageUrl: e.target.value })}
              />
            </div>
            {editable && slides.length > 1 ? (
              <button
                type="button"
                className="btn-secondary text-red-600"
                aria-label="Remove slide"
                onClick={() => onChange(slides.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <input
            className="input w-full"
            placeholder="Text on top of slide (large overlay)"
            value={slide.overlayText || ''}
            disabled={!editable}
            onChange={(e) => updateSlide(idx, { overlayText: e.target.value })}
          />
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="input"
              placeholder="Title (header bar)"
              value={slide.title || ''}
              disabled={!editable}
              onChange={(e) => updateSlide(idx, { title: e.target.value })}
            />
            <input
              className="input"
              placeholder="Subtitle"
              value={slide.subtitle || ''}
              disabled={!editable}
              onChange={(e) => updateSlide(idx, { subtitle: e.target.value })}
            />
          </div>
        </div>
      ))}
      {editable ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onChange([...slides, { title: '', subtitle: '' }])}
        >
          Add slide
        </button>
      ) : null}
    </div>
  );
}
