"use client";

/**
 * [05] MAGIC MOMENT — WhatsApp loop.
 * HTML phone mockup; scripted 7-step chat plays once on scroll ('top 60%').
 * All bubbles SSR-visible; timeline is built lazily onEnter (anti-blank).
 * Hindi text below appears ONLY inside chat bubbles (product mock, C1-allowed).
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

type Bubble = { from: "user" | "ai"; text: string; caption: string };

const SCRIPT: Bubble[] = [
  { from: "user", text: "Photo: Bill from Rajesh Provision", caption: "Owner sends a photo of today's bill" },
  { from: "ai", text: "बिल पढ़ लिया! Rajesh Provisions से ₹2,340 की खरीद दर्ज की। Tomato (5kg), Onion (10kg), Sugar (2kg) — सब ledger में आ गया।", caption: "AI reads the bill, records everything automatically" },
  { from: "user", text: "Ramesh ko kitna dena hai?", caption: "Owner asks in his own words" },
  { from: "ai", text: "Ramesh Gupta का कुल उधार: ₹4,300। सबसे पुराना: 23 दिन पहले। क्या reminder भेजूं? [हाँ / नहीं]", caption: "AI knows aging, flags risk, asks before acting" },
  { from: "user", text: "हाँ", caption: "Owner approves with one word" },
  { from: "ai", text: "Ramesh Gupta को WhatsApp reminder भेज दिया।", caption: "Action taken — human always approved it first" },
];

const PILLS = ["Photo Bills", "Voice Notes", "PDFs", "Plain Text"];

export default function WhatsAppLoop() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const section = root.current;
      if (!section) return;
      const bubbles = section.querySelectorAll('[data-gsap="bubble"]');
      const typing = section.querySelector('[data-gsap="typing"]');
      if (!bubbles.length) return;
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top 60%",
        once: true,
        onEnter: () => {
          const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
          bubbles.forEach((b, i) => {
            tl.from(b as Element, { y: 15, opacity: 0, duration: 0.4 }, i === 0 ? 0 : "+=0.8");
            // typing indicator flashes before each AI reply
            if ((SCRIPT[i]?.from === "ai") && typing) {
              tl.fromTo(typing, { opacity: 0 }, { opacity: 1, duration: 0.25 }, "<-=0.55");
              tl.to(typing, { opacity: 0, duration: 0.2 }, "<+=0.3");
            }
          });
          tl.from(section.querySelectorAll('[data-gsap="pill"]'), {
            y: 12,
            opacity: 0,
            duration: 0.4,
            stagger: 0.1,
          });
        },
      });
      return () => st.kill();
    },
    { scope: root }
  );

  return (
    <section
      ref={root}
      id="whatsapp-loop"
      aria-labelledby="loop-heading"
      className="px-4 py-24 lg:py-32"
      style={{ background: "linear-gradient(to bottom, #0F2040, #0A1929)" }}
    >
      <div className="mx-auto max-w-4xl text-center">
        <h2 id="loop-heading" className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#FDFAF4" }}>
          One WhatsApp. <span style={{ color: "#E8771A" }}>Your Entire Business.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: "rgba(253,250,244,0.75)" }}>
          No app to download. No form to fill. Just message VyapaarAI like you&apos;d message a friend.
        </p>

        <div
          className="mx-auto mt-10 w-[320px] overflow-hidden rounded-[40px] border-4"
          style={{ borderColor: "#1A1209", background: "#1A1209", maxWidth: "100%" }}
          role="img"
          aria-label="Animated WhatsApp conversation: owner sends a bill photo, VyapaarAI reads it and sends a payment reminder after approval"
        >
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#128C7E" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "#E8771A" }} aria-hidden="true">
              V
            </span>
            <div className="text-left leading-tight">
              <p className="text-sm font-semibold text-white">VyapaarAI</p>
              <p className="flex items-center gap-1 text-[11px] text-white/80">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#25D366" }} aria-hidden="true" />
                online
              </p>
            </div>
          </div>
          <div className="space-y-2 px-3 py-4" style={{ background: "#E5DDD5" }} aria-hidden="true">
            {SCRIPT.map((b, i) => (
              <div key={i}>
                <div className={`flex ${b.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    data-gsap="bubble"
                    className="max-w-[85%] rounded-2xl px-3 py-2 text-left text-[13px] leading-snug"
                    style={
                      b.from === "user"
                        ? { background: "#DCF8C6", color: "#1A1209", borderTopRightRadius: 4 }
                        : { background: "#FFFFFF", color: "#1A1209", border: "1px solid #E8DDD0", borderTopLeftRadius: 4 }
                    }
                  >
                    {b.text}
                  </div>
                </div>
                <p className="mt-1 px-1 text-left text-[10px] italic" style={{ color: "#8B7355" }}>
                  {b.caption}
                </p>
              </div>
            ))}
            <div className="flex justify-start">
              <div data-gsap="typing" className="flex gap-1 rounded-2xl bg-white px-3 py-2" style={{ opacity: 0 }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#8B7355", animationDelay: `${d * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {PILLS.map((p) => (
            <span
              key={p}
              data-gsap="pill"
              className="rounded-full border px-4 py-2 text-sm"
              style={{ borderColor: "rgba(232,119,26,0.4)", color: "rgba(253,250,244,0.8)" }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
