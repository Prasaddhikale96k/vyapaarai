"use client";

/**
 * MotionScope — zero-layout wrapper that runs one section builder.
 * display:contents ⇒ zero layout change; server components stay server.
 * Everything runs inside gsap.context + matchMedia (live reduced-motion).
 */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { governorSnapshot, killAllLoops } from "./governor";
import { h, type Ctx } from "./helpers";
import { registry } from "./registry";

export type BuildFn = (ctx: Ctx, helpers: typeof h) => void | (() => void);

export default function MotionScope({
  id,
  build,
  children,
}: {
  id: string;
  build: BuildFn;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Dev-only scrubber (no-op in production).
  useEffect(() => {
    motionDevScrubber();
  }, []);

  useGSAP(
    () => {
      registry();
      const scopeEl = ref.current;
      if (!scopeEl || typeof window === "undefined") return;
      const ctx = gsap.context(() => {
        const mm = gsap.matchMedia();
        mm.add("(prefers-reduced-motion: no-preference)", () => {
          try {
            const root = (scopeEl.firstElementChild ?? scopeEl) as Element;
            const q = gsap.utils.selector(root);
            const maybeCleanup = build({ q, root, mm }, h);
            if (typeof maybeCleanup === "function") {
              return () => {
                try {
                  maybeCleanup();
                } catch {
                  /* noop */
                }
              };
            }
            return undefined;
          } catch {
            return undefined;
          }
        });
        return () => {
          try {
            mm.revert();
          } catch {
            /* noop */
          }
        };
      }, scopeEl);
      return () => {
        try {
          ctx.revert();
        } catch {
          /* noop */
        }
      };
    },
    { scope: ref, dependencies: [], revertOnUpdate: true }
  );

  return (
    <div ref={ref} data-motion-scope={id} style={{ display: "contents" }}>
      {children}
    </div>
  );
}

/** Dev-only scrubber (absent in production builds). */
export function motionDevScrubber(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  try {
    (window as unknown as { __motion?: object }).__motion = {
      snapshot: governorSnapshot,
      killAll: killAllLoops,
      global: gsap.globalTimeline,
    };
  } catch {
    /* noop */
  }
}
