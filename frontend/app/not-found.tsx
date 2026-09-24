"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center" style={{ color: "var(--ink)" }}>
      <motion.svg viewBox="0 0 220 140" width="240" height="152" fill="none"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        {/* torn paper edge */}
        <motion.path
          d="M10 20 L30 12 L50 20 L70 12 L90 20 L110 12 L130 20 L150 12 L170 20 L190 12 L210 20 L210 130 L10 130 Z"
          fill="var(--card)" stroke="var(--card-border)" strokeWidth="2"
          initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
        />
        <motion.path d="M40 95 C 80 90, 100 55, 130 60 S 175 35, 190 22" stroke="var(--accent)" strokeWidth="4"
          strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
        <circle cx="190" cy="22" r="7" fill="var(--rose)" />
        <text x="110" y="118" textAnchor="middle" fontSize="12" fill="var(--ink-soft)">yeh panna udhaar pe gaya 😄</text>
      </motion.svg>
      <h1 className="font-display mt-2 text-5xl font-bold">404</h1>
      <p className="card-sub mt-2">Khata mein ye panna nahi mila.</p>
      <div className="mt-5 flex gap-2">
        <Link href="/" className="btn-ghost" style={{ textDecoration: "none" }}>Landing</Link>
        <Link href="/app" className="btn-primary" style={{ textDecoration: "none" }}>Dashboard</Link>
      </div>
    </main>
  );
}
