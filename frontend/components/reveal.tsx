"use client";

/**
 * ANTI-BLANK primitives (P12.10 Section E).
 *
 * LAW: the static/SSR DOM is ALWAYS fully visible. No opacity-0, no
 * translated-offscreen, no clip-hidden in markup or CSS defaults. Hiding is
 * applied ONLY inside useGSAP after mount (gsap.from with
 * immediateRender:false), and the reveal ScrollTrigger is registered in the
 * same tick. A global <Watchdog/> forces anything stuck back to visible.
 *
 * Skill rules honored:
 * - gsap-scrolltrigger: triggers top-level only, start 'top 95%' or earlier,
 *   once:true for entrances, ease expo/none as appropriate.
 * - gsap-react: useGSAP + scope, auto cleanup, client-only (no SSR measure).
 * - svg-animation: pathLength=1 draw-on normalization, strokes only.
 * - accessible-animation: reduced-motion => skip everything, static final state.
 * - 60fps-animation: transform + opacity only, no layout properties.
 */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);

export const HOUSE_EASE = "expo.out";

function motionOK() {
  return (
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* Generic entrance: SSR-visible block, mount-only gsap.from reveal. */
export function Reveal({
  children,
  variant = "rise",
  delay = 0,
  y = 26,
  className = "",
}: {
  children: ReactNode;
  variant?: "rise" | "clip";
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!motionOK()) return;
      const el = ref.current;
      if (!el) return;
      if (variant === "clip") {
        gsap.from(el, {
          clipPath: "inset(0 0 100% 0)",
          duration: 0.7,
          ease: HOUSE_EASE,
          delay,
          immediateRender: false,
          scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
      } else {
        gsap.from(el, {
          y,
          autoAlpha: 0,
          duration: 0.65,
          ease: HOUSE_EASE,
          delay,
          immediateRender: false,
          scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
      }
    },
    { scope: ref }
  );
  return (
    <div ref={ref} data-reveal className={className}>
      {children}
    </div>
  );
}

/* Masked word-by-word heading reveal. SSR: plain visible words, no hiding. */
export function MaskWords({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      if (!motionOK()) return;
      const root = ref.current;
      if (!root) return;
      const words = root.querySelectorAll(".mw-w");
      if (!words.length) return;
      gsap.from(words, {
        yPercent: 110,
        duration: 0.65,
        ease: HOUSE_EASE,
        stagger: 0.06,
        delay,
        immediateRender: false,
        scrollTrigger: { trigger: root, start: "top 95%", once: true },
      });
    },
    { scope: ref }
  );
  const parts = text.split(" ");
  return (
    <span ref={ref} data-reveal className={className}>
      {parts.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className="mw-w inline-block">
            {w}
            {i < parts.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

/* SVG draw-on. SSR: full path rendered (visible). Mount-only dash animation. */
export function DrawPath({
  d,
  stroke = "var(--ink-line)",
  width = 2,
  duration = 1.2,
  delay = 0,
  className = "",
}: {
  d: string;
  stroke?: string;
  width?: number;
  duration?: number;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<SVGPathElement>(null);
  useGSAP(
    () => {
      if (!motionOK()) return;
      const p = ref.current;
      if (!p) return;
      gsap.fromTo(
        p,
        { strokeDasharray: 1, strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          duration,
          delay,
          ease: "none",
          immediateRender: false,
          scrollTrigger: { trigger: p, start: "top 95%", once: true },
        }
      );
    },
    { scope: ref }
  );
  return (
    <path
      ref={ref}
      data-reveal
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      className={className}
    />
  );
}

/**
 * DEAD-MAN'S SWITCH (E4). After 1.5s (and again at 3s), any in-viewport
 * [data-reveal] element still computing to opacity 0 is forced visible via
 * .ink-shown (!important beats stuck inline styles). Below-fold elements are
 * left alone so scroll reveals keep working.
 */
export function Watchdog() {
  useEffect(() => {
    let cancelled = false;
    const sweep = () => {
      if (cancelled) return;
      try {
        const vh = window.innerHeight;
        document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top >= vh || r.bottom <= 0) return;
          const op = window.getComputedStyle(el).opacity;
          if (op === "0") el.classList.add("ink-shown");
        });
      } catch {
        /* never break the page for a safety net */
      }
    };
    const t1 = setTimeout(sweep, 1500);
    const t2 = setTimeout(sweep, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  return null;
}
