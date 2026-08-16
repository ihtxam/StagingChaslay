import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  zIndexClass?: string;
};

/** Shared backdrop, sizing, ESC dismiss for WebPOS keypad / numeric entry modals. */
export default function WebPosKeypadModalShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  zIndexClass = 'z-[80]',
}: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`webpos-keypad-modal-backdrop fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/45 p-4`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="webpos-keypad-modal w-full max-w-md rounded-2xl border border-[var(--webpos-border,var(--border,#e7e5e4))] bg-[var(--webpos-surface,var(--bg-elevated,#fff))] text-[var(--webpos-text,var(--text,#1c1917))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-keypad-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--webpos-border,var(--border,#e7e5e4))] px-5 py-3.5">
          <div className="min-w-0">
            <h3 id="webpos-keypad-modal-title" className="font-semibold leading-snug">
              {title}
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-stone-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="shrink-0 p-2 text-[var(--webpos-text-muted,var(--text-muted,#78716c))]"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--webpos-border,var(--border,#e7e5e4))] p-5 pt-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
