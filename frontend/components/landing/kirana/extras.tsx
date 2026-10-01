"use client";

/**
 * Mounted-only EXTRAS layer for the kirana scene.
 * Rendered only after client `ready` flips true (never in SSR HTML),
 * initial hidden states are applied via gsap.set in the hook before paint.
 * All ids are static (kr- prefix) — no hydration mismatches.
 */

const SAFFRON = "#E8771A";
const GOLD = "#D4A017";
const NAVY = "#0F2040";
const INK = "#1A1209";
const PAPER = "#FFF8E7";
const IVORY = "#FDFAF4";
const WA_GREEN = "#25D366";
const LEDGER_GREEN = "#2D6A4F";
const LEDGER_RED = "#C0392B";
const MUTED = "#8B7355";

const DUST_SPOTS: Array<[number, number]> = [
  [232, 90], [246, 110], [262, 96], [272, 130],
  [240, 150], [256, 168], [228, 180], [266, 190],
];

const SPARKLE_SPOTS: Array<[number, number]> = [
  [348, 196], [368, 188], [404, 188], [422, 200], [386, 244], [404, 248],
];

function Sparkle({ x, y }: { x: number; y: number }) {
  return (
    <path
      data-k="sparkle"
      d={`M${x} ${y - 7} Q${x + 1.6} ${y - 1.6} ${x + 7} ${y} Q${x + 1.6} ${y + 1.6} ${x} ${y + 7} Q${x - 1.6} ${y + 1.6} ${x - 7} ${y} Q${x - 1.6} ${y - 1.6} ${x} ${y - 7} Z`}
      fill={IVORY}
      stroke={GOLD}
      strokeWidth="1"
    />
  );
}

