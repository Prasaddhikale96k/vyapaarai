"use client";

/**
 * L0 RULED PAPER — oversize SVG, rules every 44px, red margin line at 12%,
 * faint tally/₹/arrow doodles (≤.12), ivory vignette to keep text calm.
 * Poster: static. The film slides .hf-paper-slide by exactly 44px / 8s linear.
 */
const TALLIES: Array<[number, number]> = [
  [300, 200], [700, 420], [1100, 160], [1350, 500], [180, 560], [900, 640],
];

export default function RuledPaper() {
  return (
    <div data-hf="layer-paper" className="hf-layer">
      <svg data-hf="paper-slide" className="hf-paper-slide" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id="hf-rules" width="200" height="44" patternUnits="userSpaceOnUse">
            <line x1="0" y1="43.5" x2="200" y2="43.5" stroke="#E8DDD0" strokeWidth="1" opacity="0.5" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="1600" height="800" fill="url(#hf-rules)" />
        <line x1="192" y1="0" x2="192" y2="800" stroke="#C0392B" strokeWidth="1.5" opacity="0.18" />
        {TALLIES.map(([x, y], i) => (
          <g key={i} stroke="#8B7355" strokeWidth="1.6" strokeLinecap="round" opacity="0.12">
            <line x1={x} y1={y} x2={x + 3} y2={y - 18} />
            <line x1={x + 8} y1={y} x2={x + 11} y2={y - 18} />
            <line x1={x + 16} y1={y} x2={x + 19} y2={y - 18} />
            <line x1={x - 2} y1={y - 4} x2={x + 22} y2={y - 13} />
          </g>
        ))}
        <text x="520" y="330" fontSize="30" fill="#8B7355" opacity="0.1" fontFamily="Georgia,serif">
          ₹
        </text>
        <text x="1180" y="600" fontSize="26" fill="#8B7355" opacity="0.1" fontFamily="Georgia,serif">
          ₹
        </text>
        <path d="M240 480 h44 m-10 -7 l10 7 l-10 7" stroke="#8B7355" strokeWidth="1.6" opacity="0.12" fill="none" strokeLinecap="round" />
        <path d="M1240 260 h44 m-10 -7 l10 7 l-10 7" stroke="#8B7355" strokeWidth="1.6" opacity="0.12" fill="none" strokeLinecap="round" />
      </svg>
      <div data-hf="paper-vignette" className="hf-vignette" aria-hidden="true" />
    </div>
  );
}
