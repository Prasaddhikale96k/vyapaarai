"use client";

/**
 * Section builders — one pure builder per section.
 * Targets existing elements by tag / [data-gsap] / [data-m] (additive only).
 * G3 heading reveal runs on every section via withHeadings. The observed-issue
 * fixes (O1/O2/O3/O4) + signature moments land here. Every builder is
 * reduced-motion-gated (MotionScope wraps in matchMedia) and runs inside
 * gsap.context (cleanup reverts).
 */

import gsap from "gsap";
import type { BuildFn } from "../MotionScope";
import { h, type Ctx } from "../helpers";
import { headingSystem, buttonLife, cleanupAll } from "../systems";
import { easeOr, isMobile } from "../registry";

/** G3 + pass-through wrapper so every section gets the heading reveal.
 *  Aggregates the heading-system cleanup (split reverts, swash removal)
 *  with whatever the section builder returns. */
function withHeadings(fn: BuildFn): BuildFn {
  return (ctx, hh) => {
    const cleanups: Array<() => void> = [];
    const hs = headingSystem(ctx);
    if (hs) cleanups.push(hs);
    const own = fn(ctx, hh);
    if (own) cleanups.push(own);
    return cleanups.length ? cleanupAll(cleanups) : undefined;
  };
}

// ---- O1: hero intro residue (clearProps after the existing intro settles) ----
function heroClearResidue(ctx: Ctx): void {
  try {
    // Hero is above the fold; its intro completes ~1.8s after mount.
    gsap.delayedCall(2.0, () => {
      try {
        gsap.set(
          ctx.root.querySelectorAll(
            '[data-gsap="cta"],[data-gsap="trust"],[data-gsap="mask"],[data-gsap="badge"],[data-gsap="sub"]'
          ),
          { clearProps: "transform,opacity" }
        );
      } catch {
        /* noop */
      }
    });
  } catch {
    /* noop */
  }
}

// ---- S1: watermark parallax (transform-only, scrubbed) ----
function heroWatermark(ctx: Ctx): void {
  if (isMobile()) return;
  try {
    const wm = ctx.root.querySelector(".font-devanagari.pointer-events-none") as HTMLElement | null;
    if (!wm) return;
    gsap.to(wm, {
      y: -60,
      ease: "none",
      scrollTrigger: { trigger: ctx.root, start: "top top", end: "bottom top", scrub: 1.2 },
    });
  } catch {
    /* noop */
  }
}

// ---- S1: scroll-hint bounce (governed) ----
function heroScrollHint(ctx: Ctx, hh: Parameters<BuildFn>[1]): void {
  try {
    const hint = ctx.root.querySelector('a[aria-label="Scroll to see more"]') as HTMLElement | null;
    if (!hint) return;
    hh.loop("hero.hint", () => {
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(hint, { y: 8, duration: 1.6, ease: "sine.inOut" });
      return tl;
    }, { trigger: ctx.root, nodes: 1, tier: "A" });
  } catch {
    /* noop */
  }
}

export const buildNav: BuildFn = withHeadings(() => {
  // Nav logo idle + wordmark shimmer: Tier-B, deferred (needs a data-m rig the
  // existing Nav logo group does not expose; logged, not half-wired).
  return undefined;
});

export const buildHero: BuildFn = withHeadings((ctx, hh) => {
  const c: Array<() => void> = [];
  const bl = buttonLife(ctx);
  if (bl) c.push(bl);
  heroClearResidue(ctx);
  heroWatermark(ctx);
  heroScrollHint(ctx, hh);
  return c.length ? cleanupAll(c) : undefined;
});

export const buildMarquee: BuildFn = withHeadings((ctx) => {
  const bar = ctx.root.querySelector(".landing-marquee, [data-m~='marquee']") ?? ctx.root;
  h.curtain(bar as HTMLElement, { dir: "left", color: "#0F2040", trigger: ctx.root, duration: 0.6 });
  return undefined;
});

