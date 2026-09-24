"use client";

/**
 * [15] FOOTER — deep navy-black. Real links only (no socials invented).
 * Gold व्यापार watermark (decorative, contained, never scrolls sideways).
 */

import Link from "next/link";
import { scrollToId } from "./gsap-setup";

const anchor = (id: string) => (e: React.MouseEvent) => {
  e.preventDefault();
  scrollToId(id);
};

export default function Footer() {
  return (
    <footer className="overflow-hidden" style={{ background: "#0A0D14", color: "rgba(253,250,244,0.6)" }}>
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <Link href="/" className="flex flex-col leading-none rounded focus-visible:outline-2" style={{ outlineColor: "#E8771A" }} aria-label="VyapaarAI home">
            <span className="font-display text-2xl font-bold" style={{ color: "#FDFAF4" }}>
              VyapaarAI
            </span>
            <span className="font-devanagari text-sm" style={{ color: "#E8771A" }}>
              व्यापार
            </span>
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm" aria-label="Footer">
            <a href="#features" onClick={anchor("features")} className="rounded hover:underline focus-visible:outline-2" style={{ outlineColor: "#E8771A" }}>
              Features
            </a>
            <a href="#how-it-works" onClick={anchor("how-it-works")} className="rounded hover:underline focus-visible:outline-2" style={{ outlineColor: "#E8771A" }}>
              How It Works
            </a>
            <a href="#demo" onClick={anchor("demo")} className="rounded hover:underline focus-visible:outline-2" style={{ outlineColor: "#E8771A" }}>
              Demo
            </a>
            <Link href="/login" className="rounded hover:underline focus-visible:outline-2" style={{ outlineColor: "#E8771A" }}>
              Sign In
            </Link>
            <Link href="/register" className="rounded hover:underline focus-visible:outline-2" style={{ outlineColor: "#E8771A" }}>
              Get Started
            </Link>
          </nav>
        </div>

        <div className="relative mt-12 text-center">
          <hr className="relative z-10" style={{ borderColor: "rgba(232,221,208,0.3)" }} />
          <div
            className="font-devanagari pointer-events-none select-none"
            style={{ fontSize: "3rem", color: "#D4A017", opacity: 0.15, lineHeight: 1.4 }}
            aria-hidden="true"
          >
            व्यापार
          </div>
          <p className="relative z-10 -mt-6 text-sm" style={{ color: "rgba(253,250,244,0.4)" }}>
            Making India&apos;s smallest businesses smarter, one WhatsApp at a time.
          </p>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 text-xs md:flex-row" style={{ color: "rgba(253,250,244,0.3)" }}>
          <p>© 2025 VyapaarAI. Built for India&apos;s kiranas.</p>
          <p>Powered by Gemini · Groq · WhatsApp · FastAPI</p>
        </div>
      </div>
    </footer>
  );
}
