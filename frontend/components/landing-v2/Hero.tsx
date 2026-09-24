"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

function anim(reduce: boolean, delay: number) {
  return reduce
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: EASE, delay },
      };
}

export default function Hero() {
  const reduce = useReducedMotion() ?? false;
  return (
    <section className="relative overflow-hidden px-6 py-16 md:py-24" style={{ background: "var(--paper)" }}>
      {/* Subtle brand watermark only */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        style={{ opacity: 0.05 }}
        aria-hidden="true"
      >
        <span className="font-devanagari font-bold" style={{ fontSize: "20rem", color: "var(--accent)" }}>
          व्यापार
        </span>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 md:grid-cols-2">
        <div>
          <motion.h1
            className="mb-6 text-5xl font-bold leading-tight md:text-6xl"
            style={{ color: "var(--ink)" }}
            data-reveal
            {...anim(reduce, 0)}
          >
            Your shop&apos;s WhatsApp assistant. Handles sales, stock, payments.
          </motion.h1>
          <motion.p
            className="mb-8 max-w-lg text-xl"
            style={{ color: "var(--ink-soft)" }}
            data-reveal
            {...anim(reduce, 0.2)}
          >
            Voice your sale. Get instant alerts. No app to learn.
          </motion.p>
          <motion.div data-reveal {...anim(reduce, 0.4)}>
            <Link
              href="/register"
              className="inline-block rounded-full px-8 py-4 text-lg font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4"
              style={{ background: "var(--accent)", outlineColor: "var(--accent)", textDecoration: "none" }}
            >
              Try it free
            </Link>
          </motion.div>
          <motion.p
            className="mt-6 text-sm"
            style={{ color: "var(--ink-faint)" }}
            data-reveal
            {...anim(reduce, 0.55)}
          >
            1,000+ Indian MSMEs already using it
          </motion.p>
        </div>

        <motion.div
          className="relative"
          data-reveal
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, x: 40 },
                animate: { opacity: 1, x: 0 },
                transition: { duration: 0.8, ease: EASE, delay: 0.3 },
              })}
        >
          <div
            className="relative mx-auto aspect-[9/19] w-full max-w-sm overflow-hidden rounded-[3rem] border-8 shadow-2xl"
            style={{ background: "var(--ink)", borderColor: "var(--ink)" }}
          >
            <div className="absolute inset-8 overflow-y-auto rounded-2xl p-4" style={{ background: "var(--card)" }}>
              <div className="space-y-4">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2 text-white" style={{ background: "var(--accent)", borderTopRightRadius: 4 }}>
                    <p className="text-sm">Today ka sale?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div
                    className="max-w-[80%] rounded-2xl border px-4 py-2"
                    style={{ background: "var(--paper)", borderColor: "var(--card-border)", borderTopLeftRadius: 4 }}
                  >
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      Rs.18,450
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                      Top: Atta (22 units)
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl px-4 py-2 text-white" style={{ background: "var(--accent)", borderTopRightRadius: 4 }}>
                    <p className="text-sm">Kitna udhaar pending?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div
                    className="max-w-[80%] rounded-2xl border px-4 py-2"
                    style={{ background: "var(--paper)", borderColor: "var(--card-border)", borderTopLeftRadius: 4 }}
                  >
                    <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      Rs.53,400 across 12 customers
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