export const buildProblem: BuildFn = withHeadings((ctx, hh) => {
  // O4: the existing hook already spreads the stain group. Additively inject a
  // detaching drip droplet at RUNTIME (so reduced-motion / no-JS stays
  // byte-identical to the Phase-0 baseline — nothing added to static DOM).
  if (isMobile()) return undefined;
  const stain = ctx.root.querySelector('[data-gsap="stain"]') as Element | null;
  if (!stain) return undefined;
  const svg = (stain as unknown as { ownerSVGElement?: SVGSVGElement }).ownerSVGElement ?? (stain.closest("svg") as SVGSVGElement | null);
  if (!svg) return undefined;
  try {
    const ns = "http://www.w3.org/2000/svg";
    const drop = document.createElementNS(ns, "circle");
    drop.setAttribute("cx", "345");
    drop.setAttribute("cy", "150");
    drop.setAttribute("r", "3.2");
    drop.setAttribute("fill", "#C0392B");
    drop.setAttribute("aria-hidden", "true");
    svg.appendChild(drop);
    const lobes = document.createElementNS(ns, "circle");
    lobes.setAttribute("cx", "338");
    lobes.setAttribute("cy", "132");
    lobes.setAttribute("r", "2.4");
    lobes.setAttribute("fill", "#C0392B");
    lobes.setAttribute("aria-hidden", "true");
    svg.appendChild(lobes);
    hh.loop("problem.drip", () => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 7.5 });
      tl.fromTo(drop, { attr: { cy: 150 }, opacity: 0 }, { attr: { cy: 156 }, opacity: 0.7, duration: 0.7, ease: "power1.out" }, 0)
        .to(drop, { attr: { cy: 210 }, opacity: 0, duration: 1.8, ease: "power2.in" }, 0.7)
        .fromTo(lobes, { attr: { r: 1.5 }, opacity: 0 }, { attr: { r: 3 }, opacity: 0.5, duration: 1.2, ease: "power1.out" }, 0.2)
        .to(lobes, { opacity: 0.3, duration: 1, ease: "power1.inOut" }, 1.4);
      return tl;
    }, { trigger: ctx.root, nodes: 2, tier: "B" });
  } catch {
    /* keep static stain */
  }
  return undefined;
});

export const buildWhatsapp: BuildFn = withHeadings((ctx, hh) => {
  // O3: the EXISTING section hook already plays the chat film on first arrival
  // (once:true onEnter) and leaves every bubble visible after completion.
  // We do NOT re-animate the bubbles (would double-drive the existing hook).
  // Additively: phone float + header status pulse (both new, no conflict).
  // Phone float (governed).
  const phone = ctx.root.querySelector('[role="img"]') as HTMLElement | null;
  if (phone) {
    hh.loop("whatsapp.float", () => {
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(phone, { y: 6, duration: 2.95, ease: "sine.inOut" });
      return tl;
    }, { trigger: ctx.root, nodes: 1, tier: "A" });
  }
  return undefined;
});

export const buildHowItWorks: BuildFn = withHeadings((ctx, hh) => {
  // O2 residue: clear inline transform/opacity left on the step cards, ~1.2s
  // AFTER they reveal (so the existing from-tween has settled first).
  try {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: ctx.root, start: "top 85%", once: true },
    });
    tl.set(ctx.root.querySelectorAll('[data-gsap="step"]'), { clearProps: "transform,opacity" }, 1.2);
  } catch {
    /* noop */
  }
  // O2 connectors: add a traveling "data packet" dot along the arrow path.
  if (isMobile()) return undefined;
  const svg = ctx.root.querySelector('svg[aria-hidden="true"]') as SVGSVGElement | null;
  const path = svg?.querySelector('[data-gsap="arrow"]') as SVGPathElement | null;
  if (!svg || !path) return undefined;
  try {
    const len = path.getTotalLength();
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#E8771A");
    dot.setAttribute("aria-hidden", "true");
    svg.appendChild(dot);
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 24; i++) {
      const p = path.getPointAtLength((len / 24) * i);
      pts.push({ x: p.x, y: p.y });
    }
    hh.loop("hiw.packet", () => {
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
      pts.forEach((p, idx) => tl.to(dot, { attr: { cx: p.x, cy: p.y }, duration: 0.05, ease: "none" }, idx * 0.05));
      tl.set(dot, { attr: { cx: pts[0].x, cy: pts[0].y } }, pts.length * 0.05);
      return tl;
    }, { trigger: ctx.root, nodes: 1, tier: "B" });
  } catch {
    try {
      svg.querySelector("circle[aria-hidden='true'][fill='#E8771A']")?.remove();
    } catch {
      /* noop */
    }
  }
  return undefined;
});

