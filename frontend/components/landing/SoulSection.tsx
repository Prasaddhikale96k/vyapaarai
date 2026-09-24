"use client";

/**
 * [11] SOUL MOMENT — the golden breath. No pitch, just the brand soul.
 * SSR renders व्यापार at full opacity; the hook dims-then-reveals on scroll.
 * One confetti burst per session. Watchdog covers any failure.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

export default function SoulSection() {
  const root = useRef<HTMLElement>(null);
  const fired = useRef(false);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const mark = root.current?.querySelector('[data-gsap="soul-mark"]');
      if (!mark) return;
      gsap.set(mark, { opacity: 0.05, scale: 0.85 });
      gsap.to(mark, {
        opacity: 1,
        scale: 1,
        duration: 1.2,
        ease: EASE_EXPO,
        scrollTrigger: {
          trigger: root.current,
          start: "top 75%",
          once: true,
          onEnter: async () => {
            if (fired.current) return;
            fired.current = true;
            try {
              const confetti = (await import("canvas-confetti")).default;
              confetti({
                particleCount: 20,
                spread: 80,
                decay: 0.95,
                origin: { y: 0.6 },
                colors: ["#E8771A", "#D4A017", "#FFFFFF"],
              });
            } catch {
              /* decoration only */
            }
          },
        },
      });
    },
    { scope: root }
  );

  return (
    <section id="soul" aria-label="Vyapaar — commerce in its most human form" ref={root} className="px-4 py-24 text-center lg:py-32" style={{ background: "#D4A017" }}>
      <div
        data-gsap="soul-mark"
        className="font-devanagari mx-auto text-[12vw] leading-none lg:text-[10vw]"
        style={{ color: "#0F2040", letterSpacing: "-0.02em" }}
        aria-hidden="true"
      >
        व्यापार
      </div>
      <p
        className="font-display mx-auto mt-6 max-w-2xl text-lg italic sm:text-xl lg:text-2xl"
        style={{ color: "#0F2040" }}
      >
        Commerce, in its most human form. We built VyapaarAI for the people who
        wake up before dawn, open their shutters, and serve their community every
        single day.
      </p>
      <svg viewBox="0 0 200 20" width="200" height="20" fill="none" className="mx-auto mt-8" aria-hidden="true">
        <path d="M6 12 C 40 6, 70 16, 104 10 S 168 8, 194 12" stroke="#0F2040" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </section>
  );
}
