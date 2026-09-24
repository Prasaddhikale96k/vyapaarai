"use client";

/**
 * THE INK LINE — safe version (P12.10 Section F + R10).
 *
 * NO fixed full-viewport layer. Each section renders its own inline
 * <SectionInk> placed at the section margin/edge or inside a card, behind
 * content (absolute, z-0, pointer-events-none). Same emerald/marigold
 * identity everywhere so it reads as one pen across the page.
 * Light #059669 via --ink-line / dark #10B981. Mobile hides complex
 * segments (CSS), reduced-motion leaves every path fully drawn and static.
 */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { DrawPath, HOUSE_EASE } from "@/components/reveal";

gsap.registerPlugin(ScrollTrigger);

export function SectionInk({
  d,
  viewBox = "0 0 400 120",
  className = "",
  accent = false,
  width = 2,
  duration = 1.4,
  delay = 0,
  /** inFlow renders the flourish inline (e.g. headline underline) instead of absolute. */
  inFlow = false,
}: {
  d: string;
  viewBox?: string;
  className?: string;
  accent?: boolean;
  width?: number;
  duration?: number;
  delay?: number;
  inFlow?: boolean;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={inFlow ? className : `section-ink ${className}`}
      style={inFlow ? { display: "block", opacity: 0.85 } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <DrawPath
        d={d}
        stroke={accent ? "#F59E0B" : "var(--ink-line)"}
        width={width}
        duration={duration}
        delay={delay}
      />
    </svg>
  );
}

/**
 * HERO KILLER MOMENT (R10): giant Devanagari brand word drawn as SVG text
 * behind the headline. SSR renders it faint and fully visible; mount-only
 * GSAP measures, draws the stroke (1.8s), then fades the fill to 10%.
 */
export function VyapaarWatermark({ className = "" }: { className?: string }) {
  const ref = useRef<SVGTextElement>(null);
  useGSAP(
    () => {
      const t = ref.current;
      if (!t) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let len = 2000;
      try {
        const m = (t as unknown as SVGGeometryElement).getTotalLength();
        if (m > 0) len = m;
      } catch {
        /* keep estimate */
      }
      gsap.set(t, { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 });
      const tl = gsap.timeline();
      tl.to(t, { strokeDashoffset: 0, duration: 1.8, ease: HOUSE_EASE });
      tl.to(t, { fillOpacity: 0.1, duration: 0.6, ease: HOUSE_EASE }, "+=0.3");
    },
    { scope: ref }
  );
  return (
    <svg
      viewBox="0 0 800 200"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <text
        ref={ref}
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="var(--font-devanagari), 'Tiro Devanagari Hindi', serif"
        fontSize="180"
        fontWeight="400"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
        className="text-emerald-600 dark:text-emerald-400"
      >
        व्यापार
      </text>
    </svg>
  );
}

/** Small handwritten-style brand signature (S7 ink accent). */
export function VyapaarSign({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 60" preserveAspectRatio="xMidYMid meet" className={className}
      aria-hidden="true" focusable="false">
      <DrawPath
        d="M20 40 C 60 38, 90 20, 120 30 S 160 45, 185 25"
        stroke="var(--ink-line)"
        width={2.5}
        duration={1}
      />
      <text
        x="100"
        y="52"
        textAnchor="middle"
        fontFamily="var(--font-devanagari), 'Tiro Devanagari Hindi', serif"
        fontSize="22"
        fill="var(--ink-soft)"
      >
        व्यापार
      </text>
    </svg>
  );
}
