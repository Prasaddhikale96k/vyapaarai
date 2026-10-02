"use client";

import { UPI_ORDER } from "../constants";

/** #13 UPI CHIP — 5×5 grid (poster: filled) + check (poster: shown). */
export default function UpiChip() {
  const cells: Array<{ x: number; y: number; i: number }> = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      cells.push({ x: 12 + c * 11, y: 12 + r * 11, i: r * 5 + c });
    }
  }
  return (
    <svg viewBox="0 0 90 90" width="100%" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="82" height="82" rx="14" fill="#FFFDF8" stroke="#E8DDD0" strokeWidth="2" />
      {cells.map(({ x, y, i }) => (
        <rect
          key={i}
          data-hf="upi-cell"
          data-ord={UPI_ORDER.indexOf(i)}
          x={x}
          y={y}
          width="8"
          height="8"
          rx="1.5"
          fill={i % 4 === 0 ? "#E8DDD0" : "#1A1209"}
        />
      ))}
      <g data-hf="upi-check">
        <circle cx="66" cy="66" r="13" fill="#25D366" />
        <path d="M60 66 L64.5 70.5 L73 60" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
