import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Search } from 'lucide-react';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { isExtrasModifierGroup, isNosModifierGroup } from '@/components/shop/shop-modifier-utils';

type ModifierGroup = {
  id: string;
  title: string;
  options?: Array<{ name: string }>;
};

type CatalogProduct = {
  id: string;
  name: string;
  category?: { name?: string } | null;
  modifierGroups?: Array<{ id: string; title: string }>;
};

export default function PizzaBuilderPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [linkedByProduct, setLinkedByProduct] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, g] = await Promise.all([
        api.get('/merchant/products?limit=500'),
        api.get('/merchant/modifiers'),
      ]);
      const list: CatalogProduct[] = p.data.products || [];
      setProducts(list);
      setGroups(g.data.groups || []);
      const next: Record<string, string[]> = {};
      for (const product of list) {
        next[product.id] = (product.modifierGroups || []).map((group) => group.id);
      }
      setLinkedByProduct(next);
    } catch {
      toast.error(t('failedLoadModifiers'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const hay = `${product.name} ${product.category?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [products, search]);

  const toggleGroup = async (productId: string, groupId: string) => {
    const current = linkedByProduct[productId] || [];
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setLinkedByProduct((prev) => ({ ...prev, [productId]: next }));
    setSavingId(productId);
    try {
      await api.put(`/merchant/products/${productId}/modifiers`, { groupIds: next });
      toast.success(t('pizzaBuilderSaved'));
    } catch (err: unknown) {
      setLinkedByProduct((prev) => ({ ...prev, [productId]: current }));
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || t('saveFailed'));
    } finally {
      setSavingId(null);
    }
  };

  const kindBadge = (title: string) => {
    if (isNosModifierGroup(title)) return t('extrasNosBadgeNos');
    if (isExtrasModifierGroup(title)) return t('extrasNosBadgeExtras');
    return null;
  };

  if (loading) {
    return <div className="py-16 text-center text-[var(--text-muted)]">{t('loadingModifiers')}</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t('pizzaBuilderTitle')}</h1>
          <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderDescription')}</p>
          <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderEditorHint')}</p>
        </div>
        <Link
          to="/merchant/modifiers"
          className="btn-secondary !text-sm shrink-0 self-start"
        >
          {t('pizzaBuilderOpenModifiers')}
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('pizzaBuilderSearchProducts')}
          className="field-input w-full pl-9"
        />
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">
          {t('pizzaBuilderNoGroups')}{' '}
          <Link to="/merchant/modifiers" className="underline">
            {t('pizzaBuilderOpenModifiers')}
          </Link>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">{t('pizzaBuilderNoProducts')}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => {
            const linked = new Set(linkedByProduct[product.id] || []);
            return (
              <article
                key={product.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{product.name}</h2>
                    {product.category?.name ? (
                      <p className="text-xs text-[var(--text-muted)]">{product.category.name}</p>
                    ) : null}
                  </div>
                  {savingId === product.id ? (
                    <Loader2 className="animate-spin text-[var(--text-muted)]" size={16} />
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">
                      {t('pizzaBuilderLinked').replace('{n}', String(linked.size))}
                    </span>
                  )}
                </div>
                {groups.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((group) => {
                      const on = linked.has(group.id);
                      const badge = kindBadge(group.title);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          disabled={savingId === product.id}
                          onClick={() => void toggleGroup(product.id, group.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            on
                              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)]'
                              : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                          }`}
                        >
                          {group.title}
                          {badge ? ` · ${badge}` : ''}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
