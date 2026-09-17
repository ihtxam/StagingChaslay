/**
 * Provider-independent address autocomplete / geocoding.
 * Default provider: Photon (komoot). Nominatim search is the fallback.
 * Frontend never calls Photon/Nominatim directly.
 */

export type LocationSuggestion = {
  id: string;
  displayAddress: string;
  addressLine1?: string;
  houseNumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  latitude: number;
  longitude: number;
  provider: "photon" | "nominatim";
  providerId?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
};

type NominatimHit = {
  lat?: string;
  lon?: string;
  display_name?: string;
  osm_id?: number;
  osm_type?: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
    country_code?: string;
  };
};

const USER_AGENT = "Reborn-POS/1.0 (https://app.rebornsense.com)";
const CACHE_TTL_MS = 60_000;
const FETCH_MS = 4_000;

const NAME_TO_ISO: Record<string, string> = {
  switzerland: "CH",
  suisse: "CH",
  schweiz: "CH",
  svizzera: "CH",
  france: "FR",
  germany: "DE",
  deutschland: "DE",
  italy: "IT",
  italia: "IT",
  austria: "AT",
  osterreich: "AT",
  österreich: "AT",
  belgium: "BE",
  belgien: "BE",
  belgique: "BE",
};

const cache = new Map<string, { at: number; suggestions: LocationSuggestion[] }>();

export function normalizeCountryCode(raw?: string | null): string | undefined {
  const s = String(raw || "").trim();
  if (!s) return undefined;
  if (/^[a-z]{2}$/i.test(s)) return s.toUpperCase();
  const mapped = NAME_TO_ISO[s.toLowerCase()];
  return mapped;
}

export function composeDisplayAddress(parts: {
  houseNumber?: string;
  street?: string;
  name?: string;
  postcode?: string;
  city?: string;
  country?: string;
}): string {
  const line1 =
    [parts.houseNumber, parts.street].filter(Boolean).join(" ").trim() ||
    String(parts.name || "").trim();
  const line2 = [parts.postcode, parts.city].filter(Boolean).join(" ").trim();
  return [line1, line2, parts.country].filter(Boolean).join(", ");
}

