import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { PizzaBuilderTemplate, PizzaPortionType } from '@/lib/pizza-builder';
import { MERCHANT_PIZZA_BUILDER_PATH } from '@/lib/permissions';

export default function PizzaBuilderPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PizzaBuilderTemplate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/pizza-templates');
      setTemplates(res.data.templates || []);
    } catch {
      toast.error(t('pizzaBuilderLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const portionLabel = (type: PizzaPortionType) => {
    if (type === 'half') return t('pizzaBuilderPortionHalf');
    if (type === 'quarter') return t('pizzaBuilderPortionQuarter');
    return t('pizzaBuilderPortionWhole');
  };

  const onDelete = async (tpl: PizzaBuilderTemplate) => {
    if (!window.confirm(t('pizzaBuilderDeleteConfirm').replace('{name}', tpl.name))) return;
    try {
      await api.delete(`/merchant/pizza-templates/${tpl.id}`);
      toast.success(t('pizzaBuilderDeleted'));
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || t('deleteFailed'));
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t('pizzaBuilderTitle')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderDescription')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/merchant/modifiers" className="btn-secondary !text-sm">
            {t('pizzaBuilderOpenModifiers')}
          </Link>
          <Link
            to={`${MERCHANT_PIZZA_BUILDER_PATH}/new`}
            className="btn-primary !text-sm inline-flex items-center gap-1.5"
          >
            <Plus size={16} />
            {t('pizzaBuilderAddTemplate')}
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">{t('loading')}</p>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] p-8 text-center space-y-3">
          <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderEmpty')}</p>
          <button
            type="button"
            className="btn-primary !text-sm"
            onClick={() => navigate(`${MERCHANT_PIZZA_BUILDER_PATH}/new`)}
          >
            {t('pizzaBuilderAddTemplate')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((tpl) => (
            <article
              key={tpl.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <h2 className="font-semibold truncate">{tpl.name || t('pizzaBuilderUntitled')}</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {portionLabel(tpl.portionType)}
                  {' · '}
                  {t('pizzaBuilderStepsCount').replace('{n}', String(tpl.steps.length))}
                  {' · '}
                  {t('pizzaBuilderProductsCount').replace('{n}', String(tpl.linkedProductIds.length))}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`${MERCHANT_PIZZA_BUILDER_PATH}/${tpl.id}`}
                  className="btn-secondary !text-xs"
                >
                  {t('edit')}
                </Link>
                <button
                  type="button"
                  className="btn-secondary !text-xs text-red-600"
                  aria-label={t('delete')}
                  onClick={() => void onDelete(tpl)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
