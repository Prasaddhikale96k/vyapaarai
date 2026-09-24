"use client";

/** BEAT 4 — Watch it work. Sticky visual, scrolling chapters. */

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { LottiePlayer } from "@/components/illustrations/LottiePlayer";
import { Munshi, RupeeCoins, StampOverdue, UdhaarKhata } from "@/components/illustrations/doodles";
import SectionWrapper from "./SectionWrapper";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

const CHAPTERS = [
  {
    h: "Just say it.",
    d: "“Bees kilo chawal becha.” VyapaarAI enters the Rs.20 rice sale. Zero typing.",
    lottie: "magic-voice",
    art: <Munshi className="h-auto w-full max-w-xs" />,
  },
  {
    h: "Snap the bill.",
    d: "Handwritten? Faded? VyapaarAI reads it, structures it, logs it.",
    lottie: "magic-photo",
    art: <UdhaarKhata className="h-auto w-full max-w-xs" />,
  },
  {
    h: "It remembers.",
    d: "Rs.53,400 overdue. 18 SKUs low. Reorder Tuesday. Every time.",
    lottie: "magic-alert",
    art: (
      <span className="flex items-center gap-3">
        <RupeeCoins className="h-24 w-24" />
        <StampOverdue />
      </span>
    ),
  },
];

export default function Beat4Magic() {
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  return (
    <SectionWrapper className="px-6 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
        <div className="md:sticky md:top-24 md:self-start">
          <div className="mx-auto flex min-h-[320px] max-w-sm items-center justify-center rounded-3xl border p-8" style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--ink)" }}>
            <LottiePlayer
              key={CHAPTERS[active].lottie}
              name={CHAPTERS[active].lottie}
              fallback={CHAPTERS[active].art}
              className="w-full max-w-xs"
            />
          </div>
          <div className="mt-4 flex justify-center gap-2" aria-hidden="true">
            {CHAPTERS.map((c, i) => (
              <span
                key={c.h}
                className="h-2 w-2 rounded-full"
                style={{ background: i === active ? "var(--accent)" : "var(--card-border)" }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-16 py-8">
          {CHAPTERS.map((c, i) => (
            <motion.div
              key={c.h}
              data-reveal
              onViewportEnter={() => setActive(i)}
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 24 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, margin: "-100px" },
                    transition: { duration: 0.6, ease: EASE },
                  })}
            >
              <h3 className="font-display mb-2 text-3xl font-semibold" style={{ color: "var(--ink)" }}>
                {c.h}
              </h3>
              <p className="max-w-prose text-lg" style={{ color: "var(--ink-soft)" }}>
                {c.d}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
