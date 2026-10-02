"use client";

/**
 * Global motion systems — shared across sections.
 * G3: heading word-mask reveal + hand-drawn swash under accent spans.
 * G5: magnetic + shine + press squash on primary/ghost CTAs.
 * All reduced-motion-gated, all additive (select by tag/[data-m]).
 */

import gsap from "gsap";
import { h, type Ctx } from "./helpers";
import { easeOr, isFineDesktop } from "./registry";

/** G3 — split every h2 (and the CTA h2 when marked) into masked words. */
export function headingSystem(ctx: Ctx): void {
  try {
    const h2s = ctx.root.querySelectorAll("h2, [data-m~='heading']");
    h2s.forEach((el) => {
      h.splitHeading(el, { type: "lines" });
    });
  } catch {
    /* headings stay visible */
  }
}

/** G3 swash — a hand-drawn underline draws after its heading lands.
 *  Target: an inline SVG path carrying data-m="swash" inside the heading's
 *  accent <span>. Pure overlay, aria-hidden, does not move text. */
export function headingSwash(ctx: Ctx): void {
  try {
    const swashes = ctx.root.querySelectorAll('[data-m~="swash"] path, [data-m~="swash"]');
    swashes.forEach((el) => {
      const path = (el as SVGPathElement).getTotalLength
        ? (el as SVGPathElement)
        : (el.querySelector("path") as SVGPathElement | null);
      if (path) h.drawOnce(path, { trigger: ctx.root, duration: 0.6, ease: easeOr("kPen", "power1.inOut") });
    });
  } catch {
    /* swash skipped */
  }
}

/** G5 — button life: magnetic + periodic shine sweep + press squash. */
export function buttonLife(ctx: Ctx): (() => void) | undefined {
  const btns = ctx.root.querySelectorAll('[data-m~="btn"]') as NodeListOf<HTMLElement>;
  const cleanups: Array<() => void> = [];
  btns.forEach((btn) => {
    // Magnetic (fine desktop pointers only).
    const unmag = h.magnetic(btn, { strength: 6 });
    if (unmag) cleanups.push(unmag);

    // Press squash — transform only, never blocks the real control.
    try {
      const down = () => {
        try {
          gsap.to(btn, { scale: 0.97, duration: 0.12, ease: easeOr("kSnap", "power2.out"), overwrite: "auto" });
        } catch {
          /* noop */
        }
      };
      const up = () => {
        try {
          gsap.to(btn, { scale: 1, duration: 0.2, ease: "power2.out", overwrite: "auto" });
        } catch {
          /* noop */
        }
      };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      cleanups.push(() => {
        btn.removeEventListener("pointerdown", down);
        btn.removeEventListener("pointerup", up);
        btn.removeEventListener("pointerleave", up);
      });
    } catch {
      /* noop */
    }

    // Shine sweep — transform-only overlay crossing the button every ~7s.
    // Only when the button is already a positioned containing block;
    // otherwise skip (we never add position to an existing element).
    if (isFineDesktop()) {
      try {
        const host = btn;
        const cs = window.getComputedStyle(host);
        const positioned = cs.position === "relative" || cs.position === "absolute" || cs.position === "fixed" || cs.position === "sticky";
        if (positioned && !host.querySelector(":scope > .m-shine")) {
          const shine = document.createElement("span");
          shine.setAttribute("aria-hidden", "true");
          shine.className = "m-shine";
          host.appendChild(shine);
          // The element animates the ::after via a child .m-shine-bar.
          const bar = document.createElement("span");
          bar.setAttribute("aria-hidden", "true");
          bar.className = "m-shine-bar";
          bar.style.cssText =
            "position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,0.45),transparent);transform:translateX(-140%);pointer-events:none;";
          shine.appendChild(bar);
          // Register as a governed loop so it pauses offscreen / hidden tab.
          const loopId = `shine:${btn.id ? btn.id : `btn-${Array.from(btns).indexOf(btn)}`}`;
          h.loop(loopId, () => {
            const tl = gsap.timeline({ repeat: -1, repeatDelay: 4.5 });
            tl.fromTo(bar, { x: "-140%" }, { x: "260%", duration: 0.9, ease: "power1.inOut" });
            return tl;
          }, { trigger: host, nodes: 1, tier: "B" });
        }
      } catch {
        /* shine skipped */
      }
    }
  });
  // Register cleanup into the gsap.context via the returned fn.
  return cleanups.length ? cleanupAll(cleanups) : undefined;
}

/** Return a cleanup fn that runs all subsystem cleanups (for gsap.context). */
export function cleanupAll(fns: Array<() => void> | undefined | null): () => void {
  return () => {
    (fns ?? []).forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
  };
}
