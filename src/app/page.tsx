"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SkinTempResult, computeSkinTemp, DEFAULT_EMISSIVITY } from "@/lib/skinTemp";
import SitePanel from "@/components/SitePanel";
import Legend from "@/components/Legend";

const SiteMap = dynamic(() => import("@/components/SiteMap"), { ssr: false });

const REFRESH_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const [sites, setSites] = useState<SkinTempResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Emissivity state
  const [globalEmissivity, setGlobalEmissivity] = useState(DEFAULT_EMISSIVITY);
  const [siteEmissivity, setSiteEmissivity] = useState<Record<string, number>>({});

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveEmissivity = useCallback(
    (siteId: string) => siteEmissivity[siteId] ?? globalEmissivity,
    [siteEmissivity, globalEmissivity]
  );

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

  // Derive skin temps with current emissivity for header stats and table
  const derivedSites = sites.map((s) => {
    const eps = effectiveEmissivity(s.siteId);
    return {
      ...s,
      skinTempC:
        s.lwout != null && s.lwin != null
          ? computeSkinTemp(s.lwout, s.lwin, eps)
          : null,
    };
  });

  const withData = derivedSites.filter((s) => s.skinTempC !== null);
  const temps = withData.map((s) => s.skinTempC as number);
  const mean = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null;
  const max = temps.length ? Math.max(...temps) : null;
  const min = temps.length ? Math.min(...temps) : null;

  const overrideCount = Object.keys(siteEmissivity).length;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 flex-shrink-0">
        {/* Title */}
        <div className="mr-2">
          <h1 className="text-sm font-bold text-white leading-tight">
            COSMOS-UK Land Surface Skin Temperature
          </h1>
          <p className="text-[10px] text-slate-400">
            Stefan-Boltzmann longwave inversion · 30-min data
          </p>
        </div>

        {/* Global emissivity slider */}
        <div className="flex items-center gap-2 bg-slate-700/60 rounded-lg px-3 py-1.5">
          <span className="text-xs text-slate-300 whitespace-nowrap">
            Global ε
          </span>
          <input
            type="range"
            min="0.01"
            max="1.0"
            step="0.01"
            value={globalEmissivity}
            onChange={(e) => setGlobalEmissivity(parseFloat(e.target.value))}
            className="w-28 accent-blue-400"
          />
          <span className="text-sm font-mono text-blue-300 w-10">
            {globalEmissivity.toFixed(2)}
          </span>
          <button
            onClick={() => setGlobalEmissivity(DEFAULT_EMISSIVITY)}
            className="text-[10px] text-slate-400 hover:text-white underline whitespace-nowrap"
            title={`Reset to default (${DEFAULT_EMISSIVITY})`}
          >
            reset
          </button>
          {overrideCount > 0 && (
            <button
              onClick={() => setSiteEmissivity({})}
              className="text-[10px] text-orange-400 hover:text-orange-200 underline whitespace-nowrap"
              title="Clear all per-site overrides"
            >
              clear {overrideCount} override{overrideCount !== 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-slate-300 ml-auto">
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
            <div className="flex gap-2">
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
          <SiteMap
            sites={sites}
            selected={selected}
            onSelect={setSelected}
            effectiveEmissivity={effectiveEmissivity}
          />
          <div className="absolute bottom-6 left-3 z-[1000]">
            <Legend />
          </div>
        </div>

        {/* Side panel */}
        <div
          className={`w-80 flex-shrink-0 overflow-y-auto bg-slate-900 border-l border-slate-700 transition-all duration-200 ${
            selectedSite
              ? "translate-x-0"
              : "translate-x-full sm:translate-x-0 sm:w-0 sm:border-0"
          }`}
        >
          {selectedSite ? (
            <div className="p-3">
              <SitePanel
                site={selectedSite}
                globalEmissivity={globalEmissivity}
                siteEmissivity={siteEmissivity[selectedSite.siteId]}
                onSiteEmissivityChange={(eps) =>
                  setSiteEmissivity((prev) => {
                    const next = { ...prev };
                    if (eps === undefined) {
                      delete next[selectedSite.siteId];
                    } else {
                      next[selectedSite.siteId] = eps;
                    }
                    return next;
                  })
                }
                onClose={() => setSelected(null)}
              />
            </div>
          ) : (
            <div className="p-4 text-slate-500 text-sm">
              Click a site on the map to see its skin temperature history and set a site-specific emissivity.
            </div>
          )}
        </div>
      </div>

      {/* Site table */}
      <div className="hidden lg:block flex-shrink-0 max-h-48 overflow-y-auto border-t border-slate-700">
        <table className="w-full text-xs text-slate-300">
          <thead className="bg-slate-800 sticky top-0">
            <tr>
              {["Site", "ID", "ε", "Skin T (°C)", "Air T (°C)", "ΔT (°C)", "L↑ (W m⁻²)", "L↓ (W m⁻²)", "Timestamp"].map(
                (h) => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-slate-400">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {derivedSites
              .slice()
              .sort((a, b) => (b.skinTempC ?? -99) - (a.skinTempC ?? -99))
              .map((s, i) => {
                const hasOverride = siteEmissivity[s.siteId] !== undefined;
                return (
                  <tr
                    key={s.siteId}
                    className={`cursor-pointer hover:bg-slate-700/50 ${
                      s.siteId === selected ? "bg-slate-700" : i % 2 === 0 ? "bg-slate-800/30" : ""
                    }`}
                    onClick={() => setSelected(s.siteId)}
                  >
                    <td className="px-3 py-1.5 font-medium text-white">{s.siteName}</td>
                    <td className="px-3 py-1.5 text-slate-400">{s.siteId}</td>
                    <td className="px-3 py-1.5 font-mono">
                      <span className={hasOverride ? "text-orange-300" : "text-slate-400"}>
                        {effectiveEmissivity(s.siteId).toFixed(2)}
                      </span>
                      {hasOverride && (
                        <span className="ml-1 text-[9px] text-orange-500">●</span>
                      )}
                    </td>
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
                );
              })}
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
