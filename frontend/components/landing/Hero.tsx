"use client";

/**
 * [02] HERO — "Your Kirana's AI Brain — On WhatsApp."
 * Masked line reveals (transform only), sub-headline 0.3→1, CTAs, trust row,
 * KiranaShopSVG centerpiece, scroll hint. All content SSR-visible.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import KiranaShopSVG, { WhatsAppGlyph } from "./KiranaShopSVG";
import { EASE_EXPO, prefersReduced, scrollToId } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const LINES: { text: string; accent?: boolean; italic?: boolean }[] = [
  { text: "Your Kirana's" },
  { text: "AI Brain", accent: true, italic: true },
  { text: "on WhatsApp." },
];

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const [pastHint, setPastHint] = useState(false);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const q = gsap.utils.selector(root.current);
      const tl = gsap.timeline({ defaults: { ease: EASE_EXPO } });
      tl.from(q('[data-gsap="badge"]'), { y: -20, opacity: 0, duration: 0.6 }, 0.2)
        .from(q('[data-gsap="mask"]'), { yPercent: 110, duration: 0.9, stagger: 0.12 }, 0.3)
        .fromTo(q('[data-gsap="sub"]'), { opacity: 0.3 }, { opacity: 1, duration: 0.8 }, 0.7)
        .from(q('[data-gsap="cta"]'), { y: 20, opacity: 0.2, duration: 0.6, stagger: 0.1 }, 1.0)
        .from(q('[data-gsap="trust"]'), { opacity: 0.2, duration: 0.6 }, 1.2);
    },
    { scope: root }
  );

  useEffect(() => {
    const fn = () => setPastHint(window.scrollY > 200);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <section
      ref={root}
      id="hero"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden px-4 pb-16 pt-24 sm:pt-28"
      style={{ background: "#FDFAF4", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}
    >
      <div
        className="font-devanagari pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        style={{ fontSize: "40vw", opacity: 0.04, color: "#D4A017" }}
        aria-hidden="true"
      >
        व्यापार
      </div>

      <div className="relative mx-auto w-full max-w-5xl">
        <span
          data-gsap="badge"
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
          style={{ background: "#FFF3E0", borderColor: "rgba(232,119,26,0.3)", color: "#B85A00" }}
        >
          <WhatsAppGlyph />
          WhatsApp-First · No App Install Needed
        </span>

        <h1
          id="hero-heading"
          className="font-display mx-auto font-black leading-[0.95] tracking-tight"
          style={{ fontSize: "clamp(3rem, 9vw, 6rem)", maxWidth: "15ch" }}
        >
          {LINES.map((l) => (
            <span key={l.text} className="block overflow-hidden pb-[0.08em]">
              <span
                data-gsap="mask"
                className="block"
                style={l.accent ? { color: "#E8771A", fontStyle: "italic" } : { color: "#1A1209" }}
              >
                {l.text}
              </span>
            </span>
          ))}
        </h1>

        <p
          data-gsap="sub"
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
          style={{ color: "#4A3728" }}
        >
          Send a photo. Send a voice note. VyapaarAI reads it, records it, and tells
          you what to do next — in your language, on WhatsApp.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            data-gsap="cta"
            href="/register"
            className="inline-flex min-h-[56px] items-center rounded-full px-8 py-4 text-lg font-semibold text-white transition-transform focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ background: "#E8771A", outlineColor: "#E8771A", textDecoration: "none", boxShadow: "0 0 40px rgba(232,119,26,0.25)" }}
          >
            See It Work →
          </Link>
          <button
            data-gsap="cta"
            onClick={() => scrollToId("how-it-works")}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full border px-8 py-4 text-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ borderColor: "#E8DDD0", color: "#1A1209", background: "transparent", outlineColor: "#E8771A" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 6.8 L13.2 10 L8 13.2 Z" fill="currentColor" />
            </svg>
            Watch the Demo
          </button>
        </div>

        <p data-gsap="trust" className="mt-4 text-sm" style={{ color: "#8B7355" }}>
          Trusted by kirana owners across India · Zero setup · Your language
        </p>

        <div className="mt-10">
          <KiranaShopSVG />
        </div>
      </div>

      {!pastHint && (
        <a
          href="#proof-bar"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("proof-bar");
          }}
          aria-label="Scroll to see more"
          className="landing-bob absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full p-2 focus-visible:outline-2"
          style={{ color: "#8B7355", outlineColor: "#E8771A" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 4 L12 20 M12 20 L5 13 M12 20 L19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
    </section>
  );
}
