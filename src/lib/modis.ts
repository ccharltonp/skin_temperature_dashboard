// ORNL DAAC MODIS Web Service — MOD11A2 (Terra, 8-day composite, 1 km)
// No credentials required. https://modis.ornl.gov/rst/api/v1/

const BASE = "https://modis.ornl.gov/rst/api/v1";

export interface MODISObs {
  windowStart: string;  // YYYY-MM-DD — first day of the 8-day composite
  lstC: number;         // °C
  viewTimeUTC: number;  // fractional hours UTC (e.g. 10.5)
}

function toJulian(d: Date): string {
  const year = d.getUTCFullYear();
  const doy = Math.floor(
    (d.getTime() - Date.UTC(year, 0, 1)) / 86400000
  ) + 1;
  return `A${year}${String(doy).padStart(3, "0")}`;
}

export async function fetchMODISLSTTimeseries(
  lat: number,
  lon: number,
  fromISO: string,
  toISO: string
): Promise<MODISObs[]> {
  const url = new URL(`${BASE}/MOD11A2/subset`);
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("startDate", toJulian(new Date(fromISO)));
  url.searchParams.set("endDate", toJulian(new Date(toISO)));
  url.searchParams.set("kmAboveBelow", "0");
  url.searchParams.set("kmLeftRight", "0");

  const r = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`MODIS API ${r.status}: ${text.slice(0, 200)}`);
  }

  const json = await r.json();
  const subsets: any[] = json.subset ?? [];

  // Index bands by (modis_date → value)
  const byDate: Record<string, { lst?: number; qc?: number; viewTime?: number; calDate?: string }> = {};
  for (const s of subsets) {
    const val = s.data?.[0];
    if (val == null) continue;
    const key = s.modis_date as string;
    if (!byDate[key]) byDate[key] = { calDate: s.calendar_date };

    if (s.band === "LST_Day_1km")  byDate[key].lst      = val;
    if (s.band === "QC_Day")       byDate[key].qc       = val;
    if (s.band === "Day_view_time") byDate[key].viewTime = val;
  }

  const results: MODISObs[] = [];
  for (const entry of Object.values(byDate)) {
    const { lst, qc, viewTime, calDate } = entry;
    if (!calDate || lst == null || lst === 0) continue;

    // QC bits 0–1: 00 = good, 01 = marginal-but-usable, 10/11 = reject
    if (qc != null && (qc & 0b11) > 1) continue;

    // Day_view_time fill value = 255; scale 0.1 → hours UTC
    const vtRaw = viewTime ?? 255;
    if (vtRaw === 255) continue;
    const viewTimeUTC = vtRaw * 0.1;

    const lstK = lst * 0.02;
    if (lstK < 263 || lstK > 328) continue; // plausibility

    results.push({ windowStart: calDate, lstC: +(lstK - 273.15).toFixed(2), viewTimeUTC });
  }

  return results.sort((a, b) => a.windowStart.localeCompare(b.windowStart));
}
