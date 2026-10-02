"use client";

/**
 * [14] CTA — "Ready to Know Your Business?"
 * Word-split headline reveal, confetti primary (dynamic import, then navigate),
 * ghost Sign In, trust badges. Full text SSR-visible.
 */

import Link from "next/link";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const HEADLINE = ["Ready", "to", "Know", "Your", "Business?"];
const BADGES = ["Your data is yours", "WhatsApp-native", "Made for India", "Zero setup"];

export default function CTASection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="word"]') ?? [], {
        y: 40,
        opacity: 0.2,
        duration: 0.6,
        ease: EASE_EXPO,
        stagger: 0.06,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
      });
    },
    { scope: root }
  );

  const celebrate = async () => {
    if (prefersReduced()) return;
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 60,
        spread: 120,
        startVelocity: 35,
        origin: { y: 0.6 },
        colors: ["#E8771A", "#D4A017", "#FFFFFF", "#FFF3E0"],
      });
    } catch {
      /* decoration only */
    }
  };

  return (
    <section id="cta" aria-labelledby="cta-heading" ref={root} className="px-4 py-24 text-center lg:py-32" style={{ background: "#0F2040" }}>
      <h2 id="cta-heading" className="font-display mx-auto max-w-4xl text-4xl font-black leading-tight lg:text-6xl" style={{ color: "#FFFFFF" }}>
        {HEADLINE.map((w) => (
          <span key={w} data-gsap="word" className="mr-[0.25em] inline-block">
            {w}
          </span>
        ))}
        <span data-gsap="word" className="font-devanagari mt-2 block" style={{ color: "#D4A017" }}>
          व्यापार
        </span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-xl" style={{ color: "rgba(255,255,255,0.7)" }}>
        Join the waitlist. Connect your WhatsApp. Start in 2 minutes.
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          data-m="cta.btn"
          href="/register"
          onClick={() => {
            void celebrate();
          }}
          className="inline-flex min-h-[60px] items-center rounded-full px-10 py-5 text-lg font-bold text-white transition-transform focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ background: "#E8771A", outlineColor: "#E8771A", textDecoration: "none", boxShadow: "0 0 40px rgba(232,119,26,0.25)" }}
        >
          Get Started Free — It&apos;s on WhatsApp
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-[60px] items-center rounded-full border px-8 py-5 text-lg text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ borderColor: "rgba(255,255,255,0.3)", textDecoration: "none", outlineColor: "#E8771A" }}
        >
          Sign In
        </Link>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
        {BADGES.map((b) => (
          <span key={b}>{b}</span>
        ))}
      </div>
    </section>
  );
}
