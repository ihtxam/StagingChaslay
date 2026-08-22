import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import SignageTemplatePreview, { SIGNAGE_TEMPLATES } from './SignageTemplatePreview';

type Schedule = {
  type: 'always' | 'weekdays' | 'daypart';
  weekdays?: number[];
  daypart?: 'lunch' | 'dinner';
  startTime?: string;
  endTime?: string;
};

type Category = { id: string; name: string };

type Props = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCreated: (playlistId: string) => void;
};

const WEEKDAYS = [
  { n: 1, key: 'signageMon' },
  { n: 2, key: 'signageTue' },
  { n: 3, key: 'signageWed' },
  { n: 4, key: 'signageThu' },
  { n: 5, key: 'signageFri' },
  { n: 6, key: 'signageSat' },
  { n: 7, key: 'signageSun' },
] as const;

export default function SignagePlaylistWizard({ open, categories, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('dark_pizza');
  const [scheduleType, setScheduleType] = useState<Schedule['type']>('always');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [daypart, setDaypart] = useState<'lunch' | 'dinner'>('lunch');
  const [startTime, setStartTime] = useState('11:00');
  const [endTime, setEndTime] = useState('14:30');
  const [slideType, setSlideType] = useState<'menu' | 'image' | 'image_text'>('menu');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setName('');
    setTemplate('dark_pizza');
    setScheduleType('always');
    setWeekdays([1, 2, 3, 4, 5]);
    setSlideType('menu');
    setHeadline('');
    setBody('');
  };

  const schedule: Schedule =
    scheduleType === 'weekdays'
      ? { type: 'weekdays', weekdays }
      : scheduleType === 'daypart'
        ? { type: 'daypart', daypart, startTime, endTime }
        : { type: 'always' };

  const finish = async () => {
    if (!name.trim()) {
      toast.error(t('signagePlaylistNameRequired'));
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/merchant/signage/playlists', { name: name.trim(), template, schedule });
      const playlistId = res.data?.playlist?.id as string;
      if (!playlistId) throw new Error('Failed');
      await api.post(`/merchant/signage/playlists/${playlistId}/slides`, {
        type: slideType,
        durationSec: slideType === 'menu' ? 12 : 8,
        showPrices: true,
        showPhotos: true,
        categoryIds: slideType === 'menu' ? categories.slice(0, 3).map((c) => c.id) : [],
        headline: slideType !== 'menu' ? headline || t('signageDefaultHeadline') : undefined,
        body: slideType === 'image_text' ? body : undefined,
      });
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-bold">{t('signageWizardTitle')}</h2>
            <p className="text-xs text-stone-500">{t('signageWizardStep').replace('{n}', String(step)).replace('{total}', '2')}</p>
          </div>
          <button type="button" className="p-2 rounded-lg hover:bg-stone-100" onClick={() => { reset(); onClose(); }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 space-y-4">
            <p className="text-sm text-stone-600">{t('signagePlaylistHelp')}</p>
            <label className="block text-sm">
              {t('signagePlaylistName')}
              <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('signagePlaylistNamePh')} />
            </label>
            <label className="block text-sm">
              {t('signageTemplate')}
              <select className="input mt-1 w-full" value={template} onChange={(e) => setTemplate(e.target.value)}>
                {SIGNAGE_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{t(tpl.key)}</option>
                ))}
              </select>
            </label>
            <SignageTemplatePreview templateId={template} />
            <label className="block text-sm">
              {t('signageSchedule')}
              <select
                className="input mt-1 w-full"
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
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${weekdays.includes(d.n) ? 'bg-teal-600 text-white' : 'bg-stone-100'}`}
                    onClick={() => setWeekdays((prev) => (prev.includes(d.n) ? prev.filter((x) => x !== d.n) : [...prev, d.n]))}
                  >
                    {t(d.key)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <p className="text-sm text-stone-600">{t('signageWizardStep2Hint')}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['menu', 'image', 'image_text'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-xl border-2 p-3 text-xs font-semibold ${slideType === type ? 'border-teal-500 bg-teal-50' : 'border-stone-200'}`}
                  onClick={() => setSlideType(type)}
                >
                  {type === 'menu' ? t('signageAddMenuSlide') : type === 'image' ? t('signageAddImageSlide') : t('signageAddImageTextSlide')}
                </button>
              ))}
            </div>
            {slideType !== 'menu' ? (
              <>
                <input className="input w-full" placeholder={t('signageHeadline')} value={headline} onChange={(e) => setHeadline(e.target.value)} />
                {slideType === 'image_text' ? (
                  <textarea className="input w-full" rows={3} placeholder={t('signageBody')} value={body} onChange={(e) => setBody(e.target.value)} />
                ) : null}
              </>
            ) : (
              <p className="text-xs text-stone-500">{t('signageWizardMenuHint')}</p>
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
            <button
              type="button"
              className="btn-primary text-sm inline-flex items-center gap-1"
              disabled={!name.trim()}
              onClick={() => setStep(2)}
            >
              {t('next')} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" className="btn-primary text-sm inline-flex items-center gap-1" disabled={busy} onClick={() => void finish()}>
              <Plus className="h-4 w-4" /> {t('signageWizardCreate')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
