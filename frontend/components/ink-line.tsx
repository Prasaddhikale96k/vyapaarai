"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * THE INK LINE — signature narrative spine (Section E).
 * One fixed full-viewport SVG layer, section-anchored .ink-segment paths
 * with data-section="#id", scrub-drawn via top-level ScrollTriggers.
 * - svg-animation skill: pathLength=1 normalization (no getTotalLength SSR risk),
 *   dashoffset animated to 0; strokes only (fill:none).
 * - gsap-scrolltrigger skill: all triggers top-level, never nested in a parent
 *   timeline; ease:'none' for scrub; refreshPriority in page order.
 * - gsap-react skill: useGSAP with scope + auto cleanup; client-only.
 * - gsap-performance: transform/opacity only, no layout props.
 * - accessible-animation: reduced-motion => fully drawn static, no scrub.
 * - 60fps: will-change avoided; single fixed layer with translateZ(0).
 * Light #059669 / dark #10B981 via CSS var --ink-line.
 */
export function InkLine() {
  const inkRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const segs = gsap.utils.toArray<SVGPathElement>(".ink-segment");
      if (reduce) {
        // Fully drawn, static — vestibular-safe.
        segs.forEach((p) => gsap.set(p, { strokeDasharray: 1, strokeDashoffset: 0 }));
        return;
      }
      segs.forEach((path, i) => {
        // pathLength=1 trick: dasharray/offset in 0..1, no measurement needed.
        // Guard: S0 preloader unmounts after boot — fall back to body so
        // ScrollTrigger never warns "trigger not found".
        const sel = path.dataset.section;
        const el = (sel ? document.querySelector(sel) : null) || document.body;
        gsap.set(path, { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.to(path, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: el,
            start: "top center",
            end: "bottom center",
            scrub: 0.6,
            refreshPriority: i,
          },
        });
      });
      const t = setTimeout(() => {
        try {
          ScrollTrigger.refresh();
        } catch {
          /* ignore */
        }
      }, 700);
      return () => clearTimeout(t);
    },
    { scope: inkRef }
  );

  return (
    <svg
      ref={inkRef}
      className="ink-line-layer"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 8000"
      preserveAspectRatio="xMidYMin meet"
    >
      {/* S0 preloader monogram echo */}
      <path
        className="ink-segment"
        data-section="#s0"
        d="M470,40 L500,110 L530,40 M500,110 L500,128"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
      {/* S1 hero: ruled ledger lines + headline underline */}
      <path
        className="ink-segment"
        data-section="#s1"
        d="M120,300 L880,300 M120,380 L880,380 M120,460 L880,460 M220,620 C 400,640 600,600 780,624"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S1 accent: marigold underline flourish */}
      <path
        className="ink-segment ink-accent"
        data-section="#s1"
        d="M330,668 C 470,682 620,656 700,664"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S2 marquee: connecting swash */}
      <path
        className="ink-segment"
        data-section="#s2"
        d="M60,1050 C 300,1010 700,1090 940,1040"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S3 scrollytelling: message tail -> chart line */}
      <path
        className="ink-segment"
        data-section="#s3"
        d="M180,1400 C 220,1500 160,1600 260,1700 C 360,1800 520,1780 640,1900 C 720,1970 780,2050 760,2140"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S4 bento: chart axis + connecting flourish */}
      <path
        className="ink-segment"
        data-section="#s4"
        d="M140,2500 L140,2900 L860,2900 M140,2900 C 340,2850 560,2950 860,2860"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S5 mini-demo: message connector thread */}
      <path
        className="ink-segment"
        data-section="#s5"
        d="M480,3300 C 430,3450 560,3550 500,3700 C 470,3780 430,3840 460,3920"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
      {/* S6 stats: sparklines */}
      <path
        className="ink-segment"
        data-section="#s6"
        d="M120,4300 C 300,4280 400,4240 520,4250 M560,4300 C 680,4280 780,4240 900,4250"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S7 quote: attribution underline */}
      <path
        className="ink-segment"
        data-section="#s7"
        d="M300,4900 C 450,4920 600,4880 720,4900"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
      {/* S8 final CTA: draws into a check */}
      <path
        className="ink-segment"
        data-section="#s8"
        d="M380,5400 C 500,5500 600,5600 660,5750 M660,5750 L700,5810 L780,5690"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
      />
      {/* Mobile simplification: slim margin path (visible <=768px only) */}
      <path
        className="ink-segment ink-mobile"
        data-section="#s1"
        d="M40,0 L40,8000"
        fill="none"
        stroke="var(--ink-line)"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
      />
    </svg>
  );
}
