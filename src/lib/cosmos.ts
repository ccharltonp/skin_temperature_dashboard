const BASE = "https://cosmos-api.ceh.ac.uk";

export interface CosmosLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface CosmosObservation {
  siteId: string;
  timestamp: string;
  lwout: number | null;
  lwin: number | null;
  ta: number | null;
}

// Fetch all site locations from the 30-minute collection
export async function fetchSites(): Promise<CosmosLocation[]> {
  const url = `${BASE}/collections/30M/locations`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`COSMOS locations fetch failed: ${res.status}`);
  const json = await res.json();

  // The API returns coordinates as [lat, lon] (non-standard GeoJSON)
  const features: CosmosLocation[] = (json.features ?? []).map((f: any) => ({
    id: f.id,
    name: f.properties?.label ?? f.properties?.name ?? f.id,
    lat: f.geometry?.coordinates?.[0] ?? 0,
    lon: f.geometry?.coordinates?.[1] ?? 0,
  }));
  return features;
}

// Fetch the most recent 30-min observation for a site (lwout, lwin, ta)
export async function fetchLatestObservation(
  siteId: string
): Promise<CosmosObservation> {
  // COSMOS data can lag by up to ~8 hours; look back 12 h to always get a value
  // API requires datetime without milliseconds: %Y-%m-%dT%H:%M:%SZ
  const toCosmosISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const now = new Date();
  const lookback = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const dtParam = `${toCosmosISO(lookback)}/${toCosmosISO(now)}`;

  const url =
    `${BASE}/collections/30M/locations/${encodeURIComponent(siteId)}` +
    `?parameter-name=lwout,lwin,ta&datetime=${dtParam}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    return { siteId, timestamp: now.toISOString(), lwout: null, lwin: null, ta: null };
  }

  const json = await res.json();
  // Single-site responses are always wrapped in coverages array
  const coverage = json.coverages?.[0] ?? json;

  const times: string[] =
    coverage?.domain?.axes?.t?.values ?? [];
  const lwoutVals: (number | null)[] =
    coverage?.ranges?.lwout?.values ?? [];
  const lwinVals: (number | null)[] =
    coverage?.ranges?.lwin?.values ?? [];
  const taVals: (number | null)[] =
    coverage?.ranges?.ta?.values ?? [];

  // Find the most recent non-null pair
  for (let i = times.length - 1; i >= 0; i--) {
    const lo = lwoutVals[i];
    const li = lwinVals[i];
    if (lo != null && li != null) {
      return {
        siteId,
        timestamp: times[i],
        lwout: lo,
        lwin: li,
        ta: taVals[i] ?? null,
      };
    }
  }

  return {
    siteId,
    timestamp: times[times.length - 1] ?? now.toISOString(),
    lwout: null,
    lwin: null,
    ta: null,
  };
}

// Fetch historical observations for a site over a date range (for chart)
export async function fetchHistory(
  siteId: string,
  from: Date,
  to: Date
): Promise<CosmosObservation[]> {
  const toCosmosISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  const dtParam = `${toCosmosISO(from)}/${toCosmosISO(to)}`;
  const url =
    `${BASE}/collections/30M/locations/${encodeURIComponent(siteId)}` +
    `?parameter-name=lwout,lwin,ta&datetime=${dtParam}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const json = await res.json();
  const coverage = json.coverages?.[0] ?? json;

  const times: string[] = coverage?.domain?.axes?.t?.values ?? [];
  const lwoutVals: (number | null)[] = coverage?.ranges?.lwout?.values ?? [];
  const lwinVals: (number | null)[] = coverage?.ranges?.lwin?.values ?? [];
  const taVals: (number | null)[] = coverage?.ranges?.ta?.values ?? [];

  return times.map((t, i) => ({
    siteId,
    timestamp: t,
    lwout: lwoutVals[i] ?? null,
    lwin: lwinVals[i] ?? null,
    ta: taVals[i] ?? null,
  }));
}
