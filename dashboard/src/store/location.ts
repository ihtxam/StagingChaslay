import { create } from 'zustand';
import api from '@/lib/api';
import { notifyPanelLocationScopeChanged } from '@/lib/panel-location-scope';
import { canSwitchPanelLocationFromUser } from '@/lib/panel-location-switch';
import { useAuthStore } from '@/store/auth';

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
const SCOPE_STORAGE_KEY = 'manupos_panel_scope';

export type PanelLocationScope = 'hq' | 'branch';

type LocationStore = {
  locations: MerchantLocation[];
  /** Active branch id when scope is `branch`; null in HQ view. */
  locationId: string | null;
  location: MerchantLocation | null;
  panelScope: PanelLocationScope;
  isHqView: boolean;
  limits: LocationLimits | null;
  loading: boolean;
  hydrated: boolean;
  /** Manager / admin / owner may switch branches; floor staff are locked. */
  canSwitchPanelLocation: boolean;
  boundLocationId: string | null;
  setLocationId: (id: string) => void;
  setHqView: () => void;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};

function readStoredScope(): PanelLocationScope {
  try {
    const raw = localStorage.getItem(SCOPE_STORAGE_KEY);
    return raw === 'hq' ? 'hq' : 'branch';
  } catch {
    return 'branch';
  }
}

function writeStoredScope(scope: PanelLocationScope) {
  try {
    localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  } catch {
    /* ignore */
  }
}

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

function panelLocationSwitchAllowed(): boolean {
  const user = useAuthStore.getState().user;
  return canSwitchPanelLocationFromUser(user);
}

export const useLocationStore = create<LocationStore>((set, get) => ({
  locations: [],
  locationId: readStoredScope() === 'hq' ? null : readStoredId(),
  location: null,
  panelScope: readStoredScope(),
  isHqView: readStoredScope() === 'hq',
  limits: null,
  loading: false,
  hydrated: false,
  canSwitchPanelLocation: true,
  boundLocationId: null,
  setLocationId: (id) => {
    const { canSwitchPanelLocation: canSwitch, boundLocationId } = get();
    if (!canSwitch) {
      const locked = boundLocationId || id;
      if (locked && locked !== get().locationId) {
        const loc = get().locations.find((l) => l.id === locked) || null;
        writeStoredScope('branch');
        writeStoredId(locked);
        set({
          locationId: locked,
          location: loc,
          panelScope: 'branch',
          isHqView: false,
        });
      }
      return;
    }
    writeStoredScope('branch');
    writeStoredId(id);
    const loc = get().locations.find((l) => l.id === id) || null;
    set({ locationId: id, location: loc, panelScope: 'branch', isHqView: false });
    notifyPanelLocationScopeChanged();
  },
  setHqView: () => {
    if (!get().canSwitchPanelLocation) return;
    writeStoredScope('hq');
    writeStoredId(null);
    set({ locationId: null, location: null, panelScope: 'hq', isHqView: true });
    notifyPanelLocationScopeChanged();
  },
  load: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/merchant/locations');
      const locations: MerchantLocation[] = res.data?.locations || [];
      const limits: LocationLimits | null = res.data?.limits || null;
      const panelLocation = res.data?.panelLocation as
        | { canSwitchPanelLocation?: boolean; boundLocationId?: string | null }
        | undefined;
      const canSwitch =
        panelLocation?.canSwitchPanelLocation ?? panelLocationSwitchAllowed();
      const boundLocationId = panelLocation?.boundLocationId
        ? String(panelLocation.boundLocationId)
        : null;

      if (!canSwitch) {
        const pick =
          (boundLocationId && locations.find((l) => l.id === boundLocationId)?.id) ||
          locations.find((l) => l.isDefault)?.id ||
          locations[0]?.id ||
          null;
        if (pick) {
          writeStoredScope('branch');
          writeStoredId(pick);
        }
        set({
          locations,
          limits,
          locationId: pick,
          location: locations.find((l) => l.id === pick) || null,
          panelScope: 'branch',
          isHqView: false,
          canSwitchPanelLocation: false,
          boundLocationId: pick,
          hydrated: true,
        });
        return;
      }

      const scope = readStoredScope();
      const stored = readStoredId();
      const canUseHq = locations.length > 1 && scope === 'hq';

      if (canUseHq) {
        set({
          locations,
          limits,
          locationId: null,
          location: null,
          panelScope: 'hq',
          isHqView: true,
          canSwitchPanelLocation: true,
          boundLocationId: null,
          hydrated: true,
        });
        return;
      }

      const pick =
        locations.find((l) => l.id === stored)?.id ||
        locations.find((l) => l.isDefault)?.id ||
        locations[0]?.id ||
        null;
      if (pick) {
        writeStoredScope('branch');
        writeStoredId(pick);
      }
      set({
        locations,
        limits,
        locationId: pick,
        location: locations.find((l) => l.id === pick) || null,
        panelScope: 'branch',
        isHqView: false,
        canSwitchPanelLocation: true,
        boundLocationId: null,
        hydrated: true,
      });
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SCOPE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      set({
        locationId: null,
        location: null,
        panelScope: 'branch',
        isHqView: false,
        canSwitchPanelLocation: panelLocationSwitchAllowed(),
        boundLocationId: null,
        hydrated: true,
      });
    } finally {
      set({ loading: false });
    }
  },
  refresh: async () => {
    await get().load();
  },
}));

export function getSelectedLocationId(): string | null {
  if (readStoredScope() === 'hq') return null;
  return useLocationStore.getState().locationId || readStoredId();
}

export function getPanelLocationScope(): PanelLocationScope {
  return readStoredScope();
}
