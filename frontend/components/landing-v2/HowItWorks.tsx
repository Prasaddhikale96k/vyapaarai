"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

function BubbleIcon() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 20 h64 v36 h-38 l-14 12 v-12 h-12 Z" />
      <path d="M30 36 h36 M30 46 h24" strokeWidth="3" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M48 10 L58 38 L86 48 L58 58 L48 86 L38 58 L10 48 L38 38 Z" />
      <circle cx="72" cy="22" r="5" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg viewBox="0 0 96 96" className="h-24 w-24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 84 h72" />
      <path d="M24 84 v-22 M42 84 v-38 M60 84 v-28 M78 84 v-48" />
      <path d="M20 44 L40 30 L56 36 L80 16" strokeWidth="3" />
      <path d="M70 16 h10 v10" strokeWidth="3" />
    </svg>
  );
}

const STEPS = [
  {
    n: "1",
    Icon: BubbleIcon,
    h: "Message your business",
    d: "Voice, photo, or text. Hindi, English, or Hinglish.",
  },
  {
    n: "2",
    Icon: SparkIcon,
    h: "AI handles the rest",
    d: "Auto-entry, overdue alerts, stock warnings. Zero manual work.",
  },
  {
    n: "3",
    Icon: ChartIcon,
    h: "Get insights, not tasks",
    d: "Health score, forecasts, reports. Know what matters.",
  },
];

export default function HowItWorks() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section id="how" className="px-6 py-16 md:py-24" style={{ background: "var(--card)" }}>
      <div className="mx-auto max-w-7xl">
        <motion.h2
          className="mb-10 text-center text-3xl font-bold md:text-4xl"
          style={{ color: "var(--ink)" }}
          data-reveal
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 20 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, margin: "-100px" },
                transition: { duration: 0.6, ease: EASE },
              })}
        >
          How it works
        </motion.h2>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="rounded-2xl border p-8 transition-colors"
              style={{ background: "var(--paper)", borderColor: "var(--card-border)" }}
              data-reveal
              {...(reduce
                ? {}
                : {
                    initial: { opacity: 0, y: 20 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, margin: "-100px" },
                    transition: { duration: 0.6, ease: EASE, delay: i * 0.15 },
                  })}
            >
              <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                {s.n}
              </p>
              <div className="my-4" style={{ color: "var(--accent)" }}>
                <s.Icon />
              </div>
              <h3 className="mb-2 text-xl font-semibold" style={{ color: "var(--ink)" }}>
                {s.h}
              </h3>
              <p style={{ color: "var(--ink-soft)" }}>{s.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
