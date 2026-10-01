"use client";

/**
 * Kirana shop counter scene — rigged, layered, hand-choreographed.
 * The server-rendered SVG is the COMPLETE static base scene (no hidden
 * elements in the DOM). Client extras mount after `ready`; the
 * useKiranaScene hook owns intro/idle/story/interactions.
 * Default export name + props signature unchanged (Hero.tsx compatible).
 */

import { useEffect, useRef, useState } from "react";
import { useKiranaScene } from "./kirana/useKiranaScene";
import KiranaExtras from "./kirana/extras";

function WhatsAppGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 A10 10 0 0 0 3.5 15.5 L2 22 L8.7 20.4 A10 10 0 1 0 12 2 Z"
        fill="#25D366"
      />
      <path
        d="M8.8 8.2 C8.5 8.2 8 8.4 7.8 8.9 C7.3 10 7.8 11.9 9.2 13.7 C10.6 15.5 12.4 16.4 13.9 16.2 C14.5 16.1 14.9 15.7 15.1 15.2 L15.7 13.9 C15.8 13.6 15.7 13.3 15.4 13.1 L13.9 12.2 C13.7 12.1 13.4 12.1 13.2 12.3 L12.6 12.9 C11.4 12.3 10.3 11.2 9.8 10 L10.4 9.4 C10.6 9.2 10.6 8.9 10.5 8.7 L9.6 7.2 C9.4 6.9 9.1 6.8 8.8 8.2"
        fill="#fff"
      />
    </svg>
  );
}

export { WhatsAppGlyph };

const JAR_COLORS = ["#E8771A", "#D4A017", "#2D6A4F", "#C0392B"];
const JAR_GLASS = ["#FFF3E0", "#E8DDD0", "#FFF8E1", "#DCF8C6"];
// Upper fan only (0..180°) so rays never touch the hanging sign; cone fills below.
const RAY_ANGLES = [0, 45, 90, 135, 180];

