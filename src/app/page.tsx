"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SkinTempResult } from "@/lib/skinTemp";
import SitePanel from "@/components/SitePanel";
import Legend from "@/components/Legend";

const SiteMap = dynamic(() => import("@/components/SiteMap"), { ssr: false });

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh every 5 minutes

export default function Dashboard() {
  const [sites, setSites] = useState<SkinTempResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/skin-temp");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSites(json.results ?? []);
      setUpdatedAt(json.updatedAt ?? null);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const selectedSite = sites.find((s) => s.siteId === selected) ?? null;

  const withData = sites.filter((s) => s.skinTempC !== null);
  const temps = withData.map((s) => s.skinTempC as number);
  const mean = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const max = temps.length ? Math.max(...temps) : null;
  const min = temps.length ? Math.min(...temps) : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-white leading-tight">
            COSMOS-UK Land Surface Skin Temperature
          </h1>
          <p className="text-xs text-slate-400">
            Stefan-Boltzmann longwave inversion · ε&nbsp;=&nbsp;0.97 · 30-min data
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-300">
          {updatedAt && (
            <span className="hidden sm:inline text-slate-500">
              Updated{" "}
              {new Date(updatedAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {mean !== null && (
            <div className="flex gap-3">
              <Pill label="Mean" value={`${mean.toFixed(1)} °C`} />
              <Pill label="Min" value={`${min!.toFixed(1)} °C`} color="text-blue-400" />
              <Pill label="Max" value={`${max!.toFixed(1)} °C`} color="text-orange-400" />
            </div>
          )}
          <a
            href="/api/export"
            className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-200 transition-colors"
          >
            ↓ CSV
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-2 py-1 rounded text-white transition-colors"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="relative flex-1 min-w-0">
          {loading && sites.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/70 text-slate-300">
              Fetching COSMOS-UK data…
            </div>
          )}
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-900 text-red-200 rounded px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <SiteMap sites={sites} selected={selected} onSelect={setSelected} />

          {/* Legend overlay */}
          <div className="absolute bottom-6 left-3 z-[1000]">
            <Legend />
          </div>
        </div>

        {/* Side panel */}
        <div
          className={`w-80 flex-shrink-0 overflow-y-auto bg-slate-900 border-l border-slate-700 transition-all duration-200 ${
            selectedSite ? "translate-x-0" : "translate-x-full sm:translate-x-0 sm:w-0 sm:border-0"
          }`}
        >
          {selectedSite ? (
            <div className="p-3">
              <SitePanel site={selectedSite} onClose={() => setSelected(null)} />
            </div>
          ) : (
            <div className="p-4 text-slate-500 text-sm">
              Click a site on the map to see its skin temperature history.
            </div>
          )}
        </div>
      </div>

      {/* Site table (scrollable below map on small screens) */}
      <div className="hidden lg:block flex-shrink-0 max-h-48 overflow-y-auto border-t border-slate-700">
        <table className="w-full text-xs text-slate-300">
          <thead className="bg-slate-800 sticky top-0">
            <tr>
              {["Site", "ID", "Skin T (°C)", "Air T (°C)", "ΔT (°C)", "L↑ (W m⁻²)", "L↓ (W m⁻²)", "Timestamp"].map(
                (h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-slate-400">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sites
              .slice()
              .sort((a, b) => (b.skinTempC ?? -99) - (a.skinTempC ?? -99))
              .map((s, i) => (
                <tr
                  key={s.siteId}
                  className={`cursor-pointer hover:bg-slate-700/50 ${
                    s.siteId === selected ? "bg-slate-700" : i % 2 === 0 ? "bg-slate-800/30" : ""
                  }`}
                  onClick={() => setSelected(s.siteId)}
                >
                  <td className="px-3 py-1.5 font-medium text-white">{s.siteName}</td>
                  <td className="px-3 py-1.5 text-slate-400">{s.siteId}</td>
                  <td className="px-3 py-1.5 text-orange-400 font-mono">
                    {s.skinTempC != null ? s.skinTempC.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {s.ta != null ? s.ta.toFixed(1) : "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {s.skinTempC != null && s.ta != null
                      ? (s.skinTempC - s.ta).toFixed(1)
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {s.lwout != null ? s.lwout.toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {s.lwin != null ? s.lwin.toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">
                    {s.timestamp
                      ? new Date(s.timestamp).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span className="bg-slate-700 rounded px-2 py-0.5">
      <span className="text-slate-400">{label} </span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}
