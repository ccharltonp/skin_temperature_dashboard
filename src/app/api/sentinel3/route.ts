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

    // Build daily max COSMOS skin temp and daily mean air temp (ta) per date.
    // ta is used as a quality gate for S3: cloud-top temperatures are always
    // anomalously cold relative to screen-level air temperature, so any S3
    // retrieval more than 10 °C colder than the daily mean ta is cloud-contaminated.
    const cosmosByDate = new Map<string, number>();   // daily max skin temp
    const cosmosTaByDate = new Map<string, number[]>(); // daily ta values for mean

    for (const o of cosmosObs) {
      const date = o.timestamp.slice(0, 10);

      if (o.lwout != null && o.lwin != null) {
        const skinC = computeSkinTemp(o.lwout, o.lwin, emissivity);
        if (skinC != null) {
          const prev = cosmosByDate.get(date);
          if (prev === undefined || skinC > prev) cosmosByDate.set(date, skinC);
        }
      }

      if (o.ta != null) {
        const arr = cosmosTaByDate.get(date) ?? [];
        arr.push(o.ta);
        cosmosTaByDate.set(date, arr);
      }
    }

    const pairs: ScatterPair[] = [];

    for (const s3 of s3Obs) {
      const date = s3.time.slice(0, 10);
      const cosmosMax = cosmosByDate.get(date);
      if (cosmosMax === undefined) continue;

      // Air-temperature consistency check: reject S3 values that are more than
      // 10 °C colder than the daily mean COSMOS air temperature.
      const taVals = cosmosTaByDate.get(date);
      if (taVals && taVals.length > 0) {
        const meanTa = taVals.reduce((a, b) => a + b, 0) / taVals.length;
        if (s3.lstC < meanTa - 10) continue;
      }

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
