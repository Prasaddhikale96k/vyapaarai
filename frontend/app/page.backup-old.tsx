"use client";

/**
 * VyapaarAI landing v2 — clean, minimal, 5 sections (S1–S5 + footer).
 * framer-motion only. Inter only. Emerald/cream/ink.
 * Anti-blank: fast subtle entrances + watchdog forcing stuck nodes visible.
 */

import { useEffect } from "react";
import Header from "@/components/landing-v2/Header";
import Hero from "@/components/landing-v2/Hero";
import HowItWorks from "@/components/landing-v2/HowItWorks";
import Demo from "@/components/landing-v2/Demo";
import Proof from "@/components/landing-v2/Proof";
import FinalCTA from "@/components/landing-v2/FinalCTA";
import Footer from "@/components/landing-v2/Footer";

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
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Demo />
        <Proof />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
