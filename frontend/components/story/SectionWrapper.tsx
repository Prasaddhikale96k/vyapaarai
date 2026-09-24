"use client";

/** Scroll-reveal section shell. data-reveal keeps the watchdog covering it. */

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

export default function SectionWrapper({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.section
      id={id}
      className={`relative ${className}`}
      data-reveal
      {...(reduce
        ? {}
        : {
            initial: { opacity: 0 },
            whileInView: { opacity: 1 },
            viewport: { once: true, margin: "-100px" },
            transition: { duration: 0.6, ease: EASE },
          })}
    >
      {children}
    </motion.section>
  );
}
