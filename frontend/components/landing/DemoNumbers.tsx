"use client";

/**
 * [07] DEMO NUMBERS — "Real Numbers. Real Business."
 * 6 stat cards with rAF count-ups (SSR shows final values) + lazy Recharts
 * health chart (dynamic ssr:false, static-text fallback).
 */

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { formatIN, useCountUp, useInViewOnce } from "@/hooks/useCountUp";
import { API_URL } from "@/lib/api";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const HealthChart = dynamic(() => import("./HealthChart"), {
  ssr: false,
  loading: () => (
    <p className="py-8 text-center text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
      Business health score improved from 44 to 88 over 12 weeks.
    </p>
  ),
});

function RupeeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <text x="6" y="21" fontSize="18" fontWeight="bold" fill="#C0392B" fontFamily="Georgia, serif">₹</text>
    </svg>
  );
}
function PulseIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M2 14 H9 L12 7 L16 21 L19 14 H26" stroke="#2D6A4F" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BoxIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 3 L25 9 L25 20 L14 26 L3 20 L3 9 Z" stroke="#D4A017" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 9 L14 15 L25 9 M14 15 L14 26" stroke="#D4A017" strokeWidth="1.6" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="10" y="3" width="8" height="13" rx="4" stroke="#E8771A" strokeWidth="2" />
      <path d="M6 13 A8 8 0 0 0 22 13 M14 21 L14 25" stroke="#E8771A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function DiyaIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M5 18 Q14 22 23 18 L20 23 Q14 25 8 23 Z" fill="#8B6914" />
      <path d="M14 6 C16 9 16.5 11.5 14 14 C11.5 11.5 12 9 14 6 Z" fill="#E8771A" />
      <circle cx="14" cy="12" r="1.6" fill="#FFD700" />
    </svg>
  );
}
function PhoneCheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="7" y="2" width="14" height="24" rx="3" stroke="#2D6A4F" strokeWidth="2" />
      <path d="M11 14 L13.5 16.5 L18 11" stroke="#2D6A4F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({
  icon,
  format,
  from,
  to,
  label,
  color,
  started,
  holdFrom,
}: {
  icon: React.ReactNode;
  format: (v: number) => string;
  from: number;
  to: number;
  label: string;
  color: string;
  started: boolean;
  holdFrom?: number;
}) {
  // "44 → 88": hold the start value briefly, then count (pause handled by delay state)
  const value = useCountUp({ from: holdFrom ?? from, to, start: started, format, duration: 1500 });
  return (
    <div
      data-gsap="stat"
      className="rounded-2xl border p-6 text-center transition-colors"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
    >
      <div className="mx-auto w-fit" aria-hidden="true">{icon}</div>
      <p className="tnum-landing font-display mt-2 text-4xl font-black sm:text-5xl" style={{ color }}>
        {value}
      </p>
      <p className="mt-2 text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
        {label}
      </p>
    </div>
  );
}

