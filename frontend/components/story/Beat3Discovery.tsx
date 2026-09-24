"use client";

/** BEAT 3 — The message. The pivot. Mood lifts. */

import { motion, useReducedMotion } from "framer-motion";
import { LottiePlayer } from "@/components/illustrations/LottiePlayer";
import { WhatsAppPhone } from "@/components/illustrations/doodles";
import SectionWrapper from "./SectionWrapper";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export default function Beat3Discovery() {
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
    <SectionWrapper className="px-6 py-16 md:py-24" >
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2" style={{ background: "var(--paper)" }}>
        <div>
          <motion.p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }} data-reveal {...rise(0.6)}>
            Then one day
          </motion.p>
          <motion.h2 className="font-display mb-4 text-3xl font-semibold md:text-4xl" style={{ color: "var(--ink)" }} data-reveal {...rise(0.8)}>
            A message: “Try VyapaarAI. Free for 30 days.”
          </motion.h2>
          <motion.p className="max-w-prose text-lg" style={{ color: "var(--ink-soft)" }} data-reveal {...rise(1.0)}>
            Ramesh clicks. Connects his WhatsApp. The story changes.
          </motion.p>
        </div>
        <motion.div
          className="relative mx-auto w-full max-w-xs"
          data-reveal
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, x: 60 },
                whileInView: { opacity: 1, x: 0 },
                viewport: { once: true, margin: "-100px" },
                transition: { duration: 0.8, ease: EASE },
              })}
        >
          <div className="pointer-events-none absolute inset-0 -z-0 scale-110 rounded-full" aria-hidden style={{ background: "radial-gradient(circle, var(--accent-soft), transparent 70%)" }} />
          <motion.div
            className="relative rounded-[2.5rem] border-8 p-4 shadow-2xl"
            style={{ background: "var(--ink)", borderColor: "var(--ink)", color: "var(--ink)" }}
            {...(reduce ? {} : { animate: { y: [-6, 6, -6] }, transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } })}
          >
            <LottiePlayer
              name="discovery-phone"
              fallback={<WhatsAppPhone className="h-auto w-full" />}
              className="w-full"
            />
          </motion.div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
