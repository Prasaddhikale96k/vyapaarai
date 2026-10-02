"use client";

/** L7 LIGHT LEAK — diagonal gradient band, parked offscreen at rest. */
export default function LightLeak() {
  return (
    <div
      data-hf="layer-leak"
      className="hf-leak"
      style={{
        background:
          "linear-gradient(100deg, rgba(232,119,26,0) 0%, rgba(232,119,26,0.2) 45%, rgba(212,160,23,0.2) 55%, rgba(212,160,23,0) 100%)",
      }}
      aria-hidden="true"
    />
  );
}
