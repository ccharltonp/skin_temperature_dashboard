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

    // Build sorted COSMOS array with timestamps as ms for binary search
    const cosmos = cosmosObs
      .filter((o) => o.lwout != null && o.lwin != null)
      .flatMap((o) => {
        const skinC = computeSkinTemp(o.lwout!, o.lwin!, emissivity);
        if (skinC == null) return [];
        return [{ ms: new Date(o.timestamp).getTime(), skinC }];
      })
      .sort((a, b) => a.ms - b.ms);

    const TOLERANCE_MS = 30 * 60 * 1000; // ±30 min

    const pairs: ScatterPair[] = [];

    for (const s3 of s3Obs) {
      const t = new Date(s3.time).getTime();
      // Binary search for nearest COSMOS obs
      let lo = 0, hi = cosmos.length - 1, best = -1, bestDiff = Infinity;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const diff = Math.abs(cosmos[mid].ms - t);
        if (diff < bestDiff) { bestDiff = diff; best = mid; }
        if (cosmos[mid].ms < t) lo = mid + 1;
        else hi = mid - 1;
      }
      if (best >= 0 && bestDiff <= TOLERANCE_MS) {
        pairs.push({ time: s3.time, s3lstC: s3.lstC, cosmosSkinC: cosmos[best].skinC });
      }
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
