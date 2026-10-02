"use client";

/**
 * Motion registry — GSAP plugins + ledger-physics eases + env gates.
 * Registered ONCE. All builders import from here and never call
 * gsap.registerPlugin themselves. GSAP >= 3.13 ships every plugin free
 * in the npm package, so static imports are safe and standard.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";

let registered = false;
let easesReady = false;

export function registry(): void {
  if (typeof window === "undefined" || registered) return;
  try {
    gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, MotionPathPlugin, SplitText, CustomEase);
    registered = true;
    try {
      CustomEase.create("kOut", "0.16,1,0.3,1");
      CustomEase.create("kSettle", "0.34,1.4,0.64,1");
      CustomEase.create("kPen", "0.45,0,0.15,1");
      CustomEase.create("kSnap", "0.7,0,0.2,1");
      easesReady = true;
    } catch {
      /* named eases fall back per-tween */
    }
  } catch {
    /* static page stays */
  }
}

export const EASE_KOUT = "kOut";
export const EASE_KSETTLE = "kSettle";
export const EASE_KPEN = "kPen";
export const EASE_KSNAP = "kSnap";

/** Resolve a named ease with a built-in fallback (used before CustomEase registers). */
export function easeOr(name: string, fallback: string): string {
  return easesReady ? name : fallback;
}

export function isDrawSVGAvailable(): boolean {
  return registered;
}

export function isMotionPathAvailable(): boolean {
  return registered;
}

export function isSplitTextAvailable(): boolean {
  return registered;
}

export function isReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function isCoarse(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function isMobile(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches
  );
}

export function isFineDesktop(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches
  );
}
