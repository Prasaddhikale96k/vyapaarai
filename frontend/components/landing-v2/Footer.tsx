"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t px-6 py-8" style={{ background: "#171512", borderColor: "rgba(250,247,242,0.1)" }}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm md:flex-row" style={{ color: "rgba(250,247,242,0.6)" }}>
        <p>© 2026 VyapaarAI</p>
        <nav className="flex items-center gap-5" aria-label="Footer">
          <Link href="/app" className="hover:opacity-80 active:opacity-60">
            Product
          </Link>
          <Link href="/login" className="hover:opacity-80 active:opacity-60">
            Login
          </Link>
          <Link href="/register" className="hover:opacity-80 active:opacity-60">
            Register
          </Link>
          <Link href="/admin" className="hover:opacity-80 active:opacity-60">
            Admin
          </Link>
        </nav>
        <p className="font-devanagari text-base" style={{ color: "rgba(250,247,242,0.5)" }} aria-label="Vyapaar brand signature">
          व्यापार
        </p>
      </div>
    </footer>
  );
}
