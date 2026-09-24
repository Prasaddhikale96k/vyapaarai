"use client";

/** BEAT 5 — The results. Before/after wipe, real numbers, earned payoff. */

import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LottiePlayer } from "@/components/illustrations/LottiePlayer";
import { Sparkline, StampPaid } from "@/components/illustrations/doodles";
import SectionWrapper from "./SectionWrapper";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

function Score() {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion() ?? false;
  const [n, setN] = useState(88);
  useEffect(() => {
    if (!inView || reduce) return;
    setN(44);
    const c = animate(44, 88, { duration: 1.5, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, reduce]);
  return (
    <span ref={ref} className="tabular-nums">
      {n}
    </span>
  );
}

export default function Beat5Transformation() {
  const reduce = useReducedMotion() ?? false;
  return (
    <SectionWrapper className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="mb-8 text-center text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
          30 days with VyapaarAI →
        </p>
        <div className="relative grid overflow-hidden rounded-3xl border md:grid-cols-2" style={{ borderColor: "var(--card-border)" }}>
          <div className="p-8 md:p-12" style={{ background: "var(--card)", color: "var(--ink-soft)", filter: "grayscale(1)", opacity: 0.85 }}>
            <p className="text-sm font-bold uppercase tracking-wide">Before</p>
            <p className="font-display mt-4 text-5xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
              44
            </p>
            <p className="mt-2">Health score</p>
            <p className="mt-4">Rs.53,400 lost to bad debt</p>
            <p>3 hrs/day on books</p>
          </div>
          <div className="relative p-8 md:p-12" style={{ background: "var(--accent-soft)" }}>
            <motion.div
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: "var(--accent)" }}
              data-reveal
              {...(reduce
                ? {}
                : {
                    initial: { scaleY: 0 },
                    whileInView: { scaleY: 1 },
                    viewport: { once: true, margin: "-100px" },
                    transition: { duration: 1.2, ease: EASE },
                  })}
              aria-hidden="true"
            />
            <p className="text-sm font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              After
            </p>
            <p className="font-display mt-4 text-5xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
              <Score />
            </p>
            <p className="mt-2" style={{ color: "var(--ink-soft)" }}>
              Health score
            </p>
            <div className="mt-4 flex items-center gap-3" style={{ color: "var(--accent)" }}>
              <LottiePlayer name="success-growth" fallback={<Sparkline className="h-10 w-32" />} className="w-32" />
              <StampPaid />
            </div>
            <p className="mt-4" style={{ color: "var(--ink-soft)" }}>
              Rs.0 missed payments · 5 mins/day to review
            </p>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
