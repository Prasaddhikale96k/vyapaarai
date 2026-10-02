"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isCoarse, isMobile } from "../motion/registry";

/**
 * HERO FILM interactions (§12) + scroll exit (§13).
 * Pointer work is pointer-only (off on coarse/mobile); every listener,
 * quickTo, ScrollTrigger and tween is tracked and torn down by cleanup.
 * DOWNGRADE (logged): camera-rotates-toward-cursor → dropped — the ambient
 * camera breathing already owns stage rotation and same-prop tweens would
 * fight. Object parallax carries the depth instead.
 */

const AMP: Record<string, number> = { far: 5, mid: 12, near: 22 };

function bandOf(obj: Element): string {
  try {
    if (obj.classList.contains("hf-near")) return "near";
    if (obj.classList.contains("hf-mid")) return "mid";
    return "far";
  } catch {
    return "far";
  }
}

/** I1 pointer parallax + I2 cursor repel (Tier C). */
export function buildPointer(root: HTMLElement): () => void {
  const cleanups: Array<() => void> = [];
  try {
    if (isCoarse() || isMobile()) return () => {};
    if (!window.matchMedia("(pointer: fine)").matches) return () => {};
    const section = root;
    const objs = Array.from(section.querySelectorAll<HTMLElement>('[data-hf^="obj-"]'));
    const movers = objs
      .map((o) => ({ o, w: o.querySelector<HTMLElement>(".hf-pointer"), band: bandOf(o) }))
      .filter((m) => m.w) as Array<{ o: HTMLElement; w: HTMLElement; band: string }>;
    if (!movers.length) return () => {};
    const qs = movers.map((m) => ({
      m,
      qx: gsap.quickTo(m.w, "x", { duration: 0.6, ease: "power3.out" }),
      qy: gsap.quickTo(m.w, "y", { duration: 0.6, ease: "power3.out" }),
    }));
    const onMove = (e: PointerEvent) => {
      try {
        const r = section.getBoundingClientRect();
        const nx = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
        const ny = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
        qs.forEach(({ m, qx, qy }) => {
          const amp = AMP[m.band] ?? 5;
          let x = nx * 2 * amp;
          let y = ny * 2 * amp;
          // I2 repel: MID/NEAR within 140px drift away up to 14px.
          if (m.band !== "far") {
            try {
              const or = m.o.getBoundingClientRect();
              const cx = or.left + or.width / 2;
              const cy = or.top + or.height / 2;
              const dx = cx - e.clientX;
              const dy = cy - e.clientY;
              const d = Math.max(1, Math.hypot(dx, dy));
              if (d < 140) {
                const k = ((140 - d) / 140) * 14;
                x += (dx / d) * k;
                y += (dy / d) * k;
              }
            } catch {
              /* parallax only */
            }
          }
          qx(x);
          qy(y);
        });
      } catch {
        /* noop */
      }
    };
    const onLeave = () => {
      try {
        qs.forEach(({ m }) => {
          gsap.to(m.w, { x: 0, y: 0, duration: 1, ease: "power3.out", overwrite: "auto" });
        });
      } catch {
        /* noop */
      }
    };
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
      try {
        section.removeEventListener("pointermove", onMove);
        section.removeEventListener("pointerleave", onLeave);
        movers.forEach((m) => {
          try {
            gsap.set(m.w, { clearProps: "transform" });
          } catch {
            /* noop */
          }
        });
      } catch {
        /* noop */
      }
    });
  } catch {
    /* pointer off */
  }
  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
  };
}

/** I4 spotlight follows the cursor (fine pointers only). */
export function buildSpotlight(root: HTMLElement): () => void {
  try {
    if (isCoarse() || isMobile()) return () => {};
    if (!window.matchMedia("(pointer: fine)").matches) return () => {};
    const spot = root.querySelector<HTMLElement>('[data-hf="layer-spot"]');
    if (!spot) return () => {};
    const qx = gsap.quickTo(spot, "x", { duration: 0.8, ease: "power3.out" });
    const qy = gsap.quickTo(spot, "y", { duration: 0.8, ease: "power3.out" });
    const onMove = (e: PointerEvent) => {
      try {
        const r = (root as HTMLElement).getBoundingClientRect();
        qx(e.clientX - (r.left + r.width / 2));
        qy(e.clientY - (r.top + r.height * 0.4));
        gsap.to(spot, { opacity: 0.35, duration: 0.4, overwrite: "auto" });
      } catch {
        /* noop */
      }
    };
    const onLeave = () => {
      try {
        gsap.to(spot, { opacity: 0, duration: 0.6, overwrite: "auto" });
      } catch {
        /* noop */
      }
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      try {
        root.removeEventListener("pointermove", onMove);
        root.removeEventListener("pointerleave", onLeave);
        gsap.set(spot, { clearProps: "transform,opacity" });
      } catch {
        /* noop */
      }
    };
  } catch {
    return () => {};
  }
}

