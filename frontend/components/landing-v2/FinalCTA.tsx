"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export default function FinalCTA() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section className="px-6 py-20" style={{ background: "var(--card)" }}>
      <motion.div
        className="mx-auto max-w-2xl text-center"
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
        <h2 className="mb-4 text-4xl font-semibold" style={{ color: "var(--ink)" }}>
          Start running smarter today.
        </h2>
        <p className="mb-8 text-lg" style={{ color: "var(--ink-soft)" }}>
          Free for 30 days. No card needed.
        </p>
        <Link
          href="/register"
          className="inline-block rounded-full px-10 py-5 text-lg font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ background: "var(--accent)", outlineColor: "var(--accent)", textDecoration: "none" }}
        >
          Get started free
        </Link>
        <div className="mt-4">
          <Link
            href="/app"
            className="text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: "var(--accent)", outlineColor: "var(--accent)" }}
          >
            Book a demo instead →
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
