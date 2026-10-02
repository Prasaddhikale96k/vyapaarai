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
    const sweep = () => {
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
            try {
              if (gsap.isTweening(el)) return;
            } catch {
              /* fall through to force-show */
            }
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
              scope
                .querySelectorAll("[data-gsap]")
                .forEach((node) => {
                  const el = node as HTMLElement;
                  if (el.hasAttribute("data-m") && !el.hasAttribute("data-gsap")) return;
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
