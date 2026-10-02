"use client";

/**
 * Section builders — one pure builder per section (Phase 1: EMPTY).
 * Selectors by [data-m] attribute only. Tier-A choreography lands in
 * Phases 2–7. Empty builders prove MotionScope wiring is layout-identical.
 */

import type { BuildFn } from "../MotionScope";

function empty(): BuildFn {
  return () => undefined;
}

export const buildNav: BuildFn = empty();
export const buildHero: BuildFn = empty();
export const buildMarquee: BuildFn = empty();
export const buildProblem: BuildFn = empty();
export const buildWhatsapp: BuildFn = empty();
export const buildHowItWorks: BuildFn = empty();
export const buildDemoNumbers: BuildFn = empty();
export const buildBento: BuildFn = empty();
export const buildVoice: BuildFn = empty();
export const buildFestival: BuildFn = empty();
export const buildSoul: BuildFn = empty();
export const buildHitl: BuildFn = empty();
export const buildTestimonials: BuildFn = empty();
export const buildCta: BuildFn = empty();
export const buildFooter: BuildFn = empty();
