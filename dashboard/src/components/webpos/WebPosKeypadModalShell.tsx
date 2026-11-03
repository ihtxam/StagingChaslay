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
  /** Wider keypad dialogs (open price, custom amount). */
  size?: 'md' | 'lg';
  /** Enter key submits (e.g. add open-price line to cart). */
  onEnter?: () => void;
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
  size = 'md',
  onEnter,
}: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter' && onEnter) {
        const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
        if (tag === 'textarea') return;
        e.preventDefault();
        onEnter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, onEnter]);

  if (!open) return null;

  const panelSizeClass =
    size === 'lg' ? 'webpos-keypad-modal webpos-keypad-modal--lg' : 'webpos-keypad-modal';

  return (
    <div
      className={`webpos-keypad-modal-backdrop fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/45 p-3 sm:p-5`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`${panelSizeClass} w-full rounded-2xl border border-[var(--webpos-border,var(--border,#e7e5e4))] bg-[var(--webpos-surface,var(--bg-elevated,#fff))] text-[var(--webpos-text,var(--text,#1c1917))] shadow-xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="webpos-keypad-modal-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--webpos-border,var(--border,#e7e5e4))] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h3
              id="webpos-keypad-modal-title"
              className="text-base font-semibold leading-snug text-[var(--webpos-text,var(--text))] sm:text-lg"
            >
              {title}
            </h3>
            {subtitle ? (
              <p className="mt-1 text-xs leading-relaxed text-[var(--webpos-text-muted,var(--text-muted))]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-2 text-[var(--webpos-text-muted,var(--text-muted,#78716c))] hover:bg-[var(--webpos-surface-2,var(--bg-muted))]"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-5 sm:p-6 sm:space-y-5">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--webpos-border,var(--border,#e7e5e4))] p-5 pt-0 sm:p-6 sm:pt-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
