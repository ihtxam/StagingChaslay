import { FormEvent, useMemo, useState } from 'react';
import { Layers, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useTableManagement } from '@/hooks/useTableManagement';

export default function TableSettings() {
  const { t } = useI18n();
  const { sections, loading, reload } = useTableManagement();
  const [activeSectionId, setActiveSectionId] = useState<string | 'all'>('all');
  const [newSectionName, setNewSectionName] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [addCapacity, setAddCapacity] = useState(4);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState('');
  const [batchStart, setBatchStart] = useState(1);
  const [batchCount, setBatchCount] = useState(5);
  const [batchCapacity, setBatchCapacity] = useState(4);
  const [batchSectionId, setBatchSectionId] = useState('');
  const [busy, setBusy] = useState(false);

  const activeSection =
    activeSectionId === 'all'
      ? null
      : sections.find((s) => s.id === activeSectionId) || sections[0] || null;

  const visibleTables = useMemo(() => {
    if (activeSectionId === 'all') {
      return sections.flatMap((s) =>
        s.tables.map((t) => ({ ...t, sectionName: s.name }))
      );
    }
    return (activeSection?.tables || []).map((t) => ({
      ...t,
      sectionName: activeSection?.name,
    }));
  }, [sections, activeSectionId, activeSection]);

  const targetSectionId =
    activeSectionId === 'all' ? sections[0]?.id : activeSectionId;

  const createSection = async (e: FormEvent) => {
    e.preventDefault();
    const name = newSectionName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await api.post('/merchant/floor-plans', { name });
      const plan = res.data.plan;
      toast.success(t('tableSectionCreated'));
      setNewSectionName('');
      setActiveSectionId(plan.id);
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tableSectionCreateFailed'));
    } finally {
      setBusy(false);
    }
  };

  const addTable = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetSectionId) {
      toast.error(t('tableSectionRequired'));
      return;
    }
    const label = addLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      await api.post(`/merchant/floor-plans/${targetSectionId}/tables`, {
        label,
        capacity: addCapacity,
      });
      toast.success(t('tableAdded'));
      setAddLabel('');
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tableAddFailed'));
    } finally {
      setBusy(false);
    }
  };

  const batchAdd = async (e: FormEvent) => {
    e.preventDefault();
    const planId = batchSectionId || targetSectionId;
    if (!planId) {
      toast.error(t('tableSectionRequired'));
      return;
    }
    setBusy(true);
    try {
      await api.post(`/merchant/floor-plans/${planId}/tables/batch`, {
        prefix: batchPrefix || undefined,
        startNumber: batchStart,
        count: batchCount,
        capacity: batchCapacity,
      });
      toast.success(t('tableBatchAdded'));
      setBatchOpen(false);
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tableBatchFailed'));
    } finally {
      setBusy(false);
    }
  };

  const deleteTable = async (tableId: string) => {
    if (!window.confirm(t('confirmDeleteTable'))) return;
    setBusy(true);
    try {
      await api.delete(`/merchant/floor-plans/tables/${tableId}`);
      toast.success(t('tableDeleted'));
      await reload();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('tableDeleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-[var(--text-muted)]">{t('loading')}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="card space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Layers className="h-4 w-4 text-emerald-500" />
          {t('tableSections')}
        </h2>

        <button
          type="button"
          onClick={() => setActiveSectionId('all')}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
            activeSectionId === 'all'
              ? 'bg-emerald-600/15 font-semibold text-emerald-400 ring-1 ring-emerald-600/40'
              : 'hover:bg-[var(--bg-subtle)]'
          }`}
        >
          {t('tableSectionAll')}
          <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
            {sections.reduce((n, s) => n + s.tables.length, 0)} {t('tables')}
          </span>
        </button>

        <div className="space-y-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSectionId(s.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                activeSectionId === s.id
                  ? 'bg-emerald-600/15 font-semibold text-emerald-400 ring-1 ring-emerald-600/40'
                  : 'hover:bg-[var(--bg-subtle)]'
              }`}
            >
              {s.name}
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                {s.tables.length} {t('tables')}
              </span>
            </button>
          ))}
        </div>

        <form onSubmit={createSection} className="flex gap-2 border-t border-[var(--border)] pt-3">
          <input
            className="input flex-1 text-sm"
            placeholder={t('tableSectionNew')}
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
          />
          <button type="submit" disabled={busy} className="btn-primary shrink-0 px-2">
            <Plus className="h-4 w-4" />
          </button>
        </form>
      </aside>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {activeSectionId === 'all' ? t('tableSectionAll') : activeSection?.name || t('tables')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => setBatchOpen(true)}>
              {t('tableBatchAdd')}
            </button>
          </div>
        </div>

        <form onSubmit={addTable} className="card flex flex-wrap items-end gap-3">
          <div className="min-w-[8rem] flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{t('tableLabel')}</label>
            <input
              className="input"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="#17"
            />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{t('tableCapacity')}</label>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={addCapacity}
              onChange={(e) => setAddCapacity(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <button type="submit" disabled={busy || !sections.length} className="btn-primary">
            {t('tableAdd')}
          </button>
        </form>

        {!sections.length ? (
          <div className="card py-12 text-center text-sm text-[var(--text-muted)]">
            {t('tableCreateSectionFirst')}
          </div>
        ) : !visibleTables.length ? (
          <div className="card py-12 text-center text-sm text-[var(--text-muted)]">{t('tableNoTables')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {visibleTables.map((table) => (
              <div
                key={table.id}
                className="card group relative flex flex-col items-center justify-center gap-1 py-6 text-center transition hover:ring-1 hover:ring-emerald-600/30"
              >
                <span className="text-xl font-bold text-[var(--text-primary)]">{table.label}</span>
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Users className="h-3.5 w-3.5" />
                  {table.capacity}
                </span>
                {activeSectionId === 'all' && (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                    {table.sectionName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void deleteTable(table.id)}
                  className="absolute right-2 top-2 hidden rounded p-1 text-xs text-red-400 hover:bg-red-500/10 group-hover:block"
                >
                  {t('delete')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {batchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="font-semibold text-[var(--text-primary)]">{t('tableBatchAdd')}</h3>
            </div>
            <form onSubmit={batchAdd} className="space-y-3 p-4">
              <label className="block text-sm">
                <span className="font-medium">{t('tableSection')}</span>
                <select
                  className="input mt-1"
                  value={batchSectionId || targetSectionId || ''}
                  onChange={(e) => setBatchSectionId(e.target.value)}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">{t('tableBatchPrefix')}</span>
                <input
                  className="input mt-1"
                  placeholder="T"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="font-medium">{t('tableBatchStart')}</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min={0}
                    value={batchStart}
                    onChange={(e) => setBatchStart(Number(e.target.value) || 1)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">{t('tableBatchCount')}</span>
                  <input
                    className="input mt-1"
                    type="number"
                    min={1}
                    max={100}
                    value={batchCount}
                    onChange={(e) => setBatchCount(Math.max(1, Number(e.target.value) || 1))}
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="font-medium">{t('tableCapacity')}</span>
                <input
                  className="input mt-1"
                  type="number"
                  min={1}
                  max={50}
                  value={batchCapacity}
                  onChange={(e) => setBatchCapacity(Math.max(1, Number(e.target.value) || 4))}
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
                <button type="button" className="btn-secondary" onClick={() => setBatchOpen(false)}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={busy} className="btn-primary">
                  {t('tableBatchAdd')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
