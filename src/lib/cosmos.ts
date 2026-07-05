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
  tsoil2: number | null; // 2 cm soil temperature from STP probe (stp_tsoil2)
  tsoil5: number | null; // 5 cm soil temperature from STP probe (stp_tsoil5)
}

const toCosmosISO = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

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

// Fetch the most recent 30-min observation for a site
export async function fetchLatestObservation(
  siteId: string
): Promise<CosmosObservation> {
  // COSMOS data can lag by up to ~8 hours; look back 12 h to always get a value
  // API requires datetime without milliseconds: %Y-%m-%dT%H:%M:%SZ
  const now = new Date();
  const lookback = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const dtParam = `${toCosmosISO(lookback)}/${toCosmosISO(now)}`;

  const url =
    `${BASE}/collections/30M/locations/${encodeURIComponent(siteId)}` +
    `?parameter-name=lwout,lwin,ta,stp_tsoil2,stp_tsoil5&datetime=${dtParam}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    return { siteId, timestamp: now.toISOString(), lwout: null, lwin: null, ta: null, tsoil2: null };
  }

  const json = await res.json();
  const coverage = json.coverages?.[0] ?? json;

  const times: string[]          = coverage?.domain?.axes?.t?.values ?? [];
  const lwoutVals: (number|null)[] = coverage?.ranges?.lwout?.values ?? [];
  const lwinVals:  (number|null)[] = coverage?.ranges?.lwin?.values ?? [];
  const taVals:    (number|null)[] = coverage?.ranges?.ta?.values ?? [];
  const tsoil2Vals:(number|null)[] = coverage?.ranges?.stp_tsoil2?.values ?? [];
  const tsoil5Vals:(number|null)[] = coverage?.ranges?.stp_tsoil5?.values ?? [];

  // Find the most recent timestep with valid lwout + lwin
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
        tsoil2: tsoil2Vals[i] ?? null,
        tsoil5: tsoil5Vals[i] ?? null,
      };
    }
  }

  return {
    siteId,
    timestamp: times[times.length - 1] ?? now.toISOString(),
    lwout: null,
    lwin: null,
    ta: null,
    tsoil2: null,
    tsoil5: null,
  };
}

// Fetch daily cosmos_vwc from the 1D collection (CRNS-derived soil moisture, %)
export async function fetchVwcHistory(
  siteId: string,
  from: Date,
  to: Date
): Promise<{ date: string; vwc: number | null }[]> {
  const dtParam = `${toCosmosISO(from)}/${toCosmosISO(to)}`;
  const url =
    `${BASE}/collections/1D/locations/${encodeURIComponent(siteId)}` +
    `?parameter-name=cosmos_vwc&datetime=${dtParam}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const json = await res.json();
  const coverage = json.coverages?.[0] ?? json;
  const times: string[]          = coverage?.domain?.axes?.t?.values ?? [];
  const vwcVals: (number|null)[] = coverage?.ranges?.cosmos_vwc?.values ?? [];

  return times.map((t, i) => ({
    date: t.slice(0, 10), // "YYYY-MM-DD" key for joining to 30-min data
    vwc: vwcVals[i] ?? null,
  }));
}

// Fetch historical observations for a site over a date range (for chart)
export async function fetchHistory(
  siteId: string,
  from: Date,
  to: Date
): Promise<CosmosObservation[]> {
  const dtParam = `${toCosmosISO(from)}/${toCosmosISO(to)}`;
  const url =
    `${BASE}/collections/30M/locations/${encodeURIComponent(siteId)}` +
    `?parameter-name=lwout,lwin,ta,stp_tsoil2,stp_tsoil5&datetime=${dtParam}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const json = await res.json();
  const coverage = json.coverages?.[0] ?? json;

  const times: string[]          = coverage?.domain?.axes?.t?.values ?? [];
  const lwoutVals: (number|null)[] = coverage?.ranges?.lwout?.values ?? [];
  const lwinVals:  (number|null)[] = coverage?.ranges?.lwin?.values ?? [];
  const taVals:    (number|null)[] = coverage?.ranges?.ta?.values ?? [];
  const tsoil2Vals:(number|null)[] = coverage?.ranges?.stp_tsoil2?.values ?? [];
  const tsoil5Vals:(number|null)[] = coverage?.ranges?.stp_tsoil5?.values ?? [];

  return times.map((t, i) => ({
    siteId,
    timestamp: t,
    lwout: lwoutVals[i] ?? null,
    lwin: lwinVals[i] ?? null,
    ta: taVals[i] ?? null,
    tsoil2: tsoil2Vals[i] ?? null,
    tsoil5: tsoil5Vals[i] ?? null,
  }));
}
