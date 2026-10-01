"use client";

/**
 * Decorative pointer interactions for the kirana scene (easter eggs only).
 * No roles, no tabIndex, no tooltips. All listeners removed on cleanup.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Q } from "./timelines";

export interface InterRefs {
  story: () => gsap.core.Timeline | null;
  coarse: boolean;
  mobile: boolean;
}

export function bindInteractions(
  root: HTMLElement,
  q: Q,
  refs: InterRefs
): () => void {
  const cleanups: Array<() => void> = [];
  const on = (
    el: Element | null,
    ev: string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions
  ) => {
    if (!el) return;
    el.addEventListener(ev, fn as EventListener, opts);
    cleanups.push(() => el.removeEventListener(ev, fn as EventListener, opts));
  };

  const lamp = (q('[data-k="lamp"]') as unknown as Element[])[0] ?? null;
  const phone = (q('[data-k="phone"]') as unknown as Element[])[0] ?? null;
  const keeper = (q('[data-k="keeper"]') as unknown as Element[])[0] ?? null;
  const svg = root.querySelector("svg");

  // ---- I3 phone tap: restart story outside snap..reply ----
  if (phone) {
    (phone as unknown as HTMLElement).style.cursor = "pointer";
    cleanups.push(() => {
      ((phone as unknown as HTMLElement).style.cursor = "");
    });
    on(phone, "pointerdown", () => {
      try {
        const st = refs.story();
        if (!st) return;
        const t = st.time();
        if (t < 1.0 || t > 4.35) st.restart();
      } catch {
        /* ignore */
      }
    });
  }

  // ---- I2 lamp tug: impulse + damped return, then resume pendulum ----
  let lampMine: gsap.core.Tween[] = [];
  if (lamp) {
    (lamp as unknown as HTMLElement).style.cursor = "pointer";
    cleanups.push(() => {
      ((lamp as unknown as HTMLElement).style.cursor = "");
    });
    on(lamp, "pointerdown", () => {
      try {
        lampMine.forEach((t) => {
          try {
            t.kill();
          } catch {
            /* noop */
          }
        });
        lampMine = [];
        gsap.killTweensOf(lamp);
        const amps = [10, 6, 3.5, 1.5];
        amps.forEach((a, i) => {
          lampMine.push(gsap.to(lamp, {
            rotation: i % 2 === 0 ? a : -a,
            svgOrigin: "250 0",
            duration: 0.5,
            ease: "sine.inOut",
            delay: i * 0.5,
          }));
        });
        // flicker with the tug
        lampMine.push(gsap.to(q('[data-k="filament"]'), {
          opacity: 0.55, duration: 0.09, yoyo: true, repeat: 3,
        }));
        // hand the angle back: resume idle-style pendulum from rest
        lampMine.push(gsap.to(lamp, {
          rotation: 3.5,
          svgOrigin: "250 0",
          duration: 2.9,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: amps.length * 0.5,
          onStart: () => gsap.set(lamp, { rotation: 0 }),
        }));
      } catch {
        /* ignore */
      }
    });
    cleanups.push(() => {
      lampMine.forEach((t) => {
        try {
          t.kill();
        } catch {
          /* noop */
        }
      });
    });
  }

  // ---- I1 pointer parallax (skip on coarse/mobile) ----
  // Targets use x/y nobody else owns: far = shelves/sign/cone, near =
  // counter/phone/ledger (story owns phone x only during the 0.4s shake;
  // keeper excluded — idle weight-shift owns its x).
  if (!refs.coarse && !refs.mobile && svg) {
    const far = q('[data-k="shelves"], [data-k="sign"], [data-k="cone"]');
    const near = q('[data-k="counter"], [data-k="phone"], [data-k="ledger"]');
    const pupils = q('[data-k="pupilL"], [data-k="pupilR"]');
    const mk = (targets: unknown, amt: number) => ({
      x: gsap.quickTo(targets as gsap.TweenTarget, "x", { duration: 0.6, ease: "power3.out" }),
      y: gsap.quickTo(targets as gsap.TweenTarget, "y", { duration: 0.6, ease: "power3.out" }),
      amt,
    });
    const layers = [mk(far, 5), mk(near, 11)];
    const pup = {
      x: gsap.quickTo(pupils as gsap.TweenTarget, "x", { duration: 0.4, ease: "power3.out" }),
      y: gsap.quickTo(pupils as gsap.TweenTarget, "y", { duration: 0.4, ease: "power3.out" }),
    };
    const move = (e: Event) => {
      try {
        const pe = e as PointerEvent;
        const r = root.getBoundingClientRect();
        const nx = (pe.clientX - r.left) / Math.max(r.width, 1) - 0.5;
        const ny = (pe.clientY - r.top) / Math.max(r.height, 1) - 0.5;
        layers.forEach((l) => {
          l.x(nx * 2 * l.amt);
          l.y(ny * 2 * l.amt);
        });
        pup.x(nx * 2 * 1.6);
        pup.y(ny * 2 * 1.6);
      } catch {
        /* ignore */
      }
    };
    const leave = () => {
      try {
        layers.forEach((l) => {
          l.x(0);
          l.y(0);
        });
        pup.x(0);
        pup.y(0);
      } catch {
        /* ignore */
      }
    };
    on(root, "pointermove", move, { passive: true });
    on(root, "pointerleave", leave);
  }

  // ---- I4 keeper tap: namaste (Tier B) ----
  if (keeper) {
    (keeper as unknown as HTMLElement).style.cursor = "pointer";
    cleanups.push(() => {
      ((keeper as unknown as HTMLElement).style.cursor = "");
    });
    let busy = false;
    on(keeper, "pointerdown", () => {
      if (busy) return;
      busy = true;
      try {
        const tl = gsap.timeline({ onComplete: () => {
          busy = false;
        } });
        tl.to(q('[data-k="armL"]'), { rotation: 48, svgOrigin: "368 184", duration: 0.5, ease: "kSettle" }, 0)
          .to(q('[data-k="armR"]'), { rotation: -48, svgOrigin: "416 184", duration: 0.5, ease: "kSettle" }, 0)
          .to(q('[data-k="keeper"]'), { y: 1.5, duration: 0.5 }, 0)
          .to(q('[data-k="head"]'), { x: 4, duration: 0.4 }, 0)
          .to({}, { duration: 0.6 })
          .to(q('[data-k="armL"]'), { rotation: 0, duration: 0.5 }, ">")
          .to(q('[data-k="armR"]'), { rotation: 0, duration: 0.5 }, "<")
          .to(q('[data-k="keeper"]'), { y: 0, duration: 0.5 }, "<")
          .to(q('[data-k="head"]'), { x: 2, duration: 0.4 }, "<");
      } catch {
        busy = false;
      }
    });
  }

  // ---- I5 scroll drift (transform-only, scrubbed) ----
  // y-drift on layers whose y nobody else owns: shelves/sign (far),
  // keeper (mid; story nods it 0.9s/loop — negligible overlap), cone (near).
  let st: ScrollTrigger | null = null;
  try {
    if (svg) {
      const far = q('[data-k="shelves"], [data-k="sign"]');
      const mid = q('[data-k="keeper"]');
      const near = q('[data-k="cone"]');
      st = ScrollTrigger.create({
        trigger: svg,
        start: "top 95%",
        end: "bottom top",
        scrub: 0.8,
        onUpdate: (self) => {
          const p = self.progress;
          try {
            gsap.set(far, { y: p * 10 });
            gsap.set(mid, { y: p * 17 });
            gsap.set(near, { y: p * 24 });
          } catch {
            /* ignore */
          }
        },
      });
    }
  } catch {
    st = null;
  }

  return () => {
    cleanups.forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
    try {
      st?.kill();
    } catch {
      /* noop */
    }
  };
}
