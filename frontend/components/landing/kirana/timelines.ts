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

/** Stroke length helper for manual draw-on inside the story. */
function prepDraw(el: Element): number {
  try {
    const g = el as unknown as SVGGeometryElement;
    const len = g.getTotalLength();
    gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    return len;
  } catch {
    return 0;
  }
}

const BUBBLE_EN = { t1: "Bill read!", t2: "+ Rs.2,340" };
const BUBBLE_HI = { t1: "बिल दर्ज हो गया ✓", t2: "+ Rs.2,340" };

/**
 * Story master ≈11.5s, repeat -1, repeatDelay 1.2.
 * Touches ONLY idle-free props (head x, pupils, brows scaleY, mouth scaleX,
 * keeper y, arm rotations, extras) so idle + story never fight.
 */
export function buildStory(q: Q, opts?: { mobile?: boolean }): gsap.core.Timeline {
  const mobile = opts?.mobile ?? false;
  const one = <T extends Element>(sel: string): T => (q(sel) as unknown as T[])[0];
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, defaults: { ease: "power3.out" } });

  // ---------- 0.00 notice ----------
  tl.fromTo(q('[data-k="paper"]'),
    { opacity: 0, x: 0, y: 10, scale: 0.6, rotation: -6, svgOrigin: "324 320" },
    { opacity: 1, y: -12, scale: 1, rotation: -2, duration: 0.6, ease: "kSettle" }, 0);
  tl.fromTo(q('[data-k="head"]'), { x: 0 }, { x: 2, duration: 0.4, ease: "sine.out" }, 0);
  tl.to(q('[data-k="pupilL"], [data-k="pupilR"]'), { x: -1.5, y: 1, duration: 0.4, ease: "sine.out" }, 0);
  tl.to(q('[data-k="browL"], [data-k="browR"]'), { scaleY: 0.8, transformOrigin: "50% 50%", duration: 0.3 }, 0);

  // ---------- 1.00 snap ----------
  tl.to(q('[data-k="phone"]'), { scale: 0.97, svgOrigin: "293 290", duration: 0.1 }, 1.0);
  tl.to(q('[data-k="phone"]'), { scale: 1, duration: 0.25, ease: "kSettle" }, 1.1);
  tl.fromTo(q('[data-k="flash"]'),
    { opacity: 0.9, scale: 0, svgOrigin: "293 290" },
    { opacity: 0, scale: 1.6, duration: 0.35, ease: "power1.out" }, 1.0);
  tl.fromTo(q('[data-k="paper-beam"]'), { opacity: 0.55, y: 0 }, { opacity: 0.55, y: 52, duration: 0.7, ease: "power1.inOut" }, 1.0);
  tl.to(q('[data-k="paper-beam"]'), { opacity: 0, duration: 0.15 }, 1.7);
  (q('[data-k="paper-stroke"]') as unknown as Element[]).forEach((s, i) => {
    prepDraw(s);
    tl.to(s, { strokeDashoffset: 0, duration: 0.3, ease: "power1.inOut" }, 1.1 + i * 0.2);
  });

  // ---------- 1.90 send ----------
  tl.to(q('[data-k="paper"]'), {
    motionPath: [{ x: 0, y: -12 }, { x: 6, y: -40 }, { x: -8, y: 2 }],
    scale: 0.12,
    rotation: 14,
    duration: 0.55,
    ease: "power3.in",
  }, 1.9);
  tl.to(q('[data-k="paper"]'), { opacity: 0, duration: 0.15 }, 2.3);
  tl.fromTo(q('[data-k="screen"]'), { opacity: 1 }, { opacity: 0.55, duration: 0.12, yoyo: true, repeat: 1 }, 2.3);
  (["[data-k=\"ripple-1\"]", "[data-k=\"ripple-2\"]"]).forEach((sel, i) => {
    tl.fromTo(q(sel),
      { opacity: 0.55, scale: 0.6, svgOrigin: "293 272" },
      { opacity: 0, scale: 2.1, duration: 0.8, ease: "power1.out" }, 2.35 + i * 0.18);
  });
  tl.to(q('[data-k="browL"], [data-k="browR"]'), { scaleY: 1.1, duration: 0.15 }, 2.4);
  tl.to(q('[data-k="eyeL"], [data-k="eyeR"]'), { scale: 1.08, transformOrigin: "50% 50%", duration: 0.15 }, 2.4);

  // ---------- 2.70 think ----------
  [0, 1, 2].forEach((c) => {
    tl.to(q('[data-k="dot"]'), { scale: 1.3, transformOrigin: "50% 50%", duration: 0.2 }, 2.7 + c * 0.4);
    tl.to(q('[data-k="dot"]'), { scale: 1, duration: 0.2 }, 2.9 + c * 0.4);
  });
  tl.to(q('[data-k="header"]'), { opacity: 0.55, duration: 0.3, yoyo: true, repeat: 3 }, 2.7);

  // ---------- 3.90 reply ----------
  tl.fromTo(q('[data-k="bubble"]'),
    { opacity: 0, scale: 0.6, y: 6, svgOrigin: "266 298" },
    { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(2)" }, 3.9);
  tl.to(q('[data-k="phone"]'), { x: 1.4, duration: 0.08, yoyo: true, repeat: 4 }, 3.9);
  tl.to(q('[data-k="phone"]'), { x: 0, duration: 0.1 }, 4.3);
  tl.to(q('[data-k="keeper"]'), { y: 2, duration: 0.22, yoyo: true, repeat: 3, ease: "sine.inOut" }, 3.9);
  tl.to(q('[data-k="mouth"]'), { scaleX: 1.15, transformOrigin: "50% 50%", duration: 0.3 }, 3.9);
  tl.to(q('[data-k="eyeL"], [data-k="eyeR"]'), { scale: 1, duration: 0.3 }, 4.1);

  // ---------- 4.70 coins ----------
  const coinCount = mobile ? 3 : 5;
  const coinTargets = [172, 182, 192, 202, 212];
  (q('[data-k="coin"]') as unknown as Element[]).forEach((c, i) => {
    if (i >= coinCount) return;
    const dx = coinTargets[i] - 293;
    tl.fromTo(c,
      { opacity: 1, scale: 1, x: 0, y: 0, svgOrigin: "293 285" },
      {
        motionPath: [{ x: 0, y: 0 }, { x: dx * 0.5, y: -46 }, { x: dx, y: 20 }],
        scaleX: -1,
        duration: 0.9,
        ease: "power1.inOut",
      }, 4.7 + i * 0.12);
    tl.to(c, { scaleX: 1, duration: 0.45, ease: "power1.inOut" }, 4.7 + i * 0.12 + 0.45);
    tl.to(c, { scale: 0, opacity: 0, duration: 0.12 }, 5.6 + i * 0.12);
  });
  tl.fromTo(q('[data-k="ledger"]'), { scaleY: 1 }, { scaleY: 0.985, svgOrigin: "155 318", duration: 0.08, yoyo: true, repeat: 1 }, 5.6);
  tl.fromTo(q('[data-k="plusLabel"]'), { opacity: 0, y: 6 }, { opacity: 1, y: -14, duration: 0.9, ease: "power2.out" }, 5.6);
  tl.to(q('[data-k="plusLabel"]'), { opacity: 0, duration: 0.2 }, 6.4);

  // ---------- 5.50 write ----------
  tl.fromTo(q('[data-k="ghostpen"]'),
    { opacity: 0, x: 158, y: 305, rotation: -35 },
    { opacity: 1, x: 158, y: 305, rotation: -35, duration: 0.25 }, 5.5);
  tl.to(q('[data-k="ghostpen"]'), { x: 210, duration: 0.9, ease: "power1.inOut" }, 5.75);
  tl.to(q('[data-k="ghostpen"]'), { y: 305.6, duration: 0.06, yoyo: true, repeat: 14, ease: "sine.inOut" }, 5.75);
  tl.fromTo(one<SVGRectElement>('[data-k="newrow-cliprect"]'), { attr: { width: 0 } }, { attr: { width: 52 }, duration: 0.9, ease: "power1.inOut" }, 5.75);
  tl.fromTo(q('[data-k="newrow"]'), { opacity: 1 }, { opacity: 1, duration: 0.9 }, 5.75);
  {
    const check = one('[data-k="newrow-check"]');
    const fl = one('[data-k="newrow-flourish"]');
    prepDraw(check);
    prepDraw(fl);
    tl.to(check, { strokeDashoffset: 0, duration: 0.3 }, 6.65);
    tl.to(fl, { strokeDashoffset: 0, duration: 0.35 }, 6.95);
  }
  tl.to(q('[data-k="ghostpen"]'), { y: 295, rotation: -60, opacity: 0, duration: 0.3 }, 7.3);

  // ---------- 6.90 scan ----------
  if (!mobile) {
    tl.fromTo(q('[data-k="scan"]'), { opacity: 0, x: 0 }, { opacity: 0.35, duration: 0.2 }, 6.9);
    tl.to(q('[data-k="scan"]'), { x: 150, duration: 1.1, ease: "power1.inOut" }, 6.9);
    tl.to(q('[data-k="scan"]'), { opacity: 0, duration: 0.25 }, 7.9);
  }
  (q('[data-k^="k-jar-"]') as unknown as Element[]).forEach((j, i) => {
    tl.to(j, { scale: 1.06, transformOrigin: "50% 100%", duration: 0.12, yoyo: true, repeat: 1 }, 6.9 + i * 0.07);
  });
  tl.to(q('[data-k="fill"]')[9] as unknown as Element, {
    scaleY: 0.15, transformOrigin: "50% 100%", duration: 0.6, ease: "power2.inOut",
  }, 7.3);
  if (!mobile) {
    tl.fromTo(q('[data-k="lowtag"]'),
      { opacity: 0, scale: 0.6, svgOrigin: "120 168" },
      { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, 7.5);
    tl.to(q('[data-k="lowtag"]'), { rotation: 4, svgOrigin: "120 168", duration: 0.12, yoyo: true, repeat: 3 }, 7.9);
    tl.to(q('[data-k="lowtag"]'), { rotation: 0, duration: 0.1 }, 8.3);
    tl.fromTo(q('[data-k="flagbadge"]'),
      { opacity: 0, scale: 0.6, svgOrigin: "56 108" },
      { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, 7.7);
    const num = one('[data-k="flagbadge-text"]');
    const counter = { v: 0 };
    tl.to(counter, {
      v: 18, duration: 0.9, ease: "power2.out", snap: { v: 1 },
      onUpdate: () => {
        num.textContent = `${Math.round(counter.v)} flagged`;
      },
      onComplete: () => {
        num.textContent = "18 flagged";
      },
    }, 7.8);
  }
  tl.to(q('[data-k="pupilL"], [data-k="pupilR"]'), { x: -1.5, duration: 0.2 }, 7.1);
  tl.to(q('[data-k="pupilL"], [data-k="pupilR"]'), { x: 0, duration: 0.3 }, 7.8);

  // ---------- 8.60 health ----------
  tl.fromTo(q('[data-k="healthchip"]'),
    { opacity: 0, scale: 0, svgOrigin: "388 217" },
    { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 8.6);
  {
    const ring = one('[data-k="healthchip-ring"]') as unknown as SVGCircleElement;
    const C = 2 * Math.PI * 10;
    gsap.set(ring, { strokeDasharray: C, strokeDashoffset: C * (1 - 0.44), stroke: "#C0392B" });
    tl.to(ring, { strokeDashoffset: C * (1 - 0.88), duration: 1.2, ease: "power2.out" }, 8.7);
    tl.to(ring, { stroke: "#2D6A4F", duration: 1.2 }, 8.7);
    const num = one('[data-k="healthchip-num"]');
    const health = { v: 44 };
    tl.to(health, {
      v: 88, duration: 1.2, ease: "power2.out", snap: { v: 1 },
      onUpdate: () => {
        num.textContent = String(Math.round(health.v));
      },
      onComplete: () => {
        num.textContent = "88";
      },
    }, 8.7);
  }
  (q('[data-k="sparkle"]') as unknown as Element[]).forEach((s, i) => {
    if (mobile && i > 2) return;
    tl.fromTo(s, { opacity: 0, scale: 0 }, {
      opacity: 1, scale: 1, rotation: 90, duration: 0.35,
      yoyo: true, repeat: 1, transformOrigin: "50% 50%",
    }, 9.0 + i * 0.04);
  });
  // thumbs-up: right arm about the shoulder, thumb out, max smile
  tl.to(q('[data-k="armR"]'), { rotation: -35, svgOrigin: "416 184", duration: 0.5, ease: "kSettle" }, 8.8);
  tl.to(q('[data-k="thumb"]'), { scaleY: 1.6, transformOrigin: "50% 100%", duration: 0.3 }, 9.0);
  tl.to(q('[data-k="mouth"]'), { scaleX: 1.25, transformOrigin: "50% 50%", duration: 0.3 }, 8.8);
  tl.to(q('[data-k="head"]'), { x: 3.5, duration: 0.4 }, 8.8);

  // ---------- 10.40 settle ----------
  tl.to(q('[data-k="healthchip"], [data-k="lowtag"], [data-k="flagbadge"]'),
    { scale: 0.85, opacity: 0, duration: 0.45, ease: "power2.in", stagger: 0.06 }, 10.4);
  tl.to(q('[data-k="armR"]'), { rotation: 0, duration: 0.5, ease: "power2.inOut" }, 10.4);
  tl.to(q('[data-k="thumb"]'), { scaleY: 1, duration: 0.3 }, 10.4);
  tl.to(q('[data-k="mouth"]'), { scaleX: 1, duration: 0.3 }, 10.4);
  tl.to(q('[data-k="head"]'), { x: 2, duration: 0.4 }, 10.4);
  tl.to(q('[data-k="pupilL"], [data-k="pupilR"]'), { x: -1.5, y: 1, duration: 0.3 }, 10.4);
  tl.to(q('[data-k="newrow"]'), { opacity: 0, duration: 0.5 }, 10.5);
  tl.add(() => {
    // invisible resets for the next loop (self-resetting via fromTo above)
    gsap.set(one('[data-k="newrow-cliprect"]') as unknown as Element, { attr: { width: 0 } });
    gsap.set(q('[data-k="bubble"]'), { opacity: 1, scale: 1, y: 0 });
    const t1 = one('[data-k="bubble-t1"]');
    const t2 = one('[data-k="bubble-t2"]');
    t1.textContent = BUBBLE_EN.t1;
    t2.textContent = BUBBLE_EN.t2;
    // restore the drained fill for the next loop
    gsap.set(q('[data-k="fill"]')[9] as unknown as Element, { scaleY: 1 });
  }, 11.2);

  // Tier-B: alternate bubble language per loop
  let loops = 0;
  tl.eventCallback("onRepeat", () => {
    loops += 1;
    try {
      const t1 = one('[data-k="bubble-t1"]');
      const t2 = one('[data-k="bubble-t2"]');
      const hi = loops % 2 === 1;
      t1.textContent = hi ? BUBBLE_HI.t1 : BUBBLE_EN.t1;
      t2.textContent = hi ? BUBBLE_HI.t2 : BUBBLE_EN.t2;
    } catch {
      /* mock text stays */
    }
  });

  return tl;
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
