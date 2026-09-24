"use client";

/**
 * THE INK LINE — safe version (P12.10 Section F).
 *
 * NO fixed full-viewport layer. Each section renders its own inline
 * <SectionInk> placed at the section margin/edge or inside a card, behind
 * content (absolute, z-0, pointer-events-none). Same emerald/marigold
 * identity everywhere so it reads as one pen across the page.
 * Light #059669 via --ink-line / dark #10B981. Mobile hides complex
 * segments (CSS), reduced-motion leaves every path fully drawn and static.
 */

import { DrawPath } from "@/components/reveal";

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
