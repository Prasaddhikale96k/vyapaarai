"use client";

/** BEAT 1 — Meet Ramesh. Shop runs on chaos. */

import { motion, useReducedMotion } from "framer-motion";
import { LottiePlayer } from "@/components/illustrations/LottiePlayer";
import { KiranaStore } from "@/components/illustrations/doodles";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];
const WORDS = "Every day, 13 million shops run on memory and hope.".split(" ");

export default function Beat1Hero() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden px-6 py-20" style={{ background: "var(--paper)" }}>
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 md:grid-cols-5">
        <motion.div
          className="md:col-span-2"
          data-reveal
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, scale: 0.92 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.8, ease: EASE },
              })}
          style={{ color: "var(--ink)" }}
        >
          <LottiePlayer
            name="hero-shop"
            fallback={<KiranaStore className="h-auto w-full max-w-md" />}
            className="mx-auto w-full max-w-md"
          />
        </motion.div>
        <div className="md:col-span-3">
          <h1 className="font-display mb-6 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl" style={{ color: "var(--ink)" }}>
            {WORDS.map((w, i) => (
              <motion.span
                key={i}
                className="mr-3 inline-block"
                data-reveal
                {...(reduce
                  ? {}
                  : {
                      initial: { opacity: 0, y: 20 },
                      animate: { opacity: 1, y: 0 },
                      transition: { delay: 0.4 + i * 0.06, duration: 0.6, ease: EASE },
                    })}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p
            className="mb-10 max-w-2xl text-xl md:text-2xl"
            style={{ color: "var(--ink-soft)" }}
            data-reveal
            {...(reduce ? {} : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 1.0, duration: 0.6, ease: EASE } })}
          >
            Ramesh writes sales in a khata. Forgets who owes what. Runs out of stock mid-festival.
          </motion.p>
          <motion.div
            className="flex items-center gap-3"
            style={{ color: "var(--accent)" }}
            data-reveal
            {...(reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 1.5, duration: 0.5 } })}
          >
            <span className="text-sm font-medium uppercase tracking-wide">See his day</span>
            <motion.svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              {...(reduce ? {} : { animate: { y: [0, 5, 0] }, transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } })}
            >
              <path d="M10 3L10 17M10 17L3 10M10 17L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </motion.svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
