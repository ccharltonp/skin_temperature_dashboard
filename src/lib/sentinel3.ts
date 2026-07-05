const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

let _tok: { t: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  if (_tok && Date.now() < _tok.exp - 30_000) return _tok.t;
  const id = process.env.SH_CLIENT_ID;
  const sec = process.env.SH_CLIENT_SECRET;
  if (!id || !sec) throw new Error("credentials_missing");

  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: sec,
    }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Token request failed: ${r.status}`);
  const j = await r.json();
  _tok = { t: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return _tok.t;
}

export interface S3LSTObs {
  time: string;   // ISO — midpoint of the 30-min window containing the overpass
  lstC: number;   // LST in °C (converted from Kelvin)
}

// Evalscript: returns LST (K) masked by dataMask; masked pixels → 0
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["LST", "LST_uncertainty", "dataMask"] }],
    output: [
      { id: "lst", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}
function evaluatePixel(s) {
  // Exclude cloud-contaminated pixels: dataMask=0 means no data;
  // LST_uncertainty >= 2 K indicates a poor retrieval (cloud/mixed pixel).
  // Also guard against unphysical UK values (below -15 C or above 55 C).
  const valid = s.dataMask === 1
    && s.LST_uncertainty > 0
    && s.LST_uncertainty < 2.0
    && s.LST > 258
    && s.LST < 328;
  return { lst: [valid ? s.LST : NaN], dataMask: [valid ? 1 : 0] };
}`;

export async function fetchS3LSTTimeseries(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string
): Promise<S3LSTObs[]> {
  const token = await getToken();

  // ~1 km half-width (smaller than one SLSTR pixel → samples the single containing pixel)
  const d = 0.005;
  const bbox = [lon - d, lat - d, lon + d, lat + d];

  const body = {
    input: {
      bounds: {
        bbox,
        properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" },
      },
      data: [{
        type: "sentinel-3-slstr-l2",
        dataFilter: { s3Type: "SL_2_LST" },
      }],
    },
    aggregation: {
      timeRange: { from: fromISO, to: toISO },
      aggregationInterval: { of: "P1D" },
      resampling: "NEAREST",
      evalscript: EVALSCRIPT,
    },
    calculations: {
      default: {
        statistics: { default: { percentiles: { k: [50.0] } } },
      },
    },
  };

  const r = await fetch(STATS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    next: { revalidate: 1800 },
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`Sentinel Hub Statistics API ${r.status}: ${msg}`);
  }

  const json = await r.json();
  const out: S3LSTObs[] = [];

  for (const interval of json.data ?? []) {
    const band = interval.outputs?.lst?.bands?.B0;
    if (!band) continue;

    // Statistics API nests all stats under band.stats
    const stats = band.stats ?? band;
    const validCount = (stats.sampleCount ?? 0) - (stats.noDataCount ?? 0);
    if (validCount <= 0) continue;

    const lstK = stats.percentiles?.["50.0"] ?? stats.mean;
    // Plausibility check: realistic UK land-surface range −15 °C to 55 °C
    if (!lstK || lstK < 258 || lstK > 328) continue;

    // Midpoint of the 30-min window as the overpass representative time
    const t1 = new Date(interval.interval.from).getTime();
    const t2 = new Date(interval.interval.to).getTime();

    out.push({
      time: new Date((t1 + t2) / 2).toISOString(),
      lstC: Math.round((lstK - 273.15) * 10) / 10,
    });
  }

  return out;
}
