"use client";

/**
 * LandingShell — owns preloader state + LAW-WATCHDOG.
 * Lenis is NOT initialized here: the global <Smooth> provider in app/layout.tsx
 * already wires Lenis + ScrollTrigger with the exact canonical wiring
 * (lenis.on('scroll', ScrollTrigger.update); ticker ms conversion; lagSmoothing(0)).
 * A second instance would double-drive scroll (jitter per gsap-web skill).
 * Nav renders only after the preloader exits (RULE-STICKY-NAV-ZINDEX).
 */

import { useEffect, useState } from "react";
import Nav from "./Nav";
import Preloader from "./Preloader";

export default function LandingShell({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  // LAW-WATCHDOG (verbatim): force-show anything GSAP touched after 1.5s.
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll("[data-gsap]").forEach((el) => {
        (el as HTMLElement).style.opacity = "1";
        (el as HTMLElement).style.transform = "none";
      });
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {!ready && <Preloader onDone={() => setReady(true)} />}
      {ready && <Nav />}
      {children}
    </>
  );
}
