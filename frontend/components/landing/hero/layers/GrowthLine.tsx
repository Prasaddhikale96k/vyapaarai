"use client";

import { growthPath, GROWTH_HEAD } from "../constants";

/**
 * L3 GROWTH LINE — health 44 → 88. Poster: fully drawn @ rest opacity,
 * head dot parked at the end, chips 44 (left) / 88 (at head).
 */
export default function GrowthLine() {
  return (
    <div data-hf="layer-growth" className="hf-layer" aria-hidden="true">
      <svg viewBox="0 0 1600 360" preserveAspectRatio="none" className="hf-growth-svg">
        <defs>
          <linearGradient id="hf-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4A017" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#D4A017" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path data-hf="growth-area" d={`${growthPath(0)} L1560 360 L40 360 Z`} fill="url(#hf-area)" />
        <path
          data-hf="growth-red"
          d={growthPath(14)}
          fill="none"
          stroke="#C0392B"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
          vectorEffect="non-scaling-stroke"
        />
        <path
          data-hf="growth-green"
          d={growthPath(0)}
          fill="none"
          stroke="#E8771A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />
        <g data-hf="growth-head">
          <circle cx={GROWTH_HEAD.x} cy={GROWTH_HEAD.y} r="14" fill="none" stroke="#E8771A" strokeWidth="2" opacity="0.5" />
          <circle cx={GROWTH_HEAD.x} cy={GROWTH_HEAD.y} r="6" fill="#E8771A" />
        </g>
        <g data-hf="growth-chip44">
          <rect x="18" y="292" width="52" height="26" rx="13" fill="#FFFDF8" stroke="#E8DDD0" strokeWidth="1.5" />
          <text x="44" y="310" textAnchor="middle" fontSize="16" fontWeight="700" fill="#4A3728" fontFamily="'JetBrains Mono',monospace">
            44
          </text>
        </g>
        <g data-hf="growth-chip88">
          <rect x="1468" y="34" width="52" height="26" rx="13" fill="#FFF8E1" stroke="#D4A017" strokeWidth="1.5" />
          <text x="1494" y="52" textAnchor="middle" fontSize="16" fontWeight="800" fill="#2D6A4F" fontFamily="'JetBrains Mono',monospace">
            88
          </text>
        </g>
      </svg>
    </div>
  );
}
