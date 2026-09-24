"use client";

/**
 * [09] VOICE & LANGUAGE — "Speak. It Listens. It Understands."
 * Language badges + callout left; mic + CSS pulse rings + 30-bar GSAP waveform
 * (fixed seed heights, no Math.random in render) + IO-triggered transcript right.
 * Hinglish transcript line is product-mock content (C1-allowed).
 */

import { useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

// Exact spec seed — deterministic, hydration-safe.
const BARS = [15, 22, 8, 28, 12, 19, 25, 6, 30, 18, 14, 26, 9, 23, 17, 11, 29, 7, 24, 16, 20, 13, 27, 10, 21, 8, 18, 25, 12, 20];

const BADGES = ["Hindi", "Hinglish", "Marathi", "English"];

export default function VoiceLanguageSection() {
  const root = useRef<HTMLElement>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const bars = root.current?.querySelectorAll('[data-gsap="bar"]') ?? [];
      bars.forEach((b, i) => {
        gsap.to(b as Element, {
          scaleY: 0.35,
          transformOrigin: "center",
          duration: 0.3 + i * 0.02,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
          delay: (i % 7) * 0.13,
        });
      });
      gsap.from(root.current?.querySelectorAll('[data-gsap="badge"]') ?? [], {
        x: -30,
        opacity: 0.2,
        duration: 0.6,
        ease: EASE_EXPO,
        stagger: 0.1,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
      });
    },
    { scope: root }
  );

  useEffect(() => {
    const box = transcript.current;
    if (!box) return;
    box.classList.add("js");
    if (typeof IntersectionObserver === "undefined") {
      box.classList.add("on");
      return;
    }
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          box.classList.add("on");
          ob.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    ob.observe(box);
    return () => ob.disconnect();
  }, []);

  return (
    <section id="voice" aria-labelledby="voice-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#FFF3E0" }}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 id="voice-heading" className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#1A1209" }}>
            Speak. It Listens. <span style={{ color: "#E8771A" }}>It Understands.</span>
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed" style={{ color: "#4A3728" }}>
            Hindi, Marathi, Hinglish, English — VyapaarAI matches your language,
            not the other way around.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {BADGES.map((b) => (
              <span
                key={b}
                data-gsap="badge"
                className="rounded-full border bg-white px-4 py-2 text-sm font-medium"
                style={{ borderColor: "#E8DDD0", color: "#1A1209" }}
              >
                {b}
              </span>
            ))}
          </div>
          <blockquote className="mt-6 rounded-r-xl border-l-4 bg-white p-5" style={{ borderColor: "#E8771A" }}>
            <p className="leading-relaxed" style={{ color: "#1A1209" }}>
              “Send a voice note saying &apos;aaj 20kg aata becha 1200 rupye mein&apos; —
              and your ledger updates instantly.”
            </p>
            <cite className="mt-2 block text-sm not-italic" style={{ color: "#8B7355" }}>
              — VyapaarAI, processing in real time
            </cite>
          </blockquote>
        </div>

        <div className="flex flex-col items-center">
          <span className="relative inline-flex" aria-hidden="true">
            <span className="landing-ping-ring absolute inset-0 rounded-full" style={{ background: "#E8771A", animationDelay: "0s" }} />
            <span className="landing-ping-ring absolute inset-0 rounded-full" style={{ background: "#E8771A", animationDelay: "0.7s" }} />
            <span className="landing-ping-ring absolute inset-0 rounded-full" style={{ background: "#E8771A", animationDelay: "1.4s" }} />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full" style={{ background: "#E8771A" }}>
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                <rect x="10" y="3" width="8" height="13" rx="4" fill="#fff" />
                <path d="M6 13 A8 8 0 0 0 22 13 M14 21 L14 25" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </span>
          <svg viewBox="0 0 300 40" className="mt-6 w-full max-w-sm" fill="none" aria-hidden="true">
            {BARS.map((h, i) => (
              <rect
                key={i}
                data-gsap="bar"
                x={6 + i * 9.6}
                y={20 - h / 2}
                width="5"
                height={h}
                rx="2.5"
                fill="#E8771A"
                opacity="0.8"
              />
            ))}
          </svg>
          <div ref={transcript} className="landing-transcript mt-4 w-full max-w-sm rounded-2xl border bg-white p-4" style={{ borderColor: "#E8DDD0" }} aria-live="polite">
            <p className="landing-transcript-line text-sm" style={{ color: "#8B7355" }}>Transcribing...</p>
            <p className="landing-transcript-line mt-1 text-sm italic" style={{ color: "#4A3728" }}>“aaj 20kg aata becha 1200 rupye mein”</p>
            <p className="landing-transcript-line mt-1 text-sm font-semibold" style={{ color: "#2D6A4F" }}>Recorded to ledger</p>
          </div>
        </div>
      </div>
    </section>
  );
}
