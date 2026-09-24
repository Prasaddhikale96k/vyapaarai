"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";

export default function Header() {
  const { theme, toggle } = useTheme();
  return (
    <header className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-4">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        style={{ outlineColor: "var(--accent)" }}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          V
        </span>
        <span className="text-lg font-bold" style={{ color: "var(--ink)" }}>
          VyapaarAI
        </span>
      </Link>
      <nav className="ml-auto hidden items-center gap-5 text-sm md:flex" style={{ color: "var(--ink-soft)" }}>
        <a href="#how" className="rounded px-1 py-2 hover:opacity-70 active:opacity-50">
          How it works
        </a>
        <a href="#demo" className="rounded px-1 py-2 hover:opacity-70 active:opacity-50">
          Demo
        </a>
      </nav>
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <button
          onClick={toggle}
          aria-label="Toggle color theme"
          className="min-h-[44px] min-w-[44px] rounded-xl border p-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ borderColor: "var(--card-border)", color: "var(--ink)", outlineColor: "var(--accent)" }}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-4"
          style={{ background: "var(--accent)", outlineColor: "var(--accent)", textDecoration: "none" }}
        >
          Login
        </Link>
      </div>
    </header>
  );
}
