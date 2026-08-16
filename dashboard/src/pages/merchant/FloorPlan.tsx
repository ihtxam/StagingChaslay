import { CSSProperties, FormEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import TableQrPrintPanel from '@/components/merchant/TableQrPrintPanel';

type TableShape = 'rect' | 'round';
type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';
type ElementType = 'WALL' | 'DOOR';

interface DesignerElement {
  localId: string;
  elementType: ElementType;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
}

interface DesignerTable {
  localId: string;
  id?: string;
  label: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  status: TableStatus;
}

interface FloorPlanData {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  isActive: boolean;
  tables: Array<Omit<DesignerTable, 'localId'> & { id: string }>;
  elements?: Array<{
    id: string;
    elementType: ElementType;
    posX: number;
    posY: number;
    width: number;
    height: number;
    rotation?: number;
  }>;
}

function uid() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const MIN_TABLE_SIZE = 40;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const RESIZE_HANDLES: Array<{ handle: ResizeHandle; cursor: string; style: CSSProperties }> = [
  { handle: 'nw', cursor: 'nwse-resize', style: { top: -5, left: -5 } },
  { handle: 'n', cursor: 'ns-resize', style: { top: -5, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'ne', cursor: 'nesw-resize', style: { top: -5, right: -5 } },
  { handle: 'e', cursor: 'ew-resize', style: { top: '50%', right: -5, transform: 'translateY(-50%)' } },
  { handle: 'se', cursor: 'nwse-resize', style: { bottom: -5, right: -5 } },
  { handle: 's', cursor: 'ns-resize', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' } },
  { handle: 'sw', cursor: 'nesw-resize', style: { bottom: -5, left: -5 } },
  { handle: 'w', cursor: 'ew-resize', style: { top: '50%', left: -5, transform: 'translateY(-50%)' } },
];

function applyTableResize(
  handle: ResizeHandle,
  start: { posX: number; posY: number; width: number; height: number },
  dx: number,
  dy: number,
  canvasWidth: number,
  canvasHeight: number
) {
  let { posX, posY, width, height } = start;

  if (handle.includes('e')) width = start.width + dx;
  if (handle.includes('w')) {
    width = start.width - dx;
    posX = start.posX + dx;
  }
  if (handle.includes('s')) height = start.height + dy;
  if (handle.includes('n')) {
    height = start.height - dy;
    posY = start.posY + dy;
  }

  if (width < MIN_TABLE_SIZE) {
    if (handle.includes('w')) posX = start.posX + start.width - MIN_TABLE_SIZE;
    width = MIN_TABLE_SIZE;
  }
  if (height < MIN_TABLE_SIZE) {
    if (handle.includes('n')) posY = start.posY + start.height - MIN_TABLE_SIZE;
    height = MIN_TABLE_SIZE;
  }

  posX = Math.max(0, Math.min(posX, canvasWidth - width));
  posY = Math.max(0, Math.min(posY, canvasHeight - height));
  width = Math.min(width, canvasWidth - posX);
  height = Math.min(height, canvasHeight - posY);

  return {
    posX: Math.round(posX),
    posY: Math.round(posY),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function toDesignerElements(
  elements: FloorPlanData['elements'] = []
): DesignerElement[] {
  return elements.map((el) => ({
    localId: el.id || uid(),
    elementType: el.elementType === 'DOOR' ? 'DOOR' : 'WALL',
    posX: el.posX ?? 20,
    posY: el.posY ?? 20,
    width: el.width || 120,
    height: el.height || 16,
    rotation: el.rotation || 0,
  }));
}

function toDesigner(tables: FloorPlanData['tables'] = []): DesignerTable[] {
  return tables.map((t) => ({
    localId: t.id || uid(),
    id: t.id,
    label: t.label,
    capacity: t.capacity || 2,
    shape: t.shape === 'round' ? 'round' : 'rect',
    posX: t.posX ?? 40,
    posY: t.posY ?? 40,
    width: t.width || 100,
    height: t.height || 80,
    rotation: t.rotation || 0,
    status: (t.status as TableStatus) || 'available',
  }));
}

const STATUS_COLOR: Record<TableStatus, string> = {
  available: '#22c55e',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  dirty: '#94a3b8',
};

export default function FloorPlan({ embedded = false, hideQr = false }: { embedded?: boolean; hideQr?: boolean }) {
  const { t } = useI18n();
  const [plans, setPlans] = useState<FloorPlanData[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [tables, setTables] = useState<DesignerTable[]>([]);
  const [elements, setElements] = useState<DesignerElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [covers, setCovers] = useState<{ coversServed: number; dineInOrders: number; averagePartySize: number } | null>(null);
  const [merchantSlug, setMerchantSlug] = useState('');
  const [drag, setDrag] = useState<{
    kind: 'table' | 'element';
    localId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const [resize, setResize] = useState<{
    localId: string;
    handle: ResizeHandle;
    startPointerX: number;
    startPointerY: number;
    startPosX: number;
    startPosY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  /** Inner canvas (same coordinate space for pointer down + move). */
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || null,
    [plans, activePlanId]
  );
  const selected = tables.find((t) => t.localId === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, coversRes, settingsRes] = await Promise.all([
        api.get('/merchant/floor-plans'),
        api.get('/merchant/floor-plans/covers').catch(() => null),
        api.get('/merchant/settings').catch(() => null),
      ]);
      const slug = settingsRes?.data?.settings?.slug || settingsRes?.data?.slug || '';
      if (slug) setMerchantSlug(String(slug));
      const list: FloorPlanData[] = plansRes.data.plans || [];
      setPlans(list);
      if (coversRes?.data) {
        setCovers({
          coversServed: coversRes.data.coversServed || 0,
          dineInOrders: coversRes.data.dineInOrders || 0,
          averagePartySize: coversRes.data.averagePartySize || 0,
        });
      }
      if (list.length) {
        const id = activePlanId && list.some((p) => p.id === activePlanId) ? activePlanId : list[0].id;
        setActivePlanId(id);
        const plan = list.find((p) => p.id === id)!;
        setTables(toDesigner(plan.tables));
        setElements(toDesignerElements(plan.elements));
      } else {
        setActivePlanId(null);
        setTables([]);
        setElements([]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load floor plans');
    } finally {
      setLoading(false);
    }
  }, [activePlanId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPlan = (planId: string) => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setActivePlanId(planId);
    setTables(toDesigner(plan.tables));
    setElements(toDesignerElements(plan.elements));
    setSelectedId(null);
    setSelectedElementId(null);
  };

  const createPlan = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/merchant/floor-plans', { name: newPlanName || 'Main floor' });
      const plan = res.data.plan as FloorPlanData;
      setPlans((prev) => [...prev, plan]);
      setActivePlanId(plan.id);
      setTables(toDesigner(plan.tables));
      setNewPlanName('');
      toast.success('Floor plan created');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create floor plan');
    }
  };

  const addTable = () => {
    const n = tables.length + 1;
    const next: DesignerTable = {
      localId: uid(),
      label: `T${n}`,
      capacity: 4,
      shape: 'rect',
      posX: 40 + (n % 5) * 30,
      posY: 40 + (n % 4) * 30,
      width: 110,
      height: 90,
      rotation: 0,
      status: 'available',
    };
    setTables((prev) => [...prev, next]);
    setSelectedId(next.localId);
  };

  const updateSelected = (patch: Partial<DesignerTable>) => {
    if (!selectedId) return;
    setTables((prev) => prev.map((t) => (t.localId === selectedId ? { ...t, ...patch } : t)));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setTables((prev) => prev.filter((t) => t.localId !== selectedId));
    setSelectedId(null);
  };

  const addElement = (elementType: ElementType) => {
    const n = elements.length + 1;
    const next: DesignerElement = {
      localId: uid(),
      elementType,
      posX: 24 + (n % 4) * 40,
      posY: 24 + Math.floor(n / 4) * 40,
      width: elementType === 'DOOR' ? 48 : 160,
      height: elementType === 'DOOR' ? 12 : 10,
      rotation: 0,
    };
    setElements((prev) => [...prev, next]);
    setSelectedElementId(next.localId);
    setSelectedId(null);
  };

  const removeSelectedElement = () => {
    if (!selectedElementId) return;
    setElements((prev) => prev.filter((el) => el.localId !== selectedElementId));
    setSelectedElementId(null);
  };

  const saveTables = async () => {
    if (!activePlanId) return;
    setSaving(true);
    try {
      const res = await api.put(`/merchant/floor-plans/${activePlanId}/tables`, {
        tables: tables.map((t, idx) => ({
          label: t.label,
          capacity: t.capacity,
          shape: t.shape,
          posX: Math.round(t.posX),
          posY: Math.round(t.posY),
          width: Math.round(t.width),
          height: Math.round(t.height),
          rotation: t.rotation,
          status: t.status,
          sortOrder: idx,
        })),
        elements: elements.map((el) => ({
          id: el.localId,
          elementType: el.elementType,
          posX: Math.round(el.posX),
          posY: Math.round(el.posY),
          width: Math.round(el.width),
          height: Math.round(el.height),
          rotation: el.rotation,
        })),
      });
      const plan = res.data.plan as FloorPlanData;
      setPlans((prev) => prev.map((p) => (p.id === plan.id ? plan : p)));
      setTables(toDesigner(plan.tables));
      setElements(toDesignerElements(plan.elements));
      toast.success('Floor plan saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save tables');
    } finally {
      setSaving(false);
    }
  };

  const canvasPointerActive = drag || resize;

  const onCanvasBackgroundPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('[data-floor-table]') ||
      target.closest('[data-floor-element]') ||
      target.closest('[data-resize-handle]')
    ) {
      return;
    }
    setSelectedId(null);
    setSelectedElementId(null);
  };

  const onTablePointerDown = (e: PointerEvent<HTMLDivElement>, localId: string) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
    e.stopPropagation();
    e.preventDefault();
    const table = tables.find((t) => t.localId === localId);
    if (!table) return;
    setSelectedId(localId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      kind: 'table',
      localId,
      offsetX: e.clientX - rect.left - table.posX,
      offsetY: e.clientY - rect.top - table.posY,
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onElementPointerDown = (e: PointerEvent<HTMLDivElement>, localId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const element = elements.find((el) => el.localId === localId);
    if (!element) return;
    setSelectedElementId(localId);
    setSelectedId(null);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrag({
      kind: 'element',
      localId,
      offsetX: e.clientX - rect.left - element.posX,
      offsetY: e.clientY - rect.top - element.posY,
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onResizeHandlePointerDown = (
    e: PointerEvent<HTMLDivElement>,
    localId: string,
    handle: ResizeHandle
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const table = tables.find((t) => t.localId === localId);
    if (!table) return;
    setSelectedId(localId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setResize({
      localId,
      handle,
      startPointerX: e.clientX - rect.left,
      startPointerY: e.clientY - rect.top,
      startPosX: table.posX,
      startPosY: table.posY,
      startWidth: table.width,
      startHeight: table.height,
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onCanvasPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !activePlan) return;

    if (resize) {
      const dx = e.clientX - rect.left - resize.startPointerX;
      const dy = e.clientY - rect.top - resize.startPointerY;
      const next = applyTableResize(
        resize.handle,
        {
          posX: resize.startPosX,
          posY: resize.startPosY,
          width: resize.startWidth,
          height: resize.startHeight,
        },
        dx,
        dy,
        activePlan.canvasWidth,
        activePlan.canvasHeight
      );
      setTables((prev) =>
        prev.map((t) => (t.localId === resize.localId ? { ...t, ...next } : t))
      );
      return;
    }

    if (!drag) return;

    if (drag.kind === 'element') {
      const element = elements.find((el) => el.localId === drag.localId);
      if (!element) return;
      const x = Math.max(
        0,
        Math.min(activePlan.canvasWidth - element.width, e.clientX - rect.left - drag.offsetX)
      );
      const y = Math.max(
        0,
        Math.min(activePlan.canvasHeight - element.height, e.clientY - rect.top - drag.offsetY)
      );
      setElements((prev) =>
        prev.map((el) => (el.localId === drag.localId ? { ...el, posX: x, posY: y } : el))
      );
      return;
    }

    const table = tables.find((t) => t.localId === drag.localId);
    const x = Math.max(
      0,
      Math.min(activePlan.canvasWidth - (table?.width || 40), e.clientX - rect.left - drag.offsetX)
    );
    const y = Math.max(
      0,
      Math.min(activePlan.canvasHeight - (table?.height || 40), e.clientY - rect.top - drag.offsetY)
    );
    setTables((prev) =>
      prev.map((t) => (t.localId === drag.localId ? { ...t, posX: x, posY: y } : t))
    );
  };

  const onCanvasPointerUp = (e?: PointerEvent<HTMLDivElement>) => {
    if (e && (drag || resize)) {
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    setDrag(null);
    setResize(null);
  };

  if (loading) return <div className="text-center py-12">Loading floor plans...</div>;

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('floorPlan')}</h1>
            <p className="text-slate-600 mt-1">
              Design dining tables with capacity (PAX). Enable floor plan &amp; per-person ordering in Settings → Tables.
            </p>
          </div>
          {covers && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Covers served today</div>
              <div className="text-2xl font-bold text-slate-900">{covers.coversServed}</div>
              <div className="text-xs text-slate-500">
                {covers.dineInOrders} dine-in · avg party {covers.averagePartySize}
              </div>
            </div>
          )}
        </div>
      )}
      {embedded && covers && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm inline-block">
          <div className="text-xs uppercase tracking-wide text-slate-500">Covers served today</div>
          <div className="text-2xl font-bold text-slate-900">{covers.coversServed}</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-4">
        {/* Plans list */}
        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-900">Floor plans</h2>
          <form onSubmit={createPlan} className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="New plan name"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              {t('add')}
            </button>
          </form>
          <div className="space-y-1">
            {plans.length === 0 && <p className="text-sm text-slate-500">No plans yet. Create one to start.</p>}
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPlan(p.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
                  p.id === activePlanId ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50'
                }`}
              >
                {p.name}
                <span className="block text-xs text-slate-500">{p.tables?.length || 0} tables</span>
              </button>
            ))}
          </div>
        </div>

        {/* Designer: details bar on top, canvas fills remaining space */}
        <div className="flex flex-col gap-4 min-w-0 min-h-0">
          <div className="card space-y-3">
            <h2 className="font-semibold text-slate-900">Table details</h2>
            {!selected ? (
              <p className="text-sm text-slate-500">Select a table on the canvas to edit label, capacity, and shape.</p>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[7rem] flex-1">
                  <label className="block text-sm font-medium mb-1">Label</label>
                  <input
                    className="input"
                    value={selected.label}
                    onChange={(e) => updateSelected({ label: e.target.value })}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium mb-1">PAX</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={50}
                    value={selected.capacity}
                    onChange={(e) => updateSelected({ capacity: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium mb-1">Shape</label>
                  <select
                    className="input"
                    value={selected.shape}
                    onChange={(e) => updateSelected({ shape: e.target.value as TableShape })}
                  >
                    <option value="rect">Rectangle</option>
                    <option value="round">Round</option>
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium mb-1">Width</label>
                  <input
                    className="input"
                    type="number"
                    value={selected.width}
                    onChange={(e) => updateSelected({ width: Math.max(MIN_TABLE_SIZE, Number(e.target.value) || MIN_TABLE_SIZE) })}
                  />
                </div>
                <div className="w-24">
                  <label className="block text-sm font-medium mb-1">Height</label>
                  <input
                    className="input"
                    type="number"
                    value={selected.height}
                    onChange={(e) => updateSelected({ height: Math.max(MIN_TABLE_SIZE, Number(e.target.value) || MIN_TABLE_SIZE) })}
                  />
                </div>
                <button type="button" className="btn-secondary text-red-600 shrink-0" onClick={removeSelected}>
                  {t('delete')}
                </button>
              </div>
            )}
            <div className="border-t pt-3 text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
              <p>
                <strong>PAX ordering:</strong> when enabled in Settings, POS orders &amp; bills per person (Person 1…).
              </p>
              <p>
                <strong>Split bill:</strong> at checkout use Pay all, /N equal split, or pay by person.
              </p>
            </div>
          </div>

          <div className="card min-w-0 flex-1 flex flex-col min-h-[480px]">
            <div className="sticky top-0 z-10 -mx-3 sm:-mx-4 mb-3 flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 bg-[var(--bg-elevated)] px-3 sm:px-4 py-2 shrink-0">
              <h2 className="font-semibold text-slate-900 truncate min-w-0">{activePlan?.name || 'Canvas'}</h2>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="btn-secondary" onClick={addTable} disabled={!activePlan}>
                  + Table
                </button>
                <button type="button" className="btn-secondary" onClick={() => addElement('WALL')} disabled={!activePlan}>
                  + Wall
                </button>
                <button type="button" className="btn-secondary" onClick={() => addElement('DOOR')} disabled={!activePlan}>
                  + Door
                </button>
                {selectedElementId ? (
                  <button type="button" className="btn-secondary text-red-600" onClick={removeSelectedElement}>
                    {t('delete')} element
                  </button>
                ) : null}
                <button type="button" className="btn-primary whitespace-nowrap" onClick={saveTables} disabled={!activePlan || saving}>
                  {saving ? 'Saving...' : t('save')}
                </button>
              </div>
            </div>

            {!activePlan ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 border border-dashed rounded-xl min-h-[360px]">
                Create a floor plan to design tables
              </div>
            ) : (
              <div
                className="relative flex-1 rounded-xl border border-slate-200 bg-[linear-gradient(#e2e8f0_1px,transparent_1px),linear-gradient(90deg,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] min-h-[360px]"
                style={{
                  overflow: canvasPointerActive ? 'hidden' : 'auto',
                  touchAction: canvasPointerActive ? 'none' : 'auto',
                }}
                onPointerDown={onCanvasBackgroundPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerUp}
              >
                <div
                  ref={canvasRef}
                  className="relative bg-slate-50/40"
                  style={{ width: activePlan.canvasWidth, height: activePlan.canvasHeight }}
                >
                  {elements
                    .filter((el) => el.localId !== selectedElementId)
                    .map((el) => {
                    const hitPad = Math.max(0, (24 - el.height) / 2);
                    return (
                      <div
                        key={el.localId}
                        data-floor-element
                        onPointerDown={(e) => onElementPointerDown(e, el.localId)}
                        className={`absolute cursor-grab active:cursor-grabbing select-none ${
                          selectedElementId === el.localId
                            ? 'ring-2 ring-indigo-200'
                            : ''
                        }`}
                        style={{
                          left: el.posX,
                          top: el.posY - hitPad,
                          width: el.width,
                          height: el.height + hitPad * 2,
                          touchAction: 'none',
                          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                        }}
                      >
                        <div
                          className={`h-full w-full border ${
                            selectedElementId === el.localId
                              ? 'border-indigo-600'
                              : 'border-transparent'
                          }`}
                          style={{
                            height: el.height,
                            marginTop: hitPad,
                            backgroundColor: el.elementType === 'DOOR' ? '#8D6E63' : '#4A4A4A',
                          }}
                        />
                      </div>
                    );
                  })}
                  {tables.map((table) => (
                    <div
                      key={table.localId}
                      data-floor-table
                      onPointerDown={(e) => onTablePointerDown(e, table.localId)}
                      className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none shadow-sm border-2 ${
                        selectedId === table.localId ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-700/40'
                      } ${table.shape === 'round' ? 'rounded-full' : 'rounded-xl'} ${
                        table.status === 'reserved' ? 'ring-4 ring-amber-400 ring-offset-1' : ''
                      }`}
                      style={{
                        left: table.posX,
                        top: table.posY,
                        width: table.width,
                        height: table.height,
                        touchAction: 'none',
                        backgroundColor: `${STATUS_COLOR[table.status]}22`,
                        transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
                      }}
                    >
                      <div className="font-bold text-slate-900 text-sm">{table.label}</div>
                      <div className="text-[11px] text-slate-600">{table.capacity} PAX</div>
                      <div
                        className="mt-1 h-2 w-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLOR[table.status] }}
                      />
                      {selectedId === table.localId &&
                        RESIZE_HANDLES.map(({ handle, cursor, style }) => (
                          <div
                            key={handle}
                            data-resize-handle
                            onPointerDown={(e) => onResizeHandlePointerDown(e, table.localId, handle)}
                            className="absolute z-10 h-2.5 w-2.5 rounded-sm border-2 border-indigo-600 bg-white shadow-sm"
                            style={{ ...style, cursor, touchAction: 'none' }}
                          />
                        ))}
                    </div>
                  ))}
                  {selectedElementId &&
                    elements
                      .filter((el) => el.localId === selectedElementId)
                      .map((el) => {
                        const hitPad = Math.max(0, (24 - el.height) / 2);
                        return (
                          <div
                            key={el.localId}
                            data-floor-element
                            onPointerDown={(e) => onElementPointerDown(e, el.localId)}
                            className="absolute z-10 cursor-grab active:cursor-grabbing select-none ring-2 ring-indigo-200"
                            style={{
                              left: el.posX,
                              top: el.posY - hitPad,
                              width: el.width,
                              height: el.height + hitPad * 2,
                              touchAction: 'none',
                              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                            }}
                          >
                            <div
                              className="h-full w-full border border-indigo-600"
                              style={{
                                height: el.height,
                                marginTop: hitPad,
                                backgroundColor: el.elementType === 'DOOR' ? '#8D6E63' : '#4A4A4A',
                              }}
                            />
                          </div>
                        );
                      })}
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 shrink-0">
              {Object.entries(STATUS_COLOR).map(([k, c]) => (
                <span key={k} className="inline-flex items-center gap-1 capitalize">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
                  {k}
                </span>
              ))}
            </div>
            {merchantSlug && activePlan && !hideQr ? (
              <TableQrPrintPanel
                merchantSlug={merchantSlug}
                tables={tables
                  .filter((t) => t.id)
                  .map((t) => ({ id: t.id!, label: t.label }))}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
