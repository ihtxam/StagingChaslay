import type { MouseEvent, PointerEvent } from 'react';
import { useSecretTap } from '@/lib/use-secret-tap';

type Props = {
  onUnlock: () => void;
  className?: string;
};

/** Small earthworm icon beside the orders search. Five quick taps unlock bulk delete mode. */
export default function SecretGandolaTapButton({ onUnlock, className }: Props) {
  const registerTap = useSecretTap(5, 3500);

  const handleTap = (event: MouseEvent | PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    registerTap(onUnlock);
  };

  return (
    <button
      type="button"
      aria-label="Orders filter"
      title=""
      className={
        className ||
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-stone-300 bg-stone-100 text-stone-600 shadow-sm hover:bg-stone-200 active:scale-95'
      }
      onPointerDown={handleTap}
    >
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 14c2-3 5-4 8-3 2 1 4 0 6-2 2-5 3-8 2" />
        <path d="M16 11c2-1 4-1 6 1" />
        <circle cx="5" cy="14" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="13.5" r="0.35" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