/** I3 coin flick — rotationY impulse on the ART wrapper (spin owns .hf-float scaleX). */
export function buildCoinFlick(root: HTMLElement): () => void {
  const offs: Array<() => void> = [];
  try {
    if (isCoarse() || isMobile()) return () => {};
    const coins = Array.from(root.querySelectorAll<HTMLElement>('[data-hf^="obj-coin"]'));
    coins.forEach((coin) => {
      try {
        const art = coin.querySelector<HTMLElement>(".hf-float");
        const spark = coin.querySelector<SVGElement>('[data-hf="coin-spark"]');
        if (!art) return;
        const flick = () => {
          try {
            gsap.fromTo(
              art,
              { rotationY: 0 },
              { rotationY: 1080, duration: 1.4, ease: "power2.out", overwrite: "auto" }
            );
            if (spark) {
              gsap.fromTo(
                spark,
                { opacity: 0.9, scale: 0.6, transformOrigin: "50% 50%" },
                { opacity: 0, scale: 1.6, duration: 0.7, ease: "power1.out", overwrite: "auto" }
              );
            }
          } catch {
            /* noop */
          }
        };
        coin.addEventListener("pointerdown", flick);
        offs.push(() => {
          try {
            coin.removeEventListener("pointerdown", flick);
          } catch {
            /* noop */
          }
        });
      } catch {
        /* noop */
      }
    });
  } catch {
    /* flick off */
  }
  return () => {
    offs.forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
  };
}

/** I5 scroll-velocity skew (Tier C): skewY ≤3° on floats, eases home. */
export function buildSkew(root: HTMLElement): () => void {
  let st: ScrollTrigger | null = null;
  try {
    if (isCoarse() || isMobile()) return () => {};
    const floats = Array.from(root.querySelectorAll<HTMLElement>(".hf-float"));
    if (!floats.length) return () => {};
    const setters = floats.map((f) => gsap.quickTo(f, "skewY", { duration: 0.3, ease: "power2.out" }));
    st = ScrollTrigger.create({
      trigger: root,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        try {
          const v = gsap.utils.clamp(-3, 3, self.getVelocity() / 400);
          setters.forEach((s) => s(Math.abs(v) < 0.2 ? 0 : v));
        } catch {
          /* noop */
        }
      },
    });
  } catch {
    /* skew off */
  }
  return () => {
    try {
      st?.kill();
    } catch {
      /* noop */
    }
  };
}

/**
 * §13 SCROLL EXIT — scrubbed, never pinned. Depth translates + outward
 * scatter share ONE tween per .hf-scroll wrapper (no fights); H1 block and
 * watermark ride along; growth line drifts. Opacity never moves.
 */
export function buildScrollExit(root: HTMLElement): (() => void) | null {
  try {
    const scrolls = Array.from(root.querySelectorAll<HTMLElement>(".hf-scroll"));
    if (!scrolls.length) return null;
    const factor = (el: HTMLElement): number => {
      try {
        const obj = el.closest('[data-hf^="obj-"]');
        if (!obj) return 0.4;
        if (obj.classList.contains("hf-near")) return 0.9;
        if (obj.classList.contains("hf-mid")) return 0.55;
        return 0.25;
      } catch {
        return 0.4;
      }
    };
    const scatter = (el: HTMLElement): number => {
      try {
        const obj = el.closest('[data-hf^="obj-"]') as HTMLElement | null;
        if (!obj) return 0;
        const r = obj.getBoundingClientRect();
        const sr = (root as HTMLElement).getBoundingClientRect();
        const side = r.left + r.width / 2 < sr.left + sr.width / 2 ? -1 : 1;
        const band = factor(el);
        return side * (8 + band * 10) * (sr.width / 100);
      } catch {
        return 0;
      }
    };
    const h1 = root.querySelector<HTMLElement>("#hero-heading");
    const wm = root.querySelector<HTMLElement>(".font-devanagari.pointer-events-none");
    const growth = root.querySelector<HTMLElement>('[data-hf="layer-growth"]');
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: root,
        start: "top top",
        end: "bottom top",
        scrub: 0.8,
      },
    });
    scrolls.forEach((el) => {
      const f = factor(el);
      tl.fromTo(
        el,
        { y: 0, x: 0, rotation: 0 },
        { y: -140 * f, x: scatter(el), rotation: f * 6, ease: "none", immediateRender: false },
        0
      );
    });
    if (h1) tl.fromTo(h1, { scale: 1, y: 0 }, { scale: 0.94, y: -48, ease: "none", immediateRender: false }, 0);
    if (wm) tl.fromTo(wm, { y: 0 }, { y: -60, ease: "none", immediateRender: false }, 0);
    if (growth) tl.fromTo(growth, { y: 0 }, { y: 30, ease: "none", immediateRender: false }, 0);
    const st = tl.scrollTrigger as ScrollTrigger | undefined;
    return () => {
      try {
        st?.kill();
      } catch {
        /* noop */
      }
      try {
        tl.kill();
      } catch {
        /* noop */
      }
    };
  } catch {
    return null;
  }
}
