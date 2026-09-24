"use client";

/** BEAT 2 — The daily struggle. Dark mood, real numbers, no blame. */

import { motion, useReducedMotion } from "framer-motion";
import { LottiePlayer } from "@/components/illustrations/LottiePlayer";
import { Munshi } from "@/components/illustrations/doodles";
import SectionWrapper from "./SectionWrapper";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

const CARDS = [
  { t: "Rs.53,400 forgotten in udhaari", from: { x: -40, y: 0 } },
  { t: "18 products out of stock", from: { x: 40, y: 0 } },
  { t: "3 hours on ledger maths", from: { x: 0, y: 40 } },
];

export default function Beat2Problem() {
  const reduce = useReducedMotion() ?? false;
  return (
    <SectionWrapper className="overflow-hidden px-6 py-16 md:py-24" >
      <div className="pointer-events-none absolute inset-0" aria-hidden style={{ background: "linear-gradient(var(--paper), var(--card-border))", opacity: 0.5 }} />
      <div className="relative mx-auto max-w-5xl text-center">
        <div className="mx-auto max-w-md" style={{ color: "var(--ink)" }}>
          <LottiePlayer name="problem-chaos" fallback={<Munshi className="h-auto w-full" />} className="mx-auto w-full max-w-md" />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.t}
              className="rounded-2xl border-2 p-4 shadow-lg"
              style={{ background: "var(--card)", borderColor: "var(--rose)" }}
              data-reveal
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, ...c.from },
                    whileInView: { opacity: 1, x: 0, y: 0 },
                    viewport: { once: true, margin: "-100px" },
                    transition: { delay: 0.5 + i * 0.2, duration: 0.6, ease: EASE },
                  })}
            >
              <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {c.t}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
