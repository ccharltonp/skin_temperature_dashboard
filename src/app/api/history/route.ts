import { NextRequest, NextResponse } from "next/server";
import { fetchHistory, fetchVwcHistory } from "@/lib/cosmos";
import { computeSkinTemp } from "@/lib/skinTemp";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("site");
  const days = Math.min(Number(searchParams.get("days") ?? "7"), 182);

  if (!siteId) {
    return NextResponse.json({ error: "?site= required" }, { status: 400 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  // Fetch 30-min and daily VWC in parallel
  const [obs, vwcDaily] = await Promise.all([
    fetchHistory(siteId, from, to),
    fetchVwcHistory(siteId, from, to),
  ]);

  // Build a date→vwc lookup so we can join VWC onto each 30-min row
  const vwcByDate = new Map(vwcDaily.map((d) => [d.date, d.vwc]));

  const series = obs.map((o) => ({
    timestamp: o.timestamp,
    skinTempC:
      o.lwout != null && o.lwin != null
        ? computeSkinTemp(o.lwout, o.lwin)
        : null,
    ta: o.ta,
    tsoil2: o.tsoil2,
    vwc: vwcByDate.get(o.timestamp.slice(0, 10)) ?? null,
    lwout: o.lwout,
    lwin: o.lwin,
  }));

  return NextResponse.json({ siteId, from: from.toISOString(), to: to.toISOString(), series });
}
