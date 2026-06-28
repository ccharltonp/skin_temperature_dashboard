"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import { computeSkinTemp, DEFAULT_EMISSIVITY } from "@/lib/skinTemp";

interface RawPoint {
  timestamp: string;
  skinTempC: number | null;
  ta: number | null;
  tsoil2: number | null;
  vwc: number | null; // CRNS cosmos_vwc, daily, % — joined from 1D collection
  lwout: number | null;
  lwin: number | null;
}

interface Props {
  siteId: string;
  siteName: string;
  emissivity?: number;
}

const PERIODS = [
  { label: "Last 24 hours", days: 1 },
  { label: "Last 7 days",   days: 7 },
  { label: "Last month",    days: 30 },
  { label: "Last 6 months", days: 182 },
] as const;

const DEFAULT_PERIOD = 7;

// Tick format depends on the range: short ranges show time, long ranges show date only
function tickFmt(days: number) {
  if (days <= 1)  return (t: string) => format(parseISO(t), "HH:mm");
  if (days <= 7)  return (t: string) => format(parseISO(t), "dd MMM HH:mm");
  if (days <= 30) return (t: string) => format(parseISO(t), "dd MMM");
  return          (t: string) => format(parseISO(t), "MMM yyyy");
}

function tooltipFmt(days: number) {
  if (days <= 1)  return (t: string) => format(parseISO(t), "HH:mm dd MMM");
  if (days <= 7)  return (t: string) => format(parseISO(t), "HH:mm dd MMM");
  if (days <= 30) return (t: string) => format(parseISO(t), "dd MMM yyyy");
  return          (t: string) => format(parseISO(t), "dd MMM yyyy");
}

export default function SiteChart({
  siteId,
  siteName,
  emissivity = DEFAULT_EMISSIVITY,
}: Props) {
  const [days, setDays] = useState<number>(DEFAULT_PERIOD);
  const [raw, setRaw] = useState<RawPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setRaw([]);
    fetch(`/api/history?site=${siteId}&days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        setRaw(json.series ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId, days]);

  // Re-derive skin temp from raw radiation whenever emissivity changes
  const data = useMemo(
    () =>
      raw.map((p) => ({
        ...p,
        skinTempC:
          p.lwout != null && p.lwin != null
            ? computeSkinTemp(p.lwout, p.lwin, emissivity)
            : null,
      })),
    [raw, emissivity]
  );

  const selectedPeriod = PERIODS.find((p) => p.days === days) ?? PERIODS[1];

  return (
    <div className="flex flex-col gap-2">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {selectedPeriod.label} — <span className="text-white">{siteName}</span>
        </p>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chart area */}
      {loading ? (
        <div className="flex items-center justify-center h-[340px] text-slate-400">
          Loading {selectedPeriod.label.toLowerCase()}…
        </div>
      ) : raw.length === 0 ? (
        <div className="flex items-center justify-center h-[340px] text-slate-400">
          No data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data} margin={{ top: 4, right: 52, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={tickFmt(days)}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              interval="preserveStartEnd"
              minTickGap={days <= 1 ? 30 : days <= 7 ? 60 : 80}
            />
            {/* Left axis: temperature */}
            <YAxis
              yAxisId="temp"
              unit="°C"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              width={45}
            />
            {/* Right axis: soil moisture */}
            <YAxis
              yAxisId="vwc"
              orientation="right"
              unit="%"
              domain={[0, 60]}
              tick={{ fontSize: 10, fill: "#2dd4bf" }}
              width={42}
            />
            <Tooltip
              labelFormatter={tooltipFmt(days)}
              formatter={(v: any, name: string) => {
                if (v == null) return "—";
                if (name === "VWC (CRNS)") return `${Number(v).toFixed(1)} %`;
                return `${Number(v).toFixed(1)} °C`;
              }}
              contentStyle={{ background: "#1e293b", border: "none", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="skinTempC"
              name="Skin temp"
              stroke="#f97316"
              dot={false}
              connectNulls={false}
              strokeWidth={1.5}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="ta"
              name="Air temp"
              stroke="#38bdf8"
              dot={false}
              connectNulls={false}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="tsoil2"
              name="Soil temp (2 cm)"
              stroke="#a3e635"
              dot={false}
              connectNulls={false}
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <Line
              yAxisId="vwc"
              type="monotone"
              dataKey="vwc"
              name="VWC (CRNS)"
              stroke="#2dd4bf"
              dot={days >= 30 ? { r: 2, fill: "#2dd4bf" } : false}
              connectNulls={false}
              strokeWidth={2}
              strokeDasharray="6 3"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
