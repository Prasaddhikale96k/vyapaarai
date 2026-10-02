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
import { ScrollTrigger } from "gsap/ScrollTrigger";
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

export const buildNav: BuildFn = withHeadings(() => {
  // Nav logo idle + wordmark shimmer: Tier-B, deferred (needs a data-m rig the
  // existing Nav logo group does not expose; logged, not half-wired).
  return undefined;
});

export const buildHero: BuildFn = withHeadings((ctx) => {
  // NOTE: the scroll-hint bounce is owned by the CSS .landing-bob animation
  // (CSS animation origin beats GSAP's inline transform — a GSAP loop here
  // would be dead code). The G6 observer pauses it offscreen instead.
  const c: Array<() => void> = [];
  const bl = buttonLife(ctx);
  if (bl) c.push(bl);
  heroClearResidue(ctx);
  heroWatermark(ctx);
  return c.length ? cleanupAll(c) : undefined;
});

export const buildMarquee: BuildFn = withHeadings((ctx, hh) => {
  // The section is position:static (curtain self-skips — logged downgrade).
  // Additive: the aria-hidden bullet separators pulse in a slow staggered wave
  // (transform only; the CSS marquee track itself is NEVER touched — its
  // animation is owned by CSS and merely paused offscreen by the G6 observer).
  if (isMobile()) return undefined;
  const bullets = Array.from(ctx.root.querySelectorAll('span[aria-hidden="true"]')) as HTMLElement[];
  if (!bullets.length) return undefined;
  hh.loop("marquee.bullets", () => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.8 });
    bullets.forEach((b, i) => {
      tl.to(b, { scale: 1.55, duration: 0.35, ease: "sine.inOut", yoyo: true, repeat: 1 }, i * 0.09);
    });
    return tl;
  }, { trigger: ctx.root, nodes: Math.min(bullets.length, 8), tier: "B" });
  return undefined;
});

// ---- S3: problem-card icon micro-acts (icons are decorative children; the
// cards themselves are owned by the existing reveal hook — never touch them).
function problemIconActs(ctx: Ctx, hh: Parameters<BuildFn>[1]): void {
  if (isMobile()) return;
  try {
    const svgs = Array.from(ctx.root.querySelectorAll('[data-gsap="card"] svg'));
    if (svgs.length < 3) return;
    // Card 1: the red X over the ledger redraws itself every few seconds.
    const xPath = svgs[0].querySelector('path[stroke="#C0392B"]') as SVGPathElement | null;
    if (xPath) {
      try {
        const len = xPath.getTotalLength();
        gsap.set(xPath, { strokeDasharray: len, strokeDashoffset: 0 });
        hh.loop("problem.x", () => {
          const tl = gsap.timeline({ repeat: -1, repeatDelay: 3.4 });
          tl.to(xPath, { strokeDashoffset: len, duration: 0.4, ease: "power2.in" })
            .to(xPath, { strokeDashoffset: 0, duration: 0.7, ease: easeOr("kPen", "power1.inOut") }, "+=0.35");
          return tl;
        }, { trigger: ctx.root, nodes: 1, tier: "B" });
      } catch {
        /* X stays static */
      }
    }
    // Card 2: the lone orange stock square tips off the empty shelf, then resets.
    const square = svgs[1].querySelector('rect[fill="#E8771A"]') as SVGElement | null;
    if (square) {
      hh.loop("problem.shelf", () => {
        const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.4 });
        tl.to(square, { rotation: 16, y: 5, transformOrigin: "50% 100%", duration: 0.5, ease: "power2.in" })
          .to(square, { rotation: 0, y: 0, duration: 0.45, ease: "power2.out" }, "+=1.3");
        return tl;
      }, { trigger: ctx.root, nodes: 1, tier: "B" });
    }
    // Card 3: pupils dart side to side while the stress marks blink.
    const pupils = Array.from(svgs[2].querySelectorAll('circle[fill="#1A1209"]')) as SVGElement[];
    const stress = svgs[2].querySelector('path[stroke="#8B7355"]') as SVGElement | null;
    if (pupils.length) {
      hh.loop("problem.pupils", () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(pupils, { x: -2.2, duration: 0.5, ease: "power2.inOut", stagger: 0.05 }, 0)
          .to(pupils, { x: 2.4, duration: 0.65, ease: "power2.inOut", stagger: 0.05 }, "+=1.0")
          .to(pupils, { x: 0, duration: 0.4, ease: "power2.inOut" }, "+=0.8");
        if (stress) {
          tl.to(stress, { opacity: 0.3, duration: 0.3, ease: "sine.inOut", yoyo: true, repeat: 3 }, 0.4);
        }
        return tl;
      }, { trigger: ctx.root, nodes: pupils.length, tier: "B" });
    }
  } catch {
    /* icons stay static */
  }
}

