"use client";

/**
 * LOOP GOVERNOR (G6) — every infinite animation registers here.
 * Plays only while its trigger is in view; pauses in hidden tabs.
 * Budget: ≤70 concurrently-animating nodes desktop, ≤40 mobile.
 * Over-budget Tier-B loops are skipped (logged, downgraded to one-time).
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isMobile } from "./registry";

interface LoopEntry {
  id: string;
  tl: gsap.core.Timeline | gsap.core.Tween;
  trigger: Element;
  nodes: number;
  tier: "A" | "B";
  st?: ScrollTrigger;
  skipped?: string;
}

const entries: LoopEntry[] = [];
let visibilityWired = false;
const skippedLog: string[] = [];

function ensureVisibility(): void {
  if (visibilityWired || typeof document === "undefined") return;
  visibilityWired = true;
  document.addEventListener("visibilitychange", () => {
    try {
      if (document.hidden) {
        entries.forEach((e) => {
          try {
            e.tl.pause();
          } catch {
            /* noop */
          }
        });
      } else {
        entries.forEach((e) => {
          try {
            const r = e.trigger.getBoundingClientRect();
            const inView =
              r.bottom > 0 && r.top < window.innerHeight;
            if (inView && !e.skipped) e.tl.play();
          } catch {
            /* noop */
          }
        });
      }
    } catch {
      /* noop */
    }
  });
}

function budgetCap(): number {
  try {
    return isMobile() ? 40 : 70;
  } catch {
    return 70;
  }
}

function runningNodes(): number {
  let n = 0;
  entries.forEach((e) => {
    try {
      if (!e.skipped && e.tl.isActive()) n += e.nodes;
    } catch {
      /* noop */
    }
  });
  return n;
}

export function registerLoop(opts: {
  id: string;
  build: () => gsap.core.Timeline | gsap.core.Tween;
  trigger: Element;
  nodes?: number;
  tier?: "A" | "B";
}): gsap.core.Timeline | gsap.core.Tween | null {
  ensureVisibility();
  const nodes = opts.nodes ?? 1;
  const tier = opts.tier ?? "B";
  if (tier === "B" && runningNodes() + nodes > budgetCap()) {
    skippedLog.push(`SKIPPED loop ${opts.id} (budget)`);
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      try {
        // eslint-disable-next-line no-console
        console.info(`[motion] governor skipped Tier-B loop: ${opts.id}`);
      } catch {
        /* noop */
      }
    }
    return null;
  }
  let tl: gsap.core.Timeline | gsap.core.Tween;
  try {
    tl = opts.build();
  } catch {
    return null;
  }
  try {
    tl.pause();
  } catch {
    /* noop */
  }
  const entry: LoopEntry = { id: opts.id, tl, trigger: opts.trigger, nodes, tier };
  try {
    entry.st = ScrollTrigger.create({
      trigger: opts.trigger,
      start: "top 100%",
      end: "bottom 0%",
      onToggle: (self) => {
        try {
          if (entry.skipped) return;
          if (self.isActive) tl.play();
          else tl.pause();
        } catch {
          /* noop */
        }
      },
    });
    // Start in correct state without waiting for a scroll event.
    try {
      const r = opts.trigger.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) tl.play();
    } catch {
      /* noop */
    }
  } catch {
    try {
      tl.play();
    } catch {
      /* noop */
    }
  }
  entries.push(entry);
  return tl;
}

/** Pause a registered loop by id (used by section fail-safes). */
export function unregisterLoop(id: string): void {
  const i = entries.findIndex((e) => e.id === id);
  if (i < 0) return;
  const [e] = entries.splice(i, 1);
  try {
    e.tl.kill();
  } catch {
    /* noop */
  }
  try {
    e.st?.kill();
  } catch {
    /* noop */
  }
}

export function runningLoopCount(): number {
  let n = 0;
  entries.forEach((e) => {
    try {
      if (!e.skipped && e.tl.isActive()) n += 1;
    } catch {
      /* noop */
    }
  });
  return n;
}

export function governorSnapshot(): { loops: number; nodes: number; skipped: string[] } {
  return { loops: runningLoopCount(), nodes: runningNodes(), skipped: [...skippedLog] };
}

export function killAllLoops(): void {
  entries.splice(0).forEach((e) => {
    try {
      e.tl.kill();
    } catch {
      /* noop */
    }
    try {
      e.st?.kill();
    } catch {
      /* noop */
    }
  });
}
