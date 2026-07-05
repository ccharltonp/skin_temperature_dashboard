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

    // S3 returns one daily median LST per day (P1D aggregation).
    // Match each S3 day to the daily mean COSMOS skin temperature for the same UTC date.
    // S3 P90 represents the warm/clear-sky end of each day's overpasses.
    // Match to the daily maximum COSMOS skin temperature so both sides
    // represent peak daytime clear-sky conditions.
    const cosmosByDate = new Map<string, number>();
    for (const o of cosmosObs) {
      if (o.lwout == null || o.lwin == null) continue;
      const skinC = computeSkinTemp(o.lwout, o.lwin, emissivity);
      if (skinC == null) continue;
      const date = o.timestamp.slice(0, 10);
      const prev = cosmosByDate.get(date);
      if (prev === undefined || skinC > prev) cosmosByDate.set(date, skinC);
    }

    const pairs: ScatterPair[] = [];

    for (const s3 of s3Obs) {
      const date = s3.time.slice(0, 10);
      const cosmosMax = cosmosByDate.get(date);
      if (cosmosMax === undefined) continue;
      pairs.push({ time: s3.time, s3lstC: s3.lstC, cosmosSkinC: +cosmosMax.toFixed(2) });
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
