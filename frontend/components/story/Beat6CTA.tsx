"use client";

/** BEAT 6 — Your turn. Open invitation, magnetic CTA lands in Phase 2. */

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { LottiePlayer } from "@/components/illustrations/LottiePlayer";
import { Munshi, Scooter } from "@/components/illustrations/doodles";
import SectionWrapper from "./SectionWrapper";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export default function Beat6CTA() {
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
    <SectionWrapper className="overflow-hidden px-6 py-20 md:py-28">
      <div
        className="font-devanagari pointer-events-none absolute inset-0 flex items-center justify-center font-bold select-none"
        style={{ fontSize: "22rem", opacity: 0.05, color: "var(--accent)" }}
        aria-hidden="true"
      >
        व्यापार
      </div>
      <div className="relative mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 flex max-w-xs items-end justify-center gap-3" style={{ color: "var(--accent)" }}>
          <LottiePlayer name="cta-rocket" fallback={<Scooter className="h-20 w-40" />} className="w-40" />
          <Munshi className="h-20 w-20" />
        </div>
        <motion.h2 className="font-display mb-4 text-4xl font-semibold md:text-5xl" style={{ color: "var(--ink)" }} data-reveal {...rise(0)}>
          Your shop&apos;s story starts here.
        </motion.h2>
        <motion.p className="mb-8 text-xl" style={{ color: "var(--ink-soft)" }} data-reveal {...rise(0.15)}>
          Free for 30 days. No card. Just your WhatsApp number.
        </motion.p>
        <motion.div data-reveal {...rise(0.3)}>
          <Link
            href="/register"
            className="inline-block rounded-full px-12 py-5 text-xl font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ background: "var(--accent)", outlineColor: "var(--accent)", textDecoration: "none" }}
          >
            Start your free trial →
          </Link>
        </motion.div>
        <motion.div data-reveal {...rise(0.45)}>
          <Link
            href="/app"
            className="mt-4 inline-block text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: "var(--accent)", outlineColor: "var(--accent)" }}
          >
            Book a 5-min demo instead
          </Link>
        </motion.div>
        <motion.p className="mt-8 text-sm" style={{ color: "var(--ink-faint)" }} data-reveal {...rise(0.6)}>
          1,000+ Indian MSMEs already growing with us
        </motion.p>
      </div>
    </SectionWrapper>
  );
}
