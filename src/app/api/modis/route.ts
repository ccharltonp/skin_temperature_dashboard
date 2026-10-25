import { NextRequest, NextResponse } from "next/server";
import { fetchMODISLSTTimeseries } from "@/lib/modis";
import { fetchHistory } from "@/lib/cosmos";
import { computeSkinTemp } from "@/lib/skinTemp";

export const dynamic = "force-dynamic";

export interface MODISScatterPair {
  time: string;       // windowStart date
  modisLstC: number;
  cosmosSkinC: number;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site");
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  const days = Math.min(Number(searchParams.get("days") ?? "90"), 365);
  const emissivity = Number(searchParams.get("emissivity") ?? "0.97");

  if (!site || isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "?site=&lat=&lon= required" }, { status: 400 });
  }

  const to = new Date();
  // Reach back further — 8-day composites need more history to get enough points
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const [modisObs, cosmosObs] = await Promise.all([
      fetchMODISLSTTimeseries(lat, lon, from.toISOString(), to.toISOString()),
      fetchHistory(site, from, to),
    ]);

    // Build COSMOS skin temp by date and timestamp (ms)
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

    const pairs: MODISScatterPair[] = [];

    for (const obs of modisObs) {
      // 8-day window: windowStart to windowStart+7 days
      const windowStartMs = new Date(obs.windowStart).getTime();
      const windowEndMs = windowStartMs + 7 * 24 * 3600 * 1000;

      // Find COSMOS obs across the 8-day window within ±1.5 h of the MODIS view time
      const WINDOW_MS = 1.5 * 3600 * 1000;
      const candidateSkinC: number[] = [];
      const candidateTa: number[] = [];

      // Iterate over each day in the window
      for (let d = 0; d <= 7; d++) {
        const dayMs = windowStartMs + d * 24 * 3600 * 1000;
        const dayISO = new Date(dayMs).toISOString().slice(0, 10);
        const targetMs = dayMs + obs.viewTimeUTC * 3600 * 1000;

        const dayObs = cosmosByDate.get(dayISO) ?? [];
        for (const o of dayObs) {
          if (Math.abs(o.ms - targetMs) <= WINDOW_MS) {
            candidateSkinC.push(o.skinC);
          }
        }

        const taArr = cosmosTaByDate.get(dayISO) ?? [];
        for (const ta of taArr) candidateTa.push(ta);
      }

      if (candidateSkinC.length === 0) continue;

      // Median skin temp across matched obs
      candidateSkinC.sort((a, b) => a - b);
      const medianSkinC = candidateSkinC[Math.floor(candidateSkinC.length / 2)];

      // Air-temp consistency check (same as S3 route)
      if (candidateTa.length > 0) {
        const meanTa = candidateTa.reduce((a, b) => a + b, 0) / candidateTa.length;
        if (obs.lstC < meanTa - 10) continue;
      }

      pairs.push({
        time: obs.windowStart,
        modisLstC: obs.lstC,
        cosmosSkinC: +medianSkinC.toFixed(2),
      });
    }

    return NextResponse.json({ pairs });
  } catch (err: any) {
    console.error("modis route error:", err);
    return NextResponse.json({ error: String(err?.message ?? err), pairs: [] }, { status: 500 });
  }
}
