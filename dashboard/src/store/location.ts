import { create } from 'zustand';
import api from '@/lib/api';

export type MerchantLocation = {
  id: string;
  name: string;
  slug: string;
  businessCategory: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  timezone?: string | null;
  isDefault: boolean;
  status: string;
};

type LocationLimits = {
  maxLocations: number;
  currentCount: number;
};

const STORAGE_KEY = 'manupos_selected_location';

type LocationStore = {
  locations: MerchantLocation[];
  locationId: string | null;
  location: MerchantLocation | null;
  limits: LocationLimits | null;
  loading: boolean;
  hydrated: boolean;
  setLocationId: (id: string) => void;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  locations: [],
  locationId: readStoredId(),
  location: null,
  limits: null,
  loading: false,
  hydrated: false,
  setLocationId: (id) => {
    writeStoredId(id);
    const loc = get().locations.find((l) => l.id === id) || null;
    set({ locationId: id, location: loc });
  },
  load: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/merchant/locations');
      const locations: MerchantLocation[] = res.data?.locations || [];
      const limits: LocationLimits | null = res.data?.limits || null;
      const stored = readStoredId();
      const pick =
        locations.find((l) => l.id === stored)?.id ||
        locations.find((l) => l.isDefault)?.id ||
        locations[0]?.id ||
        null;
      if (pick) writeStoredId(pick);
      set({
        locations,
        limits,
        locationId: pick,
        location: locations.find((l) => l.id === pick) || null,
        hydrated: true,
      });
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      set({ locationId: null, location: null, hydrated: true });
    } finally {
      set({ loading: false });
    }
  },
  refresh: async () => {
    await get().load();
  },
}));

export function getSelectedLocationId(): string | null {
  return useLocationStore.getState().locationId || readStoredId();
}
