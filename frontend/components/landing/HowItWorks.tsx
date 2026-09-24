"use client";

/**
 * [06] HOW IT WORKS — "From Bahi-Khata to Business Intelligence".
 * 3 step cards (framer-motion hover) + dashed connector arrows that draw on.
 * getTotalLength() runs client-only inside useGSAP (LAW-SSR).
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function SendIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 10 A20 20 0 0 0 8 38 L5 43 L11 41 A20 20 0 1 0 8 10 Z" fill="#DCF8C6" stroke="#128C7E" strokeWidth="2" />
      <rect x="15" y="17" width="16" height="12" rx="2" fill="#fff" stroke="#8B7355" strokeWidth="1.5" />
      <circle cx="19" cy="21" r="1.6" fill="#E8771A" />
      <path d="M15 29 L23 23 L27 26 L33 20" stroke="#2D6A4F" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 6 C16 6 10 12 10 20 C10 24 12 27 14 29 C13 31 13 34 15 36 C17 40 21 42 24 42 C27 42 31 40 33 36 C35 34 35 31 34 29 C36 27 38 24 38 20 C38 12 32 6 24 6 Z" stroke="#1A1209" strokeWidth="2" />
      <path d="M24 6 L24 42 M16 14 L32 14 M14 24 L34 24 M17 34 L31 34" stroke="#E8771A" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2.4" fill="#E8771A" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M24 4 L40 11 L40 23 C40 33 32 40 24 44 C16 40 8 33 8 23 L8 11 Z" stroke="#1A1209" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17 23 L22.5 28.5 L31 18" stroke="#2D6A4F" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    icon: <SendIcon />,
    title: "You Send",
    text: "A bill photo, voice note, PDF, or text. On WhatsApp. In your language. That's it.",
    highlight: "Zero forms. Zero app.",
  },
  {
    n: "02",
    icon: <BrainIcon />,
    title: "AI Understands",
    text: "Gemini Vision reads your documents. Whisper transcribes your voice. AI extracts every number, every name, every item — perfectly structured.",
    highlight: "Gemini + Whisper AI",
  },
  {
    n: "03",
    icon: <ShieldIcon />,
    title: "You Decide",
    text: "The AI proposes actions. You approve them. Reminders, reorders, reports — nothing happens without your OK.",
    highlight: "Always Human-in-the-Loop",
  },
];

export default function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      if (typeof window === "undefined") return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="step"]') ?? [], {
        y: 40,
        opacity: 0.2,
        duration: 0.7,
        ease: EASE_EXPO,
        stagger: 0.15,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
      });
      root.current?.querySelectorAll('[data-gsap="arrow"]').forEach((p) => {
        const el = p as unknown as SVGPathElement;
        let len = 200;
        try {
          len = el.getTotalLength();
        } catch {
          /* fallback keeps static visible path */
          return;
        }
        gsap.fromTo(
          el,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: "power1.inOut",
            immediateRender: false,
            scrollTrigger: { trigger: el, start: "top 90%", once: true },
          }
        );
      });
    },
    { scope: root }
  );

  return (
    <section id="how-it-works" aria-labelledby="hiw-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#FDFAF4" }}>
      <div className="mx-auto max-w-7xl text-center">
        <h2 id="hiw-heading" className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#1A1209" }}>
          From Bahi-Khata to <span style={{ color: "#E8771A" }}>Business Intelligence</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg" style={{ color: "#4A3728" }}>
          Three steps. Zero friction. Total clarity.
        </p>

        <div className="relative mt-12 grid gap-6 md:grid-cols-3">
          <svg className="pointer-events-none absolute inset-x-0 top-16 hidden h-8 w-full md:block" viewBox="0 0 600 32" fill="none" aria-hidden="true" preserveAspectRatio="none">
            <path data-gsap="arrow" d="M190 16 C 240 16, 250 16, 290 16" stroke="#E8771A" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
            <path data-gsap="arrow" d="M400 16 C 440 16, 450 16, 490 16" stroke="#E8771A" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
          </svg>
          {STEPS.map((s) => (
            <motion.article
              key={s.n}
              data-gsap="step"
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border p-8 text-left"
              style={{ background: "#FFFFFF", borderColor: "#E8DDD0" }}
            >
              <span className="font-mono text-6xl font-medium" style={{ color: "#E8771A", opacity: 0.15 }} aria-hidden="true">
                {s.n}
              </span>
              {s.icon}
              <h3 className="font-display text-xl font-semibold sm:text-2xl" style={{ color: "#1A1209" }}>
                {s.title}
              </h3>
              <p className="leading-relaxed" style={{ color: "#4A3728" }}>
                {s.text}
              </p>
              <p className="mt-auto text-sm font-semibold" style={{ color: "#E8771A" }}>
                {s.highlight}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
