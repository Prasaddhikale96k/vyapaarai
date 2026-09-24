"use client";

/**
 * useCountUp — landing-only count-up hook (ANTI-BLANK: SSR renders the final
 * value; the effect rewinds to `from` and counts only after `start` flips).
 * rAF + power2.out easing. Any failure leaves the final value on screen.
 */

import { useEffect, useRef, useState } from "react";

export function formatIN(v: number): string {
  try {
    return Math.round(v).toLocaleString("en-IN");
  } catch {
    return String(Math.round(v));
  }
}

export function useCountUp(opts: {
  from: number;
  to: number;
  duration?: number;
  start: boolean;
  format: (v: number) => string;
}): string {
  const { from, to, duration = 1500, start, format } = opts;
  const [display, setDisplay] = useState<string>(() => {
    try {
      return format(to);
    } catch {
      return String(to);
    }
  });
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!start) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (from === to) return;
    let stopped = false;
    const t0 = performance.now();
    const tick = (now: number) => {
      if (stopped) return;
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 2); // power2.out
      const v = from + (to - from) * eased;
      try {
        setDisplay(format(v));
      } catch {
        /* keep last good value */
      }
      if (p < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        try {
          setDisplay(format(to));
        } catch {
          /* keep last good value */
        }
      }
    };
    try {
      setDisplay(format(from));
    } catch {
      /* ignore */
    }
    raf.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf.current);
    };
  }, [start, from, to, duration, format]);

  return display;
}

/** Starts `true` once the element scrolls into view (once). */
export function useInViewOnce<T extends HTMLElement>(threshold = 0.3): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          ob.disconnect();
        }
      },
      { threshold }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}
