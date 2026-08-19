import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type TableShape = 'rect' | 'round';
type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty';

type PosTable = {
  id: string;
  label: string;
  capacity: number;
  shape: TableShape;
  posX: number;
  posY: number;
  width: number;
  height: number;
  rotation: number;
  status: TableStatus;
};

type FloorPlanData = {
  id: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  tables: PosTable[];
};

const STATUS_COLOR: Record<TableStatus, string> = {
  available: '#22c55e',
  occupied: '#ef4444',
  reserved: '#f59e0b',
  dirty: '#94a3b8',
};

/** Survives Tables → register → Tables remounts in the same tab session. */
const SELECTED_FLOOR_KEY = 'manupos_webpos_selected_floor_id';

function readSelectedFloorId(): string | null {
  try {
    const value = sessionStorage.getItem(SELECTED_FLOOR_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeSelectedFloorId(id: string) {
  try {
    sessionStorage.setItem(SELECTED_FLOOR_KEY, id);
  } catch {
    /* private mode / quota */
  }
}

type Props = {
  onSelectTable?: (table: { id: string; label: string }) => void;
  selectedTableId?: string | null;
  /** Table ids that have an in-session open draft cart */
  draftTableIds?: string[];
  /** Hide this table from the plan (e.g. source table when picking a move target). */
  excludeTableId?: string | null;
  /** Move whole open order from an occupied table. */
  onMoveTable?: (table: { id: string; label: string }) => void;
  /** Bump to reload floor plans (e.g. after table release). */
  refreshToken?: number;
};

export default function WebPosTablesView({
  onSelectTable,
  selectedTableId,
  draftTableIds = [],
  excludeTableId = null,
  onMoveTable,
  refreshToken = 0,
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<FloorPlanData[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(readSelectedFloorId);

  const selectFloor = useCallback((id: string) => {
    setActivePlanId(id);
    writeSelectedFloorId(id);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/merchant/floor-plans');
      const list: FloorPlanData[] = res.data.plans || [];
      setPlans(list);
      if (list.length) {
        setActivePlanId((prev) => {
          const next = prev && list.some((p) => p.id === prev) ? prev : list[0]!.id;
          writeSelectedFloorId(next);
          return next;
        });
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || t('webPosLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const activePlan = useMemo(
    () => plans.find((p) => p.id === activePlanId) || null,
    [plans, activePlanId]
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-stone-500">
        {t('loading')}
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-stone-500">
        <p>{t('createFloorPlanHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-100">
      {plans.length > 1 ? (
        <div className="flex gap-2 border-b border-stone-200 bg-white px-3 py-2">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectFloor(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                p.id === activePlanId
                  ? 'bg-[var(--webpos-accent)] text-white'
                  : 'bg-stone-100 text-stone-600'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div
          className="relative mx-auto rounded-xl border border-stone-200 bg-white shadow-sm"
          style={{
            width: activePlan.canvasWidth,
            height: activePlan.canvasHeight,
            maxWidth: '100%',
          }}
        >
          {activePlan.tables
            .filter((table) => table.id !== excludeTableId)
            .map((table) => {
            const selected = selectedTableId === table.id;
            const hasDraft = draftTableIds.includes(table.id);
            const isReserved = table.status === 'reserved';
            const statusColor = hasDraft ? STATUS_COLOR.occupied : STATUS_COLOR[table.status];
            return (
              <div
                key={table.id}
                className="absolute"
                style={{
                  left: table.posX,
                  top: table.posY,
                  width: table.width,
                  height: table.height,
                  transform: `rotate(${table.rotation || 0}deg)`,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectTable?.({ id: table.id, label: table.label })}
                  className={`flex h-full w-full flex-col items-center justify-center border-2 text-xs font-bold transition hover:brightness-95 ${
                    table.shape === 'round' ? 'rounded-full' : 'rounded-lg'
                  } ${selected ? 'ring-4 ring-[var(--webpos-accent-ring)] ring-offset-2' : ''} ${
                    isReserved && !hasDraft ? 'ring-4 ring-amber-400 ring-offset-1' : ''
                  }`}
                  style={{
                    backgroundColor: `${statusColor}22`,
                    borderColor: statusColor,
                    color: '#1c1917',
                  }}
                >
                  <span>{table.label}</span>
                  <span className="text-[10px] font-normal opacity-70">
                    {hasDraft ? t('webPosOpenCart') : `${table.capacity}p`}
                  </span>
                </button>
                {hasDraft && onMoveTable ? (
                  <button
                    type="button"
                    title={t('webPosMoveTable')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveTable({ id: table.id, label: table.label });
                    }}
                    className="absolute -right-1 -top-1 z-10 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-stone-700 shadow ring-1 ring-stone-300 hover:bg-stone-50"
                  >
                    ⇄
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
