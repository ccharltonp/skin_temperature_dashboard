"use client";

import { useEffect, useRef } from "react";

interface Props {
  onClose: () => void;
}

export default function InfoModal({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        className="relative bg-white border border-stone-200 rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-stone-200 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-base font-semibold text-stone-800">About this dashboard</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 text-sm text-stone-600 leading-relaxed">

          {/* Data sources */}
          <section>
            <h3 className="text-stone-800 font-semibold mb-2 flex items-center gap-2">
              <span className="text-blue-500">⬡</span> Data sources
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://cosmos-api.ceh.ac.uk/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  COSMOS-UK API (cosmos-api.ceh.ac.uk)
                </a>
                <p className="mt-0.5 text-stone-500">
                  Provides 30-minute observations from 51 UK monitoring sites operated by
                  UKCEH. This dashboard uses three variables from the{" "}
                  <code className="bg-stone-100 px-1 rounded text-xs">30M</code> collection:
                </p>
                <ul className="mt-1.5 ml-4 space-y-1 text-stone-500 text-xs list-disc">
                  <li><code className="bg-stone-100 px-1 rounded">lwout</code> — outgoing (upwelling) longwave radiation, W m⁻²</li>
                  <li><code className="bg-stone-100 px-1 rounded">lwin</code> — incoming (downwelling) longwave radiation, W m⁻²</li>
                  <li><code className="bg-stone-100 px-1 rounded">ta</code> — screen-level air temperature, °C</li>
                  <li><code className="bg-stone-100 px-1 rounded">stp_tsoil2</code> — STP probe soil temperature at 2 cm depth, °C</li>
                  <li><code className="bg-stone-100 px-1 rounded">stp_tsoil5</code> — STP probe soil temperature at 5 cm depth, °C</li>
                </ul>
              </li>
              <li>
                <a
                  href="https://cosmos-api.ceh.ac.uk/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  COSMOS-UK API — daily collection
                </a>
                <p className="mt-0.5 text-stone-500">
                  The{" "}
                  <code className="bg-stone-100 px-1 rounded text-xs">1D</code>{" "}
                  collection provides one additional variable used in the chart:
                </p>
                <ul className="mt-1.5 ml-4 space-y-1 text-stone-500 text-xs list-disc">
                  <li>
                    <code className="bg-stone-100 px-1 rounded">cosmos_vwc</code> — volumetric
                    water content (%) derived from the Cosmic-Ray Neutron Sensor (CRNS).
                    Area-integrated soil moisture estimate over approximately 12 hectares and ~30 cm depth.
                  </li>
                </ul>
              </li>
              <li>
                <a
                  href="https://cosmos.ceh.ac.uk/data/variables"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  COSMOS-UK variable definitions (cosmos.ceh.ac.uk)
                </a>
                <p className="mt-0.5 text-stone-500">
                  Full descriptions, units, and measurement methods for all COSMOS-UK variables.
                </p>
              </li>
            </ul>
          </section>

          {/* Skin temperature method */}
          <section>
            <h3 className="text-stone-800 font-semibold mb-2 flex items-center gap-2">
              <span className="text-orange-500">⬡</span> Skin temperature calculation
            </h3>
            <p>
              Land surface skin temperature is estimated by inverting the{" "}
              <strong className="text-stone-800">Stefan-Boltzmann longwave radiation balance</strong>.
              The surface emits and reflects longwave radiation according to:
            </p>
            <div className="my-3 bg-stone-100 border border-stone-200 rounded-lg px-4 py-3 font-mono text-xs text-stone-800">
              L↑ = ε · σ · Tₛ⁴ + (1 − ε) · L↓
            </div>
            <p>Rearranging for skin temperature Tₛ:</p>
            <div className="my-3 bg-stone-100 border border-stone-200 rounded-lg px-4 py-3 font-mono text-xs text-stone-800">
              Tₛ (°C) = [ (L↑ − (1 − ε) · L↓) / (ε · σ) ]^(1/4) − 273.15
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-stone-500">
              <li><span className="text-stone-700">L↑</span> = <code className="bg-stone-100 px-1 rounded">lwout</code>, outgoing longwave radiation (W m⁻²)</li>
              <li><span className="text-stone-700">L↓</span> = <code className="bg-stone-100 px-1 rounded">lwin</code>, incoming longwave radiation (W m⁻²)</li>
              <li><span className="text-stone-700">ε</span> = surface broadband emissivity (default 0.97, typical for vegetated and soil surfaces)</li>
              <li><span className="text-stone-700">σ</span> = 5.670 × 10⁻⁸ W m⁻² K⁻⁴ (Stefan-Boltzmann constant)</li>
            </ul>
            <p className="mt-3 text-stone-500 text-xs">
              This approach is equivalent to the method used at eddy-covariance flux towers and
              validated in:{" "}
              <a
                href="https://www.nature.com/articles/s41598-022-12304-3"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Tang et al. (2022), <em>Scientific Reports</em>
              </a>
              . The emissivity slider lets you adjust ε globally or per site to reflect
              different surface types (e.g. open water ≈ 0.99, bare soil ≈ 0.93–0.96).
            </p>
          </section>

          {/* Update frequency */}
          <section>
            <h3 className="text-stone-800 font-semibold mb-2 flex items-center gap-2">
              <span className="text-green-600">⬡</span> Update frequency & data lag
            </h3>
            <p className="text-stone-500 text-xs">
              The dashboard auto-refreshes every 5 minutes. COSMOS-UK data is typically
              delivered with a lag of 6–10 hours, so the most recent observation shown is
              usually from the previous evening or early morning. Estimates are stored locally
              in <code className="bg-stone-100 px-1 rounded">data/estimates.json</code> and
              can be downloaded as CSV using the button in the header.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