export default function KiranaExtras() {
  return (
    <g data-k="extras" aria-hidden="true">
      {/* bill paper rising near the phone */}
      <g data-k="paper">
        <rect x="300" y="258" width="48" height="62" rx="3" fill={PAPER} stroke={MUTED} strokeWidth="1.5" />
        {[0, 1, 2].map((i) => (
          <line key={i} x1="306" y1={268 + i * 8} x2="342" y2={268 + i * 8} stroke="#C9B99A" strokeWidth="1.2" />
        ))}
        {[0, 1, 2].map((i) => (
          <line
            key={`u${i}`}
            data-k="paper-stroke"
            x1="306"
            y1={272 + i * 8}
            x2="342"
            y2={272 + i * 8}
            stroke={SAFFRON}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ))}
        <rect data-k="paper-beam" x="302" y="260" width="44" height="5" rx="2.5" fill={SAFFRON} opacity="0.55" />
        <circle cx="340" cy="312" r="5" fill={LEDGER_GREEN} />
        <path d="M337.6 312 l1.7 1.7 l3.2 -3.4" stroke={IVORY} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>

      {/* camera flash ring */}
      <circle data-k="flash" cx="293" cy="290" r="30" fill="none" stroke={SAFFRON} strokeWidth="3" />

      {/* send ripples on the phone screen */}
      <circle data-k="ripple-1" cx="293" cy="272" r="10" fill="none" stroke={WA_GREEN} strokeWidth="2.5" />
      <circle data-k="ripple-2" cx="293" cy="272" r="10" fill="none" stroke={WA_GREEN} strokeWidth="2.5" />

      {/* coins flying bubble -> ledger */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} data-k="coin">
          <circle cx="293" cy="285" r="6" fill={GOLD} stroke="#8B6914" strokeWidth="1.5" />
          <circle cx="293" cy="285" r="3.2" fill="none" stroke="#FFF8E7" strokeWidth="1.2" />
        </g>
      ))}

      {/* new ledger row: clip-masked 2,340 + check + flourish */}
      <g data-k="newrow">
        <defs>
          <clipPath id="kr-newrow-clip">
            <rect data-k="newrow-cliprect" x="156" y="297" width="0" height="14" />
          </clipPath>
        </defs>
        <g clipPath="url(#kr-newrow-clip)">
          <text x="158" y="307" fontSize="9" fill="#4A3728" fontFamily="'JetBrains Mono', monospace">2,340</text>
        </g>
        <path data-k="newrow-check" d="M202 303 l3 3 l6 -7" stroke={LEDGER_GREEN} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path data-k="newrow-flourish" d="M158 310 q12 3 26 0 t26 -1" stroke={SAFFRON} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      </g>

      {/* ghost pen (AI writes; keeper only watches) */}
      <g data-k="ghostpen">
        <rect x="-3" y="-16" width="7" height="26" rx="3" fill={NAVY} transform="rotate(-35)" />
        <path d="M-3 10 L4 10 L0.5 16 Z" fill={SAFFRON} transform="rotate(-35)" />
        <path data-k="pen-spark" d="M10 -14 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z" fill={GOLD} />
      </g>

      {/* +Rs label rising off the ledger */}
      <text data-k="plusLabel" x="185" y="292" fontSize="11" fontWeight="bold" fill={SAFFRON} fontFamily="Inter, sans-serif" textAnchor="middle">
        + Rs.2,340
      </text>

      {/* shelf scan beam */}
      <rect data-k="scan" x="70" y="100" width="10" height="112" rx="5" fill={SAFFRON} opacity="0.35" />

      {/* low stock tag + flagged badge */}
      <g data-k="lowtag">
        <rect x="82" y="158" width="76" height="20" rx="10" fill={LEDGER_RED} />
        <text x="120" y="172" fontSize="10" fontWeight="bold" fill={IVORY} fontFamily="Inter, sans-serif" textAnchor="middle">LOW STOCK</text>
      </g>
      <g data-k="flagbadge">
        <rect x="8" y="96" width="96" height="24" rx="12" fill={NAVY} />
        <text data-k="flagbadge-text" x="56" y="112" fontSize="10" fontWeight="bold" fill={IVORY} fontFamily="Inter, sans-serif" textAnchor="middle">18 flagged</text>
      </g>

      {/* health chip with mini ring */}
      <g data-k="healthchip">
        <rect x="340" y="200" width="96" height="34" rx="17" fill={IVORY} stroke={MUTED} strokeWidth="1.5" />
        <circle cx="357" cy="217" r="10" fill="none" stroke="#E8DDD0" strokeWidth="3.5" />
        <circle
          data-k="healthchip-ring"
          cx="357"
          cy="217"
          r="10"
          fill="none"
          stroke={LEDGER_RED}
          strokeWidth="3.5"
          strokeLinecap="round"
          transform="rotate(-90 357 217)"
        />
        <text data-k="healthchip-num" x="398" y="222" fontSize="12" fontWeight="bold" fill={INK} fontFamily="Inter, sans-serif" textAnchor="middle">44</text>
      </g>

      {/* sparkle burst */}
      {SPARKLE_SPOTS.map(([x, y], i) => (
        <Sparkle key={i} x={x} y={y} />
      ))}

      {/* TIER-B: chai + steam on the counter */}
      <g data-k="steam-glass">
        <path d="M48 206 L72 206 L68 226 L52 226 Z" fill={IVORY} stroke={MUTED} strokeWidth="1.5" />
        <path d="M51 210 L69 210 L67 222 L53 222 Z" fill={SAFFRON} opacity="0.8" />
        <path data-k="steam-1" d="M57 202 q-3 -6 0 -11 q3 -5 0 -10" stroke={MUTED} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
        <path data-k="steam-2" d="M64 202 q3 -6 0 -11 q-3 -5 0 -10" stroke={MUTED} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.6" />
      </g>

      {/* TIER-B: dust motes in the light cone */}
      {DUST_SPOTS.map(([x, y], i) => (
        <circle key={i} data-k="dust" cx={x} cy={y} r="1.2" fill={GOLD} opacity="0.3" />
      ))}

      {/* TIER-B: cat curled on the floor, right side */}
      <g data-k="cat">
        <ellipse data-k="cat-body" cx="447" cy="342" rx="17" ry="10" fill={MUTED} />
        <circle data-k="cat-head" cx="460" cy="335" r="7.5" fill={MUTED} />
        <path data-k="cat-ear" d="M455 329 L457 322 L461 328 Z" fill={MUTED} stroke={INK} strokeWidth="1" />
        <path data-k="cat-tail" d="M431 344 q-10 1 -12 -8" stroke={MUTED} strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="462.5" cy="334" r="1" fill={INK} />
      </g>
    </g>
  );
}
