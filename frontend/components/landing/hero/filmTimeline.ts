"use client";

import gsap from "gsap";
import { easeOr, isMobile } from "../motion/registry";
import { buttonLife } from "../motion/systems";
import type { Ctx } from "../motion/helpers";
import {
  splitH1,
  splitWords,
  splitTrust,
  wrapArrow,
  addHighlights,
} from "./typography";

/**
 * HERO FILM timelines. buildIntro covers §11 INTRO (one-time, time-based)
 * + kinetic typography (§10). Ambient/story/pointer/scroll land in later
 * phases. Every target is data-gsap (resting opacity 1) or data-hf (ignored
 * by the watchdog); from-states are set post-hydration/pre-paint inside the
 * caller's useGSAP, and clearProps restores the poster frame on completion.
 */

export interface IntroBuild {
  tl: gsap.core.Timeline;
  targets: Element[];
  cleanup: () => void;
  isDone: () => boolean;
}

function visibleObjects(root: Element): HTMLElement[] {
  try {
    return Array.from(root.querySelectorAll<HTMLElement>('[data-hf^="obj-"]')).filter((el) => {
      try {
        return window.getComputedStyle(el).display !== "none";
      } catch {
        return true;
      }
    });
  } catch {
    return [];
  }
}

/** §7.6 TEXT-SAFE: demote MID/NEAR objects intersecting text to FAR @ ≤.28. */
export function textSafe(root: Element): () => void {
  try {
    const textEls = Array.from(
      root.querySelectorAll('[data-gsap="badge"],#hero-heading,[data-gsap="sub"],[data-gsap="cta"]')
    ) as HTMLElement[];
    if (!textEls.length) return () => {};
    const boxes = textEls.map((el) => {
      try {
        return el.getBoundingClientRect();
      } catch {
        return null;
      }
    });
    const objs = Array.from(root.querySelectorAll<HTMLElement>('[data-hf^="obj-"]'));
    const demoted: HTMLElement[] = [];
    objs.forEach((o) => {
      try {
        const band = o.classList.contains("hf-near") ? "near" : o.classList.contains("hf-mid") ? "mid" : "far";
        if (band === "far" || o.classList.contains("hf-demote")) return;
        const r = o.getBoundingClientRect();
        const hit = boxes.some(
          (b) =>
            b && r.left < b.right - 8 && r.right > b.left + 8 && r.top < b.bottom - 4 && r.bottom > b.top + 4
        );
        if (hit) {
          o.dataset.hfBand = band;
          o.classList.remove("hf-mid", "hf-near");
          o.classList.add("hf-far", "hf-demote");
          demoted.push(o);
        }
      } catch {
        /* keep pose */
      }
    });
    return () => {
      demoted.forEach((o) => {
        try {
          const band = o.dataset.hfBand;
          o.classList.remove("hf-demote", "hf-far");
          o.classList.add(band === "near" ? "hf-near" : "hf-mid");
          delete o.dataset.hfBand;
        } catch {
          /* noop */
        }
      });
    };
  } catch {
    return () => {};
  }
}

