"use client";

/**
 * [07] DEMO NUMBERS — "Real Numbers. Real Business."
 * 6 stat cards with rAF count-ups (SSR shows final values) + lazy Recharts
 * health chart (dynamic ssr:false, static-text fallback).
 */

import { Suspense, useRef } from "react";
import dynamic from "next/dynamic";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { formatIN, useCountUp, useInViewOnce } from "@/hooks/useCountUp";
import { usePublicStats } from "@/lib/usePublicStats";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const HealthChart = dynamic(() => import("./HealthChart"), {
  ssr: false,
  loading: () => (
    <p className="py-8 text-center text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
      Sample preview of the health trend chart.
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

function ZeroStat({ icon, line, color }: { icon: React.ReactNode; line: string; color: string }) {
  // P20 zero-state: qualitative line, NO numbers (same card typography).
  return (
    <div
      data-gsap="stat"
      className="rounded-2xl border p-6 text-center transition-colors"
      style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }}
    >
      <div className="mx-auto w-fit" aria-hidden="true">{icon}</div>
      <p className="font-display mt-2 text-xl font-bold leading-snug" style={{ color }}>
        {line}
      </p>
    </div>
  );
}

export default function DemoNumbers() {
  const root = useRef<HTMLElement>(null);
  const [gridRef, started] = useInViewOnce<HTMLDivElement>(0.3);
  // P20 truth engine: live DB numbers; loading/all-zero -> zero-state lines.
  const { stats, live } = usePublicStats();
  const overdue = stats?.overdue_total ?? 0;
  const health = stats?.health_now ?? 0;
  const lowSkus = stats?.low_stock_count ?? 0;
  const voice = stats?.voice_entries ?? 0;

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
          Like Sharma Kirana Traders in our demo: 30 days on VyapaarAI. Here&apos;s what happened.
        </p>
        <div ref={gridRef} className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
          {live ? (
            <>
              <Stat icon={<RupeeIcon />} from={0} to={overdue} format={(v) => `₹${formatIN(v)}`} label="Overdue Udhaari Tracked" color="#E0604F" started={started} />
              <Stat icon={<PulseIcon />} from={0} to={health} format={(v) => `${Math.round(v)}`} label="Live Health Score" color="#4CAF7D" started={started} />
              <Stat icon={<BoxIcon />} from={0} to={lowSkus} format={(v) => `${Math.round(v)} SKUs`} label="Low-Stock Items Flagged" color="#D4A017" started={started} />
              <Stat icon={<MicIcon />} from={0} to={voice} format={(v) => formatIN(v)} label="Voice Entries Counted" color="#E8771A" started={started} />
            </>
          ) : (
            <>
              <ZeroStat icon={<RupeeIcon />} line="Overdue udhaari, caught before it becomes loss." color="#E0604F" />
              <ZeroStat icon={<PulseIcon />} line="Business health, scored live from your ledger." color="#4CAF7D" />
              <ZeroStat icon={<BoxIcon />} line="Low stock flagged before the shelf goes empty." color="#D4A017" />
              <ZeroStat icon={<MicIcon />} line="Every voice note, counted." color="#E8771A" />
            </>
          )}
          <Stat icon={<DiyaIcon />} from={1} to={1.6} format={(v) => `×${v.toFixed(1)}`} label="Diwali Demand Boost Forecast" color="#D4A017" started={started} />
          <Stat icon={<PhoneCheckIcon />} from={0} to={0} format={() => "₹0"} label="App Install Required" color="#4CAF7D" started={started} />
        </div>
        <div className="mt-10 rounded-2xl border p-6" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="mb-4 text-sm font-medium" style={{ color: "rgba(253,250,244,0.7)" }}>
            Business Health Trend — Sample Preview
          </p>
          <Suspense
            fallback={
              <p className="py-8 text-center text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
                Sample preview of the health trend chart.
              </p>
            }
          >
            <HealthChart />
          </Suspense>
          <p className="mt-3 text-xs" style={{ color: "rgba(253,250,244,0.5)" }}>
            Sample preview — your live trend appears here once entries land.
          </p>
        </div>
      </div>
    </section>
  );
}