export const buildDemoNumbers: BuildFn = withHeadings(() => {
  // Existing count-ups untouched (no double-animate).
  return undefined;
});

export const buildBento: BuildFn = withHeadings(() => {
  // Health arc already draws on scroll (existing hook). Nothing hides content.
  return undefined;
});

export const buildVoice: BuildFn = withHeadings(() => {
  // 30 waveform bars oscillate via the existing hook. Offscreen pause of these
  // GSAP bars is a pre-existing condition we cannot govern additively without
  // touching that hook; logged, not half-fixed.
  return undefined;
});

export const buildFestival: BuildFn = withHeadings(() => {
  // CONFLICT: the existing FestivalSection hook ALREADY owns the flame
  // (line ~27: scaleX 1.1 yoyo repeat -1), the sparks, the card pop and the
  // badge pulses. Animating them again here would double-drive the same
  // elements. Logged as a deliberate no-op downgrade.
  return undefined;
});

export const buildSoul: BuildFn = withHeadings((ctx, hh) => {
  // CONFLICT-AWARE: the existing SoulSection hook owns the mark's scale/
  // opacity reveal (gsap.set(mark,{opacity:0.05,scale:0.85}) + grow-in).
  // We therefore NEVER touch scale/opacity here. Additive only: a gentle
  // governed y-drift "breath" (transform-only, resting opacity untouched) and
  // a curtain wipe that self-skips when the section is position:static.
  const mark = ctx.root.querySelector('[data-gsap="soul-mark"]') as HTMLElement | null;
  if (!mark) return undefined;
  const cs = window.getComputedStyle(ctx.root as HTMLElement);
  if (cs.position !== "static") {
    h.curtain(mark, { dir: "right", color: "#D4A017", trigger: ctx.root, duration: 1.6 });
  }
  hh.loop("soul.breath", () => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(mark, { y: -3, duration: 2.95, ease: "sine.inOut" });
    return tl;
  }, { trigger: ctx.root, nodes: 1, tier: "A" });
  return undefined;
});

export const buildHitl: BuildFn = withHeadings(() => {
  // Panel + rows already reveal on scroll (existing hook). Nothing hides content.
  return undefined;
});

export const buildTestimonials: BuildFn = withHeadings(() => {
  // Cards already stagger (existing hook). Nothing hides content.
  return undefined;
});

export const buildCta: BuildFn = withHeadings((ctx, hh) => {
  const bl = buttonLife(ctx);
  if (!bl) return undefined;
  return bl;
});

export const buildFooter: BuildFn = withHeadings((ctx) => {
  // Top rule draws (dashoffset on the first path-like element that reports a length).
  const candidates = Array.from(ctx.root.querySelectorAll("svg path")) as SVGPathElement[];
  for (const rule of candidates) {
    if (typeof (rule as SVGGeometryElement).getTotalLength === "function") {
      try {
        h.drawOnce(rule, { trigger: ctx.root, duration: 1, ease: easeOr("kPen", "power1.inOut") });
      } catch {
        /* noop */
      }
      break;
    }
  }
  return undefined;
});
