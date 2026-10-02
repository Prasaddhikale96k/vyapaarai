"use client";

/** #1 BILL — receipt with zigzag bottom, ruled lines, mono total. */
export default function Bill() {
  return (
    <svg viewBox="0 0 120 150" width="100%" fill="none" aria-hidden="true">
      <path
        d="M6 4 H114 V128 L105 136 L96 128 L87 136 L78 128 L69 136 L60 128 L51 136 L42 128 L33 136 L24 128 L15 136 L6 128 Z"
        fill="#FFFDF8"
        stroke="#E8DDD0"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {[28, 44, 60, 76].map((y) => (
        <line key={y} x1="18" y1={y} x2="102" y2={y} stroke="#E8DDD0" strokeWidth="1.5" strokeLinecap="round" />
      ))}
      <text x="60" y="102" textAnchor="middle" fontSize="19" fontWeight="700" fill="#1A1209" fontFamily="'JetBrains Mono',monospace">
        ₹2,340
      </text>
      {[110, 116, 122].map((y) => (
        <line key={y} data-hf="bill-underline" x1="34" y1={y} x2="86" y2={y} stroke="#E8771A" strokeWidth="2" strokeLinecap="round" />
      ))}
      <rect data-hf="bill-scan" className="hf-rest0" x="6" y="4" width="108" height="10" fill="#E8771A" opacity="0" />
    </svg>
  );
}
