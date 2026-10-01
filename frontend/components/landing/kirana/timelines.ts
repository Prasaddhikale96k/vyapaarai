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

/** Handle for a running idle group (tweens + delayedCall chains). */
export interface IdleCtl {
  start: () => void;
  stop: () => void;
}

/**
 * Idle life, split to avoid fighting the intro:
 * - group A starts mid-intro (owns nothing the intro still touches)
 * - group B starts at intro complete (sign swing, keeper loops, jar wobbles)
 */
export function buildIdle(q: Q, opts?: { mobile?: boolean }): {
  A: IdleCtl;
  B: IdleCtl;
  pauseAll: () => void;
  resumeAll: () => void;
} {
  const mobile = opts?.mobile ?? false;
  const tweens: gsap.core.Tween[] = [];
  const calls: gsap.core.Tween[] = [];
  const track = (t: gsap.core.Tween) => {
    tweens.push(t);
    return t;
  };
  const later = (fn: () => void, at: number) => {
    calls.push(gsap.delayedCall(at, fn));
  };
  const stopAll = () => {
    tweens.forEach((t) => {
      try {
        t.kill();
      } catch {
        /* noop */
      }
    });
    calls.forEach((c) => {
      try {
        c.kill();
      } catch {
        /* noop */
      }
    });
    tweens.length = 0;
    calls.length = 0;
  };

  // ---------- group A ----------
  const startA = () => {
    // lamp pendulum about the cord top (mid-swing offset)
    const lamp = gsap.to(q('[data-k="lamp"]'), {
      rotation: 3.5,
      svgOrigin: "250 0",
      duration: 2.9,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    lamp.progress(0.3);
    track(lamp);
    // rays shimmer
    (q('[data-k="ray"]') as unknown as Element[]).forEach((r, i) => {
      track(gsap.to(r, {
        scale: 1.1,
        svgOrigin: "250 48",
        duration: 1.8,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: i * 0.12,
      }));
    });
    // filament flicker chain (5-9s)
    const flick = () => {
      track(gsap.to(q('[data-k="filament"]'), { opacity: 0.55, duration: 0.09 }));
      track(gsap.to(q('[data-k="filament"]'), { opacity: 1, duration: 0.09, delay: 0.09 }));
      later(flick, gsap.utils.random(5, 9));
    };
    later(flick, 5);
    // cone breathe
    track(gsap.to(q('[data-k="cone"]'), {
      opacity: 0.55,
      duration: 3.7,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    }));
    // ground shadow drifts opposite the lamp
    track(gsap.to(q('[data-k="shadow"]'), {
      x: 3,
      scaleX: 1.02,
      svgOrigin: "250 352",
      duration: 2.9,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    }));
    // keeper blink chain (2.6-5.2s)
    const blink = () => {
      track(gsap.to(q('[data-k="eyeL"], [data-k="eyeR"]'), {
        scaleY: 0.08,
        transformOrigin: "50% 50%",
        duration: 0.07,
        yoyo: true,
        repeat: 1,
      }));
      later(blink, gsap.utils.random(2.6, 5.2));
    };
    later(blink, 1.6);
    // brows drift
    track(gsap.to(q('[data-k="browL"]'), { y: -0.5, duration: 5.9, ease: "sine.inOut", yoyo: true, repeat: -1 }));
    track(gsap.to(q('[data-k="browR"]'), { y: 0.5, duration: 5.9, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 0.7 }));
    // ledger corner air
    track(gsap.to(q('[data-k="corner"]'), {
      rotation: 2.2,
      svgOrigin: "212 256",
      duration: 5.9,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    }));
    // phone status dot pulse
    track(gsap.to(q('[data-k="dot-status"]'), {
      scale: 1.35,
      opacity: 0.7,
      svgOrigin: "270 258",
      duration: 1.6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    }));
    // idle typing dots wave
    (q('[data-k="dot"]') as unknown as Element[]).forEach((d, i) => {
      track(gsap.to(d, {
        y: -1.5,
        duration: 0.9,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        delay: i * 0.15,
      }));
    });

    if (!mobile) {
      // dust motes drift inside the cone (fixed seed spots, sine paths)
      (q('[data-k="dust"]') as unknown as Element[]).forEach((m, i) => {
        track(gsap.to(m, {
          x: i % 2 === 0 ? 6 : -6,
          duration: 6 + i * 0.7,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: i * 0.4,
        }));
        track(gsap.to(m, {
          y: -8,
          duration: 7 + i * 0.5,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
          delay: i * 0.3,
        }));
        track(gsap.to(m, {
          opacity: 0.15,
          duration: 5 + i * 0.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }));
      });
      // chai steam loops
      ["[data-k=\"steam-1\"]", "[data-k=\"steam-2\"]"].forEach((sel, i) => {
        try {
          const el = (q(sel) as unknown as SVGGeometryElement[])[0];
          const len = el.getTotalLength();
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: 0 });
          track(gsap.to(el, {
            strokeDashoffset: -len,
            duration: 3.1,
            ease: "none",
            repeat: -1,
            delay: i * 0.5,
          }));
          track(gsap.to(el, { y: -6, duration: 3.1, ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.5 }));
        } catch {
          /* skip */
        }
      });
      // cat breathing
      track(gsap.to(q('[data-k="cat-body"]'), {
        scaleY: 1.06,
        transformOrigin: "50% 100%",
        duration: 3.1,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      }));
      const ear = () => {
        track(gsap.to(q('[data-k="cat-ear"]'), { rotation: -12, svgOrigin: "457 328", duration: 0.09, yoyo: true, repeat: 1 }));
        later(ear, 7);
      };
      later(ear, 7);
      const tail = () => {
        track(gsap.to(q('[data-k="cat-tail"]'), {
          rotation: 18,
          svgOrigin: "431 344",
          duration: 0.25,
          yoyo: true,
          repeat: 3,
          ease: "sine.inOut",
        }));
        later(tail, 5);
      };
      later(tail, 5);
    }
  };

  // ---------- group B ----------
  const startB = () => {
    // sign swing, phase-lagged vs lamp
    const sign = gsap.to(q('[data-k="sign"]'), {
      rotation: -1.4,
      svgOrigin: "260 58",
      duration: 3.3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 0.4,
    });
    sign.progress(0.2);
    track(sign);
    // ropes breathe with the sign
    track(gsap.to(q('[data-k="rope-L"], [data-k="rope-R"]'), {
      skewX: 0.6,
      duration: 3.3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 0.4,
    }));
    // keeper breathing + head lag + weight shift
    track(gsap.to(q('[data-k="body"]'), {
      scaleY: 1.018,
      transformOrigin: "50% 100%",
      duration: 4.3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    }));
    track(gsap.to(q('[data-k="head"]'), {
      y: 0.8,
      rotation: 1.2,
      svgOrigin: "392 168",
      duration: 4.3,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 0.1,
    }));
    const shift = () => {
      track(gsap.to(q('[data-k="keeper"]'), { x: 1.2, duration: 0.7, ease: "sine.inOut", yoyo: true, repeat: 1 }));
      later(shift, 7);
    };
    later(shift, 7);
    // random jar wobble chain (6-10s)
    const wobble = () => {
      const all = q('[data-k^="k-jar-"]') as unknown as Element[];
      if (all.length) {
        const j = all[Math.floor(gsap.utils.random(0, all.length - 1, 1))];
        track(gsap.fromTo(j,
          { rotation: 0, transformOrigin: "50% 100%" },
          { rotation: 3, duration: 0.18, ease: "sine.inOut", yoyo: true, repeat: 3 }));
      }
      later(wobble, gsap.utils.random(6, 10));
    };
    later(wobble, 6);
  };

  return {
    A: { start: startA, stop: stopAll },
    B: { start: startB, stop: stopAll },
    pauseAll: () => {
      tweens.forEach((t) => {
        try {
          t.pause();
        } catch {
          /* noop */
        }
      });
    },
    resumeAll: () => {
      tweens.forEach((t) => {
        try {
          t.resume();
        } catch {
          /* noop */
        }
      });
    },
  };
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
