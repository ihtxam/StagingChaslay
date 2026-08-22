import { Bell } from 'lucide-react';

export default function PlatformBellButton({
  count,
  onClick,
  className = '',
}: {
  count: number;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative p-1.5 rounded-md hover:bg-[var(--bg-muted)] shrink-0 ${className}`}
      aria-label={count > 0 ? `${count} notifications` : 'Notifications'}
    >
      <Bell className="w-4 h-4 muted" />
      {count > 0 ? (
        <span className="absolute top-0.5 right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </button>
  );
}
