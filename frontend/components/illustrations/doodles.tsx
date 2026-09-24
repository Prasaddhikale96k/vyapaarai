"use client";

/**
 * Ink doodle library (R9b). Hand-coded 2px wobbly-stroke SVGs, round caps,
 * currentColor stroke, no fill except stamp text. Paths carry data-draw for
 * GSAP stroke draw-in. Static under prefers-reduced-motion.
 */

import { useEffect, type RefObject } from "react";

type P = { className?: string };

function Svg({ className = "w-24 h-24", viewBox, children }: P & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg viewBox={viewBox} className={className} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function useIdleFloat(ref: RefObject<SVGSVGElement | null>) {
  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const e = (t - t0) / 1000;
      if (ref.current) {
        ref.current.style.transform = `translateY(${(Math.sin(e * 1.7) * 2).toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}

/* Mascot: spectacles, mustache, topi, fountain pen, khata book. */
export function Munshi({ className }: P) {
  return (
    <Svg viewBox="0 0 120 140" className={className}>
      <circle cx="60" cy="38" r="24" data-draw />
      <circle cx="52" cy="36" r="8" data-draw />
      <circle cx="68" cy="36" r="8" data-draw />
      <path d="M60 36 L60 44" data-draw />
      <path d="M44 50 Q50 47 55 50 T60 53 T65 50 Q70 47 76 50" data-draw />
      <path d="M37 30 Q60 14 83 30" data-draw />
      <path d="M37 30 Q36 22 44 21 M83 30 Q84 22 76 21" data-draw />
      <rect x="38" y="64" width="44" height="58" rx="5" data-draw />
      <path d="M70 78 L92 66" strokeWidth="3" data-draw />
      <path d="M92 66 L95 62" strokeWidth="3" data-draw />
      <rect x="46" y="88" width="22" height="26" rx="2" data-draw />
      <path d="M50 95 L64 95 M50 101 L64 101 M50 107 L60 107" strokeWidth="1.2" data-draw />
    </Svg>
  );
}

/* Shop front: rolled shutter half-up, 3 boxes, hanging scale. */
export function KiranaStore({ className }: P) {
  return (
    <Svg viewBox="0 0 160 120" className={className}>
      <path d="M14 112 L14 30 Q14 22 22 22 L138 22 Q146 22 146 30 L146 112" data-draw />
      <path d="M14 44 L146 44" data-draw />
      <path d="M22 44 L22 30 M34 44 L34 30 M46 44 L46 30 M58 44 L58 30 M70 44 L70 30 M82 44 L82 30 M94 44 L94 30 M106 44 L106 30 M118 44 L118 30 M130 44 L130 30" strokeWidth="1.2" data-draw />
      <rect x="24" y="70" width="26" height="22" rx="2" data-draw />
      <rect x="56" y="62" width="26" height="30" rx="2" data-draw />
      <rect x="88" y="74" width="26" height="18" rx="2" data-draw />
      <path d="M132 50 L132 58 M126 58 L138 58 M132 58 L132 70" data-draw />
      <path d="M124 70 L140 70 L136 80 L128 80 Z" data-draw />
      <path d="M60 112 L100 112 M60 112 L60 100 M100 112 L100 100" data-draw />
    </Svg>
  );
}

/* Open ledger + magnifier over Rs.53,400 entry. */
export function UdhaarKhata({ className }: P) {
  return (
    <Svg viewBox="0 0 100 100" className={className}>
      <path d="M12 20 Q30 14 50 20 Q70 14 88 20 L86 78 Q68 72 50 78 Q32 72 14 78 Z" data-draw />
      <path d="M50 20 L50 78" data-draw />
      <path d="M20 34 L42 34 M20 42 L42 42 M58 34 L80 34" strokeWidth="1.2" data-draw />
      <circle cx="66" cy="58" r="14" data-draw />
      <path d="M76 68 L88 80" strokeWidth="3" data-draw />
      <path d="M60 58 L72 58 M66 52 L66 64" strokeWidth="1.4" data-draw />
    </Svg>
  );
}

/* Stack of 6 coins, Rs. symbol on top. */
export function RupeeCoins({ className }: P) {
  return (
    <Svg viewBox="0 0 80 80" className={className}>
      {[58, 52, 46, 40, 34].map((y) => (
        <ellipse key={y} cx="40" cy={y} rx="22" ry="7" data-draw />
      ))}
      <ellipse cx="40" cy="28" rx="22" ry="7" data-draw />
      <path d="M34 24 L46 24 M34 24 L34 28 L42 32 M40 24 L40 34" strokeWidth="1.6" data-draw />
    </Svg>
  );
}

/* Cutting chai glass + 3 steam lines. */
export function ChaiGlass({ className }: P) {
  return (
    <Svg viewBox="0 0 60 90" className={className}>
      <path d="M16 28 L22 76 Q22 80 26 80 L34 80 Q38 80 38 76 L44 28" data-draw />
      <path d="M14 28 Q30 24 46 28" data-draw />
      <path d="M19 44 Q41 44 40 50" strokeWidth="1.2" data-draw />
      <path d="M22 12 Q19 7 22 2 M30 13 Q27 7 30 1 M38 12 Q35 7 38 2" strokeWidth="1.4" data-draw />
    </Svg>
  );
}

/* Scooter side view, delivery box, motion lines. */
export function Scooter({ className }: P) {
  return (
    <Svg viewBox="0 0 140 80" className={className}>
      <circle cx="34" cy="58" r="13" data-draw />
      <circle cx="106" cy="58" r="13" data-draw />
      <path d="M34 58 L52 58 Q58 40 74 38 L88 38 L96 56" data-draw />
      <path d="M74 38 L70 24 L84 24 L88 38" data-draw />
      <rect x="96" y="22" width="28" height="24" rx="3" data-draw />
      <path d="M102 30 L118 30 M102 36 L112 36" strokeWidth="1.2" data-draw />
      <path d="M8 44 L20 44 M4 54 L16 54 M8 64 L20 64" strokeWidth="1.4" data-draw />
    </Svg>
  );
}

/* Phone outline with WhatsApp bubbles. */
export function WhatsAppPhone({ className }: P) {
  return (
    <Svg viewBox="0 0 70 120" className={className}>
      <rect x="8" y="4" width="54" height="112" rx="10" data-draw />
      <path d="M30 10 L40 10" strokeWidth="3" data-draw />
      <rect x="14" y="22" width="34" height="12" rx="6" data-draw />
      <rect x="22" y="38" width="34" height="16" rx="8" data-draw />
      <rect x="14" y="58" width="28" height="12" rx="6" data-draw />
      <circle cx="35" cy="104" r="5" data-draw />
    </Svg>
  );
}

/* 6 product doodles, ~50px. */
export function RiceSack({ className }: P) {
  return (
    <Svg viewBox="0 0 50 50" className={className}>
      <path d="M12 18 Q25 12 38 18 L36 42 Q25 46 14 42 Z" data-draw />
      <path d="M12 18 Q10 10 18 12 M38 18 Q40 10 32 12" data-draw />
      <path d="M20 26 L30 26 M19 32 L31 32" strokeWidth="1.2" data-draw />
    </Svg>
  );
}
export function OilBottle({ className }: P) {
  return (
    <Svg viewBox="0 0 50 50" className={className}>
      <rect x="21" y="6" width="8" height="7" rx="1" data-draw />
      <path d="M21 13 L17 24 L17 42 Q17 45 20 45 L30 45 Q33 45 33 42 L33 24 L29 13" data-draw />
      <path d="M21 28 Q25 30 29 28" strokeWidth="1.2" data-draw />
    </Svg>
  );
}
export function SoapBar({ className }: P) {
  return (
    <Svg viewBox="0 0 50 50" className={className}>
      <rect x="8" y="18" width="34" height="16" rx="8" data-draw />
      <path d="M16 26 Q25 22 34 26" strokeWidth="1.2" data-draw />
    </Svg>
  );
}
export function BiscuitPack({ className }: P) {
  return (
    <Svg viewBox="0 0 50 50" className={className}>
      <rect x="12" y="10" width="26" height="30" rx="3" data-draw />
      <path d="M12 16 L38 16 M12 34 L38 34" strokeWidth="1.2" data-draw />
      <circle cx="25" cy="25" r="5" data-draw />
    </Svg>
  );
}
export function MilkPouch({ className }: P) {
  return (
    <Svg viewBox="0 0 50 50" className={className}>
      <path d="M15 12 L35 12 L33 42 Q25 45 17 42 Z" data-draw />
      <path d="M15 12 Q25 8 35 12" data-draw />
      <path d="M21 24 Q25 26 29 24" strokeWidth="1.2" data-draw />
    </Svg>
  );
}
export function MasalaDabba({ className }: P) {
  return (
    <Svg viewBox="0 0 50 50" className={className}>
      <ellipse cx="25" cy="32" rx="16" ry="10" data-draw />
      <path d="M9 32 Q25 26 41 32" data-draw />
      <circle cx="19" cy="32" r="3" data-draw />
      <circle cx="27" cy="33" r="3" data-draw />
      <circle cx="34" cy="31" r="2.4" data-draw />
    </Svg>
  );
}

/* Stamp marks: rough double outline + text, rotated. */
function Stamp({ className, label, color, rotate }: P & { label: string; color: string; rotate: number }) {
  return (
    <span
      className={`inline-block rounded-md border-2 px-2 py-0.5 font-display text-sm font-bold tracking-widest ${className ?? ""}`}
      style={{ borderColor: color, color, transform: `rotate(${rotate}deg)`, maskImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='30'%3E%3Cfilter id='r'%3E%3CfeTurbulence baseFrequency='0.6'/%3E%3C/filter%3E%3Crect width='60' height='30' filter='url(%23r)' opacity='0.25'/%3E%3C/svg%3E\")" }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
export function StampPaid({ className }: P) {
  return <Stamp label="PAID" color="#059669" rotate={-8} className={className} />;
}
export function StampOverdue({ className }: P) {
  return <Stamp label="OVERDUE" color="#E11D48" rotate={8} className={className} />;
}
export function StampOK({ className }: P) {
  return <Stamp label="OK" color="#F59E0B" rotate={-8} className={className} />;
}

/* Hand-drawn 7-point sparkline. */
export function Sparkline({ className }: P) {
  return (
    <Svg viewBox="0 0 100 30" className={className}>
      <path d="M4 24 Q12 23 16 20 T28 18 T40 19 T52 13 T64 14 T76 8 T92 6" data-draw />
      <circle cx="92" cy="6" r="3" data-draw />
    </Svg>
  );
}