export const buildProblem: BuildFn = withHeadings((ctx, hh) => {
  problemIconActs(ctx, hh);
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
    // Header "online" dot breathes (decorative, aria-hidden, outside the film).
    const dot = phone.querySelector("p span.h-1.5") as HTMLElement | null;
    if (dot) {
      hh.loop("whatsapp.status", () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(dot, { opacity: 0.3, duration: 1.15, ease: "sine.inOut" });
        return tl;
      }, { trigger: ctx.root, nodes: 1, tier: "B" });
    }
  }
  return undefined;
});

export const buildHowItWorks: BuildFn = withHeadings((ctx, hh) => {
  const cleanups: Array<() => void> = [];
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
  // S5a: ghost step numerals drift desynced (transform only — their resting
  // opacity 0.15 is NEVER touched, so they stay exempt from the watchdog).
  try {
    const ghosts = Array.from(ctx.root.querySelectorAll("span.font-mono.text-6xl")) as HTMLElement[];
    ghosts.forEach((g, i) => {
      hh.loop(`hiw.ghost${i}`, () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(g, { y: i % 2 === 0 ? -3 : 3, duration: 2.4 + i * 0.6, ease: "sine.inOut" });
        return tl;
      }, { trigger: ctx.root, nodes: 1, tier: "B" });
    });
  } catch {
    /* ghosts stay static */
  }
  // S5b: highlight-line underline sweeps — injected bars measured at enter time
  // (the step cards are already position:relative, so no position is ADDED).
  try {
    const articles = Array.from(ctx.root.querySelectorAll('[data-gsap="step"]')) as HTMLElement[];
    const bars: HTMLElement[] = [];
    ScrollTrigger.create({
      trigger: ctx.root,
      start: "top 80%",
      once: true,
      onEnter: () => {
        articles.forEach((art, i) => {
          try {
            const hl = art.querySelector("p.mt-auto") as HTMLElement | null;
            if (!hl) return;
            const range = document.createRange();
            range.selectNodeContents(hl);
            const rects = Array.from(range.getClientRects());
            const last = rects[rects.length - 1];
            if (!last || last.width < 6) return;
            const aR = art.getBoundingClientRect();
            const bar = document.createElement("span");
            bar.setAttribute("aria-hidden", "true");
            bar.style.cssText =
              `position:absolute;left:${last.left - aR.left}px;top:${last.bottom - aR.top + 2}px;` +
              `width:${last.width}px;height:3px;border-radius:2px;background:#E8771A;` +
              `pointer-events:none;transform:scaleX(0);transform-origin:left center;`;
            art.appendChild(bar);
            bars.push(bar);
            gsap.to(bar, {
              scaleX: 1,
              duration: 0.6,
              ease: easeOr("kPen", "power2.out"),
              delay: 0.45 + i * 0.16,
              immediateRender: false,
            });
          } catch {
            /* bar skipped */
          }
        });
      },
    });
    if (bars.length) {
      cleanups.push(() => {
        bars.forEach((b) => {
          try {
            b.remove();
          } catch {
            /* noop */
          }
        });
      });
    }
  } catch {
    /* no bars */
  }
  // O2 connectors: add a traveling "data packet" dot along the arrow path.
  if (isMobile()) return cleanups.length ? cleanupAll(cleanups) : undefined;
  const svg = ctx.root.querySelector('svg[aria-hidden="true"]') as SVGSVGElement | null;
  const path = svg?.querySelector('[data-gsap="arrow"]') as SVGPathElement | null;
  if (!svg || !path) return cleanups.length ? cleanupAll(cleanups) : undefined;
  try {
    const len = path.getTotalLength();
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#E8771A");
    dot.setAttribute("aria-hidden", "true");
    svg.appendChild(dot);
    cleanups.push(() => {
      try {
        dot.remove();
      } catch {
        /* noop */
      }
    });
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
  return cleanups.length ? cleanupAll(cleanups) : undefined;
});

