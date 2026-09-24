"use client";

/**
 * [01] NAVIGATION — fixed, transparent → frosted after 80px.
 * Fully working mobile overlay menu (staggered links). No dead controls.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { scrollToId } from "./gsap-setup";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LINKS = [
  { label: "Features", id: "features" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Demo", id: "demo" },
];

function LedgerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M6 7 C10 5.5 14 5.5 16 7 L16 25 C14 23.5 10 23.5 6 25 Z M26 7 C22 5.5 18 5.5 16 7 L16 25 C18 23.5 22 23.5 26 25 Z"
        stroke="#1A1209"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 7 L16 25" stroke="#E8771A" strokeWidth="2" strokeLinecap="round" />
      <path d="M9 12 H13 M9 15.5 H13 M19 12 H23 M19 15.5 H23" stroke="#8B7355" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 80);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  const go = (id: string) => {
    setOpen(false);
    // wait a tick so the overlay closes before scrolling on mobile
    setTimeout(() => scrollToId(id), open ? 80 : 0);
  };

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 transition-colors"
        style={{
          background: scrolled ? "rgba(253,250,244,0.9)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid #E8DDD0" : "1px solid transparent",
        }}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-20 lg:px-8" aria-label="Primary">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ outlineColor: "#E8771A" }}
            aria-label="VyapaarAI home"
          >
            <LedgerIcon />
            <span className="flex flex-col leading-none">
              <span className="font-display text-xl font-bold" style={{ color: "#1A1209" }}>
                VyapaarAI
              </span>
              <span className="font-devanagari text-xs" style={{ color: "#E8771A" }}>
                व्यापार
              </span>
            </span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            {LINKS.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className="landing-nav-link min-h-[44px] rounded text-sm font-medium focus-visible:outline-2"
                style={{ color: "#4A3728", outlineColor: "#E8771A" }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ borderColor: "#E8DDD0", color: "#1A1209", outlineColor: "#E8771A", textDecoration: "none" }}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-[44px] items-center rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "#E8771A", outlineColor: "#E8771A", textDecoration: "none" }}
            >
              Get Started Free
            </Link>
          </div>
          <button
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
            style={{ color: "#1A1209" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <motion.path
                d="M4 7 H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={open ? { d: "M6 6 L18 18" } : { d: "M4 7 H20" }}
                transition={{ duration: 0.25, ease: EASE }}
              />
              <motion.path
                d="M4 12 H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={open ? { opacity: 0 } : { opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <motion.path
                d="M4 17 H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                animate={open ? { d: "M6 18 L18 6" } : { d: "M4 17 H20" }}
                transition={{ duration: 0.25, ease: EASE }}
              />
            </svg>
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-2"
            style={{ background: "#FDFAF4" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="dialog"
            aria-label="Menu"
          >
            {LINKS.map((l, i) => (
              <motion.button
                key={l.id}
                onClick={() => go(l.id)}
                className="font-display min-h-[56px] rounded px-4 text-3xl font-bold"
                style={{ color: "#1A1209" }}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.07, duration: 0.4, ease: EASE }}
              >
                {l.label}
              </motion.button>
            ))}
            <motion.div
              className="mt-6 flex gap-3"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.4, ease: EASE }}
            >
              <Link
                href="/login"
                className="inline-flex min-h-[48px] items-center rounded-full border px-6 py-3 font-semibold"
                style={{ borderColor: "#E8DDD0", color: "#1A1209", textDecoration: "none" }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-[48px] items-center rounded-full px-6 py-3 font-semibold text-white"
                style={{ background: "#E8771A", textDecoration: "none" }}
              >
                Get Started Free
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
