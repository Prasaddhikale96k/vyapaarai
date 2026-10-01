"use client";

/**
 * [08] FEATURES BENTO — "Everything Your Business Needs. Nothing It Doesn't."
 * Asymmetric 12-col grid (7+5 / 4+4+4 / 5+7), HTML table mocks, SVG gauge arc
 * (r=70, draws to 88%), CSS mic pulse. Non-functional buttons are disabled
 * display-only with tooltips. SSR fully visible.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

const CARD =
  "rounded-2xl border p-6 sm:p-8 transition-transform duration-300 hover:-translate-y-1";

function GaugeArc() {
  const ref = useRef<SVGSVGElement>(null);
  useGSAP(
    () => {
      if (prefersReduced()) return;
      const arc = ref.current?.querySelector('[data-gsap="arc"]') as unknown as SVGPathElement | null;
      if (!arc) return;
      const C = 2 * Math.PI * 70; // ≈439.8
      const target = C - C * 0.88; // draw 88%
      gsap.fromTo(
        arc,
        { strokeDasharray: C, strokeDashoffset: C },
        {
          strokeDashoffset: target,
          duration: 1.5,
          ease: "power2.out",
          immediateRender: false,
          scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
        }
      );
    },
    { scope: ref }
  );
  return (
    <svg ref={ref} viewBox="0 0 180 180" className="mx-auto mt-4 w-44" role="img" aria-label="Health score gauge showing 88 out of 100">
      <circle cx="90" cy="90" r="70" fill="none" stroke="#E8DDD0" strokeWidth="14" />
      <circle
        data-gsap="arc"
        cx="90"
        cy="90"
        r="70"
        fill="none"
        stroke="#2D6A4F"
        strokeWidth="14"
        strokeLinecap="round"
        transform="rotate(-90 90 90)"
      />
      <text x="90" y="96" textAnchor="middle" fontSize="38" fontWeight="900" fill="#1A1209" fontFamily="'Playfair Display', Georgia, serif">
        88
      </text>
      <text x="90" y="116" textAnchor="middle" fontSize="11" fill="#8B7355" fontFamily="Inter, sans-serif">
        Health Score
      </text>
    </svg>
  );
}

function LedgerMock() {
  const rows = [
    ["12 Jan", "Tomato 5kg", "₹320", "recorded"],
    ["12 Jan", "Aata 20kg", "₹1,200", "recorded"],
    ["11 Jan", "Udhaari: Ramesh", "₹4,300", "pending"],
    ["11 Jan", "Sugar 2kg", "₹90", "recorded"],
  ];
  return (
    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "#E8DDD0", background: "#FDFAF4" }}>
      <div className="grid grid-cols-4 gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ background: "#E8771A", color: "#fff" }}>
        <span>Date</span><span>Item</span><span>Amount</span><span>Status</span>
      </div>
      {rows.map((r) => (
        <div key={r[1]} data-gsap="ledger-row" className="grid grid-cols-4 gap-2 border-t px-4 py-2 text-xs" style={{ borderColor: "#E8DDD0", color: "#1A1209" }}>
          <span>{r[0]}</span><span>{r[1]}</span><span className="font-mono">{r[2]}</span>
          <span style={{ color: r[3] === "pending" ? "#C0392B" : "#2D6A4F" }}>{r[3]}</span>
        </div>
      ))}
    </div>
  );
}

function AgingMock() {
  const rows = [
    { name: "Ramesh Gupta", amt: "₹4,300", days: "23 days", hot: false },
    { name: "Sunita Devi", amt: "₹1,800", days: "47 days", hot: true },
    { name: "Mohan Lal", amt: "₹2,100", days: "12 days", hot: false },
  ];
  return (
    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: "#E8DDD0", background: "#FDFAF4" }}>
      <div className="grid grid-cols-4 items-center gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wide" style={{ background: "#0F2040", color: "#fff" }}>
        <span>Name</span><span>Amount</span><span>Overdue</span><span>Action</span>
      </div>
      {rows.map((r) => (
        <div key={r.name} className="grid grid-cols-4 items-center gap-2 border-t px-4 py-2.5 text-xs" style={{ borderColor: "#E8DDD0", color: "#1A1209" }}>
          <span className="font-semibold">{r.name}</span>
          <span className="font-mono">{r.amt}</span>
          <span style={{ color: r.hot ? "#C0392B" : "#4A3728", fontWeight: r.hot ? 700 : 400 }}>{r.days}</span>
          <span>
            <button
              type="button"
              disabled
              title="This would send a WhatsApp reminder"
              className="cursor-not-allowed rounded-full px-3 py-1 text-[11px] font-bold text-white"
              style={{ background: r.hot ? "#C0392B" : "#E8771A", opacity: 0.9 }}
            >
              Remind
            </button>
          </span>
        </div>
      ))}
      <div className="border-t px-4 py-2 text-xs font-bold" style={{ borderColor: "#E8DDD0", color: "#1A1209" }}>
        Total Overdue: <span className="font-mono">₹8,200</span>
      </div>
    </div>
  );
}

export default function FeaturesBento() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="bento"]') ?? [], {
        y: 30,
        opacity: 0.2,
        duration: 0.7,
        ease: EASE_EXPO,
        stagger: 0.08,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
      });
      // Ledger receipt cascade (transform + opacity only, no layout shift)
      gsap.from(root.current?.querySelectorAll('[data-gsap="ledger-row"]') ?? [], {
        x: -15,
        opacity: 0,
        duration: 0.5,
        stagger: 0.12,
        ease: "power2.out",
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 75%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section id="features" aria-labelledby="features-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#FDFAF4" }}>
      <div className="mx-auto max-w-7xl">
        <h2 id="features-heading" className="font-display mx-auto max-w-3xl text-center text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#1A1209" }}>
          Everything Your Business Needs. <span style={{ color: "#E8771A" }}>Nothing It Doesn&apos;t.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-lg" style={{ color: "#4A3728" }}>
          Built for the 7 crore MSMEs that existing software forgot.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <article data-gsap="bento" className={`${CARD} lg:col-span-7`} style={{ background: "#FFF9F0", borderColor: "#E8DDD0", boxShadow: "0 2px 20px rgba(26,18,9,0.08)" }}>
            <h3 className="font-display text-xl font-semibold sm:text-2xl" style={{ color: "#1A1209" }}>Your Ledger, Upgraded</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "#4A3728" }}>
              Every transaction from WhatsApp lands here instantly. Sales, expenses,
              udhaari — all structured, searchable, and beautiful. The bahi-khata your
              father kept, re-imagined.
            </p>
            <LedgerMock />
          </article>

          <article data-gsap="bento" className={`${CARD} lg:col-span-5`} style={{ background: "#FFFFFF", borderColor: "#E8DDD0", boxShadow: "0 2px 20px rgba(26,18,9,0.08)" }}>
            <h3 className="font-display text-xl font-semibold sm:text-2xl" style={{ color: "#1A1209" }}>Business Health Score</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "#4A3728" }}>
              A single number (0–100) that summarizes your business&apos;s financial health. Updated daily.
            </p>
            <GaugeArc />
          </article>

          <article data-gsap="bento" className={`${CARD} lg:col-span-4`} style={{ background: "#FFFFFF", borderColor: "#E8DDD0", boxShadow: "0 2px 20px rgba(26,18,9,0.08)" }}>
            <span className="relative inline-flex" aria-hidden="true">
              <span className="landing-ping-ring absolute inset-0 rounded-full" style={{ background: "#E8771A" }} />
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="relative">
                <circle cx="24" cy="24" r="22" fill="#E8771A" />
                <rect x="20" y="12" width="8" height="14" rx="4" fill="#fff" />
                <path d="M16 22 A8 8 0 0 0 32 22 M24 30 L24 35" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <h3 className="font-display mt-3 text-xl font-semibold" style={{ color: "#1A1209" }}>Voice-First Entry</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "#4A3728" }}>
              Speak your sales in Hindi or Marathi. AI transcribes and records.
            </p>
          </article>

          <article data-gsap="bento" className={`${CARD} lg:col-span-4`} style={{ background: "#FFF3E0", borderColor: "rgba(232,119,26,0.25)", boxShadow: "0 2px 20px rgba(26,18,9,0.08)" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path d="M8 30 Q24 36 40 30 L36 38 Q24 42 12 38 Z" fill="#8B6914" />
              <path d="M24 12 C27 17 27.5 20.5 24 24 C20.5 20.5 21 17 24 12 Z" fill="#E8771A" />
              <circle cx="24" cy="21" r="2.4" fill="#FFD700" />
            </svg>
            <h3 className="font-display mt-3 text-xl font-semibold" style={{ color: "#1A1209" }}>Festival Forecasting</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "#4A3728" }}>
              <span className="font-mono font-medium" style={{ color: "#B85A00" }}>×1.6</span> Diwali demand?
              AI pre-orders for you. Knows every Indian festival.
            </p>
          </article>

          <article data-gsap="bento" className={`${CARD} lg:col-span-4`} style={{ background: "#FFFFFF", borderColor: "#E8DDD0", boxShadow: "0 2px 20px rgba(26,18,9,0.08)" }}>
            <svg width="64" height="40" viewBox="0 0 64 40" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="60" height="36" rx="6" fill="#0F2040" />
              <text x="32" y="26" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#fff" fontFamily="Inter, sans-serif">UPI</text>
            </svg>
            <h3 className="font-display mt-3 text-xl font-semibold" style={{ color: "#1A1209" }}>UPI Deep-Links</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "#4A3728" }}>
              Collect payments instantly. AI generates UPI links and tracks them.
            </p>
          </article>

          <article data-gsap="bento" className={`${CARD} lg:col-span-5`} style={{ background: "#0F2040", borderColor: "#0F2040", boxShadow: "0 8px 40px rgba(26,18,9,0.12)" }}>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <rect x="10" y="6" width="28" height="36" rx="3" fill="#FDFAF4" />
              <rect x="10" y="6" width="28" height="10" rx="3" fill="#E8771A" />
              <text x="24" y="13.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff" fontFamily="Inter, sans-serif">PDF</text>
              <path d="M15 24 L23 28 L33 20" stroke="#2D6A4F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="15" y1="33" x2="33" y2="33" stroke="#E8DDD0" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h3 className="font-display mt-3 text-xl font-semibold sm:text-2xl" style={{ color: "#FDFAF4" }}>Nightly PDF Report</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "rgba(253,250,244,0.75)" }}>
              Every night, a crisp PDF of your day&apos;s business — in your WhatsApp.
            </p>
          </article>

          <article data-gsap="bento" className={`${CARD} lg:col-span-7`} style={{ background: "#FFF9F0", borderColor: "#E8DDD0", boxShadow: "0 2px 20px rgba(26,18,9,0.08)" }}>
            <h3 className="font-display text-xl font-semibold sm:text-2xl" style={{ color: "#1A1209" }}>Receivables Aging — Never Forget Udhaari Again</h3>
            <p className="mt-2 leading-relaxed" style={{ color: "#4A3728" }}>
              See every person who owes you money, how many days overdue, and let AI
              send the reminder. <span className="font-mono font-medium">₹53,400</span> recovered for Sharma Kirana.
            </p>
            <AgingMock />
          </article>
        </div>
      </div>
    </section>
  );
}
