"use client";

/**
 * [13] TESTIMONIALS — "From the Ledger to the Future."
 * Clearly-labeled illustrative beta-tester quotes (English only, C1).
 * Stagger entrance; hover lift.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion } from "framer-motion";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const QUOTES = [
  {
    text: "Before, I'd find out my losses at month's end. Now I know every morning.",
    name: "Rajesh S., Store Owner, Pune (Beta Tester)",
  },
  {
    text: "The udhaari reminder feature alone paid for itself. ₹53,400 was just sitting there.",
    name: "Meena T., Provision Store, Mumbai (Beta Tester)",
  },
  {
    text: "I sent a voice note in Marathi and my ledger updated. Felt like magic.",
    name: "Anil P., General Store, Nashik (Beta Tester)",
  },
];

export default function Testimonials() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="quote"]') ?? [], {
        y: 30,
        opacity: 0.2,
        duration: 0.7,
        ease: EASE_EXPO,
        stagger: 0.12,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#FFF3E0" }}>
      <div className="mx-auto max-w-7xl">
        <p className="text-center text-sm font-semibold uppercase tracking-widest" style={{ color: "#B85A00" }}>
          What Early Users Say
        </p>
        <h2 id="testimonials-heading" className="font-display mt-2 text-center text-3xl font-bold sm:text-4xl lg:text-5xl" style={{ color: "#1A1209" }}>
          From the Ledger to the Future.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {QUOTES.map((q) => (
            <motion.figure
              key={q.name}
              data-gsap="quote"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="rounded-2xl border bg-white p-6 shadow-sm"
              style={{ borderColor: "#E8DDD0" }}
            >
              <svg width="40" height="30" viewBox="0 0 40 30" fill="none" aria-hidden="true">
                <path d="M4 26 C4 14 10 6 22 3 L24 8 C16 10 12 15 12 22 Z M24 26 C24 14 30 6 40 3 L40 8 C34 10 30 15 30 22 Z" fill="#E8771A" opacity="0.85" />
              </svg>
              <blockquote className="mt-3 leading-relaxed" style={{ color: "#1A1209" }}>
                “{q.text}”
              </blockquote>
              <figcaption className="mt-4 text-sm font-medium" style={{ color: "#8B7355" }}>
                — {q.name}
              </figcaption>
            </motion.figure>
          ))}
        </div>
        <p className="mt-6 text-center text-xs" style={{ color: "#8B7355" }}>
          *Quotes from beta testers during development phase. VyapaarAI is in active development.
        </p>
      </div>
    </section>
  );
}
