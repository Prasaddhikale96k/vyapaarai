"use client";

/**
 * [00] PRELOADER — navy overlay, gold व्यापार mark, saffron progress bar.
 * Content beneath stays fully visible (covered, never opacity-0).
 * Exits ≤1.8s + subtle confetti on ready.
 */

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

export default function Preloader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let cancelled = false;
    const finish = async () => {
      if (cancelled) return;
      doneRef.current();
      setGone(true);
      if (!prefersReduced()) {
        try {
          const confetti = (await import("canvas-confetti")).default;
          confetti({
            particleCount: 30,
            spread: 60,
            startVelocity: 25,
            origin: { y: 0.3 },
            colors: ["#E8771A", "#D4A017", "#FFFFFF"],
          });
        } catch {
          /* confetti is decoration — never break the page */
        }
      }
    };
    if (prefersReduced()) {
      const t = setTimeout(finish, 200);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
    const ctx = gsap.context(() => {
      gsap.from(mark.current, {
        opacity: 0,
        scale: 0.9,
        duration: 0.6,
        ease: EASE_EXPO,
        immediateRender: false,
      });
      gsap.to(bar.current, { width: "100%", duration: 1.6, ease: "power2.inOut" });
      gsap.to(root.current, {
        opacity: 0,
        scale: 1.05,
        duration: 0.4,
        delay: 1.6,
        ease: "power2.in",
        onComplete: () => finish(),
      });
    }, root);
    const failsafe = setTimeout(finish, 2500);
    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      ctx.revert();
    };
  }, []);

  if (gone) return null;
  return (
    <div ref={root} data-gsap="preloader" className="landing-preloader" role="status" aria-label="Loading VyapaarAI">
      <div
        ref={mark}
        className="font-devanagari"
        style={{ fontSize: "5rem", lineHeight: 1, color: "#D4A017" }}
        aria-hidden="true"
      >
        व्यापार
      </div>
      <p className="text-sm" style={{ color: "rgba(253,250,244,0.6)" }}>
        Loading VyapaarAI...
      </p>
      <div ref={bar} className="landing-preloader-bar" aria-hidden="true" />
    </div>
  );
}