export function buildIntro(root: HTMLElement, mm: gsap.MatchMedia): IntroBuild | null {
  const cleanups: Array<() => void> = [];
  try {
    const q = gsap.utils.selector(root);
    const badge = q('[data-gsap="badge"]')[0] as HTMLElement | undefined;
    const inners = Array.from(root.querySelectorAll<HTMLElement>('[data-gsap="mask"]'));
    const h1 = root.querySelector<HTMLElement>("#hero-heading");
    const sub = q('[data-gsap="sub"]')[0] as HTMLElement | undefined;
    const ctas = Array.from(root.querySelectorAll<HTMLElement>('[data-gsap="cta"]'));
    const trust = q('[data-gsap="trust"]')[0] as HTMLElement | undefined;
    const stage = root.querySelector<HTMLElement>('[data-hf="stage"]');
    if (!h1 || !sub || inners.length < 3) return null;

    // ---- typography splits (revert on cleanup) ----
    const h1split = splitH1(h1);
    cleanups.push(h1split.revert);
    const subSplit = splitWords(sub);
    cleanups.push(subSplit.revert);
    const highlightsOff = addHighlights(sub, ["photo", "voice", "note", "reads", "records"]);
    cleanups.push(highlightsOff);
    let trustSplit: { segs: HTMLElement[]; revert: () => void } | null = null;
    if (trust) {
      trustSplit = splitTrust(trust);
      cleanups.push(trustSplit.revert);
    }
    let arrowOff: (() => void) | null = null;
    if (ctas[0]) arrowOff = wrapArrow(ctas[0]);
    if (arrowOff) cleanups.push(arrowOff);

    const targets: Element[] = [
      ...(badge ? [badge] : []),
      ...inners,
      ...h1split.lines.flat(),
      sub,
      ...subSplit.words,
      ...ctas,
      ...(trust ? [trust, ...(trustSplit?.segs ?? [])] : []),
    ];

    // Perspective for the 3D line reveal (inline → cleared with the rest).
    const lineParents = inners.map((el) => el.parentElement as HTMLElement | null);
    gsap.set(
      lineParents.filter(Boolean) as HTMLElement[],
      { perspective: 900 }
    );

    // ---- from-states (pre-paint, no flash) ----
    if (badge) gsap.set(badge, { y: -20, opacity: 0 });
    inners.forEach((el) => gsap.set(el, { rotationX: -38, transformOrigin: "50% 100%" }));
    h1split.lines.flat().forEach((w) => gsap.set(w, { yPercent: 115 }));
    gsap.set(subSplit.words, { yPercent: 105 });
    const bars = Array.from(sub.querySelectorAll<HTMLElement>(".hf-hl"));
    bars.forEach((b) => gsap.set(b, { scaleX: 0, transformOrigin: "left center" }));
    ctas.forEach((c) => gsap.set(c, { y: 18, opacity: 0 }));
    if (trustSplit) gsap.set(trustSplit.segs, { opacity: 0.2 });
    if (stage) gsap.set(stage, { scale: 1.08 });
    const auroras = Array.from(root.querySelectorAll<HTMLElement>('[data-hf^="aurora-"]'));
    if (auroras.length) gsap.set(auroras, { opacity: 0 });

    // Spokes: manual dashoffset draw (client-only lengths).
    const spokes = Array.from(root.querySelectorAll<SVGPathElement>('[data-hf="spoke"]'));
    const spokeLens: number[] = [];
    spokes.forEach((p) => {
      try {
        const len = p.getTotalLength();
        spokeLens.push(len);
        gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
      } catch {
        spokeLens.push(0);
      }
    });

    // Object entrances (visible at this viewport only).
    const objs = visibleObjects(root);
    const floats = objs
      .map((o) => o.querySelector<HTMLElement>(".hf-float"))
      .filter(Boolean) as HTMLElement[];
    if (floats.length) gsap.set(floats, { y: 40, scale: 0.6 });

    let done = false;
    const tl = gsap.timeline({
      defaults: { ease: easeOr("kOut", "expo.out") },
      onComplete: () => {
        done = true;
        try {
          gsap.set(targets, { clearProps: "transform,opacity,visibility" });
          gsap.set(lineParents.filter(Boolean) as HTMLElement[], { clearProps: "perspective" });
          bars.forEach((b) => {
            try {
              gsap.set(b, { clearProps: "transform" });
            } catch {
              /* noop */
            }
          });
        } catch {
          /* noop */
        }
      },
    });

    // 0.00 camera dolly + aurora ramp.
    if (stage) tl.to(stage, { scale: 1, duration: 2.4, ease: easeOr("kOut", "expo.out") }, 0);
    if (auroras.length) tl.to(auroras, { opacity: 1, duration: 1.2 }, 0);
    // 0.20 badge.
    if (badge) tl.to(badge, { y: 0, opacity: 1, duration: 0.7 }, 0.2);
    // 0.50–0.74 H1 lines: rotateX whole line + word stagger.
    h1split.lines.forEach((words, i) => {
      const at = 0.5 + i * 0.12;
      tl.to(inners[i], { rotationX: 0, duration: 0.95 }, at);
      tl.to(words, { yPercent: 0, duration: 0.9, stagger: 0.06 }, at);
    });
    // 's settle bounce on "Business's".
    const buss = h1split.lines.flat().find((w) => (w.textContent ?? "").includes("’s") || (w.textContent ?? "").includes("'s"));
    if (buss) tl.fromTo(buss, { y: -6 }, { y: 0, duration: 0.5, ease: easeOr("kSettle", "back.out(2)") }, 1.35);
    // 0.60–1.80 world objects enter FAR→NEAR (DOM order is back→front).
    if (floats.length)
      tl.to(floats, { y: 0, scale: 1, duration: 1.1, stagger: 0.07 }, 0.6);
    // 1.40 trust segments.
    if (trustSplit) tl.to(trustSplit.segs, { opacity: 1, duration: 0.6, stagger: 0.12 }, 1.4);
    // 1.70 sub-headline + 2.0 highlights.
    tl.to(subSplit.words, { yPercent: 0, duration: 0.8, stagger: 0.1 }, 1.7);
    if (bars.length) tl.to(bars, { scaleX: 1, duration: 0.5, ease: easeOr("kPen", "power1.inOut"), stagger: 0.25 }, 2.0);
    // 1.90 constellation spokes draw.
    if (spokes.length)
      spokes.forEach((p, i) => {
        if (spokeLens[i] > 0) tl.to(p, { strokeDashoffset: 0, duration: 0.9, ease: "power1.inOut" }, 1.9 + i * 0.12);
      });
    // 2.20 CTAs rise.
    if (ctas.length) tl.to(ctas, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1 }, 2.2);

    // CTA life = the shared G5 system (magnetic + shine + squash), not a copy.
    let blOff: (() => void) | undefined;
    try {
      const ctx: Ctx = { q, root, mm };
      blOff = buttonLife(ctx) ?? undefined;
      if (blOff) cleanups.push(blOff);
    } catch {
      /* buttons stay static */
    }
    // Primary arrow nudge (Tier A micro-loop lives with ambient in Phase 3;
    // park the arrow now so the loop can take over without a jump).
    const arrow = root.querySelector<HTMLElement>(".hf-arrow");
    if (arrow) gsap.set(arrow, { x: 0 });

    if (isMobile()) tl.timeScale(1.45);

    return {
      tl,
      targets,
      cleanup: () => {
        try {
          tl.kill();
        } catch {
          /* noop */
        }
        cleanups.forEach((fn) => {
          try {
            fn();
          } catch {
            /* noop */
          }
        });
        try {
          gsap.set(targets, { clearProps: "transform,opacity,visibility" });
        } catch {
          /* noop */
        }
      },
      isDone: () => done,
    };
  } catch {
    return null;
  }
}
