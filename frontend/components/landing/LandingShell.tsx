"use client";

/**
 * LandingShell — owns preloader state + LAW-WATCHDOG.
 * Lenis is NOT initialized here: the global <Smooth> provider in app/layout.tsx
 * already wires Lenis + ScrollTrigger with the exact canonical wiring
 * (lenis.on('scroll', ScrollTrigger.update); ticker ms conversion; lagSmoothing(0)).
 * A second instance would double-drive scroll (jitter per gsap-web skill).
 * Nav renders only after the preloader exits (RULE-STICKY-NAV-ZINDEX).
 */

import { useEffect, useState } from "react";
import gsap from "gsap";
import Nav from "./Nav";
import Preloader from "./Preloader";

export default function LandingShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  // LAW-WATCHDOG-V2 (viewport-aware): at 1.5s after mount, and 1.5s after
  // every scroll-idle, force-show only in-viewport elements that look
  // stuck (opacity ~0 with no active tween). Never touches resting<1
  // elements (data-m only, never data-gsap): glows, cones, ghosts, shadows.
  useEffect(() => {
    let idleT: ReturnType<typeof setTimeout> | null = null;
    // Hook-owned check: an element with an authored/preset inline opacity of 0
    // (WhatsApp typing indicator), or with a live OR pending GSAP tween, is
    // under a section hook's control — the watchdog must never force-show it
    // (that would spoil cues like the chat film or the soul-mark reveal).
    const hookOwned = (el: HTMLElement): boolean => {
      try {
        if (el.style && el.style.opacity === "0") return true;
        if (gsap.isTweening(el)) return true;
        if (gsap.getTweensOf(el).length > 0) return true;
      } catch {
        /* fall through to force-show */
      }
      return false;
    };
    // STUCK sweep — the transform-side companion to the opacity sweep above.
    // (a) word masks that FINISHED (data-m-done) but left a residual translate;
    // (b) curtain overlays still covering content with no active wipe → removed;
    // (c) anti-blank: hidden units in view with no active tween → force shown.
    // Never touches resting-opacity<1 nodes (they are data-m only by convention).
    const sweepStuck = (scope: ParentNode) => {
      try {
        const matrix = (el: HTMLElement): DOMMatrix | null => {
          try {
            const t = window.getComputedStyle(el).transform;
            if (!t || t === "none") return null;
            return new DOMMatrix(t);
          } catch {
            return null;
          }
        };
        const tweening = (el: HTMLElement): boolean => {
          try {
            return gsap.isTweening(el);
          } catch {
            return false;
          }
        };
        // (a) completed masks with residual transform.
        scope.querySelectorAll("[data-m-hide][data-m-done]").forEach((node) => {
          const el = node as HTMLElement;
          const probe = (el.querySelector(".m-wword") as HTMLElement | null) ?? el;
          const m = matrix(probe);
          if (!m) return;
          if (Math.abs(m.m41) <= 0.5 && Math.abs(m.m42) <= 0.5) return;
          if (tweening(probe) || tweening(el)) return;
          try {
            gsap.killTweensOf(probe);
            gsap.set(probe, { clearProps: "transform" });
          } catch {
            probe.style.transform = "";
          }
        });
        // (b) stuck curtains: covering + no active wipe → remove (content stays).
        scope.querySelectorAll(".m-curtain").forEach((node) => {
          const el = node as HTMLElement;
          const m = matrix(el);
          const scale = m ? Math.max(Math.abs(m.a), Math.abs(m.d)) : 0;
          if (scale <= 0.02) return; // invisible: its trigger may still be pending
          if (tweening(el)) return;
          try {
            el.remove();
          } catch {
            /* noop */
          }
        });
        // (c) anti-blank: hidden word units / subheads in view, no active reveal.
        scope.querySelectorAll("[data-m-hide]:not([data-m-done])").forEach((node) => {
          const el = node as HTMLElement;
          let r: DOMRect;
          try {
            r = el.getBoundingClientRect();
          } catch {
            return;
          }
          if (r.bottom <= 0 || r.top >= window.innerHeight * 0.9) return; // in view only
          const probe = (el.querySelector(".m-wword") as HTMLElement | null) ?? el;
          if (tweening(probe) || tweening(el)) return;
          try {
            gsap.killTweensOf(probe);
            gsap.set(probe, { clearProps: "transform,opacity,visibility" });
          } catch {
            probe.style.transform = "";
            probe.style.opacity = "1";
          }
          el.setAttribute("data-m-done", "1");
        });
      } catch {
        /* watchdog never throws */
      }
    };
    const sweep = () => {
      sweepStuck(document);
      try {
        document
          .querySelectorAll("[data-gsap],[data-m-hide]")
          .forEach((node) => {
            const el = node as HTMLElement;
            // Never touch correct resting-opacity<1 nodes (data-m only by convention).
            if (el.hasAttribute("data-m") && !el.hasAttribute("data-gsap") && !el.hasAttribute("data-m-hide")) return;
            let rect: DOMRect;
            try {
              rect = el.getBoundingClientRect();
            } catch {
              return;
            }
            if (rect.top >= window.innerHeight * 0.98) return; // below fold: leave for its trigger
            let opacity = 1;
            try {
              opacity = parseFloat(window.getComputedStyle(el).opacity || "1");
            } catch {
              return;
            }
            if (opacity >= 0.05) return;
            if (hookOwned(el)) return;
            try {
              gsap.killTweensOf(el);
              gsap.set(el, { clearProps: "opacity,transform,visibility" });
            } catch {
              el.style.opacity = "1";
              el.style.transform = "none";
            }
          });
      } catch {
        /* watchdog never throws */
      }
    };
    // SECTION fail-safe: trigger fired but timeline incomplete at 6s → snap final state.
    const sectionSnap = () => {
      try {
        document.querySelectorAll("[data-motion-scope]").forEach((scope) => {
          const trig = (scope.firstElementChild ?? scope) as Element;
          let r: DOMRect;
          try {
            r = trig.getBoundingClientRect();
          } catch {
            return;
          }
          const past = r.top < window.innerHeight * 0.9;
          if (!past) return;
          const fired = scope.getAttribute("data-motion-fired");
          if (fired) return;
          scope.setAttribute("data-motion-fired", "1");
          window.setTimeout(() => {
            try {
              if (scope.getAttribute("data-motion-done")) return;
              sweepStuck(scope);
              scope
                .querySelectorAll("[data-gsap]")
                .forEach((node) => {
                  const el = node as HTMLElement;
                  if (el.hasAttribute("data-m") && !el.hasAttribute("data-gsap")) return;
                  if (hookOwned(el)) return;
                  let o = 1;
                  try {
                    o = parseFloat(window.getComputedStyle(el).opacity || "1");
                  } catch {
                    return;
                  }
                  if (o < 0.05) {
                    el.style.opacity = "1";
                    el.style.transform = "none";
                  }
                });
            } catch {
              /* noop */
            }
          }, 6000);
        });
      } catch {
        /* noop */
      }
    };
    const t = setTimeout(() => {
      sweep();
      sectionSnap();
    }, 1500);
    const onScroll = () => {
      if (idleT) clearTimeout(idleT);
      idleT = setTimeout(() => {
        sweep();
        sectionSnap();
      }, 1500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      if (idleT) clearTimeout(idleT);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      {!ready && <Preloader onDone={() => setReady(true)} />}
      {ready && <Nav />}
      {children}
    </>
  );
}
