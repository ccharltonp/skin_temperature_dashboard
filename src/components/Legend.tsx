export default function Legend() {
  const stops = [
    { color: "#1e40af", label: "< −5 °C" },
    { color: "#3b82f6", label: "−5 – 0 °C" },
    { color: "#6ee7b7", label: "0 – 5 °C" },
    { color: "#34d399", label: "5 – 10 °C" },
    { color: "#fbbf24", label: "10 – 15 °C" },
    { color: "#f97316", label: "15 – 20 °C" },
    { color: "#ef4444", label: "20 – 25 °C" },
    { color: "#7f1d1d", label: "> 25 °C" },
    { color: "#94a3b8", label: "No data" },
  ];

  return (
    <div className="bg-white/90 border border-stone-200 rounded-xl p-3 text-xs text-stone-600 space-y-1 shadow-sm">
      <p className="font-semibold text-stone-800 mb-2">Skin temperature</p>
      {stops.map((s) => (
        <div key={s.label} className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: s.color }}
          />
          {s.label}
        </div>
      ))}
    </div>
  );
}
