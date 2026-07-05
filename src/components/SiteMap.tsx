"use client";

import dynamic from "next/dynamic";
import { SkinTempResult, computeSkinTemp } from "@/lib/skinTemp";

// Leaflet must be loaded client-side only
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }
);

interface Props {
  sites: SkinTempResult[];
  selected: string | null;
  onSelect: (id: string) => void;
  effectiveEmissivity: (siteId: string) => number;
}

function tempToColor(t: number | null): string {
  if (t === null) return "#94a3b8";
  if (t < -5) return "#1e40af";
  if (t < 0) return "#3b82f6";
  if (t < 5) return "#6ee7b7";
  if (t < 10) return "#34d399";
  if (t < 15) return "#fbbf24";
  if (t < 20) return "#f97316";
  if (t < 25) return "#ef4444";
  return "#7f1d1d";
}

export default function SiteMap({ sites, selected, onSelect, effectiveEmissivity }: Props) {
  return (
    <MapContainer
      center={[54.5, -4.5]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sites.map((s) => {
        const eps = effectiveEmissivity(s.siteId);
        const skinTempC =
          s.lwout != null && s.lwin != null
            ? computeSkinTemp(s.lwout, s.lwin, eps)
            : null;
        return (
          <CircleMarker
            key={s.siteId}
            center={[s.latitude, s.longitude]}
            radius={selected === s.siteId ? 12 : 8}
            pathOptions={{
              fillColor: tempToColor(skinTempC),
              color: selected === s.siteId ? "#1c1917" : "#0003",
              weight: selected === s.siteId ? 2 : 1,
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => onSelect(s.siteId) }}
          >
            <Tooltip>
              <strong>{s.siteName}</strong>
              <br />
              {skinTempC !== null
                ? `Skin temp: ${skinTempC.toFixed(1)} °C (ε=${eps.toFixed(2)})`
                : "No data"}
              {s.ta !== null && <><br />Air temp: {s.ta.toFixed(1)} °C</>}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
