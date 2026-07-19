import { NextRequest, NextResponse } from "next/server";
import { fetchHistory, fetchVwcHistory } from "@/lib/cosmos";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("site");
  if (!siteId) return NextResponse.json({ error: "?site= required" }, { status: 400 });

  // Fetch in two parallel 5-year chunks to cover the full COSMOS-UK record
  // (sites began operating from ~2013 onwards).
  const now = new Date();
  const mid  = new Date(now.getTime() - 5 * 365.25 * 24 * 3600 * 1000);
  const from = new Date("2012-01-01T00:00:00Z");

  const [obsRecent, obsOlder, vwcDaily] = await Promise.all([
    fetchHistory(siteId, mid, now),
    fetchHistory(siteId, from, mid),
    fetchVwcHistory(siteId, from, now),
  ]);

  const obs = [...obsRecent, ...obsOlder];
  const vwcByDate = new Map(vwcDaily.map((d) => [d.date, d.vwc]));

  const top3 = obs
    .filter((o) => o.tsoil5 != null)
    .sort((a, b) => b.tsoil5! - a.tsoil5!)
    .slice(0, 3)
    .map((o) => ({
      timestamp: o.timestamp,
      tsoil5: o.tsoil5!,
      ta: o.ta,
      vwc: vwcByDate.get(o.timestamp.slice(0, 10)) ?? null,
    }));

  return NextResponse.json(
    { siteId, from: from.toISOString(), to: now.toISOString(), top3 },
    { headers: { "Cache-Control": "s-maxage=21600, stale-while-revalidate=3600" } }
  );
}
