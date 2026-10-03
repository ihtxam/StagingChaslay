import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { ReactNode } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type ModeCard = {
  id: string;
  title: string;
  subtitle: string;
  bullets: string[];
  mock: ReactNode;
  bestFor: string;
};

function MockWizardShell({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden text-left">
      <div className="border-b border-stone-100 bg-stone-50 px-3 py-2">
        <p className="text-xs font-semibold text-stone-800">Catering combo · shop preview</p>
      </div>
      <div className="p-3 space-y-2 text-xs text-stone-700">{children}</div>
    </div>
  );
}

export default function CateringGuidePage() {
  const { t } = useI18n();

  const applyTemplate = async (templateId: string) => {
    try {
      await api.post(`/merchant/catering-templates/${templateId}`);
      toast.success(t('cateringTemplateApplied'));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const cards: ModeCard[] = [
    {
      id: 'package',
      title: t('cateringGuidePackageTitle'),
      subtitle: t('cateringGuidePackageSub'),
      bullets: [
        t('cateringGuidePackageB1'),
        t('cateringGuidePackageB2'),
        t('cateringGuidePackageB3'),
      ],
      bestFor: t('cateringGuidePackageBest'),
      mock: (
        <MockWizardShell>
          <p className="font-semibold">Boxed lunch platter</p>
          <p className="text-stone-500">CHF 189 · flat package</p>
          <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-2">
            <Users className="h-4 w-4" />
            <span>15 guests</span>
          </div>
          <p className="text-teal-800 font-medium">Serves 15</p>
        </MockWizardShell>
      ),
    },
    {
      id: 'per_person',
      title: t('cateringGuidePerPersonTitle'),
      subtitle: t('cateringGuidePerPersonSub'),
      bullets: [
        t('cateringGuidePerPersonB1'),
        t('cateringGuidePerPersonB2'),
        t('cateringGuidePerPersonB3'),
      ],
      bestFor: t('cateringGuidePerPersonBest'),
      mock: (
        <MockWizardShell>
          <p className="font-semibold">Buffet line</p>
          <p className="text-stone-500">CHF 18 / guest × 25 = CHF 450</p>
          <div className="flex items-center gap-2 rounded-lg bg-stone-50 p-2">
            <Users className="h-4 w-4" />
            <span>25 guests</span>
          </div>
          <p>≈ 18.00 / person · 25 guests</p>
        </MockWizardShell>
      ),
    },
    {
      id: 'mixed',
      title: t('cateringGuideMixedTitle'),
      subtitle: t('cateringGuideMixedSub'),
      bullets: [t('cateringGuideMixedB1'), t('cateringGuideMixedB2')],
      bestFor: t('cateringGuideMixedBest'),
      mock: (
        <MockWizardShell>
          <p className="font-semibold">Party pack + per head</p>
          <p className="text-stone-500">CHF 120 package + CHF 8 × 20 guests</p>
          <p className="font-medium">Total CHF 280</p>
        </MockWizardShell>
      ),
    },
    {
      id: 'tier_slot',
      title: t('cateringGuideTierTitle'),
      subtitle: t('cateringGuideTierSub'),
      bullets: [t('cateringGuideTierB1'), t('cateringGuideTierB2'), t('cateringGuideTierB3')],
      bestFor: t('cateringGuideTierBest'),
      mock: (
        <MockWizardShell>
          <p className="font-semibold">Taco bar · protein tier</p>
          <p>Chicken & beef · <span className="font-semibold">12 / person</span></p>
          <p>15 guests → <span className="font-semibold">CHF 180</span></p>
          <p className="text-stone-500">Beans & salsas included (CHF 0 steps)</p>
        </MockWizardShell>
      ),
    },
    {
      id: 'byo',
      title: t('cateringGuideByoTitle'),
      subtitle: t('cateringGuideByoSub'),
      bullets: [t('cateringGuideByoB1'), t('cateringGuideByoB2')],
      bestFor: t('cateringGuideByoBest'),
      mock: (
        <MockWizardShell>
          <p className="font-semibold">Build-your-own lunch</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Pick entrée (min 1)</li>
            <li>Pick 2 sides</li>
            <li>Add-ons · cutlery per guest</li>
          </ol>
        </MockWizardShell>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link to="/merchant/products" className="text-xs font-semibold text-teal-700 hover:underline">
          ← {t('navProducts')}
        </Link>
        <h1 className="page-title mt-2">{t('cateringGuidePageTitle')}</h1>
        <p className="page-sub mt-1">{t('cateringGuidePageSub')}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.id}
            id={`catering-mode-${card.id}`}
            className="card space-y-3 scroll-mt-24"
          >
            <div>
              <h2 className="text-lg font-semibold">{card.title}</h2>
              <p className="text-sm text-stone-600">{card.subtitle}</p>
            </div>
            {card.mock}
            <ul className="list-disc pl-5 text-sm text-stone-700 space-y-1">
              {card.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="text-xs font-medium text-teal-900 rounded-lg bg-teal-50 px-3 py-2">
              {card.bestFor}
            </p>
            {card.id === 'tier_slot' ? (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void applyTemplate('taco_bar')}
              >
                {t('cateringApplyTemplate')} — taco bar
              </button>
            ) : null}
            {card.id === 'package' ? (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void applyTemplate('boxed_lunch')}
              >
                {t('cateringApplyTemplate')} — boxed lunch
              </button>
            ) : null}
            {card.id === 'per_person' ? (
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void applyTemplate('buffet_per_person')}
              >
                {t('cateringApplyTemplate')} — buffet
              </button>
            ) : null}
          </article>
        ))}
      </div>
      <p className="text-sm text-stone-600">{t('cateringGuideFooter')}</p>
    </div>
  );
}
