"use client";

/**
 * Global motion systems — shared across sections.
 * G3: heading word-mask reveal + hand-drawn swash under accent spans.
 * G5: magnetic + shine + press squash on primary/ghost CTAs.
 * All reduced-motion-gated, all additive (select by tag/[data-m]).
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { h, type Ctx } from "./helpers";
import { easeOr, isFineDesktop } from "./registry";

/** G3 — split every h2 (and the CTA h2 when marked) into masked words,
 *  then reveal the subhead directly under it (no existing hook animates
 *  these paragraphs). Returns one cleanup (splits revert + swashes removed). */
export function headingSystem(ctx: Ctx): (() => void) | undefined {
  const cleanups: Array<() => void> = [];
  try {
    const h2s = ctx.root.querySelectorAll("h2, [data-m~='heading']");
    h2s.forEach((el) => {
      const revert = h.splitHeading(el, { type: "words" });
      if (revert) cleanups.push(revert);
      // G3b subhead: h2 + p → fade/slide in after the heading lands.
      try {
        const p = el.nextElementSibling as HTMLElement | null;
        if (p && p.tagName === "P" && !p.hasAttribute("data-gsap")) {
          p.setAttribute("data-m-hide", "");
          h.reveal(p, {
            trigger: p,
            start: "top 93%",
            y: 14,
            duration: 0.7,
            delay: 0.25,
            ease: easeOr("kOut", "power2.out"),
          });
        }
      } catch {
        /* subhead stays as authored */
      }
    });
  } catch {
    /* headings stay visible */
  }
  const swashes = headingSwash(ctx);
  if (swashes) cleanups.push(swashes);
  return cleanups.length ? cleanupAll(cleanups) : undefined;
}

/** G3 swash — hand-drawn wavy underline under each heading's ACCENT span.
 *  Measured at trigger-fire time, injected as a body-level overlay (page
 *  coords, aria-hidden, pointer-events:none), drawn once with kPen.
 *  Skips: hosts/spans owned by section hooks, non-inline spans, spans whose
 *  computed color equals the heading color (not an accent). */
export function headingSwash(ctx: Ctx): (() => void) | undefined {
  const created: SVGSVGElement[] = [];
  try {
    const hosts = ctx.root.querySelectorAll<HTMLElement>("h2, [data-m~='heading']");
    hosts.forEach((host) => {
      if (host.hasAttribute("data-gsap") || host.querySelector("[data-gsap]")) return;
      const spans = host.querySelectorAll<HTMLElement>("span[style]");
      spans.forEach((span) => {
        try {
          if (span.hasAttribute("data-gsap") || span.querySelector("[data-gsap]")) return;
          const disp = window.getComputedStyle(span).display;
          if (disp !== "inline" && disp !== "inline-block") return;
          const color = window.getComputedStyle(span).color;
          if (!color || color === window.getComputedStyle(host).color) return;
          const draw = () => {
            try {
              gsap.delayedCall(1.1, () => {
                try {
                  const r = span.getBoundingClientRect();
                  if (r.width < 6) return;
                  const w = r.width;
                  const hgt = 10;
                  const pageX = r.left + window.scrollX;
                  const pageY = r.bottom + window.scrollY - Math.max(4, r.height * 0.18);
                  const ns = "http://www.w3.org/2000/svg";
                  const svg = document.createElementNS(ns, "svg");
                  svg.setAttribute("viewBox", `0 0 ${w} ${hgt}`);
                  svg.setAttribute("width", String(w));
                  svg.setAttribute("height", String(hgt));
                  svg.setAttribute("aria-hidden", "true");
                  svg.setAttribute("focusable", "false");
                  svg.style.cssText = `position:absolute;left:${pageX}px;top:${pageY}px;pointer-events:none;overflow:visible;`;
                  const path = document.createElementNS(ns, "path");
                  const seg = w / 4;
                  const y0 = hgt * 0.55;
                  path.setAttribute("d", `M0 ${y0} q ${seg / 2} -4.5 ${seg} 0 t ${seg} 0 t ${seg} 0 t ${seg} 0`);
                  path.setAttribute("fill", "none");
                  path.setAttribute("stroke", color);
                  path.setAttribute("stroke-width", "2.5");
                  path.setAttribute("stroke-linecap", "round");
                  svg.appendChild(path);
                  document.body.appendChild(svg);
                  created.push(svg);
                  const len = path.getTotalLength();
                  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
                  gsap.to(path, {
                    strokeDashoffset: 0,
                    duration: 0.6,
                    ease: easeOr("kPen", "power1.inOut"),
                  });
                } catch {
                  /* swash skipped */
                }
              });
            } catch {
              /* noop */
            }
          };
          ScrollTrigger.create({
            trigger: host,
            start: "top 90%",
            once: true,
            onEnter: draw,
          });
        } catch {
          /* this swash skipped */
        }
      });
    });
  } catch {
    /* no swashes */
  }
  if (!created.length) return undefined;
  return () => {
    created.forEach((s) => {
      try {
        s.remove();
      } catch {
        /* noop */
      }
    });
  };
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
