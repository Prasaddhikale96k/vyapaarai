"use client";

/** #9–11 COIN — two overlapping faces; front visible at rest, swap at zero-crossing. */
export default function Coin({ tone = "#D4A017" }: { tone?: string }) {
  return (
    <svg viewBox="0 0 70 70" width="100%" fill="none" aria-hidden="true">
      <g data-hf="coin-back" opacity="0">
        <circle cx="35" cy="35" r="30" fill="#8B6914" stroke="#6E5210" strokeWidth="2" />
        <circle cx="35" cy="35" r="24" stroke="#FFF8E1" strokeWidth="1.5" strokeDasharray="3 3" />
      </g>
      <g data-hf="coin-front">
        <circle cx="35" cy="35" r="30" fill={tone} stroke="#FFF8E1" strokeWidth="2" />
        <circle cx="35" cy="35" r="24" stroke="#FFF8E1" strokeWidth="1.5" opacity="0.7" />
        <text x="35" y="45" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1A1209" fontFamily="Georgia,serif">
          ₹
        </text>
      </g>
      <circle data-hf="coin-spark" cx="58" cy="12" r="3" fill="#FFD700" opacity="0" />
    </svg>
  );
}
