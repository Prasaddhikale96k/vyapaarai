"use client";

/**
 * [12] HUMAN-IN-THE-LOOP — "The AI Suggests. You Decide. Always."
 * Static mock of the actions panel. Approve/Skip are disabled display-only.
 * Panel slides up; cards stagger.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

function BellIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 3 C10 3 8 7 8 11 L6 16 H22 L20 11 C20 7 18 3 14 3 Z" stroke="#1A1209" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 19 A2.5 2.5 0 0 0 16 19" stroke="#E8771A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function PackageIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M14 3 L25 9 L25 20 L14 26 L3 20 L3 9 Z" stroke="#1A1209" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 9 L14 15 L25 9" stroke="#E8771A" strokeWidth="1.8" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <path d="M4 24 H24" stroke="#1A1209" strokeWidth="2" strokeLinecap="round" />
      <rect x="6" y="14" width="4" height="10" rx="1" fill="#E8771A" />
      <rect x="12" y="9" width="4" height="15" rx="1" fill="#D4A017" />
      <rect x="18" y="5" width="4" height="19" rx="1" fill="#2D6A4F" />
    </svg>
  );
}

const ACTIONS = [
  { icon: <BellIcon />, title: "Send Payment Reminder", detail: "Ramesh Gupta owes ₹4,300 (23 days overdue). Send WhatsApp reminder?" },
  { icon: <PackageIcon />, title: "Reorder: Sugar & Rice", detail: "Festival season approaching. Stock at 15% capacity. Order 50kg each from Rajesh Provision?" },
  { icon: <ChartIcon />, title: "Send Nightly Report", detail: "Your business summary PDF for today is ready. Send to WhatsApp?" },
];

export default function HITLSection() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      gsap.from(root.current?.querySelectorAll('[data-gsap="hitl-panel"]') ?? [], {
        y: 40,
        opacity: 0.2,
        duration: 0.7,
        ease: EASE_EXPO,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
      });
      gsap.from(root.current?.querySelectorAll('[data-gsap="hitl-card"]') ?? [], {
        y: 24,
        opacity: 0.2,
        duration: 0.5,
        ease: EASE_EXPO,
        stagger: 0.1,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
      });
    },
    { scope: root }
  );

  return (
    <section id="hitl" aria-labelledby="hitl-heading" ref={root} className="px-4 py-24 lg:py-32" style={{ background: "#FDFAF4" }}>
      <div className="mx-auto max-w-4xl text-center">
        <h2 id="hitl-heading" className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl" style={{ color: "#1A1209" }}>
          The AI Suggests. <span style={{ color: "#E8771A" }}>You Decide.</span> Always.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-lg" style={{ color: "#4A3728" }}>
          VyapaarAI never acts without your approval. Every reminder, every reorder,
          every report — you&apos;re in control.
        </p>

        <div data-gsap="hitl-panel" className="mt-10 overflow-hidden rounded-2xl border text-left" style={{ background: "#FFF9F0", borderColor: "#E8DDD0" }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ background: "#0F2040" }}>
            <p className="font-semibold text-white">AI Action Proposals</p>
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: "#E8771A" }}>
              3 awaiting your approval
            </span>
          </div>
          {ACTIONS.map((a) => (
            <div key={a.title} data-gsap="hitl-card" className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-start" style={{ borderColor: "#E8DDD0" }}>
              <span className="shrink-0" aria-hidden="true">{a.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold" style={{ color: "#1A1209" }}>{a.title}</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "#4A3728" }}>{a.detail}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled title="Approving would send this action in the live app" className="min-h-[44px] cursor-not-allowed rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: "#2D6A4F", opacity: 0.9 }}>
                  Approve
                </button>
                <button type="button" disabled title="Skipping would dismiss this proposal in the live app" className="min-h-[44px] cursor-not-allowed rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "#E8DDD0", color: "#4A3728", background: "transparent" }}>
                  Skip
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm italic" style={{ color: "#8B7355" }}>
          Every action shown above is waiting for your tap. VyapaarAI proposes; you command.
        </p>
      </div>
    </section>
  );
}
