"use client";

/**
 * Pure timeline builders for the kirana scene.
 * Each takes a gsap selector scoped to the scene root.
 * Only transform / opacity / strokeDashoffset are animated.
 */

import gsap from "gsap";

export type Q = ReturnType<typeof gsap.utils.selector>;

/** Manual stroke draw-on (DrawSVG fallback per downgrade ladder). */
function drawOn(q: Q, sel: string, tl: gsap.core.Timeline, at: number, dur: number, stagger = 0) {
  const els = q(sel) as unknown as SVGGeometryElement[];
  els.forEach((el, i) => {
    try {
      const len = el.getTotalLength();
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
      tl.to(el, { strokeDashoffset: 0, duration: dur, ease: "power1.inOut" }, at + i * stagger);
    } catch {
      /* non-geometry element: skip */
    }
  });
}

/** Intro ≈2.8s, plays once after the preloader is gone. */
export function buildIntro(q: Q): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: "kOut" } });

  // from-states (set before paint by the caller ordering: these run at t=0)
  gsap.set(q('[data-k="shadow"]'), { scaleX: 0, svgOrigin: "250 352" });
  gsap.set(q('[data-k="counter"]'), { y: 22, scaleY: 0.92, svgOrigin: "250 342" });
  gsap.set(q('[data-k="plank-1"], [data-k="plank-2"], [data-k="plank-3"]'), {
    scaleX: 0,
    svgOrigin: "70 150",
  });
  const jars = q('[data-k^="k-jar-"]');
  (jars as unknown as Element[]).forEach((j, i) => {
    gsap.set(j, { y: -18, rotation: i % 2 === 0 ? -5 : 5, transformOrigin: "50% 60%" });
  });
  gsap.set(q('[data-k="beam"]'), { scaleX: 0, svgOrigin: "250 11" });
  gsap.set(q('[data-k="sign"]'), { y: -44, rotation: 16, svgOrigin: "182 58" });
  gsap.set(q('[data-k="cord"]'), { scaleY: 0, svgOrigin: "250 0" });
  gsap.set(q('[data-k="bulb"], [data-k="filament"]'), { opacity: 0.15 });
  gsap.set(q('[data-k="glow"], [data-k="ray"]'), { opacity: 0, scale: 0.6, svgOrigin: "250 48" });
  gsap.set(q('[data-k="cone"]'), { opacity: 0 });
  gsap.set(q('[data-k="keeper"]'), { y: 38 });
  gsap.set(q('[data-k="head"]'), { y: 6, rotation: -4, svgOrigin: "392 168" });
  gsap.set(q('[data-k="ledger"]'), { scale: 0.92, svgOrigin: "155 318" });
  gsap.set(q('[data-k="phone"]'), { y: 10, opacity: 0.4 });
  gsap.set(q('[data-k="header"]'), { opacity: 0.2 });
  gsap.set(q('[data-k="entries"] text'), { opacity: 0, y: 4 });
  gsap.set(q('[data-k="bubble"]'), { opacity: 0, y: 8 });

  // 0.00 shadow
  tl.to(q('[data-k="shadow"]'), { scaleX: 1, duration: 0.6 }, 0);
  // 0.05 counter
  tl.to(q('[data-k="counter"]'), { y: 0, scaleY: 1, duration: 0.7, ease: "kSettle" }, 0.05);
  // 0.25 planks
  tl.to(q('[data-k="plank-1"], [data-k="plank-2"], [data-k="plank-3"]'), {
    scaleX: 1,
    duration: 0.45,
    ease: "power3.out",
    stagger: 0.1,
  }, 0.25);
  // 0.40 jars drop + squash
  (jars as unknown as Element[]).forEach((j, i) => {
    const at = 0.4 + i * 0.04;
    tl.to(j, { y: 0, rotation: 0, duration: 0.45, ease: "kSettle" }, at);
    tl.to(j, { scaleY: 0.88, scaleX: 1.06, transformOrigin: "50% 100%", duration: 0.1 }, at + 0.4);
    tl.to(j, { scaleY: 1, scaleX: 1, duration: 0.22 }, at + 0.5);
  });
  // 0.50 beam + ropes draw
  drawOn(q, '[data-k="rope-L"], [data-k="rope-R"]', tl, 0.5, 0.3);
  tl.to(q('[data-k="beam"]'), { scaleX: 1, duration: 0.3, ease: "power3.out" }, 0.5);
  // 0.60 sign drop, elastic to resting tilt
  tl.to(q('[data-k="sign"]'), { y: 0, rotation: -3, duration: 1.1, ease: "elastic.out(1,0.35)" }, 0.6);
  // 0.70 lamp on
  tl.to(q('[data-k="cord"]'), { scaleY: 1, duration: 0.35, ease: "power3.out" }, 0.7);
  tl.to(q('[data-k="bulb"], [data-k="filament"]'), {
    opacity: 1,
    duration: 0.5,
    ease: "steps(6)",
  }, 0.75);
  tl.to(q('[data-k="glow"], [data-k="ray"]'), { opacity: 1, scale: 1, duration: 0.5 }, 0.8);
  tl.to(q('[data-k="cone"]'), { opacity: 0.85, duration: 0.5 }, 0.85);
  // 0.95 keeper rises (anticipation dip first)
  tl.to(q('[data-k="keeper"]'), { y: 42, duration: 0.14, ease: "kSnap" }, 0.95);
  tl.to(q('[data-k="keeper"]'), { y: 0, duration: 0.6, ease: "kSettle" }, 1.09);
  tl.to(q('[data-k="head"]'), { y: 0, rotation: 0, duration: 0.55, ease: "kSettle" }, 1.17);
  // 1.30 ledger + phone
  tl.to(q('[data-k="ledger"]'), { scale: 1, duration: 0.4, ease: "kSettle" }, 1.3);
  tl.to(q('[data-k="phone"]'), { y: 0, opacity: 1, duration: 0.4 }, 1.35);
  tl.to(q('[data-k="header"]'), { opacity: 1, duration: 0.25 }, 1.45);
  // 1.80 ruled lines + entries + bubble
  drawOn(q, '[data-k="rule"]', tl, 1.8, 0.3, 0.08);
  tl.to(q('[data-k="entries"] text'), { opacity: 1, y: 0, duration: 0.3, stagger: 0.12 }, 1.9);
  tl.to(q('[data-k="bubble"]'), { opacity: 1, y: 0, duration: 0.4, ease: "back.out(2)" }, 2.1);
  // END: clean inline transforms on intro-only elements
  tl.add(() => {
    gsap.set(q('[data-k="counter"], [data-k="plank-1"], [data-k="plank-2"], [data-k="plank-3"]'), {
      clearProps: "transform",
    });
  });

  return tl;
}
