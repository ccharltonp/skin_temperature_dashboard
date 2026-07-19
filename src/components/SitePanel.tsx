"use client";

import { SkinTempResult, computeSkinTemp, DEFAULT_EMISSIVITY } from "@/lib/skinTemp";
import SiteChart from "./SiteChart";
import ScatterPanel from "./ScatterPanel";
import SiteInfoCard from "./SiteInfoCard";

interface Props {
  site: SkinTempResult;
  globalEmissivity: number;
  siteEmissivity: number | undefined;
  onSiteEmissivityChange: (eps: number | undefined) => void;
  onClose: () => void;
}

export default function SitePanel({
  site,
  globalEmissivity,
  siteEmissivity,
  onSiteEmissivityChange,
  onClose,
}: Props) {
  const hasOverride = siteEmissivity !== undefined;
  const eps = hasOverride ? siteEmissivity : globalEmissivity;
  const skinTempC =
    site.lwout != null && site.lwin != null
      ? computeSkinTemp(site.lwout, site.lwin, eps)
      : null;

  const ts = site.timestamp
    ? new Date(site.timestamp).toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">{site.siteName}</h2>
          <p className="text-xs text-stone-500">{site.siteId} · {ts}</p>
        </div>
        <button
          onClick={onClose}
          className="text-stone-400 hover:text-stone-700 text-xl leading-none"
        >
          ×
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Skin temp"
          value={skinTempC != null ? `${skinTempC.toFixed(1)} °C` : "—"}
          highlight
        />
        <Stat
          label="Air temp"
          value={site.ta != null ? `${site.ta.toFixed(1)} °C` : "—"}
        />
        <Stat
          label="ΔT (skin−air)"
          value={
            skinTempC != null && site.ta != null
              ? `${(skinTempC - site.ta).toFixed(1)} °C`
              : "—"
          }
        />
        <Stat
          label="L↑ (lwout)"
          value={site.lwout != null ? `${site.lwout.toFixed(0)} W m⁻²` : "—"}
        />
        <Stat
          label="L↓ (lwin)"
          value={site.lwin != null ? `${site.lwin.toFixed(0)} W m⁻²` : "—"}
        />
        <Stat
          label="Lat / Lon"
          value={`${site.latitude.toFixed(3)}, ${site.longitude.toFixed(3)}`}
        />
      </div>

      {/* Per-site emissivity */}
      <div className="bg-stone-100 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-stone-700">
            Site emissivity (ε)
            {hasOverride && (
              <span className="ml-2 bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded border border-orange-200">
                overridden
              </span>
            )}
          </span>
          {hasOverride && (
            <button
              onClick={() => onSiteEmissivityChange(undefined)}
              className="text-[10px] text-stone-500 hover:text-stone-800 underline"
            >
              reset to global ({globalEmissivity.toFixed(2)})
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.01"
            max="1.0"
            step="0.01"
            value={eps}
            onChange={(e) => onSiteEmissivityChange(parseFloat(e.target.value))}
            className="flex-1 accent-orange-500"
          />
          <span className="text-sm font-mono text-orange-600 w-10 text-right">
            {eps.toFixed(2)}
          </span>
        </div>

        <p className="text-[10px] text-stone-400">
          {hasOverride
            ? "This site uses its own ε — global slider won't affect it."
            : "Tracking global ε — drag to set a site-specific value."}
        </p>
      </div>

      <SiteChart siteId={site.siteId} siteName={site.siteName} emissivity={eps} />

      <div className="border-t border-stone-200 pt-3">
        <ScatterPanel
          siteId={site.siteId}
          lat={site.latitude}
          lon={site.longitude}
          emissivity={eps}
        />
      </div>

      <SiteInfoCard
        siteId={site.siteId}
        siteName={site.siteName}
        lat={site.latitude}
        lon={site.longitude}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-stone-100 rounded-lg p-2">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-base font-semibold mt-0.5 ${highlight ? "text-orange-600" : "text-stone-800"}`}>
        {value}
      </p>
    </div>
  );
}
