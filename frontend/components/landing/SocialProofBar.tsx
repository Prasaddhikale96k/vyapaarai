"use client";

/**
 * [03] SOCIAL PROOF BAR — pure CSS infinite marquee (no JS motion, works unhydrated).
 * Content duplicated 2x for a seamless loop; pauses on hover.
 * P20 truth engine: DB-claim items come from live /public/stats; loading or
 * all-zero renders qualitative zero-state lines (no numbers). Non-claim items
 * (market, forecast feature, languages, WhatsApp-first) are static.
 */

import { formatIN } from "@/hooks/useCountUp";
import { usePublicStats } from "@/lib/usePublicStats";

const STATIC_ITEMS = [
  "1.3 Crore+ Kirana Stores — The Market We Serve",
  "x1.6 Diwali Demand Forecast",
  "Hindi · Marathi · Hinglish · English",
  "WhatsApp-First · Zero App Install",
];

const ZERO_ITEMS = [
  ...STATIC_ITEMS.slice(0, 1),
  "Every voice note, counted.",
  "Overdue udhaari, caught before it becomes loss.",
  "Business health, scored live from your ledger.",
  "Low stock flagged before the shelf goes empty.",
  ...STATIC_ITEMS.slice(1),
];

export default function SocialProofBar() {
  const { stats, live } = usePublicStats();
  const items = live && stats
    ? [
        STATIC_ITEMS[0],
        `${formatIN(stats.voice_entries)} Voice Entries Counted`,
        `Rs.${formatIN(Math.round(stats.overdue_total))} Overdue Tracked${
          stats.business_name ? ` — ${stats.business_name}` : ""
        }`,
        `Health Score ${Math.round(stats.health_now)}`,
        `${stats.low_stock_count} SKUs Flagged Low Stock`,
        ...STATIC_ITEMS.slice(1),
      ]
    : ZERO_ITEMS;
  const row = (ariaHidden: boolean) => (
    <div className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={ariaHidden}>
      {items.map((t, i) => (
        <span key={`${i}-${t}`} className="flex items-center gap-12 whitespace-nowrap text-sm font-medium" style={{ color: "rgba(253,250,244,0.8)" }}>
          {t}
          <span style={{ color: "#E8771A" }} aria-hidden="true">•</span>
        </span>
      ))}
    </div>
  );
  return (
    <section id="proof-bar" aria-label="VyapaarAI at a glance" className="landing-marquee overflow-hidden py-5" style={{ background: "#0F2040" }}>
      <div className="landing-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}
