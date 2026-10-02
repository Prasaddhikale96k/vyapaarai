"use client";

/** #7 JAR with fill + "18" badge (poster: full-ish) + LOW tag (story state, rest 0). */
export default function Jar() {
  return (
    <svg viewBox="0 0 64 96" width="100%" fill="none" aria-hidden="true">
      <rect x="10" y="18" width="44" height="66" rx="10" stroke="#8B6914" strokeWidth="2.5" fill="#FFFDF8" />
      <rect x="10" y="6" width="44" height="12" rx="5" stroke="#8B6914" strokeWidth="2.5" fill="#FFFDF8" />
      <rect data-hf="jar-fill" x="15" y="40" width="34" height="39" rx="6" fill="#E8771A" opacity="0.8" />
      <g data-hf="jar-low" opacity="0">
        <rect x="14" y="46" width="36" height="16" rx="8" fill="#C0392B" />
        <text x="32" y="58" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Inter,sans-serif">
          LOW
        </text>
      </g>
      <g data-hf="jar-badge">
        <circle cx="50" cy="80" r="13" fill="#D4A017" stroke="#FFF8E1" strokeWidth="2" />
        <text data-hf="jar-num" x="50" y="85" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1A1209" fontFamily="'JetBrains Mono',monospace">
          18
        </text>
      </g>
    </svg>
  );
}
