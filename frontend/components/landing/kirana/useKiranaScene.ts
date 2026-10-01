"use client";

/**
 * useKiranaScene(scopeRef, enabled) — owns all kirana SVG motion.
 * PHASE 1: mounts extras hidden (gsap.set before paint), reduced-motion
 * renders the static base scene only. Intro/idle/story land in later phases.
 */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";

gsap.registerPlugin(ScrollTrigger);

export function useKiranaScene(scopeRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useGSAP(
    () => {
      if (!enabled || typeof window === "undefined") return;
      const q = gsap.utils.selector(scopeRef.current);
      // Extras exist in the DOM only after `ready`; park them hidden
      // before paint so the base scene is untouched.
      gsap.set(q('[data-k="extras"] > *'), { opacity: 0 });
      gsap.set(q('[data-k="paper-beam"]'), { opacity: 0 });
    },
    { scope: scopeRef, dependencies: [enabled], revertOnUpdate: true }
  );
}
