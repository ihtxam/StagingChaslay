import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import type { TableSection } from '@/lib/table-management';

export function useTableManagement() {
  const [sections, setSections] = useState<TableSection[]>([]);
  const [merchantSlug, setMerchantSlug] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, settingsRes] = await Promise.all([
        api.get('/merchant/floor-plans'),
        api.get('/merchant/settings').catch(() => null),
      ]);
      const slug = settingsRes?.data?.settings?.slug || settingsRes?.data?.slug || '';
      if (slug) setMerchantSlug(String(slug));

      const plans = (plansRes.data.plans || []) as Array<{
        id: string;
        name: string;
        sortOrder: number;
        isActive: boolean;
        tables?: Array<{
          id: string;
          label: string;
          capacity: number;
          shape?: string;
          posX?: number;
          posY?: number;
          width?: number;
          height?: number;
          status?: string;
        }>;
      }>;

      setSections(
        plans.map((p) => ({
          id: p.id,
          name: p.name,
          sortOrder: p.sortOrder ?? 0,
          isActive: p.isActive !== false,
          tables: (p.tables || []).map((t) => ({
            id: t.id,
            label: t.label,
            capacity: t.capacity,
            floorPlanId: p.id,
            floorPlanName: p.name,
            shape: t.shape,
            posX: t.posX,
            posY: t.posY,
            width: t.width,
            height: t.height,
            status: t.status,
          })),
        }))
      );
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allTables = sections.flatMap((s) => s.tables);

  return { sections, setSections, allTables, merchantSlug, loading, reload: load };
}
