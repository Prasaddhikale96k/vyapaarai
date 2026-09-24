"use client";

import { motion } from "framer-motion";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={hover ? { y: -2, boxShadow: "0 8px 32px rgba(16,185,129,0.12)" } : undefined}
      className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`}
    >
      {children}
    </motion.div>
  );
}
