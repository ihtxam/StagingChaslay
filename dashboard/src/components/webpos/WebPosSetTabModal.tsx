import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import WebPosKeypadModalShell from './WebPosKeypadModalShell';
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
    <WebPosKeypadModalShell open={open} onClose={onClose} title={t('webPosSetTab')}>
      <input
        className="input w-full text-center text-3xl font-bold tabular-nums tracking-wide"
        inputMode="none"
        readOnly
        value={value}
        placeholder="—"
        aria-label={t('webPosSetTab')}
        autoFocus
        onKeyDown={(e) => {
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
      />
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="btn-secondary py-3" onClick={onClose}>
          {t('close')}
        </button>
        <button type="button" className="btn-primary py-3" disabled={!value} onClick={confirm}>
          {t('confirm')}
        </button>
      </div>
    </WebPosKeypadModalShell>
  );
}
