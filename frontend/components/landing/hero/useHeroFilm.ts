"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";
import { registry } from "../motion/registry";
import { buildIntro, textSafe } from "./filmTimeline";
import type { IntroBuild } from "./filmTimeline";

function preloaderGone(): boolean {
  try {
    return !document.querySelector(".landing-preloader");
  } catch {
    return true;
  }
}

function undemote(root: Element): void {
  try {
    root.querySelectorAll(".hf-demote").forEach((el) => {
      try {
        (el as HTMLElement).classList.remove("hf-demote");
      } catch {
        /* noop */
      }
    });
  } catch {
    /* noop */
  }
}

/**
 * useHeroFilm — mounts the title-sequence intro inside Hero's own useGSAP
 * context (cleanup reverts). Everything is built synchronously (paused) so
 * tweens are context-captured; playback starts when the preloader node is
 * gone (polled ≤4s). Reduced-motion builds nothing (matchMedia gate).
 */
export default function useHeroFilm(rootRef: RefObject<HTMLElement | null>): void {
  useGSAP(
    () => {
      registry();
      const root = rootRef.current;
      if (!root || typeof window === "undefined") return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        let build: IntroBuild | null = null;
        let played = false;
        const timers: Array<ReturnType<typeof setTimeout>> = [];
        const pollId: Array<ReturnType<typeof setInterval>> = [];

        try {
          build = buildIntro(root, mm);
        } catch {
          build = null;
        }
        if (!build) return undefined; // poster frame stands
        const intro = build;
        try {
          intro.tl.pause();
        } catch {
          /* noop */
        }
        // §7.6 text-safe at build + on resize/refresh (debounced).
        try {
          textSafe(root);
        } catch {
          /* keep poses */
        }
        let rz: ReturnType<typeof setTimeout> | null = null;
        const schedule = () => {
          if (rz) clearTimeout(rz);
          rz = setTimeout(() => {
            try {
              textSafe(root);
            } catch {
              /* noop */
            }
          }, 200);
        };
        window.addEventListener("resize", schedule);
        try {
          ScrollTrigger.addEventListener("refreshInit", schedule);
        } catch {
          /* noop */
        }

        const play = () => {
          if (played) return;
          played = true;
          try {
            intro.tl.play();
          } catch {
            /* poster stands */
          }
          // STAGE FAIL-SAFE: not started in 3s or not finished in 9s → poster.
          timers.push(
            setTimeout(() => {
              try {
                if (!intro.tl.isActive() && !intro.isDone()) {
                  intro.tl.kill();
                  gsap.set(intro.targets, { clearProps: "transform,opacity,visibility" });
                }
              } catch {
                /* noop */
              }
            }, 3000)
          );
          timers.push(
            setTimeout(() => {
              try {
                if (!intro.isDone()) {
                  intro.tl.kill();
                  gsap.set(intro.targets, { clearProps: "transform,opacity,visibility" });
                }
              } catch {
                /* noop */
              }
            }, 9000)
          );
          if (process.env.NODE_ENV !== "production") {
            try {
              (window as unknown as { __heroFilm?: object }).__heroFilm = { intro: intro.tl };
            } catch {
              /* noop */
            }
          }
        };

        const t0 = Date.now();
        const poll = setInterval(() => {
          try {
            if (preloaderGone() || Date.now() - t0 > 4000) {
              clearInterval(poll);
              play();
            }
          } catch {
            clearInterval(poll);
            play();
          }
        }, 100);
        pollId.push(poll);

        return () => {
          pollId.forEach((p) => {
            try {
              clearInterval(p);
            } catch {
              /* noop */
            }
          });
          timers.forEach((t) => {
            try {
              clearTimeout(t);
            } catch {
              /* noop */
            }
          });
          if (rz) {
            try {
              clearTimeout(rz);
            } catch {
              /* noop */
            }
          }
          try {
            window.removeEventListener("resize", schedule);
            ScrollTrigger.removeEventListener("refreshInit", schedule);
          } catch {
            /* noop */
          }
          undemote(root);
          try {
            intro.cleanup();
          } catch {
            /* noop */
          }
        };
      });
      return () => {
        try {
          mm.revert();
        } catch {
          /* noop */
        }
      };
    },
    { scope: rootRef as RefObject<Element | null>, dependencies: [], revertOnUpdate: true }
  );
}