function ZeroStat({ icon, line, label }: { icon: React.ReactNode; line: string; label: string }) {
  // Zero-state twin of Stat: same card, same typography, qualitative line, NO numbers.
  return (
    <div
      data-gsap="stat"
      className="rounded-2xl border p-6 text-center transition-colors"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
    >
      <div className="mx-auto w-fit" aria-hidden="true">{icon}</div>
      <p className="tnum-landing font-display mt-2 text-2xl font-bold leading-snug" style={{ color: "#FDFAF4" }}>
        {line}
      </p>
      <p className="mt-2 text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
        {label}
      </p>
    </div>
  );
}
export default function DemoNumbers() {
  const root = useRef<HTMLElement>(null);
  const [gridRef, started] = useInViewOnce<HTMLDivElement>(0.3);

  // P20 truth engine: live numbers from /public/stats. While loading, on
  // error, or when the DB holds nothing real yet -> qualitative zero-state
  // (same cards, same typography, NO numbers).
  const [stats, setStats] = useState<{
    overdue_total: number;
    low_stock_count: number;
    voice_entries: number;
    health_now: number;
    business_name: string;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_URL}/public/stats`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) {
          setStats({
            overdue_total: Number(j?.overdue_total ?? 0) || 0,
            low_stock_count: Number(j?.low_stock_count ?? 0) || 0,
            voice_entries: Number(j?.voice_entries ?? 0) || 0,
            health_now: Number(j?.health_now ?? 0) || 0,
            business_name: String(j?.business_name ?? "").trim(),
          });
        }
      } catch {
        /* zero-state stays */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const live = stats !== null &&
    (stats.overdue_total > 0 || stats.low_stock_count > 0 || stats.voice_entries > 0);
  const biz = stats?.business_name ?? "";

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="stat"]') ?? [], {
        y: 30,
        opacity: 0.2,
        duration: 0.7,
        ease: EASE_EXPO,
        stagger: 0.08,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section
      ref={root}
      id="demo"
      aria-labelledby="demo-heading"
      className="px-4 py-24 lg:py-32"
      style={{ background: "linear-gradient(to bottom right, #0F2040, #0A1929)" }}
    >
      <div className="mx-auto max-w-4xl text-center">
        <h2 id="demo-heading" className="font-display text-3xl font-bold sm:text-4xl lg:text-5xl" style={{ color: "#E8771A" }}>
          Real Numbers. Real Business.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-lg" style={{ color: "rgba(253,250,244,0.75)" }}>
          {live && stats ? (
            <>Like Sharma Kirana Traders in our demo: 30 days on VyapaarAI. Here&apos;s what happened.</>
          ) : (
            <>{biz ? `${biz} — live numbers, updating as the day happens.` : "Live from a real business — numbers update as the owner's day happens."}</>
          )}
        </p>
        <div ref={gridRef} className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
          {live && stats ? (
            <>
              <Stat icon={<RupeeIcon />} from={0} to={stats.overdue_total} format={(v) => `₹${formatIN(v)}`} label="Overdue Udhaari Detected" color="#E0604F" started={started} />
              <Stat icon={<PulseIcon />} from={0} to={stats.health_now} format={(v) => `${Math.round(v)}`} label="Current Health Score" color="#4CAF7D" started={started} />
              <Stat icon={<BoxIcon />} from={0} to={stats.low_stock_count} format={(v) => `${Math.round(v)} SKUs`} label="Low-Stock Items Flagged" color="#D4A017" started={started} />
              <Stat icon={<MicIcon />} from={0} to={stats.voice_entries} format={(v) => formatIN(v)} label="Voice Entries Processed" color="#E8771A" started={started} />
            </>
          ) : (
            <>
              <ZeroStat icon={<RupeeIcon />} line="Overdue udhaari, caught before it becomes loss." label="Overdue Udhaari Detected" />
              <ZeroStat icon={<PulseIcon />} line="Your real health score, from your real books." label="Current Health Score" />
              <ZeroStat icon={<BoxIcon />} line="Low stock flagged before the shelf goes empty." label="Low-Stock Items Flagged" />
              <ZeroStat icon={<MicIcon />} line="Every voice note, counted." label="Voice Entries Processed" />
            </>
          )}
          <Stat icon={<DiyaIcon />} from={1} to={1.6} format={(v) => `×${v.toFixed(1)}`} label="Diwali Demand Boost Forecast" color="#D4A017" started={started} />
          <Stat icon={<PhoneCheckIcon />} from={0} to={0} format={() => "₹0"} label="App Install Required" color="#4CAF7D" started={started} />
        </div>
        <div className="mt-10 rounded-2xl border p-6" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
          {live && stats ? (
            <>
              <p className="mb-4 text-sm font-medium" style={{ color: "rgba(253,250,244,0.7)" }}>
                Business Health Score — Sharma Kirana Traders (Last 12 Weeks)
              </p>
              <Suspense
                fallback={
                  <p className="py-8 text-center text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
                    Business health score improved from 44 to 88 over 12 weeks.
                  </p>
                }
              >
                <HealthChart />
              </Suspense>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm font-medium" style={{ color: "rgba(253,250,244,0.7)" }}>
                Business Health Score — builds from your first entries
              </p>
              <div className="flex h-24 items-end justify-center gap-2 py-4" aria-hidden="true">
                {[35, 55, 40, 70, 50, 80, 60, 45, 65, 52, 74, 58].map((h, i) => (
                  <div
                    key={i}
                    className="w-4 animate-pulse rounded-t"
                    style={{ height: `${h}%`, background: "rgba(232,119,26,0.35)", animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </div>
              <p className="py-2 text-center text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
                No entries yet — your live chart appears here after day one.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
