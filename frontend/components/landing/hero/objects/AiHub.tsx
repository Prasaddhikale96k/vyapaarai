"use client";

/** #5 AI-CORE HUB — core + rotating ring + 3 orbit dots + receive flash ring. */
export default function AiHub() {
  return (
    <svg viewBox="0 0 80 80" width="100%" fill="none" aria-hidden="true">
      <circle data-hf="hub-flash" cx="40" cy="40" r="30" stroke="#E8771A" strokeWidth="2" opacity="0" />
      <circle data-hf="hub-glow" cx="40" cy="40" r="26" stroke="#E8771A" strokeWidth="1.5" opacity="0.3" />
      <g data-hf="hub-ring">
        <circle cx="40" cy="40" r="20" stroke="#8B7355" strokeWidth="1.5" strokeDasharray="4 5" />
        {[0, 120, 240].map((a) => (
          <circle
            key={a}
            cx={40 + 20 * Math.cos((a * Math.PI) / 180)}
            cy={40 + 20 * Math.sin((a * Math.PI) / 180)}
            r="3"
            fill="#E8771A"
          />
        ))}
      </g>
      <circle cx="40" cy="40" r="11" fill="#E8771A" />
      <circle cx="40" cy="40" r="5" fill="#FFF8E1" />
    </svg>
  );
}
