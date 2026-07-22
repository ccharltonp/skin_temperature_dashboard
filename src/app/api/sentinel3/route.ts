import { NextRequest, NextResponse } from "next/server";
import { fetchS3LSTTimeseries } from "@/lib/sentinel3";
import { fetchHistory } from "@/lib/cosmos";
import { computeSkinTemp } from "@/lib/skinTemp";

export const dynamic = "force-dynamic";

export interface ScatterPair {
  time: string;
  s3lstC: number;
  cosmosSkinC: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site");
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const days = Math.min(Number(searchParams.get("days") ?? "30"), 90);
  const emissivity = Number(searchParams.get("emissivity") ?? "0.97");

  if (!site || isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "?site=&lat=&lon= required" }, { status: 400 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  // Check credentials first
  if (!process.env.SH_CLIENT_ID || !process.env.SH_CLIENT_SECRET) {
    return NextResponse.json({ error: "credentials_missing", pairs: [] });
  }

  try {
    const [s3Obs, cosmosObs] = await Promise.all([
      fetchS3LSTTimeseries(lat, lon, from.toISOString(), to.toISOString()),
      fetchHistory(site, from, to),
    ]);

    // Build per-date COSMOS observations (skin temp + ta) for nearest-in-time lookup.
    // Sentinel-3 SLSTR passes over the UK at approximately 10:00 UTC (daytime ascending
    // node). We match each S3 daily value to the COSMOS 30-min observation whose
    // timestamp is closest to 10:00 UTC on that day.
    const S3_OVERPASS_HOUR = 10; // UTC

    interface CosmosEntry { ms: number; skinC: number; ta: number | null }
    const cosmosByDate = new Map<string, CosmosEntry[]>();
    const cosmosTaByDate = new Map<string, number[]>();

    for (const o of cosmosObs) {
      const date = o.timestamp.slice(0, 10);

      if (o.ta != null) {
        const arr = cosmosTaByDate.get(date) ?? [];
        arr.push(o.ta);
        cosmosTaByDate.set(date, arr);
      }

      if (o.lwout == null || o.lwin == null) continue;
      const skinC = computeSkinTemp(o.lwout, o.lwin, emissivity);
      if (skinC == null) continue;

      const arr = cosmosByDate.get(date) ?? [];
      arr.push({ ms: new Date(o.timestamp).getTime(), skinC, ta: o.ta });
      cosmosByDate.set(date, arr);
    }

    const pairs: ScatterPair[] = [];

    for (const s3 of s3Obs) {
      const date = s3.time.slice(0, 10);

      // Air-temperature consistency check: reject S3 values more than 10 °C colder
      // than the daily mean COSMOS air temperature (indicates cloud contamination).
      const taVals = cosmosTaByDate.get(date);
      if (taVals && taVals.length > 0) {
        const meanTa = taVals.reduce((a, b) => a + b, 0) / taVals.length;
        if (s3.lstC < meanTa - 10) continue;
      }

      const dayObs = cosmosByDate.get(date);
      if (!dayObs || dayObs.length === 0) continue;

      // Target: 10:00 UTC on the S3 date (approximate daytime overpass time)
      const targetMs = new Date(`${date}T${String(S3_OVERPASS_HOUR).padStart(2, "0")}:00:00Z`).getTime();

      // Find the COSMOS obs closest in time to the target
      let best = dayObs[0];
      let bestDiff = Math.abs(dayObs[0].ms - targetMs);
      for (const c of dayObs) {
        const d = Math.abs(c.ms - targetMs);
        if (d < bestDiff) { bestDiff = d; best = c; }
      }

      pairs.push({ time: s3.time, s3lstC: s3.lstC, cosmosSkinC: +best.skinC.toFixed(2) });
    }

    return NextResponse.json({ pairs });
  } catch (err: any) {
    if (err?.message === "credentials_missing") {
      return NextResponse.json({ error: "credentials_missing", pairs: [] });
    }
    console.error("sentinel3 route error:", err);
    return NextResponse.json({ error: String(err?.message ?? err), pairs: [] }, { status: 500 });
  }
}
