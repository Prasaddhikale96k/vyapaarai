"use client";

import { motion, useReducedMotion, useScroll } from "framer-motion";

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduce = useReducedMotion() ?? false;
  if (reduce) return null;
  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-50 h-1 origin-left"
      style={{ scaleX: scrollYProgress, background: "var(--accent)" }}
      aria-hidden="true"
    />
  );
}
