"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis + ScrollTrigger wiring (Rule 3):
 * lenis.on('scroll', ScrollTrigger.update) + gsap.ticker drives lenis.raf.
 * No separate requestAnimationFrame loop. Refresh after fonts/layout settle.
 * Reduced motion: no Lenis at all (Tier 1 removal per accessible-animation skill).
 */
export function Smooth({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const tick = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      const onFonts = () => {
        try {
          ScrollTrigger.refresh();
        } catch {
          /* ignore */
        }
      };
      if (document.fonts?.ready) {
        document.fonts.ready.then(onFonts).catch(() => {});
      }
      const t = setTimeout(onFonts, 900);
      return () => {
        clearTimeout(t);
        try {
          gsap.ticker.remove(tick);
          lenis.destroy();
        } catch {
          /* ignore */
        }
      };
    } catch {
      return;
    }
  }, []);
  return <>{children}</>;
}
