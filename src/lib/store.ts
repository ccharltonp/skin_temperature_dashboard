// Persistent estimate store using a JSON file (works locally and on Vercel /tmp).
// On Vercel the /tmp directory is per-invocation ephemeral, so estimates
// accumulate within a session. For long-term storage, swap this module for
// a database (e.g. Turso, Supabase, Vercel KV) without changing any callers.

import fs from "fs";
import path from "path";
import { SkinTempResult } from "./skinTemp";

const STORE_PATH =
  process.env.ESTIMATE_STORE_PATH ??
  (process.env.VERCEL
    ? "/tmp/skin_temp_estimates.json"
    : path.join(process.cwd(), "data", "estimates.json"));

export function loadEstimates(): SkinTempResult[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as SkinTempResult[];
  } catch {
    return [];
  }
}

export function appendEstimates(incoming: SkinTempResult[]): void {
  try {
    const existing = loadEstimates();
    // Deduplicate by siteId + timestamp
    const key = (r: SkinTempResult) => `${r.siteId}|${r.timestamp}`;
    const seen = new Set(existing.map(key));
    const novel = incoming.filter((r) => !seen.has(key(r)));
    if (novel.length === 0) return;

    const merged = [...existing, ...novel];
    // Keep last 30 days × 48 intervals × ~50 sites ≈ 72 000 records max
    const MAX = 100_000;
    const trimmed = merged.length > MAX ? merged.slice(-MAX) : merged;

    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(trimmed, null, 0), "utf-8");
  } catch (err) {
    console.error("[store] Failed to append estimates:", err);
  }
}

export function exportCsv(): string {
  const rows = loadEstimates();
  if (rows.length === 0) return "siteId,siteName,timestamp,skinTempC,lwout,lwin,ta\n";
  const header = "siteId,siteName,latitude,longitude,timestamp,skinTempC,lwout,lwin,ta";
  const lines = rows.map(
    (r) =>
      `${r.siteId},${JSON.stringify(r.siteName)},${r.latitude},${r.longitude},${r.timestamp},${r.skinTempC ?? ""},${r.lwout ?? ""},${r.lwin ?? ""},${r.ta ?? ""}`
  );
  return [header, ...lines].join("\n");
}
