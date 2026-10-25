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
  Line,
  ComposedChart,
} from "recharts";

interface S3Pair {
  time: string;
  s3lstC: number;
  cosmosSkinC: number;
}

interface MODISPair {
  time: string;
  modisLstC: number;
  cosmosSkinC: number;
}

interface Props {
  siteId: string;
  lat: number;
  lon: number;
  emissivity: number;
}

const PERIODS = [
  { label: "30 days",  days: 30 },
  { label: "90 days",  days: 90 },
  { label: "180 days", days: 180 },
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

const S3Dot = (props: any) => {
  const { cx, cy } = props;
  return <circle cx={cx} cy={cy} r={4} fill="#ea580c" fillOpacity={0.75} stroke="#fff" strokeWidth={1} />;
};

const MODISSquare = (props: any) => {
  const { cx, cy } = props;
  const s = 7;
  return <rect x={cx - s / 2} y={cy - s / 2} width={s} height={s} fill="#16a34a" fillOpacity={0.8} stroke="#fff" strokeWidth={1} />;
};

export default function ScatterPanel({ siteId, lat, lon, emissivity }: Props) {
  const [days, setDays] = useState(90);

  // Sentinel-3
  const [s3Pairs, setS3Pairs] = useState<S3Pair[]>([]);
  const [s3Loading, setS3Loading] = useState(false);
  const [s3Error, setS3Error] = useState<string | null>(null);
  const [credsMissing, setCredsMissing] = useState(false);

  // MODIS
  const [modisPairs, setModisPairs] = useState<MODISPair[]>([]);
  const [modisLoading, setModisLoading] = useState(false);
  const [modisError, setModisError] = useState<string | null>(null);

  useEffect(() => {
    // Reset
    setS3Loading(true); setS3Error(null); setCredsMissing(false); setS3Pairs([]);
    setModisLoading(true); setModisError(null); setModisPairs([]);

    const base = `site=${encodeURIComponent(siteId)}&lat=${lat}&lon=${lon}&days=${days}&emissivity=${emissivity}`;

    fetch(`/api/sentinel3?${base}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error === "credentials_missing") { setCredsMissing(true); }
        else if (json.error) { setS3Error(json.error); }
        else { setS3Pairs(json.pairs ?? []); }
        setS3Loading(false);
      })
      .catch((e) => { setS3Error(String(e)); setS3Loading(false); });

    fetch(`/api/modis?${base}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setModisError(json.error); }
        else { setModisPairs(json.pairs ?? []); }
        setModisLoading(false);
      })
      .catch((e) => { setModisError(String(e)); setModisLoading(false); });
  }, [siteId, lat, lon, days, emissivity]);

  const s3Pts = useMemo(
    () => s3Pairs.map((p) => ({ x: p.s3lstC, y: p.cosmosSkinC, time: p.time, src: "S3" })),
    [s3Pairs]
  );

  const modisPts = useMemo(
    () => modisPairs.map((p) => ({ x: p.modisLstC, y: p.cosmosSkinC, time: p.time, src: "MODIS" })),
    [modisPairs]
  );

  const allPts = useMemo(() => [...s3Pts, ...modisPts], [s3Pts, modisPts]);
  const reg = useMemo(() => linReg(allPts), [allPts]);

  const loading = s3Loading || modisLoading;

  const xMin = allPts.length ? Math.floor(Math.min(...allPts.map((p) => p.x)) - 1) : -5;
  const xMax = allPts.length ? Math.ceil(Math.max(...allPts.map((p) => p.x)) + 1) : 40;
  const yMin = allPts.length ? Math.floor(Math.min(...allPts.map((p) => p.y)) - 1) : -5;
  const yMax = allPts.length ? Math.ceil(Math.max(...allPts.map((p) => p.y)) + 1) : 40;
  const axMin = Math.min(xMin, yMin);
  const axMax = Math.max(xMax, yMax);

  const regLine = reg
    ? [
        { x: axMin, y: reg.slope * axMin + reg.intercept },
        { x: axMax, y: reg.slope * axMax + reg.intercept },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-stone-700">Satellite LST vs COSMOS skin temperature</h3>
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-stone-600">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#ea580c" fillOpacity={0.75} /></svg>
          Sentinel-3 {s3Loading ? "(loading…)" : `(n=${s3Pts.length})`}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12"><rect x="0" y="0" width="12" height="12" fill="#16a34a" fillOpacity={0.8} /></svg>
          MODIS Terra 8-day {modisLoading ? "(loading…)" : `(n=${modisPts.length})`}
        </span>
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
              <a href="https://shapps.dataspace.copernicus.eu/dashboard/#/account/settings"
                target="_blank" rel="noopener noreferrer" className="underline">
                Sentinel Hub Dashboard
              </a>{" "}
              → User Settings → OAuth clients → Create
            </li>
            <li>Copy the Client ID and Client Secret</li>
            <li>
              In your Vercel project → Settings → Environment Variables, add:{" "}
              <code className="bg-amber-100 px-1 rounded">SH_CLIENT_ID</code> and{" "}
              <code className="bg-amber-100 px-1 rounded">SH_CLIENT_SECRET</code>
            </li>
            <li>Redeploy the project</li>
          </ol>
        </div>
      )}

      {(s3Error && !credsMissing) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          Sentinel-3 error: {s3Error}
        </div>
      )}
      {modisError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          MODIS error: {modisError}
        </div>
      )}

      {loading && allPts.length === 0 && (
        <div className="flex items-center justify-center h-[260px] text-stone-400 text-sm">
          Fetching satellite overpasses…
        </div>
      )}

      {!loading && allPts.length === 0 && !credsMissing && (
        <div className="flex items-center justify-center h-[260px] text-stone-400 text-sm">
          No satellite observations found in this period
        </div>
      )}

      {allPts.length > 0 && (
        <>
          {reg && (
            <div className="flex flex-wrap gap-3 text-xs text-stone-500">
              <span>n = {allPts.length}</span>
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
                label={{ value: "Satellite LST (°C)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#57534e" }}
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
                  const isMODIS = d.src === "MODIS";
                  return (
                    <div style={{ background: "#fff", border: "1px solid #e7e5e4", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#1c1917" }}>
                      <p className="font-medium">{isMODIS ? "MODIS Terra (8-day)" : "Sentinel-3"}</p>
                      <p>{new Date(d.time + "T12:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      <p>{isMODIS ? "MODIS LST" : "S3 LST"}: {d.x.toFixed(1)} °C</p>
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
              {/* S3 orange circles */}
              {s3Pts.length > 0 && <Scatter data={s3Pts} shape={<S3Dot />} />}
              {/* MODIS green squares */}
              {modisPts.length > 0 && <Scatter data={modisPts} shape={<MODISSquare />} />}
            </ComposedChart>
          </ResponsiveContainer>

          <p className="text-[10px] text-stone-400 leading-relaxed">
            <span className="text-orange-500 font-medium">●</span> Sentinel-3 SLSTR daily P90 LST matched to COSMOS nearest 10:00 UTC (Sentinel Hub Statistical API).{" "}
            <span className="text-green-600 font-medium">■</span> MODIS Terra MOD11A2 8-day best-clear-sky composite matched to median COSMOS skin temp
            within ±1.5 h of the MODIS view time across the composite window (ORNL DAAC, free, no credentials).
            Dashed = 1:1; blue line = combined linear fit.
          </p>
        </>
      )}
    </div>
  );
}
