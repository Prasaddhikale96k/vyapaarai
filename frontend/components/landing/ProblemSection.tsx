"use client";

/**
 * [04] PROBLEM — "The Bahi-Khata Bleeds Money — Silently."
 * 3 staggered problem cards + BahiKhataSVG. English marketing copy only.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import BahiKhataSVG from "./BahiKhataSVG";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

function LedgerXIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="10" y="6" width="28" height="36" rx="3" stroke="#1A1209" strokeWidth="2" />
      <line x1="16" y1="14" x2="32" y2="14" stroke="#8B7355" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="16" y1="20" x2="28" y2="20" stroke="#8B7355" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 28 L30 38 M30 28 L18 38" stroke="#C0392B" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function EmptyShelvesIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <line x1="6" y1="16" x2="42" y2="16" stroke="#1A1209" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="32" x2="42" y2="32" stroke="#1A1209" strokeWidth="2" strokeLinecap="round" />
      <rect x="10" y="7" width="7" height="9" rx="1.5" fill="#E8771A" opacity="0.85" />
      <path d="M24 24 h14 M24 28 h10" stroke="#C0392B" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="36" cy="11" r="4" fill="none" stroke="#8B7355" strokeWidth="1.6" />
      <line x1="33" y1="11" x2="39" y2="11" stroke="#8B7355" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ConfusedIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="16" stroke="#1A1209" strokeWidth="2" />
      <circle cx="18" cy="21" r="1.8" fill="#1A1209" />
      <circle cx="30" cy="21" r="1.8" fill="#1A1209" />
      <path d="M17 31 Q24 26 31 31" stroke="#C0392B" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M36 8 l3 -3 M39 12 h4 M36 16 l3 3" stroke="#8B7355" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const CARDS = [
  {
    icon: <LedgerXIcon />,
    title: "Udhaari Leaks Away",
    text: "Credit given to customers lives in memory. Rs.53,400 lost before anyone noticed.",
  },
  {
    icon: <EmptyShelvesIcon />,
    title: "Shelves Go Empty Overnight",
    text: "18 SKUs hit zero stock this month with no advance warning.",
  },
  {
    icon: <ConfusedIcon />,
    title: "No Idea If You're Profitable",
    text: "Paper records don't tell you trends, anomalies, or your real health score.",
  },
];

export default function ProblemSection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="card"]') ?? [], {
        x: -40,
        opacity: 0.2,
        duration: 0.7,
        ease: EASE_EXPO,
        stagger: 0.15,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section id="problem" aria-labelledby="problem-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#FDFAF4" }}>
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 id="problem-heading" className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#1A1209" }}>
            The Bahi-Khata <span style={{ color: "#C0392B" }}>Bleeds Money</span> — Silently.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed" style={{ color: "#4A3728" }}>
            India&apos;s 1.3 crore kiranas run on paper, memory, and trust. Every day,
            udhaari goes untracked, stock runs out without warning, and the owner has
            no idea if the business is actually profitable. The pain isn&apos;t lack
            of effort — it&apos;s lack of a tool built for them.
          </p>
          <div className="mt-8 space-y-4">
            {CARDS.map((c) => (
              <article
                key={c.title}
                data-gsap="card"
                className="flex items-start gap-4 rounded-2xl border p-6"
                style={{ background: "#FFF9F0", borderColor: "#E8DDD0" }}
              >
                {c.icon}
                <div>
                  <h3 className="font-display text-xl font-semibold" style={{ color: "#1A1209" }}>
                    {c.title}
                  </h3>
                  <p className="mt-1 leading-relaxed" style={{ color: "#4A3728" }}>
                    {c.text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <BahiKhataSVG />
      </div>
    </section>
  );
}
