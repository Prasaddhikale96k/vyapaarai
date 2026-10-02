"use client";

import gsap from "gsap";
import { easeOr, isMobile } from "../motion/registry";
import { registerLoop, unregisterLoop } from "../motion/governor";
import { CHAT_OWNER_SCRIPT, CHAT_AI_SCRIPT, TOAST_SCRIPT } from "./constants";

/**
 * HERO FILM story loop (§11 Acts I–IV on an 18s master timeline) + free-run
 * actors (chat cycle, packets, toasts, UPI). Chat/packets/toasts/UPI run on
 * their own governor loops rather than act-gated timelines: same elements
 * stay alive with zero prop fights and the acts keep their beats.
 * DOWNGRADED (logged): energy proxy + mic swell (would fight ambient loops
 * on the same props); stage screen-shake already dropped in hero-3.
 */

const C_RING = 2 * Math.PI * 26;

function center(el: Element | null, stage: Element): { x: number; y: number } | null {
  try {
    if (!el) return null;
    const r = (el as HTMLElement).getBoundingClientRect();
    const s = (stage as HTMLElement).getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  } catch {
    return null;
  }
}

function toUnits(svg: SVGSVGElement, px: number, py: number): { x: number; y: number } {
  try {
    const r = svg.getBoundingClientRect();
    return { x: (px / Math.max(1, r.width)) * 1600, y: (py / Math.max(1, r.height)) * 900 };
  } catch {
    return { x: 0, y: 0 };
  }
}

