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
} from "recharts";
import { format, parseISO } from "date-fns";
import { computeSkinTemp, DEFAULT_EMISSIVITY } from "@/lib/skinTemp";

interface RawPoint {
  timestamp: string;
  skinTempC: number | null;
  ta: number | null;
  tsoil2: number | null;
  tsoil5: number | null;
  vwc: number | null;
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

function tickFmt(days: number) {
  if (days <= 1)  return (t: string) => format(parseISO(t), "HH:mm");
  if (days <= 7)  return (t: string) => format(parseISO(t), "dd MMM HH:mm");
  if (days <= 30) return (t: string) => format(parseISO(t), "dd MMM");
  return          (t: string) => format(parseISO(t), "MMM yyyy");
}

function tooltipFmt(days: number) {
  if (days <= 7)  return (t: string) => format(parseISO(t), "HH:mm dd MMM");
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {selectedPeriod.label} — <span className="text-stone-800 font-medium">{siteName}</span>
        </p>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="bg-white border border-stone-300 text-stone-700 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[300px] text-stone-400">
          Loading {selectedPeriod.label.toLowerCase()}…
        </div>
      ) : raw.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-stone-400">
          No data available for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 4, right: 52, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={tickFmt(days)}
              tick={{ fontSize: 10, fill: "#78716c" }}
              interval="preserveStartEnd"
              minTickGap={days <= 1 ? 30 : days <= 7 ? 60 : 80}
            />
            <YAxis
              yAxisId="temp"
              unit="°C"
              tick={{ fontSize: 10, fill: "#78716c" }}
              width={45}
            />
            <YAxis
              yAxisId="vwc"
              orientation="right"
              unit="%"
              domain={[0, 60]}
              tick={{ fontSize: 10, fill: "#0d9488" }}
              width={42}
            />
            <Tooltip
              labelFormatter={tooltipFmt(days)}
              formatter={(v: any, name: string) => {
                if (v == null) return "—";
                if (name === "VWC (CRNS)") return `${Number(v).toFixed(1)} %`;
                return `${Number(v).toFixed(1)} °C`;
              }}
              contentStyle={{
                background: "#fff",
                border: "1px solid #e7e5e4",
                borderRadius: "6px",
                fontSize: 12,
                color: "#1c1917",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#57534e" }} />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="skinTempC"
              name="Skin temp"
              stroke="#ea580c"
              dot={false}
              connectNulls={false}
              strokeWidth={1.5}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="ta"
              name="Air temp"
              stroke="#0284c7"
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
              stroke="#65a30d"
              dot={false}
              connectNulls={false}
              strokeWidth={1.5}
              strokeDasharray="2 3"
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="tsoil5"
              name="Soil temp (5 cm)"
              stroke="#b45309"
              dot={false}
              connectNulls={false}
              strokeWidth={1.5}
              strokeDasharray="5 2"
            />
            <Line
              yAxisId="vwc"
              type="monotone"
              dataKey="vwc"
              name="VWC (CRNS)"
              stroke="#0d9488"
              dot={days >= 30 ? { r: 2, fill: "#0d9488" } : false}
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
