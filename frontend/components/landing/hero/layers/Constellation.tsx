"use client";

/**
 * L4 CONSTELLATION — hub-and-spoke overlay. Spokes arc AROUND the text block
 * (top band + bottom band), never across the H1. Poster: static dashed spokes.
 * Packets (Phase 4) ride these paths via MotionPath.
 */
const SPOKES = [
  "M60 300 Q 300 130 520 150",
  "M940 150 Q 1200 130 1440 300",
  "M120 690 Q 480 820 900 780",
  "M1060 780 Q 1300 800 1480 690",
  "M520 150 Q 730 90 940 150",
  "M900 780 Q 980 860 1060 780",
];

export default function Constellation() {
  return (
    <div data-hf="layer-constellation" className="hf-layer" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="hf-spokes-svg">
        {SPOKES.map((d, i) => (
          <path
            key={i}
            data-hf="spoke"
            d={d}
            fill="none"
            stroke="#E8771A"
            strokeWidth="1.5"
            strokeDasharray="5 7"
            opacity="0.2"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <g data-hf="packets" />
      </svg>
    </div>
  );
}
