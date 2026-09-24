"use client";

/** Shared GSAP setup for the landing: plugin registration + reduced-motion gate. */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const EASE_EXPO = "expo.out";

export function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Smooth-scroll to an anchor: native (Lenis intercepts natively-smooth scrolls
 *  via the global provider; direct lenis instance intentionally not duplicated). */
export function scrollToId(id: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    el.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
  } catch {
    el.scrollIntoView();
  }
}
