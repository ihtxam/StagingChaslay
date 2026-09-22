import { useEffect, useState } from 'react';
import axios from 'axios';

export type ShopDeliveryZone = {
  id: string;
  name: string;
  polygon?: [number, number][];
  minOrderAmount: string | number;
  deliveryFee: string | number;
  freeDeliveryMinOrder?: string | number;
  estimatedMinutes?: number;
  color?: string | null;
};

export type ShopDeliveryZipRule = {
  id: string;
  name: string;
  zipCode?: string | null;
  city?: string | null;
  minOrderAmount: string | number;
  deliveryFee: string | number;
  freeDeliveryMinOrder?: string | number;
  estimatedMinutes?: number;
};

type Result = {
  zones: ShopDeliveryZone[];
  zipRules: ShopDeliveryZipRule[];
  deliveryMode: 'zones' | 'zipcode';
  loading: boolean;
};

/**
 * Load public delivery pricing (map zones or PLZ rules) for a shop.
 */
export function useShopDeliveryPricing(
  shopKey: string | null | undefined,
  enabled = true
): Result {
  const [zones, setZones] = useState<ShopDeliveryZone[]>([]);
  const [zipRules, setZipRules] = useState<ShopDeliveryZipRule[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<'zones' | 'zipcode'>('zones');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !shopKey) {
      setZones([]);
      setZipRules([]);
      setDeliveryMode('zones');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const shopRes = await axios.get(`/api/shop/${encodeURIComponent(shopKey)}`);
        const mode = shopRes.data?.data?.deliveryMode === 'zipcode' ? 'zipcode' : 'zones';
        if (cancelled) return;
        setDeliveryMode(mode);
        if (mode === 'zipcode') {
          const zipRes = await axios.get(`/api/shop/${encodeURIComponent(shopKey)}/delivery-zip-rules`);
          const raw = zipRes.data?.data ?? zipRes.data?.rules ?? zipRes.data;
          if (!cancelled) setZipRules(Array.isArray(raw) ? raw : []);
          if (!cancelled) setZones([]);
        } else {
          const zoneRes = await axios.get(`/api/shop/${encodeURIComponent(shopKey)}/delivery-zones`);
          const raw = zoneRes.data?.data ?? zoneRes.data?.zones ?? zoneRes.data;
          if (!cancelled) setZones(Array.isArray(raw) ? raw : []);
          if (!cancelled) setZipRules([]);
        }
      } catch {
        if (!cancelled) {
          setZones([]);
          setZipRules([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, enabled]);

  return { zones, zipRules, deliveryMode, loading };
}
