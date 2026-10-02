"use client";

/** L8 SPOTLIGHT — warm radial gradient, follows cursor (Phase 5). Rest: parked, opacity 0. */
export default function Spotlight() {
  return (
    <div
      data-hf="layer-spot"
      className="hf-spot"
      style={{
        background:
          "radial-gradient(circle, rgba(255,214,140,0.35) 0%, rgba(255,214,140,0) 65%)",
      }}
      aria-hidden="true"
    />
  );
}
