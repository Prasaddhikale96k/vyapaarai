"use client";

/**
 * useKiranaScene(scopeRef, enabled) — owns all kirana SVG motion.
 * gsap.matchMedia gates everything on no-preference reduced motion.
 * Intro is time-based (preloader poll); story/idle pause offscreen + on tab hide.
 */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";
import { bindInteractions } from "./interactions";
import { buildIdle, buildIntro, buildStory } from "./timelines";

gsap.registerPlugin(CustomEase, MotionPathPlugin, ScrollTrigger);

let easesReady = false;
function ensureEases() {
  if (easesReady || typeof window === "undefined") return;
  try {
    CustomEase.create("kOut", "0.16,1,0.3,1");
    CustomEase.create("kSettle", "0.34,1.4,0.64,1");
    CustomEase.create("kSnap", "0.7,0,0.2,1");
    easesReady = true;
  } catch {
    /* fallback eases resolve per-tween below */
  }
}

/** Resolve when the landing preloader node is gone (or timeout). */
function waitForPreloader(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve();
    let waited = 0;
    const iv = window.setInterval(() => {
      waited += 100;
      if (!document.querySelector(".landing-preloader") || waited >= 4000) {
        window.clearInterval(iv);
        resolve();
      }
    }, 100);
  });
}

export function useKiranaScene(scopeRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useGSAP(
    () => {
      if (!enabled || typeof window === "undefined") return;
      ensureEases();
      const q = gsap.utils.selector(scopeRef.current);
      // Extras mount with `ready`; park them hidden before paint.
      gsap.set(q('[data-k="extras"] > *'), { opacity: 0 });
      gsap.set(q('[data-k="paper-beam"]'), { opacity: 0 });

      const mm = gsap.matchMedia();
      let intro: gsap.core.Timeline | null = null;
      let idle: ReturnType<typeof buildIdle> | null = null;
      let story: gsap.core.Timeline | null = null;
      let unbind: (() => void) | null = null;
      let pauseTrigger: ScrollTrigger | null = null;
      const cleanups: Array<() => void> = [];
      let started = false;
      let completed = false;
      let cancelled = false;

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Scene-level fail-safe: intro must start ≤3s and finish ≤8s,
        // else show the static base scene.
        const failStart = window.setTimeout(() => {
          if (!started && !cancelled) {
            failsafe();
          }
        }, 3000);
        const failDone = window.setTimeout(() => {
          if (!completed && !cancelled) {
            failsafe();
          }
        }, 8000);

        const failsafe = () => {
          cancelled = true;
          try {
            intro?.kill();
            gsap.set(
              q('[data-k="shadow"], [data-k="counter"], [data-k="plank-1"], [data-k="plank-2"], [data-k="plank-3"], [data-k^="k-jar-"], [data-k="beam"], [data-k="sign"], [data-k="lamp"], [data-k="cord"], [data-k="bulb"], [data-k="filament"], [data-k="glow"], [data-k="ray"], [data-k="cone"], [data-k="keeper"], [data-k="head"], [data-k="ledger"], [data-k="phone"], [data-k="header"], [data-k="rule"], [data-k="entries"] text, [data-k="bubble"]'),
              { clearProps: "transform,opacity" }
            );
          } catch {
            /* static scene stays */
          }
        };

        waitForPreloader().then(() => {
          if (cancelled) return;
          window.setTimeout(() => {
            if (cancelled) return;
            try {
              const isMobile = window.matchMedia("(max-width: 639px)").matches;
              const isCoarse = window.matchMedia("(pointer: coarse)").matches;
              intro = buildIntro(q);
              idle = buildIdle(q, { mobile: isMobile });
              story = buildStory(q, { mobile: isMobile });
              story.pause();
              try {
                if (scopeRef.current) {
                  unbind = bindInteractions(scopeRef.current, q, {
                    story: () => story,
                    coarse: isCoarse,
                    mobile: isMobile,
                  });
                }
              } catch {
                unbind = null;
              }
              started = true;
              // Idle group A joins mid-intro (owns nothing the intro still touches);
              // group B (sign/keeper loops) joins at intro complete.
              intro.add(() => {
                if (!cancelled) idle?.A.start();
              }, 1.6);
              intro.eventCallback("onComplete", () => {
                completed = true;
                window.clearTimeout(failStart);
                window.clearTimeout(failDone);
                if (!cancelled) idle?.B.start();
                if (!cancelled) story?.play();
              });
              // Offscreen pause: story + idle freeze when the hero leaves,
              // resume without a jump when it returns.
              try {
                const svgEl = scopeRef.current?.querySelector("svg") ?? null;
                if (svgEl) {
                  pauseTrigger = ScrollTrigger.create({
                    trigger: svgEl,
                    start: "top 95%",
                    end: "bottom 5%",
                    onToggle: (self) => {
                      try {
                        if (self.isActive) {
                          story?.play();
                          idle?.resumeAll();
                        } else {
                          story?.pause();
                          idle?.pauseAll();
                        }
                      } catch {
                        /* ignore */
                      }
                    },
                  });
                }
              } catch {
                pauseTrigger = null;
              }
              const onVis = () => {
                try {
                  if (document.hidden) {
                    story?.pause();
                    idle?.pauseAll();
                  } else if (pauseTrigger?.isActive !== false) {
                    story?.play();
                    idle?.resumeAll();
                  }
                } catch {
                  /* ignore */
                }
              };
              document.addEventListener("visibilitychange", onVis);
              cleanups.push(() => document.removeEventListener("visibilitychange", onVis));
              if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
                (window as unknown as { __kirana?: object }).__kirana = { intro, idle, story };
              }
            } catch {
              failsafe();
            }
          }, 350);
        });

        return () => {
          cancelled = true;
          window.clearTimeout(failStart);
          window.clearTimeout(failDone);
          try {
            unbind?.();
          } catch {
            /* noop */
          }
          try {
            intro?.kill();
          } catch {
            /* noop */
          }
          try {
            story?.kill();
          } catch {
            /* noop */
          }
          try {
            idle?.A.stop();
          } catch {
            /* noop */
          }
          try {
            pauseTrigger?.kill();
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
          if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
            try {
              delete (window as unknown as { __kirana?: object }).__kirana;
            } catch {
              /* noop */
            }
          }
        };
      });

      return () => {
        mm.revert();
      };
    },
    { scope: scopeRef, dependencies: [enabled], revertOnUpdate: true }
  );
}
