import { Keyboard } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useOnScreenKeyboard } from '@/lib/on-screen-keyboard-context';
import { shouldShowOnScreenKeyboardToggle } from '@/lib/platform';

type ToggleProps = {
  className?: string;
  iconSize?: number;
};

/** Top-bar icon button to show/hide the on-screen keyboard. */
export function OnScreenKeyboardToggle({ className, iconSize = 17 }: ToggleProps) {
  const { t } = useI18n();
  const { open, toggle } = useOnScreenKeyboard();
  const showToggle = shouldShowOnScreenKeyboardToggle();
  if (!showToggle) return null;

  return (
    <button
      type="button"
      data-active={open ? 'true' : 'false'}
      className={
        className ||
        'inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 hover:bg-stone-50 lg:h-9 lg:w-9'
      }
      onClick={toggle}
      aria-pressed={open}
      aria-label={open ? t('webPosOnScreenKeyboardHide') : t('webPosOnScreenKeyboard')}
      title={open ? t('webPosOnScreenKeyboardHide') : t('webPosOnScreenKeyboard')}
    >
      <Keyboard size={iconSize} className={open ? 'text-teal-700' : undefined} />
    </button>
  );
}
