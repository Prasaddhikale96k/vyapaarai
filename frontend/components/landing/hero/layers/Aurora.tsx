"use client";

/** L1 AURORA — 3 pre-baked radial-gradient blobs. Poster: calm rest poses. */
const BLOBS = [
  { id: "a", bg: "radial-gradient(circle, rgba(232,119,26,0.18) 0%, rgba(232,119,26,0) 65%)", left: "2%", top: "6%", size: "62vmax" },
  { id: "b", bg: "radial-gradient(circle, rgba(212,160,23,0.16) 0%, rgba(212,160,23,0) 65%)", left: "58%", top: "30%", size: "70vmax" },
  { id: "c", bg: "radial-gradient(circle, rgba(37,211,102,0.07) 0%, rgba(37,211,102,0) 65%)", left: "30%", top: "55%", size: "55vmax" },
];

export default function Aurora() {
  return (
    <div data-hf="layer-aurora" className="hf-layer" aria-hidden="true">
      {BLOBS.map((b) => (
        <div
          key={b.id}
          data-hf={`aurora-${b.id}`}
          className="hf-aurora"
          style={{ background: b.bg, left: b.left, top: b.top, width: b.size, height: b.size }}
        />
      ))}
    </div>
  );
}
