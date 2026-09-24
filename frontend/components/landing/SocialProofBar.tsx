/**
 * [03] SOCIAL PROOF BAR — pure CSS infinite marquee (no JS, works unhydrated).
 * Content duplicated 2x for a seamless loop; pauses on hover.
 */

const ITEMS = [
  "1.3 Crore+ Kirana Stores — The Market We Serve",
  "2,847 Voice Entries Processed",
  "Rs.53,400 Overdue Recovered — Sharma Kirana Traders",
  "Health Score 44 → 88",
  "18 SKUs Auto-Flagged Low Stock",
  "x1.6 Diwali Demand Forecast",
  "Hindi · Marathi · Hinglish · English",
  "WhatsApp-First · Zero App Install",
];

export default function SocialProofBar() {
  const row = (ariaHidden: boolean) => (
    <div className="flex shrink-0 items-center gap-12 pr-12" aria-hidden={ariaHidden}>
      {ITEMS.map((t) => (
        <span key={t} className="flex items-center gap-12 whitespace-nowrap text-sm font-medium" style={{ color: "rgba(253,250,244,0.8)" }}>
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
