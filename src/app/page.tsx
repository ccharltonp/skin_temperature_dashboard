"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SkinTempResult, computeSkinTemp, DEFAULT_EMISSIVITY } from "@/lib/skinTemp";
import SitePanel from "@/components/SitePanel";
import Legend from "@/components/Legend";
import InfoModal from "@/components/InfoModal";

const SiteMap = dynamic(() => import("@/components/SiteMap"), { ssr: false });

const REFRESH_MS = 5 * 60 * 1000;

export default function Dashboard() {
  const [sites, setSites] = useState<SkinTempResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [globalEmissivity, setGlobalEmissivity] = useState(DEFAULT_EMISSIVITY);
  const [siteEmissivity, setSiteEmissivity] = useState<Record<string, number>>({});
  const [showTable, setShowTable] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

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

  const latestDataAt = sites.length
    ? sites.reduce<string | null>((best, s) => {
        if (!s.timestamp) return best;
        return !best || s.timestamp > best ? s.timestamp : best;
      }, null)
    : null;

  const overrideCount = Object.keys(siteEmissivity).length;

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-stone-50">
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}

      {/* ── Header ── */}
      <header className="bg-white border-b border-stone-200 flex-shrink-0 shadow-sm">

        {/* Row 1: title + action buttons */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h1 className="text-sm font-bold text-stone-800 leading-tight">
              COSMOS-UK Land Surface Skin Temperature
            </h1>
            <p className="text-[10px] text-stone-500 hidden sm:block">
              Stefan-Boltzmann longwave inversion · 30-min data
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {mean !== null && (
              <div className="hidden sm:flex gap-1.5">
                <Pill label="Mean" value={`${mean.toFixed(1)} °C`} />
                <Pill label="Min" value={`${min!.toFixed(1)} °C`} color="text-blue-600" />
                <Pill label="Max" value={`${max!.toFixed(1)} °C`} color="text-orange-600" />
              </div>
            )}
            <button
              onClick={() => setShowTable((v) => !v)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                showTable
                  ? "bg-blue-600 text-white"
                  : "bg-stone-200 hover:bg-stone-300 text-stone-700"
              }`}
            >
              {showTable ? "Hide table" : "Table"}
            </button>
            <a
              href="/api/export"
              className="bg-stone-200 hover:bg-stone-300 px-2 py-1 rounded text-xs text-stone-700 transition-colors whitespace-nowrap"
            >
              ↓ CSV
            </a>
            <button
              onClick={load}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-2 py-1 rounded text-xs text-white transition-colors"
            >
              {loading ? "…" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Row 2: emissivity + timestamps */}
        <div className="px-3 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2 bg-stone-100 rounded-lg px-3 py-1.5">
            <span className="text-xs text-stone-600 whitespace-nowrap">Global ε</span>
            <input
              type="range"
              min="0.01"
              max="1.0"
              step="0.01"
              value={globalEmissivity}
              onChange={(e) => setGlobalEmissivity(parseFloat(e.target.value))}
              className="w-24 sm:w-28 accent-blue-600"
            />
            <span className="text-sm font-mono text-blue-600 w-10">
              {globalEmissivity.toFixed(2)}
            </span>
            <button
              onClick={() => setGlobalEmissivity(DEFAULT_EMISSIVITY)}
              className="text-[10px] text-stone-500 hover:text-stone-800 underline whitespace-nowrap"
              title={`Reset to default (${DEFAULT_EMISSIVITY})`}
            >
              reset
            </button>
            {overrideCount > 0 && (
              <button
                onClick={() => setSiteEmissivity({})}
                className="text-[10px] text-orange-600 hover:text-orange-800 underline whitespace-nowrap"
                title="Clear all per-site overrides"
              >
                clear {overrideCount} override{overrideCount !== 1 ? "s" : ""}
              </button>
            )}
            <button
              onClick={() => setShowInfo(true)}
              aria-label="About this dashboard"
              title="About data sources & method"
              className="ml-1 w-5 h-5 flex items-center justify-center rounded-full border border-stone-400 text-stone-500 hover:text-stone-800 hover:border-stone-800 text-[11px] font-bold leading-none transition-colors"
            >
              i
            </button>
          </div>

          <div className="flex flex-col text-[10px] text-stone-400 leading-tight">
            {latestDataAt && (
              <span>
                <span className="text-stone-600">Data:</span> {fmt(latestDataAt)}{" "}
                <span className="text-stone-300">(COSMOS lags ~8 h)</span>
              </span>
            )}
            {updatedAt && (
              <span>
                <span className="text-stone-600">Fetched:</span> {fmt(updatedAt)}
              </span>
            )}
          </div>

          {mean !== null && (
            <div className="flex sm:hidden gap-1.5">
              <Pill label="Mean" value={`${mean.toFixed(1)} °C`} />
              <Pill label="Min" value={`${min!.toFixed(1)} °C`} color="text-blue-600" />
              <Pill label="Max" value={`${max!.toFixed(1)} °C`} color="text-orange-600" />
            </div>
          )}
        </div>

        {error && (
          <div className="px-3 pb-2 text-xs text-red-600 bg-red-50 border-t border-red-200 py-1">
            {error}
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 min-h-0 md:flex-row overflow-hidden">

        {/* Map */}
        <div className="relative w-full h-[42vh] md:w-[360px] md:h-auto flex-shrink-0 border-b border-stone-200 md:border-b-0 md:border-r">
          {loading && sites.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-50/80 text-stone-500 text-sm">
              Fetching COSMOS-UK data…
            </div>
          )}
          <SiteMap
            sites={sites}
            selected={selected}
            onSelect={setSelected}
            effectiveEmissivity={effectiveEmissivity}
          />
          <div className="absolute bottom-4 left-2 z-[1000]">
            <Legend />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">

          {/* Site detail / chart */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-stone-50">
            {selectedSite ? (
              <div className="p-3 sm:p-4">
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
              <div className="flex items-center justify-center h-full text-stone-400 text-sm p-4 text-center">
                Tap a site on the map to see its skin temperature history.
              </div>
            )}
          </div>

          {/* Sites table */}
          <div className={`flex-shrink-0 max-h-52 overflow-auto border-t border-stone-200 ${showTable ? "" : "hidden"}`}>
            <table className="w-full text-xs text-stone-700">
              <thead className="bg-stone-100 sticky top-0">
                <tr>
                  {["Site", "ID", "ε", "Skin T (°C)", "Air T (°C)", "ΔT (°C)", "L↑ (W m⁻²)", "L↓ (W m⁻²)", "Time"].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-stone-500 whitespace-nowrap">
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
                        className={`cursor-pointer hover:bg-stone-100 ${
                          s.siteId === selected ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-stone-50"
                        }`}
                        onClick={() => setSelected(s.siteId)}
                      >
                        <td className="px-3 py-1.5 font-medium text-stone-800 whitespace-nowrap">{s.siteName}</td>
                        <td className="px-3 py-1.5 text-stone-500">{s.siteId}</td>
                        <td className="px-3 py-1.5 font-mono">
                          <span className={hasOverride ? "text-orange-600" : "text-stone-500"}>
                            {effectiveEmissivity(s.siteId).toFixed(2)}
                          </span>
                          {hasOverride && <span className="ml-1 text-[9px] text-orange-500">●</span>}
                        </td>
                        <td className="px-3 py-1.5 text-orange-600 font-mono">
                          {s.skinTempC != null ? s.skinTempC.toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{s.ta != null ? s.ta.toFixed(1) : "—"}</td>
                        <td className="px-3 py-1.5 font-mono">
                          {s.skinTempC != null && s.ta != null ? (s.skinTempC - s.ta).toFixed(1) : "—"}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{s.lwout != null ? s.lwout.toFixed(0) : "—"}</td>
                        <td className="px-3 py-1.5 font-mono">{s.lwin != null ? s.lwin.toFixed(0) : "—"}</td>
                        <td className="px-3 py-1.5 text-stone-400">
                          {s.timestamp
                            ? new Date(s.timestamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  color = "text-stone-800",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span className="bg-stone-100 border border-stone-200 rounded px-2 py-0.5 text-xs">
      <span className="text-stone-500">{label} </span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}
