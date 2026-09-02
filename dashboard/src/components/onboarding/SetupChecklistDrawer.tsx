import { Check, ChevronRight, MapPin, Rocket, Store, Users, CreditCard, Package, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SetupStep } from './useMerchantSetupProgress';

const ICONS: Record<string, typeof Rocket> = {
  business_info: Store,
  products: Package,
  payment_settings: CreditCard,
  staff: Users,
  online_shop: Rocket,
};

type Props = {
  open: boolean;
  onClose: () => void;
  steps: SetupStep[];
  completedCount: number;
  totalCount: number;
  percent: number;
};

export default function SetupChecklistDrawer({
  open,
  onClose,
  steps,
  completedCount,
  totalCount,
  percent,
}: Props) {
  const navigate = useNavigate();
  if (!open) return null;

  const activeStep = steps.find((s) => !s.completed) ?? null;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Close setup checklist"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-zinc-950">
        <div className="bg-zinc-950 text-white px-5 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Complete Your Setup</h2>
                <p className="text-sm text-white/70">Get your business ready to go</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span>{completedCount} of {totalCount} completed</span>
            <span className="text-2xl font-bold tabular-nums">{clamped}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${clamped}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <ol className="space-y-0">
            {steps.map((step, index) => {
              const Icon = ICONS[step.id] || MapPin;
              const isActive = activeStep?.id === step.id;
              const isLast = index === steps.length - 1;
              return (
                <li key={step.id} className="relative flex gap-3 pb-8">
                  {!isLast ? (
                    <span
                      className="absolute left-[15px] top-8 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800"
                      aria-hidden
                    />
                  ) : null}
                  <div
                    className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      step.completed
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                        : isActive
                          ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                          : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500'
                    }`}
                  >
                    {step.completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      Step {step.step}
                    </p>
                    <p
                      className={`font-semibold ${
                        step.completed
                          ? 'text-zinc-400 line-through'
                          : isActive
                            ? 'text-zinc-900 dark:text-zinc-50'
                            : 'text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500">
                      {step.completed ? step.completedDescription : step.description}
                    </p>
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(step.path);
                          onClose();
                        }}
                        className="mt-3 inline-flex items-center gap-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      >
                        Get Started
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
