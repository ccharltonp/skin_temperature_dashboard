"use client";

import { useEffect, useState } from "react";

interface Record {
  timestamp: string;
  tsoil5: number;
  ta: number | null;
  vwc: number | null;
}

interface Props {
  siteId: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function TopSoilTemps({ siteId }: Props) {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setRecords([]);
    fetch(`/api/top-soil-temps?site=${encodeURIComponent(siteId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setRecords(json.top3 ?? []);
        setLoading(false);
      })
      .catch((e) => { setError(String(e)); setLoading(false); });
  }, [siteId]);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
      <p className="text-xs font-semibold text-amber-800 mb-2">
        All-time warmest 5 cm soil temperatures
      </p>

      {loading && (
        <p className="text-xs text-stone-400 py-2">Searching full site record…</p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {!loading && !error && records.length === 0 && (
        <p className="text-xs text-stone-400">No 5 cm soil temperature data found.</p>
      )}

      {!loading && records.length > 0 && (
        <div className="flex flex-col gap-2">
          {records.map((r, i) => (
            <div
              key={r.timestamp}
              className="bg-white border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2"
            >
              <span className="text-base leading-none mt-0.5">{MEDALS[i]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-amber-700 leading-none">
                    {r.tsoil5.toFixed(1)} °C
                  </span>
                  <span className="text-[10px] text-stone-400">(5 cm soil)</span>
                </div>
                <p className="text-xs text-stone-600 mt-0.5">{fmt(r.timestamp)}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Air temp: {r.ta != null ? `${r.ta.toFixed(1)} °C` : "—"}
                  {" · "}
                  VWC: {r.vwc != null ? `${r.vwc.toFixed(1)} %` : "—"}
                </p>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-stone-400 text-right">
            Based on all available COSMOS-UK data from 2012 to present
          </p>
        </div>
      )}
    </div>
  );
}
