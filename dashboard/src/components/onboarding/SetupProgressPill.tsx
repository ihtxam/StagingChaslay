import { Rocket } from 'lucide-react';

type Props = {
  percent: number;
  completedCount: number;
  totalCount: number;
  onClick: () => void;
};

export default function SetupProgressPill({ percent, completedCount, totalCount, onClick }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-105"
      style={{
        background: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)',
      }}
      title="Complete your setup"
    >
      <Rocket className="h-3.5 w-3.5 shrink-0" />
      <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-white/30">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${clamped}%` }}
        />
      </span>
      <span className="tabular-nums">{clamped}%</span>
      <span className="hidden sm:inline text-white/90 font-normal">
        {completedCount}/{totalCount}
      </span>
    </button>
  );
}
