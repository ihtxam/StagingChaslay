import { Search } from 'lucide-react';
import type { MouseEvent, PointerEvent } from 'react';
import { useSecretTap } from '@/lib/use-secret-tap';

type Props = {
  onUnlock: () => void;
  /** Fired on every tap (before the five-tap unlock). */
  onTap?: () => void;
  className?: string;
};

/** Visible search icon beside the orders search box. Five quick taps unlock cash order delete mode. */
export default function SecretSearchTapButton({ onUnlock, onTap, className }: Props) {
  const registerTap = useSecretTap(5, 3500);

  const handleTap = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onTap?.();
    registerTap(onUnlock);
  };

  return (
    <button
      type="button"
      aria-label="Search orders"
      title="Search"
      className={
        className ||
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-stone-300 bg-stone-100 text-stone-700 shadow-sm hover:bg-stone-200 active:scale-95'
      }
      onPointerDown={handleTap}
    >
      <Search size={18} strokeWidth={2.25} />
    </button>
  );
}