export const buildDemoNumbers: BuildFn = withHeadings((ctx, hh) => {
  // Existing count-ups untouched (no double-animate). Additive: the diya's
  // flame flickers and its gold core breathes (governed, 2 nodes).
  const flame = ctx.root.querySelector('svg path[fill="#E8771A"]') as SVGElement | null;
  const glow = ctx.root.querySelector('svg circle[fill="#FFD700"]') as SVGElement | null;
  if (!flame && !glow) return undefined;
  hh.loop("demo.diya", () => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    if (flame) tl.to(flame, { scaleY: 1.14, scaleX: 0.93, transformOrigin: "50% 88%", duration: 0.42, ease: "sine.inOut" }, 0);
    if (glow) tl.to(glow, { opacity: 0.4, duration: 0.42, ease: "sine.inOut" }, 0);
    return tl;
  }, { trigger: ctx.root, nodes: 2, tier: "B" });
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
  // S10: the hand-drawn rule under the mark draws itself once on arrival.
  const rule = ctx.root.querySelector("svg path") as SVGGeometryElement | null;
  if (rule && typeof rule.getTotalLength === "function") {
    h.drawOnce(rule, { trigger: ctx.root, start: "top 85%", duration: 1.1, ease: easeOr("kPen", "power1.inOut") });
  }
  return undefined;
});

export const buildHitl: BuildFn = withHeadings(() => {
  // Panel + rows already reveal on scroll (existing hook). Nothing hides content.
  return undefined;
});

export const buildTestimonials: BuildFn = withHeadings((ctx, hh) => {
  // Cards already stagger (existing hook — never touch them). Additive: the
  // orange quote marks float desynced (transform only, governed).
  try {
    const marks = Array.from(ctx.root.querySelectorAll("figure svg path")) as SVGElement[];
    marks.forEach((m, i) => {
      hh.loop(`testi.mark${i}`, () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(m, { y: -2.5, duration: 2.2 + i * 0.45, ease: "sine.inOut" });
        return tl;
      }, { trigger: ctx.root, nodes: 1, tier: "B" });
    });
  } catch {
    /* marks stay static */
  }
  return undefined;
});

export const buildCta: BuildFn = withHeadings((ctx, hh) => {
  const bl = buttonLife(ctx);
  if (!bl) return undefined;
  return bl;
});

export const buildFooter: BuildFn = withHeadings((ctx) => {
  // S14a: the divider rule sweeps in left→right (the footer has no SVG — the
  // old path-draw loop was dead code). scaleX only; data-m-hide lets the
  // watchdog rescue it if the trigger never fires.
  try {
    const rule = ctx.root.querySelector("hr") as HTMLElement | null;
    if (rule) {
      rule.setAttribute("data-m-hide", "");
      gsap.set(rule, { scaleX: 0, transformOrigin: "left center" });
      gsap.to(rule, {
        scaleX: 1,
        duration: 1,
        ease: easeOr("kPen", "power1.inOut"),
        immediateRender: false,
        scrollTrigger: { trigger: ctx.root, start: "top 95%", once: true },
        onComplete: () => {
          rule.setAttribute("data-m-done", "1");
          try {
            gsap.set(rule, { clearProps: "transform" });
          } catch {
            /* noop */
          }
        },
      });
    }
  } catch {
    /* rule stays static */
  }
  // S14b: gold watermark parallax (transform only — resting opacity 0.15 and
  // the Hero pattern is the only other element allowed this treatment).
  try {
    if (!isMobile()) {
      const wm = ctx.root.querySelector(".font-devanagari.pointer-events-none") as HTMLElement | null;
      if (wm) {
        gsap.to(wm, {
          y: -26,
          ease: "none",
          scrollTrigger: { trigger: ctx.root, start: "top bottom", end: "bottom top", scrub: 1 },
        });
      }
    }
  } catch {
    /* noop */
  }
  return undefined;
});
