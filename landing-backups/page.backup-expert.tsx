"use client";

/**
 * VyapaarAI storytelling landing — Ramesh's journey in 6 beats.
 * Lottie-first (doodle fallbacks: 0 JSONs downloadable headless),
 * framer-motion reveals, watchdog against blank states.
 */

import { useEffect } from "react";
import Header from "@/components/landing-v2/Header";
import Footer from "@/components/landing-v2/Footer";
import Beat1Hero from "@/components/story/Beat1Hero";
import Beat2Problem from "@/components/story/Beat2Problem";
import Beat3Discovery from "@/components/story/Beat3Discovery";
import Beat4Magic from "@/components/story/Beat4Magic";
import Beat5Transformation from "@/components/story/Beat5Transformation";
import Beat6CTA from "@/components/story/Beat6CTA";
import ScrollProgress from "@/components/story/ScrollProgress";

function Watchdog() {
  useEffect(() => {
    const timer = setTimeout(() => {
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        const opacity = window.getComputedStyle(el).opacity;
        if (parseFloat(opacity) < 0.1) {
          console.warn("WATCHDOG: force-showing", el);
          (el as HTMLElement).style.opacity = "1";
          (el as HTMLElement).style.transform = "none";
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <Watchdog />
      <ScrollProgress />
      <Header />
      <main>
        <Beat1Hero />
        <Beat2Problem />
        <Beat3Discovery />
        <Beat4Magic />
        <Beat5Transformation />
        <Beat6CTA />
      </main>
      <Footer />
    </div>
  );
}
