"use client";

import { WAVE_SEED } from "../constants";

/** #6 MIC + 12-bar waveform (FIXED seed heights) + pulse rings. */
export default function MicWave() {
  return (
    <svg viewBox="0 0 100 92" width="100%" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <circle key={i} data-hf="mic-ring" cx="50" cy="22" r="14" stroke="#E8771A" strokeWidth="2" opacity="0" />
      ))}
      <circle cx="50" cy="22" r="14" fill="#E8771A" />
      <rect x="44" y="12" width="12" height="18" rx="6" fill="#fff" />
      <path d="M40 26 A10 10 0 0 0 60 26 M50 36 L50 42" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      {WAVE_SEED.map((hh, i) => (
        <rect
          key={i}
          data-hf="mic-bar"
          x={8 + i * 7.2}
          y={76 - hh / 2}
          width="4.4"
          height={hh}
          rx="2.2"
          fill="#E8771A"
          opacity="0.85"
        />
      ))}
    </svg>
  );
}
