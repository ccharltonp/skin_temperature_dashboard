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
  lwout: number | null;
  lwin: number | null;
}

interface Props {
  siteId: string;
  siteName: string;
  emissivity?: number;
  days?: number;
}

export default function SiteChart({
  siteId,
  siteName,
  emissivity = DEFAULT_EMISSIVITY,
  days = 7,
}: Props) {
  const [raw, setRaw] = useState<RawPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
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

  if (loading)
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        Loading history…
      </div>
    );

  if (raw.length === 0)
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        No data for {siteName}
      </div>
    );

  const fmt = (t: string) => {
    try {
      return format(parseISO(t), "dd MMM HH:mm");
    } catch {
      return t;
    }
  };

  return (
    <div>
      <p className="text-sm text-slate-400 mb-2">
        Last {days} days — {siteName}
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={fmt}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval="preserveStartEnd"
          />
          <YAxis
            unit="°C"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            width={45}
          />
          <Tooltip
            labelFormatter={fmt}
            formatter={(v: any) => (v != null ? `${Number(v).toFixed(1)} °C` : "—")}
            contentStyle={{ background: "#1e293b", border: "none", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="skinTempC"
            name="Skin temp"
            stroke="#f97316"
            dot={false}
            connectNulls={false}
            strokeWidth={1.5}
          />
          <Line
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
            type="monotone"
            dataKey="tsoil2"
            name="Soil temp (2 cm)"
            stroke="#a3e635"
            dot={false}
            connectNulls={false}
            strokeWidth={1.5}
            strokeDasharray="2 3"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
