// Stefan-Boltzmann inversion of longwave radiation balance.
//
// The surface longwave energy balance is:
//   L↑ = ε·σ·Ts⁴ + (1−ε)·L↓
//
// Rearranged for skin temperature Ts (K):
//   Ts = ((L↑ − (1−ε)·L↓) / (ε·σ))^(1/4)
//
// Reference: Liang et al. (2010), Scientific Reports (2022) flux-tower method.
// ε = 0.97 is the standard broadband emissivity for vegetated / soil surfaces.

const SIGMA = 5.670374419e-8; // Stefan-Boltzmann constant, W m⁻² K⁻⁴
const EMISSIVITY = 0.97;      // Broadband surface emissivity

export interface SkinTempResult {
  siteId: string;
  siteName: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  skinTempC: number | null;
  lwout: number | null;
  lwin: number | null;
  ta: number | null;         // air temperature for reference
  error?: string;
}

export function computeSkinTemp(lwout: number, lwin: number): number | null {
  // Numerator must be positive (upwelling must exceed reflected downwelling)
  const numerator = lwout - (1 - EMISSIVITY) * lwin;
  if (numerator <= 0) return null;
  const TsK = Math.pow(numerator / (EMISSIVITY * SIGMA), 0.25);
  return +(TsK - 273.15).toFixed(2);
}

export type { };
