"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  delay = 0,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, delay, ease: [0.23, 1, 0.32, 1] }}
      whileHover={hover ? { y: -2, boxShadow: "0 8px 32px rgba(232,119,26,0.14)" } : undefined}
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}
