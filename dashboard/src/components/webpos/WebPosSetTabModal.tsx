import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import WebPosNumericKeypad from './WebPosNumericKeypad';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (tabNumber: string) => void;
  current?: string | null;
};

export default function WebPosSetTabModal({ open, onClose, onConfirm, current }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState(current || '');

  useEffect(() => {
    if (open) setValue((current || '').replace(/[^\d]/g, '').slice(0, 6));
  }, [open, current]);

  if (!open) return null;

  const setDigits = (buf: string) => {
    setValue(buf.replace(/[^\d]/g, '').slice(0, 6));
  };

  const confirm = () => {
    const tab = value.replace(/[^\d]/g, '').slice(0, 6);
    if (!tab) return;
    onConfirm(tab);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          confirm();
          return;
        }
        if (e.key === 'Backspace') {
          e.preventDefault();
          setValue((v) => v.slice(0, -1));
          return;
        }
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          setValue((v) => (v + e.key).replace(/[^\d]/g, '').slice(0, 6));
        }
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <h3 className="font-semibold">{t('webPosSetTab')}</h3>
          <button type="button" className="p-2" onClick={onClose} aria-label={t('close')}>
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <input
            className="input w-full text-center text-3xl font-bold tabular-nums tracking-wide"
            inputMode="none"
            readOnly
            value={value}
            placeholder="—"
            aria-label={t('webPosSetTab')}
            autoFocus
          />
          <WebPosNumericKeypad
            mode="qty"
            onModeChange={() => undefined}
            buffer={value}
            onBufferChange={setDigits}
            onApply={confirm}
            showModeButtons={false}
            showQuickAdd={false}
            showSignToggle={false}
            integerOnly
            hideApply
            compact
          />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary py-3" onClick={onClose}>
              {t('close')}
            </button>
            <button
              type="button"
              className="btn-primary py-3"
              disabled={!value}
              onClick={confirm}
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
