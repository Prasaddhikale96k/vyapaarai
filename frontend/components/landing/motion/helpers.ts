"use client";

/**
 * Motion helpers — the ONLY way section builders touch GSAP.
 * Every method is a no-op under prefers-reduced-motion, runs inside the
 * caller's gsap.context (cleanup reverts), uses once:true triggers with
 * start ≤ 'top 95%', and animates transform/opacity/dashoffset only.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { registerLoop } from "./governor";
import { easeOr, isCoarse, isMobile, isReduced } from "./registry";

export type Q = ReturnType<typeof gsap.utils.selector>;

export interface Ctx {
  q: Q;
  root: Element;
  mm: gsap.MatchMedia;
}

function inViewport(el: Element): boolean {
  try {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  } catch {
    return false;
  }
}

export const h = {
  /** Entrance reveal. From-state set post-hydration/pre-paint; above-fold plays immediately. */
  reveal(
    targets: gsap.TweenTarget,
    opts: {
      trigger: Element;
      from?: gsap.TweenVars;
      start?: string;
      stagger?: number;
      duration?: number;
      ease?: string;
      delay?: number;
      y?: number;
      x?: number;
      onCompleteClear?: boolean;
    }
  ): gsap.core.Tween | null {
    if (isReduced() || typeof window === "undefined") return null;
    const els = gsap.utils.toArray(targets as gsap.DOMTarget) as Element[];
    if (!els.length) return null;
    const from: gsap.TweenVars = {
      y: opts.y ?? 30,
      x: opts.x ?? 0,
      opacity: 0,
      ...(opts.from ?? {}),
    };
    const vars: gsap.TweenVars = {
      ...from,
      opacity: 1,
      y: 0,
      x: 0,
      duration: opts.duration ?? 0.8,
      ease: opts.ease ?? easeOr("kOut", "expo.out"),
      stagger: opts.stagger ?? 0,
      delay: opts.delay ?? 0,
      immediateRender: false,
      scrollTrigger: {
        trigger: opts.trigger,
        start: opts.start ?? "top 90%",
        once: true,
      },
      onComplete: opts.onCompleteClear === false ? undefined : function (this: gsap.core.Tween) {
        try {
          gsap.set(this.targets(), { clearProps: "opacity,transform,visibility" });
        } catch {
          /* noop */
        }
      },
    };
    // Set from-state now (post-hydration, pre-paint inside useGSAP).
    try {
      gsap.set(els, from);
    } catch {
      /* static stays */
      return null;
    }
    // Above the fold at mount: play in the same frame (no flash, no ScrollTrigger wait).
    if (inViewport(opts.trigger)) {
      try {
        const t = gsap.to(els, { ...vars, scrollTrigger: undefined });
        return t;
      } catch {
        try {
          gsap.set(els, { clearProps: "opacity,transform,visibility" });
        } catch {
          /* noop */
        }
        return null;
      }
    }
    try {
      const t = gsap.to(els, vars);
      return t;
    } catch {
      try {
        gsap.set(els, { clearProps: "opacity,transform,visibility" });
      } catch {
        /* noop */
      }
      return null;
    }
  },

  /** COMPOSITOR MASK REVEAL — overlay wipes away, content never moves. */
  curtain(
    el: Element,
    opts: { dir?: "left" | "right" | "up"; color: string; trigger: Element; duration?: number }
  ): void {
    if (isReduced() || typeof window === "undefined") return;
    try {
      const host = el as HTMLElement;
      const cs = window.getComputedStyle(host);
      if (cs.position === "static") return; // never add position (G2 rule)
      if (host.querySelector(":scope > .m-curtain")) return;
      const dir = opts.dir ?? "left";
      const ov = document.createElement("div");
      ov.setAttribute("aria-hidden", "true");
      ov.className = "m-curtain";
      ov.style.cssText = `position:absolute;inset:0;background:${opts.color};pointer-events:none;transform:scaleX(0);transform-origin:${dir === "left" ? "left center" : "right center"};`;
      if (dir === "up") {
        ov.style.transform = "scaleY(0)";
        ov.style.transformOrigin = "center bottom";
      }
      host.appendChild(ov);
      const wipe = (target: string) =>
        gsap.to(ov, {
          scaleX: target === "none" ? 0 : target === "cover" ? 1 : 0,
          scaleY: dir === "up" ? (target === "cover" ? 1 : 0) : 1,
          duration: (opts.duration ?? 0.7) / 2,
          ease: "power2.inOut",
        });
      void wipe;
      const show = () => {
        try {
          gsap.set(ov, dir === "up" ? { scaleY: 1 } : { scaleX: 1 });
          gsap.to(ov, {
            ...(dir === "up" ? { scaleY: 0 } : { scaleX: 0 }),
            duration: opts.duration ?? 0.7,
            ease: easeOr("kPen", "power2.inOut"),
            scrollTrigger: { trigger: opts.trigger, start: "top 90%", once: true },
            onComplete: () => {
              try {
                ov.remove();
              } catch {
                /* noop */
              }
            },
          });
        } catch {
          try {
            ov.remove();
          } catch {
            /* noop */
          }
        }
      };
      if (inViewport(opts.trigger)) show();
      else {
        try {
          ScrollTrigger.create({
            trigger: opts.trigger,
            start: "top 95%",
            once: true,
            onEnter: show,
          });
        } catch {
          show();
        }
      }
    } catch {
      /* overlay skipped — content stays visible */
    }
  },

  /** Single-draw stroke reveal. Manual dashoffset fallback (client only). */
  drawOnce(
    paths: gsap.DOMTarget,
    opts: { trigger: Element; duration?: number; stagger?: number; ease?: string; start?: string }
  ): void {
    if (isReduced() || typeof window === "undefined") return;
    try {
      const els = gsap.utils.toArray(paths) as unknown as SVGGeometryElement[];
      if (!els.length) return;
      els.forEach((el, i) => {
        try {
          const len = el.getTotalLength();
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
          gsap.to(el, {
            strokeDashoffset: 0,
            duration: opts.duration ?? 0.8,
            ease: opts.ease ?? easeOr("kPen", "power1.inOut"),
            delay: (opts.stagger ?? 0) * i,
            immediateRender: false,
            scrollTrigger: {
              trigger: opts.trigger,
              start: opts.start ?? "top 90%",
              once: true,
            },
          });
        } catch {
          /* keep static visible path */
        }
      });
    } catch {
      /* noop */
    }
  },

  /** Governed infinite loop. Returns null when over budget (caller downgrades). */
  loop(
    id: string,
    buildFn: () => gsap.core.Timeline | gsap.core.Tween,
    opts: { trigger: Element; nodes?: number; tier?: "A" | "B" }
  ): gsap.core.Timeline | gsap.core.Tween | null {
    if (isReduced() || typeof window === "undefined") return null;
    try {
      return registerLoop({
        id,
        build: buildFn,
        trigger: opts.trigger,
        nodes: opts.nodes ?? 1,
        tier: opts.tier ?? "B",
      });
    } catch {
      return null;
    }
  },

  /** Word/line split that reverts on cleanup. Devanagari tokens stay atomic. */
  splitHeading(
    el: Element,
    opts?: { type?: "lines" | "words" }
  ): (() => void) | null {
    if (isReduced() || typeof window === "undefined") return null;
    try {
      const type = opts?.type ?? "words";
      const host = el as HTMLElement;
      const original = host.innerHTML;
      const label = host.textContent ?? "";
      host.setAttribute("aria-label", label);
      // Split top-level inline segments only; never inside a word/Devanagari token.
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      const texts: Text[] = [];
      while (walker.nextNode()) {
        const t = walker.currentNode as Text;
        if (t.nodeValue && t.nodeValue.trim()) texts.push(t);
      }
      const devanagari = /[\u0900-\u097F]/;
      texts.forEach((t) => {
        try {
          const parent = t.parentNode as HTMLElement | null;
          if (!parent || parent !== host) {
            // Nested spans (e.g. accent words): treat whole span as one unit.
            return;
          }
          const words = (t.nodeValue ?? "").split(/(\s+)/);
          const frag = document.createDocumentFragment();
          words.forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) {
              frag.appendChild(document.createTextNode(w));
              return;
            }
            const mask = document.createElement("span");
            mask.setAttribute("aria-hidden", "true");
            mask.className = "m-wmask";
            const inner = document.createElement("span");
            inner.className = "m-wword";
            inner.textContent = w;
            mask.appendChild(inner);
            frag.appendChild(mask);
          });
          parent.replaceChild(frag, t);
        } catch {
          /* keep original text */
        }
      });
      void type;
      void devanagari;
      const inners = host.querySelectorAll(".m-wword");
      if (inners.length) {
        // Anti-blank: from-state applied only when the trigger fires.
        try {
          gsap.from(inners, {
            yPercent: 105,
            duration: 0.9,
            ease: easeOr("kOut", "expo.out"),
            stagger: 0.1,
            immediateRender: false,
            scrollTrigger: { trigger: host, start: "top 90%", once: true },
          });
        } catch {
          /* text stays visible */
        }
      }
      return () => {
        try {
          host.innerHTML = original;
          host.removeAttribute("aria-label");
        } catch {
          /* noop */
        }
      };
    } catch {
      return null;
    }
  },

  /** Magnetic hover (fine pointers, desktop). Never alters hit-area/click. */
  magnetic(el: Element, opts?: { strength?: number }): (() => void) | null {
    if (isReduced() || typeof window === "undefined") return null;
    try {
      if (isCoarse() || isMobile()) return null;
      if (!window.matchMedia("(pointer: fine)").matches) return null;
      const s = opts?.strength ?? 6;
      const target = el as HTMLElement;
      const qx = gsap.quickTo(target, "x", { duration: 0.3, ease: "power2.out" });
      const qy = gsap.quickTo(target, "y", { duration: 0.3, ease: "power2.out" });
      const move = (e: PointerEvent) => {
        try {
          const r = target.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          qx(gsap.utils.clamp(-s, s, dx * 0.12));
          qy(gsap.utils.clamp(-s, s, dy * 0.12));
        } catch {
          /* noop */
        }
      };
      const leave = () => {
        try {
          qx(0);
          qy(0);
        } catch {
          /* noop */
        }
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerleave", leave);
      return () => {
        try {
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerleave", leave);
          gsap.set(target, { x: 0, y: 0 });
        } catch {
          /* noop */
        }
      };
    } catch {
      return null;
    }
  },

  /** Numeric tick via onUpdate. Reuse — never double-animate existing count-ups. */
  tick(
    el: Element,
    opts: { from: number; to: number; duration?: number; format?: (v: number) => string; trigger?: Element }
  ): void {
    if (isReduced() || typeof window === "undefined") return;
    try {
      const fmt = opts.format ?? ((v: number) => Math.round(v).toLocaleString("en-IN"));
      const obj = { v: opts.from };
      gsap.to(obj, {
        v: opts.to,
        duration: opts.duration ?? 1.2,
        ease: "power2.out",
        immediateRender: false,
        scrollTrigger: opts.trigger
          ? { trigger: opts.trigger, start: "top 90%", once: true }
          : undefined,
        onUpdate: () => {
          try {
            (el as HTMLElement).textContent = fmt(obj.v);
          } catch {
            /* noop */
          }
        },
      });
    } catch {
      /* number stays */
    }
  },
};
