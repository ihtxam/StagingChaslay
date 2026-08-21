import { Search } from 'lucide-react';
import { useSecretTap } from '@/lib/use-secret-tap';

type Props = {
  onUnlock: () => void;
  className?: string;
};

/** Visible search icon to the left of the orders search box. Five quick taps open sales adjustment. */
export default function SecretSearchTapButton({ onUnlock, className }: Props) {
  const registerTap = useSecretTap(5, 3500);

  return (
    <button
      type="button"
      aria-label="Search"
      className={
        className ||
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
      }
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        registerTap(onUnlock);
      }}
    >
      <Search size={16} />
    </button>
  );
}
