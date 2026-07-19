import { NextResponse } from "next/server";
import { fetchSites, fetchLatestObservation, fetchLatestVwc } from "@/lib/cosmos";
import { computeSkinTemp, SkinTempResult } from "@/lib/skinTemp";
import { appendEstimates } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sites = await fetchSites();

    // Fetch observations in parallel, capped to avoid rate limits
    const results: SkinTempResult[] = await Promise.all(
      sites.map(async (site) => {
        try {
          const [obs, vwc] = await Promise.all([
            fetchLatestObservation(site.id),
            fetchLatestVwc(site.id),
          ]);
          const skinTempC =
            obs.lwout != null && obs.lwin != null
              ? computeSkinTemp(obs.lwout, obs.lwin)
              : null;
          return {
            siteId: site.id,
            siteName: site.name,
            latitude: site.lat,
            longitude: site.lon,
            timestamp: obs.timestamp,
            skinTempC,
            lwout: obs.lwout,
            lwin: obs.lwin,
            ta: obs.ta,
            tsoil5: obs.tsoil5,
            vwc,
          };
        } catch (err) {
          return {
            siteId: site.id,
            siteName: site.name,
            latitude: site.lat,
            longitude: site.lon,
            timestamp: new Date().toISOString(),
            skinTempC: null,
            lwout: null,
            lwin: null,
            ta: null,
            tsoil5: null,
            vwc: null,
            error: String(err),
          };
        }
      })
    );

    // Persist estimates asynchronously (don't block response)
    try {
      appendEstimates(results);
    } catch {}

    return NextResponse.json({ updatedAt: new Date().toISOString(), results });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
