"use client";

import { SkinTempResult } from "@/lib/skinTemp";
import SiteChart from "./SiteChart";

interface Props {
  site: SkinTempResult;
  onClose: () => void;
}

export default function SitePanel({ site, onClose }: Props) {
  const ts = site.timestamp
    ? new Date(site.timestamp).toLocaleString("en-GB", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

  return (
    <div className="bg-slate-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{site.siteName}</h2>
          <p className="text-xs text-slate-400">{site.siteId} · {ts}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Skin temp"
          value={site.skinTempC != null ? `${site.skinTempC.toFixed(1)} °C` : "—"}
          highlight
        />
        <Stat
          label="Air temp"
          value={site.ta != null ? `${site.ta.toFixed(1)} °C` : "—"}
        />
        <Stat
          label="ΔT (skin−air)"
          value={
            site.skinTempC != null && site.ta != null
              ? `${(site.skinTempC - site.ta).toFixed(1)} °C`
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

      <SiteChart siteId={site.siteId} siteName={site.siteName} days={7} />
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
    <div className="bg-slate-700/60 rounded-lg p-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p
        className={`text-base font-semibold mt-0.5 ${highlight ? "text-orange-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
