"use client";

import gsap from "gsap";
import { easeOr, isMobile } from "../motion/registry";
import { registerLoop, unregisterLoop, runningLoopCount } from "../motion/governor";

/**
 * HERO FILM ambient life (§11 desync table + §10 idle pieces).
 * Built AFTER the intro completes (async, so every timeline/trigger/
 * delayedCall is tracked here and torn down by the returned cleanup —
 * nothing relies on gsap.context capture). All loops go through the shared
 * Loop Governor (offscreen + hidden-tab pause, Tier-B budget).
 * One owner per property per wrapper; resting poses are class/attr-based.
 */

function floatsOf(root: Element, id: string): HTMLElement | null {
  try {
    return root.querySelector<HTMLElement>(`[data-hf="obj-${id}"] .hf-float`);
  } catch {
    return null;
  }
}

export function buildAmbient(root: Element): () => void {
  const loopIds: string[] = [];
  const injected: Element[] = [];
  const delayed: gsap.core.Tween[] = [];
  const mobile = isMobile();
  const loop = (
    id: string,
    build: () => gsap.core.Timeline | gsap.core.Tween,
    nodes: number,
    tier: "A" | "B" = "B"
  ): void => {
    try {
      const tl = registerLoop({ id: `hf.${id}`, build, trigger: root, nodes, tier });
      if (tl) loopIds.push(`hf.${id}`);
    } catch {
      /* loop skipped — poster pose stands */
    }
  };

  // ---- Tier A: ruled paper slide (exactly one 44px period / 8s, seamless) ----
  try {
    const paper = root.querySelector<HTMLElement>('[data-hf="paper-slide"]');
    if (paper) {
      loop(
        "paper",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          tl.fromTo(paper, { y: -44 }, { y: 0, duration: 8, ease: "none" });
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* paper stays */
  }

  // ---- Tier A: aurora Lissajous drift (17/23s + 13s breathe) ----
  try {
    const blobs = Array.from(root.querySelectorAll<HTMLElement>('[data-hf^="aurora-"]'));
    const cfgs = [
      { x: "8vw", dx: "11s", y: "6vh", dy: "7.3s" },
      { x: "-7vw", dx: "13s", y: "5vh", dy: "9.1s" },
      { x: "5vw", dx: "9s", y: "-5vh", dy: "8.3s" },
    ];
    blobs.forEach((b, i) => {
      const c = cfgs[i % cfgs.length];
      loop(`aurora${i}`, () => {
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(b, { x: c.x, duration: parseFloat(c.dx), ease: "sine.inOut" }, 0).to(
          b,
          { y: c.y, duration: parseFloat(c.dy), ease: "sine.inOut" },
          0
        );
        return tl;
      }, 1, "A");
    });
    if (blobs[0]) {
      loop(
        "aurora-breathe",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(blobs[0], { scale: 1.08, duration: 13, ease: "sine.inOut" });
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* aurora stays */
  }

  // ---- Tier A: watermark breathing (scale only; scrub owns y in Phase 5) ----
  try {
    const wm = root.querySelector<HTMLElement>(".font-devanagari.pointer-events-none");
    if (wm) {
      loop(
        "wm",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(wm, { scale: 1.03, duration: 7.1, ease: "sine.inOut" });
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier A: object floats (prime desync; bill gets flutter+skew) ----
  const floatCfgs: Array<{ id: string; y: number; d: number; r?: number; rd?: number }> = [
    { id: "bill", y: 8, d: 5.9, r: 6, rd: 4.3 },
    { id: "chat-owner", y: 7, d: 5.9 },
    { id: "chat-ai", y: 6, d: 7.1 },
    { id: "health", y: 5, d: 4.3 },
    { id: "hub", y: 6, d: 5.9 },
    { id: "mic", y: 5, d: 7.1 },
    { id: "diya", y: 4, d: 5.9 },
    { id: "coin-big", y: 6, d: 4.3 },
    { id: "coin-mid", y: 5, d: 5.9 },
    { id: "coin-small", y: 4, d: 7.1 },
    { id: "stamp", y: 4, d: 8.3 },
    { id: "upi", y: 5, d: 7.1 },
  ];
  floatCfgs.forEach((c) => {
    const f = floatsOf(root, c.id);
    if (!f) return;
    loop(`float-${c.id}`, () => {
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(f, { y: c.y, duration: c.d, ease: "sine.inOut" }, 0);
      if (c.r) tl.to(f, { rotation: c.r, duration: c.rd ?? c.d, ease: "sine.inOut" }, 0);
      return tl;
    }, 1, "A");
  });
  // Bill skew partner (same float wrapper, same timeline family — one owner).
  try {
    const bf = floatsOf(root, "bill");
    if (bf) {
      loop(
        "bill-skew",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(bf, { skewX: 3, duration: 3.3, ease: "sine.inOut" });
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier A: coins spin + face swap + big-coin hop ----
  const coinCfgs = [
    { id: "coin-big", d: 2.9, hop: true },
    { id: "coin-mid", d: 3.7, hop: false },
    { id: "coin-small", d: 4.3, hop: false },
  ];
  coinCfgs.forEach((c) => {
    try {
      const obj = root.querySelector<HTMLElement>(`[data-hf="obj-${c.id}"]`);
      const f = floatsOf(root, c.id);
      const front = obj?.querySelector<HTMLElement>('[data-hf="coin-front"]');
      const back = obj?.querySelector<HTMLElement>('[data-hf="coin-back"]');
      if (!obj || !f || !front || !back) return;
      loop(`spin-${c.id}`, () => {
        const tl = gsap.timeline({ repeat: -1 });
        tl.to(f, { scaleX: -1, duration: c.d / 2, ease: "sine.inOut" }, 0)
          .call(() => {
            try {
              gsap.set(front, { opacity: 0 });
              gsap.set(back, { opacity: 1 });
            } catch {
              /* noop */
            }
          }, [], c.d / 4)
          .to(f, { scaleX: 1, duration: c.d / 2, ease: "sine.inOut" }, c.d / 2)
          .call(() => {
            try {
              gsap.set(front, { opacity: 1 });
              gsap.set(back, { opacity: 0 });
            } catch {
              /* noop */
            }
          }, [], (c.d * 3) / 4);
        return tl;
      }, 2, "A");
      if (c.hop) {
        // Hop lives on the outer .hf-obj (float owns .hf-float y) — no fight.
        loop(
          "hop",
          () => {
            const tl = gsap.timeline({ repeat: -1, repeatDelay: 7 });
            tl.to(obj, { y: -14, duration: 0.32, ease: "power2.out" }, 0).to(
              obj,
              { y: 0, scaleY: 0.88, duration: 0.22, ease: "power2.in" },
              0.32
            ).to(obj, { scaleY: 1, duration: 0.4, ease: easeOr("kSettle", "back.out(2)") }, 0.54);
            return tl;
          },
          1,
          "B"
        );
      }
    } catch {
      /* coin stays */
    }
  });

  // ---- Tier A: bill scan bar + total-underline redraw ----
  try {
    const scan = root.querySelector<SVGRectElement>('[data-hf="bill-scan"]');
    const lines = Array.from(root.querySelectorAll<SVGLineElement>('[data-hf="bill-underline"]'));
    if (scan && lines.length) {
      const lens = lines.map((l) => {
        try {
          const n = l.getTotalLength();
          gsap.set(l, { strokeDasharray: n, strokeDashoffset: 0 });
          return n;
        } catch {
          return 0;
        }
      });
      loop(
        "scan",
        () => {
          const tl = gsap.timeline({ repeat: -1, repeatDelay: 6.2 });
          tl.fromTo(scan, { y: 0, opacity: 0.85 }, { y: 118, duration: 0.9, ease: "power1.inOut" }, 0)
            .to(scan, { opacity: 0, duration: 0.2 }, 0.9)
            .to(
              lines,
              {
                strokeDashoffset: (_i: number, _t: SVGLineElement) => lens[_i] ?? 0,
                duration: 0.25,
                ease: "power2.in",
                stagger: 0.05,
              },
              0.5
            )
            .to(
              lines,
              { strokeDashoffset: 0, duration: 0.5, ease: easeOr("kPen", "power1.inOut"), stagger: 0.08 },
              0.9
            );
          return tl;
        },
        2,
        "A"
      );
    }
  } catch {
    /* bill stays */
  }

  // ---- Tier A: ring halo breathe (transform-only ring) ----
  try {
    const halo = root.querySelector<SVGElement>('[data-hf="ring-halo"]');
    if (halo) {
      loop(
        "halo",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(halo, { scale: 1.15, transformOrigin: "50% 50%", duration: 3.7, ease: "sine.inOut" });
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier B: camera breathing (skipped on mobile) ----
  if (!mobile) {
    try {
      const stage = root.querySelector<HTMLElement>('[data-hf="stage"]');
      if (stage) {
        loop(
          "cam",
          () => {
            const tl = gsap.timeline({ repeat: -1, yoyo: true });
            tl.to(stage, { scale: 1.012, duration: 8.3, ease: "sine.inOut" }, 0)
              .to(stage, { rotation: 0.15, duration: 11, ease: "sine.inOut" }, 0)
              .to(stage, { x: 3, duration: 7.3, ease: "sine.inOut" }, 0);
            return tl;
          },
          1,
          "B"
        );
      }
    } catch {
      /* camera still */
    }
  }

  // ---- Tier B: hub ring rotation ----
  try {
    const ring = root.querySelector<SVGGElement>('[data-hf="hub-ring"]');
    if (ring) {
      loop(
        "hub",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          tl.to(ring, { rotation: 360, transformOrigin: "50% 50%", duration: 11, ease: "none" });
          return tl;
        },
        1,
        "B"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier B: mic bars + pulse rings ----
  try {
    const bars = Array.from(root.querySelectorAll<SVGRectElement>('[data-hf="mic-bar"]'));
    if (bars.length) {
      loop(
        "mic",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          bars.forEach((b, i) => {
            tl.to(
              b,
              { scaleY: 0.35, transformOrigin: "50% 50%", duration: 0.3 + i * 0.02, ease: "sine.inOut" },
              (i % 7) * 0.13
            );
          });
          return tl;
        },
        Math.min(bars.length, 4),
        "B"
      );
    }
    const rings = Array.from(root.querySelectorAll<SVGCircleElement>('[data-hf="mic-ring"]'));
    if (rings.length) {
      loop(
        "mic-ring",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          rings.forEach((r, i) => {
            tl.fromTo(
              r,
              { scale: 1, opacity: 0.5, transformOrigin: "50% 50%" },
              { scale: 2, opacity: 0, duration: 2.4, ease: "power1.out" },
              i * 0.4
            );
          });
          return tl;
        },
        2,
        "B"
      );
    }
  } catch {
    /* mic stays */
  }

  // ---- Tier B: diya flame wobble + embers ----
  try {
    const flame = root.querySelector<SVGGElement>('[data-hf="diya-flame"]');
    if (flame) {
      loop(
        "diya",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(flame, {
            scaleX: 1.12,
            scaleY: 0.94,
            transformOrigin: "50% 90%",
            duration: 0.45,
            ease: "sine.inOut",
          });
          return tl;
        },
        1,
        "B"
      );
    }
    const embers = Array.from(root.querySelectorAll<SVGCircleElement>('[data-hf="diya-ember"]'));
    if (embers.length) {
      loop(
        "embers",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          embers.forEach((e, i) => {
            tl.fromTo(
              e,
              { y: 0, opacity: 0 },
              { y: -26, opacity: 0.8, duration: 1.1, ease: "sine.out" },
              i * 0.5
            ).to(e, { opacity: 0, duration: 1, ease: "sine.in" }, i * 0.5 + 1.1);
          });
          return tl;
        },
        Math.min(embers.length, 2),
        "B"
      );
    }
  } catch {
    /* diya stays */
  }

  // ---- Tier B: jar wobble (random 6–10s chain, killed on cleanup) ----
  try {
    const jf = floatsOf(root, "jar");
    if (jf) {
      const wob = { go: true };
      const kick = (): void => {
        if (!wob.go) return;
        try {
          const t = gsap.timeline({
            onComplete: () => {
              try {
                const d = gsap.delayedCall(6 + Math.random() * 4, kick);
                delayed.push(d as unknown as gsap.core.Tween);
              } catch {
                /* stop */
              }
            },
          });
          t.to(jf, { rotation: 3, transformOrigin: "50% 100%", duration: 0.18, ease: "sine.out" })
            .to(jf, { rotation: -2, duration: 0.16 })
            .to(jf, { rotation: 1, duration: 0.14 })
            .to(jf, { rotation: 0, duration: 0.22 });
          delayed.push(t as unknown as gsap.core.Tween);
        } catch {
          /* stop */
        }
      };
      try {
        const first = gsap.delayedCall(5, kick);
        delayed.push(first as unknown as gsap.core.Tween);
      } catch {
        /* noop */
      }
    }
  } catch {
    /* jar stays */
  }

  // ---- Tier B: badge ping ring (injected; badge is position:relative) ----
  try {
    const badge = root.querySelector<HTMLElement>('[data-gsap="badge"]');
    if (badge) {
      const ping = document.createElement("span");
      ping.setAttribute("aria-hidden", "true");
      ping.setAttribute("data-hf", "badge-ping");
      ping.className = "hf-ping";
      badge.appendChild(ping);
      injected.push(ping);
      loop(
        "ping",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          tl.fromTo(
            ping,
            { scale: 1, opacity: 0.5 },
            { scale: 2.2, opacity: 0, duration: 2.4, ease: "power1.out" }
          );
          return tl;
        },
        1,
        "B"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier B: sheens (watermark strip 9s; "AI Brain" bar 6s) ----
  const injectSheen = (host: HTMLElement | null, cls: string, key: string): HTMLElement | null => {
    try {
      if (!host) return null;
      if (host.querySelector(`[data-hf="${key}"]`)) return null;
      const bar = document.createElement("span");
      bar.setAttribute("aria-hidden", "true");
      bar.setAttribute("data-hf", key);
      bar.className = cls;
      host.appendChild(bar);
      injected.push(bar);
      return bar;
    } catch {
      return null;
    }
  };
  try {
    const wm = root.querySelector<HTMLElement>(".font-devanagari.pointer-events-none");
    const wmBar = injectSheen(wm, "hf-sheen", "wm-sheen");
    if (wmBar && wm) {
      loop(
        "sheen-wm",
        () => {
          const tl = gsap.timeline({ repeat: -1, repeatDelay: 6.6 });
          tl.fromTo(wmBar, { x: "-40%", opacity: 0 }, { opacity: 0.5, duration: 0.4 }, 0)
            .to(wmBar, { x: "320%", duration: 2, ease: "power1.inOut" }, 0.2)
            .to(wmBar, { opacity: 0, duration: 0.4 }, 2.0);
          return tl;
        },
        1,
        "B"
      );
    }
  } catch {
    /* noop */
  }
  try {
    const accent = Array.from(root.querySelectorAll<HTMLElement>('[data-gsap="mask"]')).find(
      (el) => el.style.fontStyle === "italic"
    );
    const aiBar = injectSheen(accent ?? null, "hf-sheen-ai", "ai-sheen");
    if (aiBar) {
      loop(
        "sheen-ai",
        () => {
          const tl = gsap.timeline({ repeat: -1, repeatDelay: 4.2 });
          tl.fromTo(aiBar, { x: "-60%", opacity: 0 }, { opacity: 0.55, duration: 0.3 }, 0)
            .to(aiBar, { x: "240%", duration: 1.5, ease: "power1.inOut" }, 0.15)
            .to(aiBar, { opacity: 0, duration: 0.3 }, 1.4);
          return tl;
        },
        1,
        "B"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier B: sparkle stars at "AI Brain" upper-right ----
  try {
    const accent = Array.from(root.querySelectorAll<HTMLElement>('[data-gsap="mask"]')).find(
      (el) => el.style.fontStyle === "italic"
    );
    if (accent) {
      const stars: HTMLElement[] = [];
      for (let i = 0; i < 3; i++) {
        try {
          const s = document.createElement("span");
          s.setAttribute("aria-hidden", "true");
          s.setAttribute("data-hf", "ai-spark");
          s.className = "hf-spark";
          s.style.right = `${2 + i * 7}%`;
          s.style.top = `${-4 + i * 9}%`;
          accent.appendChild(s);
          injected.push(s);
          stars.push(s);
        } catch {
          /* noop */
        }
      }
      if (stars.length) {
        loop(
          "spark",
          () => {
            const tl = gsap.timeline({ repeat: -1 });
            stars.forEach((s, i) => {
              tl.fromTo(
                s,
                { scale: 0, rotation: 0, opacity: 0 },
                { scale: 1, rotation: 90, opacity: 1, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: 1 },
                i * 0.3
              );
            });
            tl.to({}, { duration: 1.2 });
            return tl;
          },
          Math.min(stars.length, 2),
          "B"
        );
      }
    }
  } catch {
    /* noop */
  }

  // ---- Tier A/B idle: arrow nudge, play pulse, trust pulse, word breath ----
  try {
    const arrow = root.querySelector<HTMLElement>(".hf-arrow");
    if (arrow) {
      loop(
        "arrow",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          tl.to(arrow, { x: 4, duration: 0.5, ease: "sine.inOut", yoyo: true, repeat: 1 }).to(
            {},
            { duration: 0.6 }
          );
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* noop */
  }
  try {
    const play = root.querySelector<HTMLElement>('[data-gsap="cta"] svg');
    if (play) {
      loop(
        "play",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(play, { scale: 1.12, transformOrigin: "50% 50%", duration: 1.2, ease: "sine.inOut" });
          return tl;
        },
        1,
        "A"
      );
    }
  } catch {
    /* noop */
  }
  try {
    const segs = Array.from(root.querySelectorAll<HTMLElement>(".hf-trustseg"));
    if (segs.length) {
      loop(
        "trust",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          tl.to(segs, { opacity: 0.6, duration: 2.1, ease: "sine.inOut", stagger: 0.4 });
          return tl;
        },
        1,
        "B"
      );
    }
  } catch {
    /* noop */
  }
  try {
    const words = Array.from(root.querySelectorAll<HTMLElement>("#hero-heading .hf-wword"));
    if (words.length) {
      loop(
        "breath",
        () => {
          const tl = gsap.timeline({ repeat: -1, yoyo: true });
          words.forEach((w, i) => {
            tl.to(w, { y: -1.2, duration: 2.95, ease: "sine.inOut" }, i * 0.35);
          });
          return tl;
        },
        Math.min(words.length, 4),
        "B"
      );
    }
  } catch {
    /* noop */
  }

  // ---- Tier C: light-leak sweep (14s cycle; skipped when busy) ----
  try {
    if (!mobile && runningLoopCount() <= 12) {
      const leak = root.querySelector<HTMLElement>('[data-hf="layer-leak"]');
      if (leak) {
        loop(
          "leak",
          () => {
            const tl = gsap.timeline({ repeat: -1, repeatDelay: 10.8 });
            tl.fromTo(
              leak,
              { xPercent: 0 },
              { xPercent: 383, duration: 3.2, ease: "power1.inOut" }
            );
            return tl;
          },
          1,
          "B"
        );
      }
    }
  } catch {
    /* leak stays parked */
  }

  return () => {
    loopIds.forEach((id) => {
      try {
        unregisterLoop(id);
      } catch {
        /* noop */
      }
    });
    delayed.forEach((d) => {
      try {
        d.kill();
      } catch {
        /* noop */
      }
    });
    injected.forEach((el) => {
      try {
        el.remove();
      } catch {
        /* noop */
      }
    });
  };
}
