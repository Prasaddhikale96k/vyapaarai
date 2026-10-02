"use client";

const C = 2 * Math.PI * 26; // 163.36
const ARC88 = ((C * 88) / 100).toFixed(2);

/** #4 HEALTH RING — poster: green arc at 88%, numeral 88, faint halo. */
export default function HealthRing() {
  return (
    <svg viewBox="0 0 80 96" width="100%" fill="none" aria-hidden="true">
      <circle data-hf="ring-halo" cx="40" cy="36" r="32" stroke="#D4A017" strokeWidth="1.5" opacity="0.25" />
      <circle cx="40" cy="36" r="26" stroke="#E8DDD0" strokeWidth="7" />
      <circle
        data-hf="ring-red"
        cx="40"
        cy="36"
        r="26"
        stroke="#C0392B"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${C.toFixed(2)}`}
        strokeDashoffset="0"
        opacity="0"
        transform="rotate(-90 40 36)"
      />
      <circle
        data-hf="ring-green"
        cx="40"
        cy="36"
        r="26"
        stroke="#2D6A4F"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${ARC88} ${C.toFixed(2)}`}
        transform="rotate(-90 40 36)"
      />
      <text data-hf="ring-num" x="40" y="44" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1A1209" fontFamily="'JetBrains Mono',monospace">
        88
      </text>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          data-hf="ring-spark"
          cx={40 + 32 * Math.cos((a * Math.PI) / 180)}
          cy={36 + 32 * Math.sin((a * Math.PI) / 180)}
          r="2.2"
          fill="#D4A017"
          opacity="0"
        />
      ))}
      <text x="40" y="90" textAnchor="middle" fontSize="11" fontWeight="700" fill="#8B7355" fontFamily="Inter,sans-serif">
        HEALTH
      </text>
    </svg>
  );
}
