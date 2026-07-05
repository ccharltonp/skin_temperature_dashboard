"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";

interface ScatterPair {
  time: string;
  s3lstC: number;
  cosmosSkinC: number;
}

interface Props {
  siteId: string;
  lat: number;
  lon: number;
  emissivity: number;
}

const PERIODS = [
  { label: "7 days",  days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
] as const;

function linReg(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const ssxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const ssxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (ssxx === 0) return null;
  const slope = ssxy / ssxx;
  const intercept = my - slope * mx;
  const ssTot = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
  const ssRes = pts.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  const rmse = Math.sqrt(ssRes / n);
  const bias = pts.reduce((s, p) => s + (p.y - p.x), 0) / n;
  return { slope, intercept, r2, rmse, bias };
}

const CustomDot = (props: any) => {
  const { cx, cy } = props;
  return <circle cx={cx} cy={cy} r={4} fill="#ea580c" fillOpacity={0.7} stroke="#fff" strokeWidth={1} />;
};

export default function ScatterPanel({ siteId, lat, lon, emissivity }: Props) {
  const [days, setDays] = useState(30);
  const [pairs, setPairs] = useState<ScatterPair[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credsMissing, setCredsMissing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setCredsMissing(false);
    fetch(
      `/api/sentinel3?site=${encodeURIComponent(siteId)}&lat=${lat}&lon=${lon}&days=${days}&emissivity=${emissivity}`
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.error === "credentials_missing") {
          setCredsMissing(true);
          setPairs([]);
        } else if (json.error) {
          setError(json.error);
          setPairs([]);
        } else {
          setPairs(json.pairs ?? []);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [siteId, lat, lon, days, emissivity]);

  const pts = useMemo(
    () => pairs.map((p) => ({ x: p.s3lstC, y: p.cosmosSkinC, time: p.time })),
    [pairs]
  );

  const reg = useMemo(() => linReg(pts), [pts]);

  const xMin = pts.length ? Math.floor(Math.min(...pts.map((p) => p.x)) - 1) : -5;
  const xMax = pts.length ? Math.ceil(Math.max(...pts.map((p) => p.x)) + 1) : 40;
  const yMin = pts.length ? Math.floor(Math.min(...pts.map((p) => p.y)) - 1) : -5;
  const yMax = pts.length ? Math.ceil(Math.max(...pts.map((p) => p.y)) + 1) : 40;
  const axMin = Math.min(xMin, yMin);
  const axMax = Math.max(xMax, yMax);

  // Build regression line endpoints spanning axis range
  const regLine = reg
    ? [
        { x: axMin, y: reg.slope * axMin + reg.intercept },
        { x: axMax, y: reg.slope * axMax + reg.intercept },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-stone-700">Sentinel-3 LST vs COSMOS skin temperature</h3>
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setDays(p.days)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                days === p.days
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {credsMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">Sentinel Hub credentials required</p>
          <p className="text-xs text-amber-700">
            To enable Sentinel-3 LST comparison, add your Copernicus DataSpace OAuth client credentials
            as environment variables in your Vercel project:
          </p>
          <ol className="text-xs text-amber-700 list-decimal ml-4 space-y-1">
            <li>
              Go to{" "}
              <a
                href="https://dataspace.copernicus.eu"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                dataspace.copernicus.eu
              </a>{" "}
              → My Account → User Settings → OAuth clients → Create client
            </li>
            <li>Copy the Client ID and Client Secret</li>
            <li>
              In your Vercel project dashboard → Settings → Environment Variables, add:
              <br />
              <code className="bg-amber-100 px-1 rounded">SH_CLIENT_ID</code> and{" "}
              <code className="bg-amber-100 px-1 rounded">SH_CLIENT_SECRET</code>
            </li>
            <li>Redeploy the project for the variables to take effect</li>
          </ol>
        </div>
      )}

      {error && !credsMissing && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          Error fetching Sentinel-3 data: {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-[260px] text-stone-400 text-sm">
          Fetching Sentinel-3 overpasses…
        </div>
      )}

      {!loading && !credsMissing && !error && pts.length === 0 && (
        <div className="flex items-center justify-center h-[260px] text-stone-400 text-sm">
          No coincident Sentinel-3 overpasses found in this period
        </div>
      )}

      {!loading && !credsMissing && pts.length > 0 && (
        <>
          {/* Stats strip */}
          {reg && (
            <div className="flex flex-wrap gap-3 text-xs text-stone-500">
              <span>n = {pts.length}</span>
              <span>R² = {reg.r2.toFixed(3)}</span>
              <span>RMSE = {reg.rmse.toFixed(2)} °C</span>
              <span>Bias = {reg.bias >= 0 ? "+" : ""}{reg.bias.toFixed(2)} °C</span>
              <span>
                Fit: y = {reg.slope.toFixed(2)}x {reg.intercept >= 0 ? "+" : ""}
                {reg.intercept.toFixed(2)}
              </span>
            </div>
          )}

          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart margin={{ top: 4, right: 16, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis
                dataKey="x"
                type="number"
                domain={[axMin, axMax]}
                tick={{ fontSize: 10, fill: "#78716c" }}
                label={{ value: "Sentinel-3 LST (°C)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#57534e" }}
              />
              <YAxis
                dataKey="y"
                type="number"
                domain={[axMin, axMax]}
                tick={{ fontSize: 10, fill: "#78716c" }}
                label={{ value: "COSMOS skin temp (°C)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11, fill: "#57534e" }}
                width={50}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#1c1917" }}>
                      <p>{new Date(d.time).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                      <p>S3: {d.x} °C</p>
                      <p>COSMOS: {d.y.toFixed(1)} °C</p>
                    </div>
                  );
                }}
              />
              {/* 1:1 line */}
              <Line
                data={[{ x: axMin, y: axMin }, { x: axMax, y: axMax }]}
                dataKey="y"
                dot={false}
                stroke="#94a3b8"
                strokeDasharray="4 3"
                strokeWidth={1}
                legendType="none"
              />
              {/* Regression line */}
              {regLine.length > 0 && (
                <Line
                  data={regLine}
                  dataKey="y"
                  dot={false}
                  stroke="#0284c7"
                  strokeWidth={1.5}
                  legendType="none"
                />
              )}
              {/* Scatter points */}
              <Scatter data={pts} shape={<CustomDot />} />
            </ComposedChart>
          </ResponsiveContainer>

          <p className="text-[10px] text-stone-400 leading-relaxed">
            Each point is a daily Sentinel-3 SLSTR SL_2_LST median matched to the daily mean
            COSMOS-derived skin temperature for the same UTC date. Dashed line = 1:1; blue line = linear fit.
            Data via{" "}
            <a
              href="https://sh.dataspace.copernicus.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Sentinel Hub Statistical API
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