function Jar({ row, i }: { row: number; i: number }) {
  const cx = 88 + i * 36;
  const color = JAR_COLORS[(row + i) % 4];
  const glass = JAR_GLASS[(row + i) % 4];
  const id = `k-jar-${String(row * 4 + i + 1).padStart(2, "0")}`;
  const isDrainJar = row === 2 && i === 1;
  if (i % 2 === 0) {
    const cy = 118 + row * 34;
    return (
      <g data-k={id}>
        <circle cx={cx} cy={cy} r="9" fill={color} opacity="0.85" />
        <circle data-k="fill" cx={cx} cy={cy + 2} r="5.5" fill={glass} opacity="0.9" />
        <line x1={cx - 6} y1={cy - 9} x2={cx + 6} y2={cy - 9} stroke="#1A1209" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }
  const x = 80 + i * 36;
  const y = 106 + row * 34;
  return (
    <g data-k={id}>
      <rect x={x} y={y} width="16" height="22" rx="3" fill={glass} stroke="#8B7355" strokeWidth="1.5" />
      <rect data-k="fill" x={x + 3} y={y + 8} width="10" height="11" rx="1.5" fill={isDrainJar ? "#E8771A" : color} opacity="0.85" />
      <rect x={x - 1} y={y - 4} width="18" height="5" rx="2" fill="#1A1209" />
    </g>
  );
}

export default function KiranaShopSVG() {
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setReady(true);
  }, []);

  useKiranaScene(root, ready);

  return (
    <div ref={root} className="mx-auto w-full max-w-[500px]">
      <svg
        viewBox="0 0 500 380"
        className="h-auto w-full"
        role="img"
        aria-label="Illustration: a shopkeeper at Sharma Kirana photographs a bill, VyapaarAI records it in the ledger, flags low stock and lifts the business health score from 44 to 88."
      >
        <defs>
          <linearGradient id="kr-cone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D4A017" stopOpacity="0.18" />
            <stop offset="1" stopColor="#D4A017" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="kr-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#D4A017" stopOpacity="0.35" />
            <stop offset="1" stopColor="#D4A017" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ground shadow */}
        <ellipse data-k="shadow" cx="250" cy="352" rx="190" ry="16" fill="#E8DDD0" opacity="0.7" />

        {/* ceiling beam + hanging ropes */}
        <g data-k="beam">
          <rect x="150" y="8" width="200" height="6" rx="3" fill="#1A1209" />
          <circle cx="182" cy="12" r="2.5" fill="#1A1209" />
          <circle cx="338" cy="12" r="2.5" fill="#1A1209" />
        </g>
        <line data-k="rope-L" x1="182" y1="12" x2="182" y2="58" stroke="#1A1209" strokeWidth="1.5" />
        <line data-k="rope-R" x1="338" y1="12" x2="338" y2="58" stroke="#1A1209" strokeWidth="1.5" />

        {/* hanging lamp: cord, glow, bulb, rays, cone */}
        <g data-k="lamp">
          <circle data-k="glow" cx="250" cy="48" r="26" fill="url(#kr-glow)" />
          <line data-k="cord" x1="250" y1="0" x2="250" y2="34" stroke="#1A1209" strokeWidth="2" />
          <circle data-k="bulb" cx="250" cy="48" r="14" fill="#FFF8E1" stroke="#D4A017" strokeWidth="2" />
          <circle data-k="filament" cx="250" cy="48" r="5" fill="#E8771A" />
          {RAY_ANGLES.map((a) => (
            <line
              key={a}
              data-k="ray"
              x1={250 + 20 * Math.cos((a * Math.PI) / 180)}
              y1={48 - 20 * Math.sin((a * Math.PI) / 180)}
              x2={250 + 27 * Math.cos((a * Math.PI) / 180)}
              y2={48 - 27 * Math.sin((a * Math.PI) / 180)}
              stroke="#D4A017"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
          <polygon data-k="cone" points="236,62 264,62 292,232 208,232" fill="url(#kr-cone)" />
        </g>

        {/* hanging shop sign (moved up/right so jars + rays clear it) */}
        <g data-k="sign" transform="rotate(-3 182 58)">
          <rect x="170" y="58" width="180" height="36" rx="6" fill="#0F2040" />
          <rect x="170" y="58" width="180" height="36" rx="6" fill="none" stroke="#D4A017" strokeWidth="1.5" opacity="0.6" />
          <text x="260" y="82" textAnchor="middle" fontSize="17" fill="#FDFAF4" fontFamily="Georgia, serif" fontWeight="bold">
            Sharma Kirana
          </text>
        </g>

        {/* shelves with jars */}
        <g data-k="shelves">
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect data-k={`plank-${row + 1}`} x="70" y={128 + row * 34} width="150" height="6" rx="3" fill="#8B6914" />
              {[0, 1, 2, 3].map((i) => (
                <Jar key={i} row={row} i={i} />
              ))}
            </g>
          ))}
        </g>

        {/* shopkeeper (rigged) */}
        <g data-k="keeper">
          <g data-k="armL">
            <rect x="356" y="184" width="16" height="30" rx="8" fill="#E8771A" />
            <rect x="352" y="206" width="13" height="20" rx="6" fill="#E8771A" />
            <circle data-k="handL" cx="358" cy="228" r="8" fill="#4A3728" />
          </g>
          <g data-k="body">
            <rect x="368" y="178" width="48" height="54" rx="10" fill="#E8771A" />
            <path d="M380 186 h24" stroke="#B85A00" strokeWidth="2" strokeLinecap="round" />
          </g>
          <rect data-k="neck" x="384" y="166" width="16" height="12" rx="3" fill="#4A3728" />
          <g data-k="head">
            <circle cx="392" cy="150" r="20" fill="#4A3728" />
            <path d="M373 146 Q376 128 392 127 Q408 128 411 146 Q402 136 392 136 Q382 136 373 146 Z" fill="#1A1209" />
            <circle data-k="ear" cx="372" cy="151" r="3" fill="#4A3728" stroke="#1A1209" strokeWidth="1" />
            <g data-k="eyeL">
              <circle cx="385" cy="148" r="3" fill="#FDFAF4" />
              <circle data-k="pupilL" cx="385" cy="148.5" r="1.4" fill="#1A1209" />
            </g>
            <g data-k="eyeR">
              <circle cx="399" cy="148" r="3" fill="#FDFAF4" />
              <circle data-k="pupilR" cx="399" cy="148.5" r="1.4" fill="#1A1209" />
            </g>
            <line data-k="browL" x1="381" y1="140" x2="389" y2="140" stroke="#1A1209" strokeWidth="1.8" strokeLinecap="round" />
            <line data-k="browR" x1="395" y1="140" x2="403" y2="140" stroke="#1A1209" strokeWidth="1.8" strokeLinecap="round" />
            <path data-k="mouth" d="M386 158 Q392 162 398 158" stroke="#FDFAF4" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
          <g data-k="armR">
            <rect x="412" y="184" width="16" height="30" rx="8" fill="#E8771A" />
            <rect x="415" y="206" width="13" height="20" rx="6" fill="#E8771A" />
            <circle data-k="handR" cx="415" cy="228" r="8" fill="#4A3728" />
            <rect data-k="thumb" x="419" y="216" width="5" height="9" rx="2" fill="#4A3728" />
          </g>
        </g>

        {/* counter */}
        <g data-k="counter">
          <rect x="40" y="232" width="420" height="110" rx="10" fill="#8B6914" />
          <rect x="40" y="232" width="420" height="14" rx="7" fill="#A67C2A" />
          <line x1="48" y1="262" x2="452" y2="262" stroke="#6E5210" strokeWidth="1.5" opacity="0.25" />
          <line x1="48" y1="282" x2="452" y2="282" stroke="#6E5210" strokeWidth="1.5" opacity="0.25" />
          <line x1="48" y1="302" x2="452" y2="302" stroke="#6E5210" strokeWidth="1.5" opacity="0.25" />
          <line x1="48" y1="240" x2="452" y2="240" stroke="#FDFAF4" strokeWidth="1.5" opacity="0.35" />
          <ellipse cx="155" cy="322" rx="80" ry="6" fill="#1A1209" opacity="0.22" />
          <ellipse cx="293" cy="338" rx="42" ry="5" fill="#1A1209" opacity="0.22" />
          <ellipse cx="60" cy="230" rx="16" ry="3" fill="#1A1209" opacity="0.22" />
        </g>

        {/* open bahi-khata */}
        <g data-k="ledger">
          <rect data-k="cover" x="80" y="252" width="150" height="66" rx="4" fill="#C0392B" />
          <rect data-k="pageL" x="86" y="256" width="66" height="58" rx="2" fill="#FFF9F0" />
          <rect data-k="pageR" x="152" y="256" width="66" height="58" rx="2" fill="#FFF9F0" />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} data-k="rule" d={`M91 ${266 + i * 11} H147`} stroke="#C9B99A" strokeWidth="1.4" />
          ))}
          <g data-k="entries">
            <text x="158" y="272" fontSize="9" fill="#4A3728" fontFamily="'JetBrains Mono', monospace">320</text>
            <text x="158" y="283" fontSize="9" fill="#4A3728" fontFamily="'JetBrains Mono', monospace">1,200</text>
            <text x="158" y="294" fontSize="9" fill="#2D6A4F" fontFamily="'JetBrains Mono', monospace">paid</text>
          </g>
          <path data-k="corner" d="M212 256 q6 6 2 14 q-6 -2 -8 -8 q-1 -4 6 -6" fill="#FFF8E7" stroke="#C9B99A" strokeWidth="1" />
        </g>

        {/* phone with WhatsApp */}
        <g data-k="phone">
          <rect data-k="phonebody" x="258" y="246" width="70" height="88" rx="10" fill="#1A1209" />
          <rect data-k="screen" x="262" y="250" width="62" height="80" rx="7" fill="#E5DDD5" />
          <rect data-k="header" x="262" y="250" width="62" height="16" rx="7" fill="#128C7E" />
          <circle data-k="dot-status" cx="270" cy="258" r="4" fill="#25D366" />
          <text x="278" y="261" fontSize="7" fill="#fff" fontFamily="Inter, sans-serif">VyapaarAI</text>
          <g data-k="bubble">
            <rect x="266" y="272" width="54" height="26" rx="6" fill="#fff" stroke="#E8DDD0" strokeWidth="1" />
            <text data-k="bubble-t1" x="271" y="282" fontSize="7" fill="#1A1209" fontFamily="Inter, sans-serif">Bill read!</text>
            <text data-k="bubble-t2" x="271" y="291" fontSize="6.5" fill="#2D6A4F" fontFamily="Inter, sans-serif">+ Rs.2,340</text>
            <circle data-k="dot" cx="270" cy="306" r="2.4" fill="#8B7355" />
            <circle data-k="dot" cx="277" cy="306" r="2.4" fill="#8B7355" />
            <circle data-k="dot" cx="284" cy="306" r="2.4" fill="#8B7355" />
          </g>
        </g>

        {ready ? <KiranaExtras /> : null}
      </svg>
    </div>
  );
}
