"use client";

/** #12 OVERDUE STAMP "₹53,400" + approve check (story state, rest 0). Never alters the string. */
export default function OverdueStamp() {
  return (
    <svg viewBox="0 0 150 74" width="100%" fill="none" aria-hidden="true">
      <g data-hf="stamp-hit">
        <rect x="6" y="8" width="138" height="58" rx="8" stroke="#C0392B" strokeWidth="3" />
        <rect x="12" y="14" width="126" height="46" rx="5" stroke="#C0392B" strokeWidth="1.5" opacity="0.6" />
        <text x="75" y="44" textAnchor="middle" fontSize="23" fontWeight="800" fill="#C0392B" fontFamily="'JetBrains Mono',monospace">
          ₹53,400
        </text>
        <text x="75" y="60" textAnchor="middle" fontSize="11" fontWeight="800" letterSpacing="3" fill="#C0392B" fontFamily="Inter,sans-serif">
          OVERDUE
        </text>
      </g>
      <g data-hf="stamp-ok" opacity="0">
        <circle cx="122" cy="52" r="17" fill="#2D6A4F" />
        <path d="M114 52 L120 58 L131 45" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
