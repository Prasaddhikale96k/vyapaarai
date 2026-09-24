"use client";

/**
 * [10] FESTIVAL INTELLIGENCE — "Diwali Is Coming. Are Your Shelves Ready?"
 * Navy section: diya SVG with GSAP flame wobble (yoyo, keeps playing),
 * sparkles scale-in, forecast card, festival badges pop-in.
 * Card buttons are disabled display-only with tooltips.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const FESTIVALS = ["Diwali", "Eid", "Rakhi", "Navratri"];

export default function FestivalSection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const q = gsap.utils.selector(root.current);
      gsap.to(q('[data-gsap="flame"]'), {
        scaleX: 1.1,
        scaleY: 0.95,
        transformOrigin: "bottom center",
        duration: 0.4,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      gsap.from(q('[data-gsap="spark"]'), {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: EASE_EXPO,
        stagger: 0.1,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
      gsap.from(q('[data-gsap="card"]'), {
        y: 30,
        opacity: 0,
        duration: 0.7,
        ease: EASE_EXPO,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
      });
      gsap.from(q('[data-gsap="fbadge"]'), {
        scale: 0,
        opacity: 0,
        duration: 0.4,
        ease: "back.out(1.4)",
        stagger: 0.1,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 65%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section id="festival" aria-labelledby="festival-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#0F2040" }}>
      <div className="mx-auto max-w-3xl text-center">
        <h2 id="festival-heading" className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#FDFAF4" }}>
          Diwali Is Coming. <span style={{ color: "#E8771A" }}>Are Your Shelves Ready?</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(253,250,244,0.75)" }}>
          VyapaarAI&apos;s festival intelligence reads India&apos;s calendar — Diwali,
          Eid, Rakhi, Navratri — and forecasts your demand spike before it happens.
        </p>

        <svg viewBox="0 0 200 200" className="mx-auto mt-8 h-48 w-48" role="img" aria-label="Illustration of a lit diya lamp with sparkles">
          <defs>
            <linearGradient id="diyaFlame" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#FF6B2B" />
              <stop offset="100%" stopColor="#FFD700" />
            </linearGradient>
          </defs>
          {[
            [40, 50], [160, 45], [30, 120], [170, 115], [70, 25], [130, 30],
          ].map(([x, y], i) => (
            <path
              key={i}
              data-gsap="spark"
              d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`}
              fill="#D4A017"
            />
          ))}
          <ellipse cx="100" cy="150" rx="62" ry="12" fill="#000" opacity="0.3" />
          <path d="M45 120 Q100 140 155 120 L142 148 Q100 160 58 148 Z" fill="#8B6914" />
          <path d="M45 120 Q100 140 155 120" fill="none" stroke="#D4A017" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="100" y1="118" x2="100" y2="104" stroke="#1A1209" strokeWidth="3" strokeLinecap="round" />
          <path data-gsap="flame" d="M100 62 C110 78 112 92 100 102 C88 92 90 78 100 62 Z" fill="url(#diyaFlame)" />
          <ellipse cx="100" cy="92" rx="6" ry="9" fill="#FFF8E1" opacity="0.85" />
        </svg>

        <div
          data-gsap="card"
          className="mx-auto mt-6 max-w-md rounded-2xl border p-6 text-left backdrop-blur"
          style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.2)" }}
        >
          <p className="font-semibold" style={{ color: "#FDFAF4" }}>Diwali — November 2026</p>
          <p className="mt-2 text-sm" style={{ color: "rgba(253,250,244,0.8)" }}>Predicted Demand: <span className="font-mono font-medium" style={{ color: "#D4A017" }}>×1.6</span> on fast-moving SKUs</p>
          <p className="mt-1 text-sm" style={{ color: "rgba(253,250,244,0.8)" }}>Recommended: Reorder diya wax, sugar, rice, oil — 2 weeks early</p>
          <p className="mt-1 text-sm" style={{ color: "rgba(253,250,244,0.8)" }}>AI Confidence: High (based on 3-year sales pattern)</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled title="Approving this would send WhatsApp reorder messages" className="cursor-not-allowed rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: "#2D6A4F", opacity: 0.9 }}>
              Auto-Reorder
            </button>
            <button type="button" disabled title="Approving this would send WhatsApp reorder messages" className="cursor-not-allowed rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#FDFAF4", opacity: 0.9 }}>
              View Forecast
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {FESTIVALS.map((f) => (
            <span
              key={f}
              data-gsap="fbadge"
              className="rounded-full border px-3 py-1.5 text-sm"
              style={{ borderColor: "rgba(212,160,23,0.4)", color: "#D4A017" }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
