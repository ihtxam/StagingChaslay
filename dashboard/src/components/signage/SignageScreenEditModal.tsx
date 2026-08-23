import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import SignageTemplatePreview, { SIGNAGE_SCREEN_SIZES, SIGNAGE_TEMPLATES } from './SignageTemplatePreview';
import type { SignagePlaylist } from './SignagePlaylistEditModal';

export type SignageScreen = {
  id: string;
  name: string;
  token: string;
  shortCode?: string | null;
  orientation: 'landscape' | 'portrait';
  template: string;
  screenSizeIn?: number;
  playlistId: string | null;
};

type Props = {
  open: boolean;
  screen: SignageScreen | null;
  playlists: SignagePlaylist[];
  onClose: () => void;
  onChanged: () => void;
};

export default function SignageScreenEditModal({ open, screen, playlists, onClose, onChanged }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [template, setTemplate] = useState('dark_pizza');
  const [screenSizeIn, setScreenSizeIn] = useState(32);
  const [playlistId, setPlaylistId] = useState('');

  useEffect(() => {
    if (!open || !screen) return;
    setName(screen.name);
    setOrientation(screen.orientation === 'portrait' ? 'portrait' : 'landscape');
    setTemplate(screen.template || 'dark_pizza');
    setScreenSizeIn(screen.screenSizeIn || 32);
    setPlaylistId(screen.playlistId || '');
  }, [open, screen]);

  if (!open || !screen) return null;

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api.put(`/merchant/signage/screens/${screen.id}`, {
        name: trimmed,
        orientation,
        template,
        screenSizeIn,
        playlistId: playlistId || null,
      });
      toast.success(t('signageSaved'));
      onChanged();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('signageDeleteScreenConfirm'))) return;
    try {
      await api.delete(`/merchant/signage/screens/${screen.id}`);
      toast.success(t('signageSaved'));
      onClose();
      onChanged();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || t('signageSaveFailed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-bold">{t('signageEditScreen')}</h2>
            <p className="text-xs text-stone-500">{screen.name}</p>
          </div>
          <button type="button" className="p-2 rounded-lg hover:bg-stone-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <input
            className="input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('signageScreenNamePh')}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {t('signageOrientation')}
              <select
                className="input mt-1 w-full"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value === 'portrait' ? 'portrait' : 'landscape')}
              >
                <option value="landscape">{t('signageLandscape')}</option>
                <option value="portrait">{t('signagePortrait')}</option>
              </select>
            </label>
            <label className="text-sm">
              {t('signageScreenSize')}
              <select
                className="input mt-1 w-full"
                value={screenSizeIn}
                onChange={(e) => setScreenSizeIn(Number(e.target.value))}
              >
                {SIGNAGE_SCREEN_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}"
                  </option>
                ))}
              </select>
            </label>
          </div>

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

          <label className="block text-sm">
            {t('signagePlaylist')}
            <select className="input mt-1 w-full" value={playlistId} onChange={(e) => setPlaylistId(e.target.value)}>
              <option value="">{t('signageNoPlaylist')}</option>
              {playlists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex justify-between gap-2 border-t px-4 py-3">
          <button type="button" className="btn-secondary text-sm text-red-700" onClick={() => void remove()}>
            {t('delete')}
          </button>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy || !name.trim()}
              onClick={() => void save()}
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
