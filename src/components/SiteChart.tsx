"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const SERIES = [
  { key: "skinTempC",  label: "Skin temp",        color: "#ea580c" },
  { key: "ta",         label: "Air temp",          color: "#0284c7" },
  { key: "tsoil2",     label: "Soil temp (2 cm)",  color: "#65a30d" },
  { key: "tsoil5",     label: "Soil temp (5 cm)",  color: "#b45309" },
  { key: "vwc",        label: "VWC (CRNS)",        color: "#0d9488" },
] as const;

type SeriesKey = typeof SERIES[number]["key"];

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
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    skinTempC: true, ta: true, tsoil2: true, tsoil5: true, vwc: true,
  });
  const [showSeriesPicker, setShowSeriesPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowSeriesPicker(false);
      }
    };
    if (showSeriesPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSeriesPicker]);

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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-stone-500">
          {selectedPeriod.label} — <span className="text-stone-800 font-medium">{siteName}</span>
        </p>
        <div className="flex items-center gap-2">
          {/* Series picker */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowSeriesPicker((v) => !v)}
              className="bg-white border border-stone-300 text-stone-700 text-xs rounded px-2 py-1 hover:bg-stone-50 flex items-center gap-1"
            >
              Series
              <span className="text-stone-400 text-[10px]">
                ({Object.values(visible).filter(Boolean).length}/{SERIES.length})
              </span>
              <span className="text-stone-400">▾</span>
            </button>
            {showSeriesPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-stone-200 rounded-lg shadow-lg p-2 min-w-[170px]">
                {SERIES.map((s) => (
                  <label
                    key={s.key}
                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-stone-50 cursor-pointer text-xs text-stone-700 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={visible[s.key]}
                      onChange={(e) =>
                        setVisible((prev) => ({ ...prev, [s.key]: e.target.checked }))
                      }
                      className="rounded"
                      style={{ accentColor: s.color }}
                    />
                    <span
                      className="inline-block w-4 h-0.5 flex-shrink-0"
                      style={{ background: s.color }}
                    />
                    {s.label}
                  </label>
                ))}
                <div className="border-t border-stone-100 mt-1 pt-1 flex gap-2">
                  <button
                    onClick={() => setVisible({ skinTempC: true, ta: true, tsoil2: true, tsoil5: true, vwc: true })}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    All
                  </button>
                  <button
                    onClick={() => setVisible({ skinTempC: false, ta: false, tsoil2: false, tsoil5: false, vwc: false })}
                    className="text-[10px] text-stone-400 hover:underline"
                  >
                    None
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Period selector */}
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
              hide={!visible.skinTempC}
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
              hide={!visible.ta}
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
              hide={!visible.tsoil2}
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
              hide={!visible.tsoil5}
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
              hide={!visible.vwc}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