export function photonFeatureToSuggestion(feature: PhotonFeature): LocationSuggestion | null {
  const lon = Number(feature.geometry?.coordinates?.[0]);
  const lat = Number(feature.geometry?.coordinates?.[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const p = feature.properties || {};
  const street = String(p.street || p.name || "").trim() || undefined;
  const houseNumber = String(p.housenumber || "").trim() || undefined;
  const city = String(p.city || p.district || "").trim() || undefined;
  const postcode = String(p.postcode || "").trim() || undefined;
  const country = String(p.country || "").trim() || undefined;
  const countryCode = normalizeCountryCode(p.countrycode);
  const displayAddress = composeDisplayAddress({
    houseNumber,
    street,
    name: p.name,
    postcode,
    city,
    country,
  });
  if (!displayAddress) return null;
  const providerId = [p.osm_type, p.osm_id].filter(Boolean).join(":");
  return {
    id: providerId || `${lat},${lon}`,
    displayAddress,
    addressLine1: [houseNumber, street].filter(Boolean).join(" ").trim() || undefined,
    houseNumber,
    street,
    postcode,
    city,
    country,
    countryCode,
    latitude: lat,
    longitude: lon,
    provider: "photon",
    providerId: providerId || undefined,
  };
}

export function nominatimHitToSuggestion(hit: NominatimHit): LocationSuggestion | null {
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const a = hit.address || {};
  const street = String(a.road || a.pedestrian || "").trim() || undefined;
  const houseNumber = String(a.house_number || "").trim() || undefined;
  const city =
    String(a.city || a.town || a.village || a.municipality || "").trim() || undefined;
  const postcode = String(a.postcode || "").trim() || undefined;
  const country = String(a.country || "").trim() || undefined;
  const countryCode = normalizeCountryCode(a.country_code);
  const displayAddress =
    composeDisplayAddress({ houseNumber, street, postcode, city, country }) ||
    String(hit.display_name || "").trim();
  if (!displayAddress) return null;
  const providerId = [hit.osm_type, hit.osm_id].filter(Boolean).join(":");
  return {
    id: providerId || `${lat},${lon}`,
    displayAddress,
    addressLine1: [houseNumber, street].filter(Boolean).join(" ").trim() || undefined,
    houseNumber,
    street,
    postcode,
    city,
    country,
    countryCode,
    latitude: lat,
    longitude: lon,
    provider: "nominatim",
    providerId: providerId || undefined,
  };
}

export function filterAndDedupeSuggestions(
  items: LocationSuggestion[],
  countryCode?: string
): LocationSuggestion[] {
  const want = normalizeCountryCode(countryCode);
  const preferred = want
    ? items.filter((s) => !s.countryCode || s.countryCode === want)
    : items;
  const pool = preferred.length ? preferred : items;
  const seen = new Set<string>();
  const out: LocationSuggestion[] = [];
  for (const s of pool) {
    const key = `${s.displayAddress.toLowerCase()}|${s.latitude.toFixed(5)}|${s.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function photonBaseUrl(): string {
  return String(process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/+$/, "");
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function photonAutocomplete(opts: {
  q: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  limit: number;
  lang?: string;
}): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({
    q: opts.q,
    limit: String(Math.min(12, Math.max(1, opts.limit))),
  });
  if (opts.lang) params.set("lang", opts.lang);
  if (opts.lat != null && opts.lng != null && Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
    params.set("lat", String(opts.lat));
    params.set("lon", String(opts.lng));
  }
  const data = (await fetchJson(`${photonBaseUrl()}/api/?${params.toString()}`)) as {
    features?: PhotonFeature[];
  };
  const mapped = (data.features || [])
    .map(photonFeatureToSuggestion)
    .filter((s): s is LocationSuggestion => !!s);
  return filterAndDedupeSuggestions(mapped, opts.countryCode).slice(0, opts.limit);
}

async function nominatimAutocomplete(opts: {
  q: string;
  countryCode?: string;
  limit: number;
}): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    limit: String(Math.min(12, Math.max(1, opts.limit))),
    q: opts.q,
  });
  const cc = normalizeCountryCode(opts.countryCode);
  if (cc) params.set("countrycodes", cc.toLowerCase());
  const data = (await fetchJson(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`
  )) as NominatimHit[];
  const mapped = (Array.isArray(data) ? data : [])
    .map(nominatimHitToSuggestion)
    .filter((s): s is LocationSuggestion => !!s);
  return filterAndDedupeSuggestions(mapped, opts.countryCode).slice(0, opts.limit);
}

export async function autocompleteAddress(opts: {
  q: string;
  countryCode?: string;
  lat?: number | null;
  lng?: number | null;
  limit?: number;
  lang?: string;
}): Promise<LocationSuggestion[]> {
  const q = String(opts.q || "").trim();
  if (q.length < 3) return [];
  const limit = opts.limit ?? 8;
  const countryCode = normalizeCountryCode(opts.countryCode);
  const cacheKey = [
    q.toLowerCase(),
    countryCode || "",
    opts.lat != null ? Number(opts.lat).toFixed(3) : "",
    opts.lng != null ? Number(opts.lng).toFixed(3) : "",
    opts.lang || "",
  ].join("|");
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.suggestions;

  let suggestions: LocationSuggestion[] = [];
  try {
    suggestions = await photonAutocomplete({
      q,
      countryCode,
      lat: opts.lat != null ? Number(opts.lat) : undefined,
      lng: opts.lng != null ? Number(opts.lng) : undefined,
      limit,
      lang: opts.lang,
    });
  } catch {
    suggestions = [];
  }
  if (!suggestions.length) {
    try {
      suggestions = await nominatimAutocomplete({ q, countryCode, limit });
    } catch {
      suggestions = [];
    }
  }

  cache.set(cacheKey, { at: Date.now(), suggestions });
  return suggestions;
}
