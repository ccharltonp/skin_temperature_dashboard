"use client";

interface Props {
  siteId: string;
  siteName: string;
  lat: number;
  lon: number;
}

export default function SiteInfoCard({ siteId, siteName, lat, lon }: Props) {
  const cosmosUrl = `https://cosmos.ceh.ac.uk/sites/${siteId}`;
  // Google Maps satellite embed — works without an API key
  const mapsEmbed = `https://maps.google.com/maps?q=${lat},${lon}&t=k&z=15&output=embed`;

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Aerial photo */}
      <div className="relative w-full h-48">
        <iframe
          src={mapsEmbed}
          width="100%"
          height="100%"
          style={{ border: 0, display: "block" }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Satellite view of ${siteName}`}
        />
      </div>

      {/* Footer with link */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-white border-t border-stone-100">
        <div>
          <p className="text-xs font-semibold text-stone-800">{siteName}</p>
          <p className="text-[10px] text-stone-400 mt-0.5">
            {lat.toFixed(4)}° N, {lon.toFixed(4)}°{lon >= 0 ? " E" : " W"}
            {" · "}
            <span className="font-mono">{siteId}</span>
          </p>
        </div>
        <a
          href={cosmosUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
        >
          View on COSMOS-UK →
        </a>
      </div>
    </div>
  );
}
