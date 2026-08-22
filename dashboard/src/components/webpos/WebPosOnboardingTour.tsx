import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export const WEBPOS_ONBOARDING_KEY = 'webpos_onboarding_v1_done';

type Step = {
  titleKey: string;
  bodyKey: string;
};

const STEPS: Step[] = [
  { titleKey: 'webPosTourRegisterTitle', bodyKey: 'webPosTourRegisterBody' },
  { titleKey: 'webPosTourCartTitle', bodyKey: 'webPosTourCartBody' },
  { titleKey: 'webPosTourKitchenTitle', bodyKey: 'webPosTourKitchenBody' },
  { titleKey: 'webPosTourPaymentTitle', bodyKey: 'webPosTourPaymentBody' },
  { titleKey: 'webPosTourMenuTitle', bodyKey: 'webPosTourMenuBody' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
};

export function readWebPosOnboardingDone(): boolean {
  try {
    return localStorage.getItem(WEBPOS_ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWebPosOnboardingDone() {
  try {
    localStorage.setItem(WEBPOS_ONBOARDING_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function WebPosOnboardingTour({ open, onClose, onComplete }: Props) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);

  const step = useMemo(() => STEPS[index] || STEPS[0], [index]);

  if (!open) return null;

  const finish = () => {
    markWebPosOnboardingDone();
    onComplete?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
              {t('webPosTourStep')
                .replace('{n}', String(index + 1))
                .replace('{total}', String(STEPS.length))}
            </p>
            <h2 className="mt-1 text-lg font-bold text-stone-900">{t(step.titleKey)}</h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
            aria-label={t('close')}
            onClick={finish}
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-stone-600">{t(step.bodyKey)}</p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={index <= 0}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-700 disabled:opacity-30"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft size={16} />
            {t('back')}
          </button>
          {index >= STEPS.length - 1 ? (
            <button
              type="button"
              className="webpos-accent-btn rounded-lg px-4 py-2 text-xs font-bold"
              onClick={finish}
            >
              {t('webPosTourDone')}
            </button>
          ) : (
            <button
              type="button"
              className="webpos-accent-btn inline-flex items-center gap-1 rounded-lg px-4 py-2 text-xs font-bold"
              onClick={() => setIndex((i) => Math.min(STEPS.length - 1, i + 1))}
            >
              {t('next')}
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
