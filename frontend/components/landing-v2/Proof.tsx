"use client";

import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

/* SSR shows the final value; client recounts on entry. Never blank. */
function Stat({ value, prefix = "", suffix = "", label }: { value: number; prefix?: string; suffix?: string; label: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion() ?? false;
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!inView || reduce) return;
    setN(0);
    const c = animate(0, value, { duration: 1.2, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <div className="text-center">
      <p ref={ref} className="text-5xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
        {prefix}
        {n.toLocaleString("en-IN")}
        {suffix}
      </p>
      <p className="mt-2 text-sm uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
        {label}
      </p>
    </div>
  );
}

export default function Proof() {
  const reduce = useReducedMotion() ?? false;
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-100px" },
          transition: { duration: 0.6, ease: EASE, delay },
        };
  return (
    <section className="px-6 py-16 md:py-24" style={{ background: "var(--tint)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-10 sm:grid-cols-3">
          <motion.div data-reveal {...rise(0)}>
            <Stat value={53400} prefix="Rs." label="overdue caught" />
          </motion.div>
          <motion.div data-reveal {...rise(0.15)}>
            <Stat value={18} label="low-stock alerts" />
          </motion.div>
          <motion.div data-reveal {...rise(0.3)}>
            <span className="block text-center text-5xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>
              44→88
            </span>
            <span className="mt-2 block text-center text-sm uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>
              health score jump
            </span>
          </motion.div>
        </div>
        <motion.blockquote
          className="mx-auto mt-14 max-w-2xl text-center text-2xl italic leading-relaxed"
          style={{ color: "var(--ink)" }}
          data-reveal
          {...rise(0.15)}
        >
          “We used to lose Rs.15,000 monthly to missed reorders. VyapaarAI caught it all.”
          <footer className="mt-4 text-base not-italic" style={{ color: "var(--ink-soft)" }}>
            — Sharma Kirana, Delhi
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
}