export function buildStory(root: Element): () => void {
  const loopIds: string[] = [];
  const injected: Element[] = [];
  const delayed: gsap.core.Tween[] = [];
  const mobile = isMobile();
  const stage = root.querySelector<HTMLElement>('[data-hf="stage"]');
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
      /* actor skipped */
    }
  };

  // ---------- chat line mask-wrap (atomic lines, revert on cleanup) ----------
  const chatInners: HTMLElement[] = [];
  try {
    ["chat-owner", "chat-ai"].forEach((id) => {
      const line = root.querySelector<HTMLElement>(`[data-hf="obj-${id}"] [data-hf="chat-line"]`);
      if (!line || line.parentElement?.classList.contains("hf-wmask")) return;
      const mask = document.createElement("span");
      mask.setAttribute("aria-hidden", "true");
      mask.className = "hf-wmask";
      const inner = document.createElement("span");
      inner.className = "hf-wword";
      line.parentNode?.insertBefore(mask, line);
      mask.appendChild(inner);
      inner.appendChild(line);
      chatInners.push(inner);
    });
  } catch {
    /* lines stay static */
  }
  const typingOf = (id: string): HTMLElement | null => {
    try {
      return root.querySelector<HTMLElement>(`[data-hf="obj-${id}"] [data-hf="chat-typing"]`);
    } catch {
      return null;
    }
  };

  // ---------- AI check tick (injected once, drawn per cycle) ----------
  let checkPath: SVGPathElement | null = null;
  let checkLen = 0;
  try {
    const aiObj = root.querySelector(`[data-hf="obj-chat-ai"] .hf-float`);
    if (aiObj) {
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("data-hf", "ai-check");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.style.cssText = "position:absolute;right:6px;bottom:4px;width:16px;height:16px;";
      checkPath = document.createElementNS(ns, "path");
      checkPath.setAttribute("d", "M4 10.5 L8.5 15 L16 6");
      checkPath.setAttribute("fill", "none");
      checkPath.setAttribute("stroke", "#2D6A4F");
      checkPath.setAttribute("stroke-width", "2.5");
      checkPath.setAttribute("stroke-linecap", "round");
      checkPath.setAttribute("stroke-linejoin", "round");
      svg.appendChild(checkPath);
      const chip = aiObj.querySelector(".hf-chip") as HTMLElement | null;
      if (chip) {
        if (window.getComputedStyle(chip).position === "static") chip.style.position = "relative";
        chip.appendChild(svg);
        injected.push(svg);
        try {
          checkLen = checkPath.getTotalLength();
          gsap.set(checkPath, { strokeDasharray: checkLen, strokeDashoffset: checkLen });
        } catch {
          checkLen = 0;
        }
      }
    }
  } catch {
    checkPath = null;
  }

  const swapLine = (
    tl: gsap.core.Timeline,
    inner: HTMLElement,
    getText: () => string,
    at: number
  ): void => {
    tl.to(inner, { yPercent: -110, duration: 0.28, ease: "power2.in" }, at).call(
      () => {
        try {
          const line = inner.firstElementChild as HTMLElement | null;
          if (line) line.textContent = getText();
        } catch {
          /* noop */
        }
      },
      [],
      at + 0.28
    ).fromTo(inner, { yPercent: 110 }, { yPercent: 0, duration: 0.32, ease: "power2.out" }, at + 0.3);
  };

  // ---------- chat cycle (continuous, 6s) ----------
  if (chatInners.length === 2) {
    const [ownerIn, aiIn] = chatInners;
    const ownerTy = typingOf("chat-owner");
    const aiTy = typingOf("chat-ai");
    let oi = 0;
    let ai = 0;
    loop(
      "chat",
      () => {
        const tl = gsap.timeline({ repeat: -1 });
        // owner thinks → speaks
        if (ownerTy) tl.to(ownerTy, { opacity: 1, duration: 0.25 }, 0);
        swapLine(
          tl,
          ownerIn,
          () => {
            oi = (oi + 1) % CHAT_OWNER_SCRIPT.length;
            return CHAT_OWNER_SCRIPT[oi];
          },
          1.0
        );
        if (ownerTy) tl.to(ownerTy, { opacity: 0, duration: 0.2 }, 1.0);
        // AI thinks → replies (+1.4s) → check draws
        if (aiTy) tl.to(aiTy, { opacity: 1, duration: 0.25 }, 2.4);
        swapLine(
          tl,
          aiIn,
          () => {
            ai = (ai + 1) % CHAT_AI_SCRIPT.length;
            return CHAT_AI_SCRIPT[ai];
          },
          3.4
        );
        tl.call(
          () => {
            if (checkPath && checkLen > 0) {
              try {
                gsap.fromTo(
                  checkPath,
                  { strokeDashoffset: checkLen },
                  { strokeDashoffset: 0, duration: 0.3, ease: "power1.out" }
                );
              } catch {
                /* noop */
              }
            }
          },
          [],
          3.7
        );
        if (aiTy) tl.to(aiTy, { opacity: 0, duration: 0.2 }, 3.8);
        tl.to({}, { duration: 1.6 });
        return tl;
      },
      2,
      "A"
    );
    // typing-dot wave (visible only while a typing row is up)
    try {
      const dots = Array.from(root.querySelectorAll<HTMLElement>(".hf-typing i"));
      if (dots.length) {
        loop(
          "typing",
          () => {
            const tl = gsap.timeline({ repeat: -1, yoyo: true });
            dots.forEach((d, i) => {
              tl.to(d, { y: -3, duration: 0.3, ease: "sine.inOut" }, (i % 3) * 0.12);
            });
            return tl;
          },
          1,
          "B"
        );
      }
    } catch {
      /* noop */
    }
  }

  // ---------- packets (desktop only; static spokes stay on mobile) ----------
  if (!mobile && stage) {
    const routes: Array<{ from: string; to: string }> = [
      { from: "chat-owner", to: "hub" },
      { from: "hub", to: "chat-ai" },
      { from: "hub", to: "health" },
      { from: "hub", to: "jar" },
      { from: "hub", to: "diya" },
    ];
    const layer = root.querySelector<SVGGElement>('[data-hf="packets"]');
    const svg = root.querySelector<SVGSVGElement>(".hf-spokes-svg");
    if (layer && svg) {
      loop(
        "packets",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          routes.forEach((r, i) => {
            const a = center(root.querySelector(`[data-hf="obj-${r.from}"]`), stage);
            const b = center(root.querySelector(`[data-hf="obj-${r.to}"]`), stage);
            if (!a || !b) return;
            const pa = toUnits(svg, a.x, a.y);
            const pb = toUnits(svg, b.x, b.y);
            const mx = (pa.x + pb.x) / 2;
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const bow = 90;
            const cx = mx + (-dy / len) * bow;
            const cy = (pa.y + pb.y) / 2 + (dx / len) * bow;
            const at = i * 0.8;
            tl.call(
              () => {
                try {
                  const ns = "http://www.w3.org/2000/svg";
                  const pathEl = document.createElementNS(ns, "path");
                  pathEl.setAttribute(
                    "d",
                    `M${pa.x} ${pa.y} Q${cx} ${cy} ${pb.x} ${pb.y}`
                  );
                  pathEl.setAttribute("fill", "none");
                  layer.appendChild(pathEl);
                  const g = document.createElementNS(ns, "g");
                  g.setAttribute("data-hf", "packet");
                  const dot = document.createElementNS(ns, "circle");
                  dot.setAttribute("r", "3.5");
                  dot.setAttribute("fill", "#E8771A");
                  const tail = document.createElementNS(ns, "ellipse");
                  tail.setAttribute("rx", "8");
                  tail.setAttribute("ry", "2.5");
                  tail.setAttribute("fill", "#E8771A");
                  tail.setAttribute("opacity", "0.45");
                  g.appendChild(tail);
                  g.appendChild(dot);
                  layer.appendChild(g);
                  const fly = gsap.timeline({
                    onComplete: () => {
                      try {
                        g.remove();
                      } catch {
                        /* noop */
                      }
                      try {
                        pathEl.remove();
                      } catch {
                        /* noop */
                      }
                      // arrival: squash-pulse the target float + flash the hub
                      try {
                        const tgt = root.querySelector<HTMLElement>(
                          `[data-hf="obj-${r.to}"] .hf-float`
                        );
                        if (tgt && !r.to.startsWith("coin")) {
                          gsap.fromTo(
                            tgt,
                            { scale: 1.08 },
                            { scale: 1, duration: 0.25, ease: easeOr("kSettle", "back.out(2)") }
                          );
                        }
                        if (r.to === "hub") {
                          const fl = root.querySelector<SVGElement>('[data-hf="hub-flash"]');
                          if (fl) {
                            gsap.fromTo(
                              fl,
                              { opacity: 0.8, scale: 1, transformOrigin: "50% 50%" },
                              { opacity: 0, scale: 1.6, duration: 0.5, ease: "power1.out" }
                            );
                          }
                        }
                      } catch {
                        /* noop */
                      }
                    },
                  });
                  fly.to(
                    dot,
                    {
                      motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5] },
                      duration: 1.1,
                      ease: "sine.inOut",
                    },
                    0
                  );
                  fly.to(
                    tail,
                    {
                      motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5], autoRotate: true },
                      duration: 1.1,
                      ease: "sine.inOut",
                    },
                    0.05
                  );
                } catch {
                  /* packet skipped */
                }
              },
              [],
              at
            );
          });
          tl.to({}, { duration: routes.length * 0.8 + 1.6 });
          return tl;
        },
        6,
        "B"
      );
    }
  }

  // ---------- growth + ring + jar + stamp master (18s) ----------
  try {
    const green = root.querySelector<SVGPathElement>('[data-hf="growth-green"]');
    const red = root.querySelector<SVGPathElement>('[data-hf="growth-red"]');
    const chip88 = root.querySelector<SVGGElement>('[data-hf="growth-chip88"]');
    const ringG = root.querySelector<SVGCircleElement>('[data-hf="ring-green"]');
    const ringR = root.querySelector<SVGElement>('[data-hf="ring-red"]');
    const ringNum = root.querySelector<SVGTextElement>('[data-hf="ring-num"]');
    const ringSvg = root.querySelector(`[data-hf="obj-health"] svg`);
    const jarFill = root.querySelector<SVGRectElement>('[data-hf="jar-fill"]');
    const jarLow = root.querySelector<SVGGElement>('[data-hf="jar-low"]');
    const jarNum = root.querySelector<SVGTextElement>('[data-hf="jar-num"]');
    const stampHit = root.querySelector<SVGGElement>('[data-hf="stamp-hit"]');
    const stampOk = root.querySelector<SVGGElement>('[data-hf="stamp-ok"]');
    const growthBox = root.querySelector<HTMLElement>('[data-hf="layer-growth"]');

    let greenLen = 0;
    let redLen = 0;
    try {
      if (green) {
        greenLen = green.getTotalLength();
        gsap.set(green, { strokeDasharray: greenLen, strokeDashoffset: greenLen });
      }
      if (red) {
        redLen = red.getTotalLength();
        gsap.set(red, { strokeDasharray: redLen, strokeDashoffset: redLen });
      }
    } catch {
      /* lines stay */
    }
    const off44 = C_RING * (1 - 0.44);
    const off88 = C_RING * (1 - 0.88);
    try {
      if (ringG) {
        gsap.set(ringG, { strokeDasharray: C_RING, strokeDashoffset: off44 });
        if (ringNum) ringNum.textContent = "44";
      }
      if (ringR) gsap.set(ringR, { opacity: 0.8 });
    } catch {
      /* ring stays */
    }

    loop(
      "story",
      () => {
        const tl = gsap.timeline({ repeat: -1 });
        // --- Act I CHAOS 0–5: stamp slams; red leads ---
        if (stampHit) {
          tl.fromTo(
            stampHit,
            { scale: 1.7, rotation: -22, transformOrigin: "50% 50%" },
            { scale: 1, rotation: -12, duration: 0.35, ease: easeOr("kSettle", "back.out(2)") },
            0.4
          );
        }
        if (growthBox) tl.fromTo(growthBox, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0);
        if (redLen > 0 && red)
          tl.to(red, { strokeDashoffset: 0, duration: 4.5, ease: easeOr("kPen", "power1.inOut") }, 0.4);
        // --- Act II CAPTURE 5–9: bill flight, coin pop, ₹ tick ---
        tl.call(() => billFlight(), [], 5.0);
        tl.call(() => tickBill(), [], 6.0);
        tl.call(() => coinPop(), [], 7.0);
        // --- Act III ORDER 9–14: green over red, ring 44→88, jar, diya, approve ---
        if (greenLen > 0 && green)
          tl.to(green, { strokeDashoffset: 0, duration: 9, ease: easeOr("kPen", "power1.inOut") }, 4.9);
        if (ringG) tl.to(ringG, { strokeDashoffset: off88, duration: 3, ease: easeOr("kPen", "power1.inOut") }, 9.0);
        if (ringR) tl.to(ringR, { opacity: 0, duration: 2 }, 9.0);
        if (ringNum) {
          const o = { v: 44 };
          tl.to(o, {
            v: 88,
            duration: 3,
            ease: "none",
            onUpdate: () => {
              try {
                if (ringNum) ringNum.textContent = String(Math.round(o.v));
              } catch {
                /* noop */
              }
            },
          }, 9.0);
        }
        tl.call(() => ringBurst(), [], 12.0);
        tl.call(() => jarDrain(), [], 10.0);
        tl.call(() => diyaPop(), [], 11.0);
        if (stampOk) {
          tl.fromTo(
            stampOk,
            { scale: 1.6, opacity: 0, transformOrigin: "50% 50%" },
            { scale: 1, opacity: 1, duration: 0.3, ease: easeOr("kSettle", "back.out(2)") },
            12.0
          );
        }
        if (chip88)
          tl.fromTo(
            chip88,
            { scale: 0.6, opacity: 0.4, transformOrigin: "50% 50%" },
            { scale: 1, opacity: 1, duration: 0.5, ease: easeOr("kSettle", "back.out(2)") },
            13.9
          );
        // --- Act IV ALIVE 14–18: jar refills, everything relaxes to poster ---
        tl.call(() => jarFillUp(), [], 14.0);
        if (stampHit && stampOk) {
          tl.to([stampHit, stampOk], { opacity: 0, duration: 0.6 }, 16.8);
          tl.to(stampHit, { opacity: 1, duration: 0.6 }, 17.4);
        }
        if (growthBox) tl.to(growthBox, { opacity: 0, duration: 0.8 }, 15.5);
        if (ringSvg) {
          tl.to(ringSvg, { opacity: 0, duration: 0.3 }, 17.2);
          tl.call(() => {
            try {
              if (ringG) gsap.set(ringG, { strokeDashoffset: off44 });
              if (ringR) gsap.set(ringR, { opacity: 0.8 });
              if (ringNum) ringNum.textContent = "44";
            } catch {
              /* noop */
            }
          }, [], 17.5);
          tl.to(ringSvg, { opacity: 1, duration: 0.3 }, 17.6);
        }
        tl.to({}, { duration: 0.1 });
        return tl;
      },
      6,
      "A"
    );

    const ringBurst = (): void => {
      try {
        const sparks = Array.from(root.querySelectorAll<SVGCircleElement>('[data-hf="ring-spark"]'));
        if (!sparks.length) return;
        const t = gsap.timeline();
        sparks.forEach((s, i) => {
          t.fromTo(
            s,
            { scale: 0, opacity: 0, transformOrigin: "50% 50%" },
            {
              scale: 1,
              opacity: 1,
              duration: 0.3,
              ease: "power2.out",
              onComplete: () => {
                try {
                  gsap.to(s, { scale: 0, opacity: 0, duration: 0.4 });
                } catch {
                  /* noop */
                }
              },
            },
            i * 0.04
          );
        });
        delayed.push(t as unknown as gsap.core.Tween);
      } catch {
        /* noop */
      }
    };

    const jarDrain = (): void => {
      try {
        if (jarFill)
          gsap.to(jarFill, { scaleY: 0.15, transformOrigin: "50% 100%", duration: 0.9, ease: "power2.inOut" });
        if (jarLow) {
          const t = gsap.timeline();
          t.fromTo(jarLow, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.4, ease: easeOr("kSettle", "back.out(2)") })
            .to(jarLow, { rotation: 4, duration: 0.12 })
            .to(jarLow, { rotation: -4, duration: 0.12 })
            .to(jarLow, { rotation: 0, duration: 0.12 });
          delayed.push(t as unknown as gsap.core.Tween);
        }
        if (jarNum) {
          const o = { v: 0 };
          try {
            jarNum.textContent = "0";
          } catch {
            /* noop */
          }
          const t = gsap.to(o, {
            v: 18,
            duration: 0.9,
            ease: "none",
            onUpdate: () => {
              try {
                if (jarNum) jarNum.textContent = String(Math.round(o.v));
              } catch {
                /* noop */
              }
            },
          });
          delayed.push(t as unknown as gsap.core.Tween);
        }
      } catch {
        /* noop */
      }
    };

    const jarFillUp = (): void => {
      try {
        if (jarFill) gsap.to(jarFill, { scaleY: 1, duration: 1.4, ease: "power1.inOut" });
        if (jarLow) gsap.to(jarLow, { opacity: 0, duration: 0.4 });
      } catch {
        /* noop */
      }
    };

    const diyaPop = (): void => {
      try {
        const chip = root.querySelector<SVGGElement>('[data-hf="diya-chip"]');
        if (chip)
          gsap.fromTo(
            chip,
            { scale: 0.5, opacity: 0, transformOrigin: "50% 50%" },
            { scale: 1, opacity: 1, duration: 0.45, ease: easeOr("kSettle", "back.out(2)") }
          );
      } catch {
        /* noop */
      }
    };

    const tickBill = (): void => {
      try {
        const total = root.querySelector<SVGTextElement>('[data-hf="obj-bill"] text');
        if (!total) return;
        const o = { v: 0 };
        gsap.to(o, {
          v: 2340,
          duration: 1,
          ease: "power1.out",
          onUpdate: () => {
            try {
              total.textContent = `₹${Math.round(o.v).toLocaleString("en-IN")}`;
            } catch {
              /* noop */
            }
          },
        });
      } catch {
        /* noop */
      }
    };

    const billFlight = (): void => {
      try {
        if (!stage) return;
        const svg = root.querySelector<SVGSVGElement>(".hf-spokes-svg");
        const layer = root.querySelector<SVGGElement>('[data-hf="packets"]');
        if (!svg || !layer) return;
        const from = center(root.querySelector('[data-hf="obj-bill"]'), stage);
        const to = center(root.querySelector('[data-hf="obj-chat-owner"]'), stage);
        if (!from || !to) return;
        const pa = toUnits(svg, from.x, from.y);
        const pb = toUnits(svg, to.x, to.y);
        const ns = "http://www.w3.org/2000/svg";
        const pathEl = document.createElementNS(ns, "path");
        pathEl.setAttribute("d", `M${pa.x} ${pa.y} Q${(pa.x + pb.x) / 2} ${Math.min(pa.y, pb.y) - 120} ${pb.x} ${pb.y}`);
        pathEl.setAttribute("fill", "none");
        layer.appendChild(pathEl);
        const ghost = document.createElementNS(ns, "g");
        ghost.setAttribute("data-hf", "ghost");
        const r = document.createElementNS(ns, "rect");
        r.setAttribute("x", "-30");
        r.setAttribute("y", "-40");
        r.setAttribute("width", "60");
        r.setAttribute("height", "80");
        r.setAttribute("rx", "6");
        r.setAttribute("fill", "#FFFDF8");
        r.setAttribute("stroke", "#E8771A");
        r.setAttribute("stroke-width", "2");
        ghost.appendChild(r);
        layer.appendChild(ghost);
        injected.push(ghost, pathEl);
        const t = gsap.timeline({
          onComplete: () => {
            try {
              ghost.remove();
            } catch {
              /* noop */
            }
            try {
              pathEl.remove();
            } catch {
              /* noop */
            }
            try {
              const fl = root.querySelector<SVGElement>('[data-hf="hub-flash"]');
              if (fl) gsap.fromTo(fl, { opacity: 0.8, scale: 1 }, { opacity: 0, scale: 1.6, duration: 0.5 });
            } catch {
              /* noop */
            }
          },
        });
        t.to(ghost, { motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5] }, duration: 1.2, ease: "power2.in" }, 0);
        t.to(ghost, { scale: 0.12, duration: 0.5, ease: "power2.in" }, 0.7);
        delayed.push(t as unknown as gsap.core.Tween);
      } catch {
        /* noop */
      }
    };

    const coinPop = (): void => {
      try {
        if (!stage) return;
        const svg = root.querySelector<SVGSVGElement>(".hf-spokes-svg");
        const layer = root.querySelector<SVGGElement>('[data-hf="packets"]');
        if (!svg || !layer) return;
        const from = center(root.querySelector('[data-hf="obj-chat-ai"]'), stage);
        const to = center(root.querySelector('[data-hf="obj-bill"]'), stage);
        if (!from || !to) return;
        const pa = toUnits(svg, from.x, from.y);
        const pb = toUnits(svg, to.x, to.y);
        const ns = "http://www.w3.org/2000/svg";
        const pathEl = document.createElementNS(ns, "path");
        pathEl.setAttribute("d", `M${pa.x} ${pa.y} Q${(pa.x + pb.x) / 2} ${Math.min(pa.y, pb.y) - 100} ${pb.x} ${pb.y}`);
        pathEl.setAttribute("fill", "none");
        layer.appendChild(pathEl);
        const c = document.createElementNS(ns, "circle");
        c.setAttribute("data-hf", "ghost");
        c.setAttribute("r", "14");
        c.setAttribute("fill", "#D4A017");
        c.setAttribute("stroke", "#FFF8E1");
        c.setAttribute("stroke-width", "2");
        layer.appendChild(c);
        injected.push(c, pathEl);
        const t = gsap.timeline({
          onComplete: () => {
            try {
              c.remove();
            } catch {
              /* noop */
            }
            try {
              pathEl.remove();
            } catch {
              /* noop */
            }
          },
        });
        t.to(c, { motionPath: { path: pathEl, align: pathEl, alignOrigin: [0.5, 0.5] }, duration: 1, ease: "power2.out" }, 0);
        t.fromTo(c, { scaleY: 1 }, { scaleY: 0.7, duration: 0.12, yoyo: true, repeat: 1 }, 1.0);
        delayed.push(t as unknown as gsap.core.Tween);
      } catch {
        /* noop */
      }
    };
  } catch {
    /* story master skipped */
  }

  // ---------- head-dot halo pulse ----------
  try {
    const halo = root.querySelector<SVGElement>('[data-hf="growth-head"] circle');
    if (halo) {
      loop(
        "head",
        () => {
          const tl = gsap.timeline({ repeat: -1 });
          tl.fromTo(halo, { scale: 1, opacity: 0.5, transformOrigin: "50% 50%" }, { scale: 2.2, opacity: 0, duration: 1.8, ease: "power1.out" });
          return tl;
        },
        1,
        "B"
      );
    }
  } catch {
    /* noop */
  }

  // ---------- UPI grid fill + check (≈8s) ----------
  try {
    const cells = Array.from(root.querySelectorAll<SVGRectElement>('[data-hf="upi-cell"]')).sort(
      (a, b) => Number(a.dataset.ord ?? 0) - Number(b.dataset.ord ?? 0)
    );
    const check = root.querySelector<SVGGElement>('[data-hf="upi-check"]');
    if (cells.length) {
      loop(
        "upi",
        () => {
          const tl = gsap.timeline({ repeat: -1, repeatDelay: 5.4 });
          tl.to(cells, { opacity: 0, duration: 0.3, stagger: 0.008 }, 0);
          if (check) tl.to(check, { opacity: 0, duration: 0.2 }, 0);
          tl.to(cells, { opacity: 1, duration: 0.2, stagger: 0.05 }, 0.5);
          if (check)
            tl.fromTo(check, { opacity: 0, scale: 0.5, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: easeOr("kSettle", "back.out(2)") }, 1.9);
          return tl;
        },
        6,
        "B"
      );
    }
  } catch {
    /* upi stays */
  }

  // ---------- toasts (≥1024px, non-mobile) ----------
  const fineDesktop =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches &&
    !mobile;
  if (fineDesktop) {
    try {
      const stack = root.querySelector<HTMLElement>('[data-hf="layer-toasts"]');
      if (stack) {
        const ICONS = [
          '<path d="M4 8.5 L7.5 12 L13 5" stroke="#2D6A4F" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
          '<rect x="5" y="2" width="6" height="9" rx="3" fill="none" stroke="#E8771A" stroke-width="1.6"/><path d="M3 8 A5 5 0 0 0 13 8 M8 13 L8 15" stroke="#E8771A" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
          '<path d="M8 2 A5 5 0 0 1 8 12 M8 2 A5 5 0 0 0 8 12 M7 14 h2" stroke="#B85A00" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
          '<path d="M8 1.5 L14 4.5 V8 L8 12 L2 8 V4.5 Z" fill="none" stroke="#8B6914" stroke-width="1.6" stroke-linejoin="round"/>',
          '<path d="M8 13 C4 9 2 6.5 2 4.5 C2 2.5 4 1.5 6 2.5 L8 4 L10 2.5 C12 1.5 14 2.5 14 4.5 C14 6.5 12 9 8 13 Z" fill="none" stroke="#C0392B" stroke-width="1.6"/>',
        ];
        let ti = 0;
        const tick = (): void => {
          try {
            const pills = Array.from(stack.querySelectorAll<HTMLElement>('[data-hf="toast"]'));
            pills.forEach((p) => {
              try {
                gsap.to(p, { y: "-=56", duration: 0.4, ease: "power2.out" });
              } catch {
                /* noop */
              }
            });
            while (stack.querySelectorAll('[data-hf="toast"]').length >= 3) {
              try {
                stack.firstElementChild?.remove();
              } catch {
                break;
              }
            }
            const text = TOAST_SCRIPT[ti % TOAST_SCRIPT.length];
            const icon = ICONS[ti % ICONS.length];
            ti++;
            const pill = document.createElement("div");
            pill.setAttribute("aria-hidden", "true");
            pill.setAttribute("data-hf", "toast");
            pill.className = "hf-toast";
            pill.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${icon}</svg><span></span>`;
            const label = pill.querySelector("span");
            if (label) label.textContent = text;
            stack.appendChild(pill);
            injected.push(pill);
            gsap.fromTo(pill, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: easeOr("kSettle", "back.out(2)") });
            const d = gsap.delayedCall(2.2, tick);
            delayed.push(d as unknown as gsap.core.Tween);
            const old = gsap.delayedCall(3.4, () => {
              try {
                gsap.to(pill, {
                  opacity: 0,
                  duration: 0.4,
                  onComplete: () => {
                    try {
                      pill.remove();
                    } catch {
                      /* noop */
                    }
                  },
                });
              } catch {
                /* noop */
              }
            });
            delayed.push(old as unknown as gsap.core.Tween);
          } catch {
            /* feed stops */
          }
        };
        try {
          const first = gsap.delayedCall(2.6, tick);
          delayed.push(first as unknown as gsap.core.Tween);
        } catch {
          /* noop */
        }
      }
    } catch {
      /* no toasts */
    }
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
    // Unwrap chat lines + restore check-adjacent state.
    chatInners.forEach((inner) => {
      try {
        const line = inner.firstElementChild;
        const mask = inner.parentElement;
        if (line && mask && mask.classList.contains("hf-wmask")) {
          mask.parentNode?.insertBefore(line, mask);
          mask.remove();
        }
      } catch {
        /* noop */
      }
    });
    try {
      root.querySelectorAll<SVGElement>('[data-hf="ghost"],[data-hf="packet"],[data-hf="toast"]').forEach((el) => {
        try {
          el.remove();
        } catch {
          /* noop */
        }
      });
      const aiCheck = root.querySelector('[data-hf="ai-check"]');
      try {
        aiCheck?.remove();
      } catch {
        /* noop */
      }
    } catch {
      /* noop */
    }
  };
}
