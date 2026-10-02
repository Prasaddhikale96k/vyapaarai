"use client";

/** #8 DIYA + flame + "×1.6" chip (story state, rest 0) + embers (rest 0). */
export default function Diya() {
  return (
    <svg viewBox="0 0 90 84" width="100%" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <circle key={i} data-hf="diya-ember" cx={45 + (i - 1) * 8} cy={26} r="2" fill="#E8771A" opacity="0" />
      ))}
      <path d="M22 44 Q45 52 68 44 L62 56 Q45 62 28 56 Z" fill="#8B6914" />
      <ellipse cx="45" cy="44" rx="23" ry="5" fill="#6E5210" />
      <g data-hf="diya-flame">
        <path d="M45 8 C49 16 50 24 45 32 C40 24 41 16 45 8 Z" fill="#E8771A" />
        <path d="M45 18 C47 22 47.5 25 45 28 C42.5 25 43 22 45 18 Z" fill="#FFD700" />
      </g>
      <g data-hf="diya-chip" opacity="0">
        <rect x="52" y="8" width="34" height="18" rx="9" fill="#FFF8E1" stroke="#D4A017" strokeWidth="1.5" />
        <text x="69" y="21" textAnchor="middle" fontSize="12" fontWeight="800" fill="#1A1209" fontFamily="'JetBrains Mono',monospace">
          ×1.6
        </text>
      </g>
    </svg>
  );
}
