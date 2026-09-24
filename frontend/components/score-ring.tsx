"use client";

import { animate, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const gradeTone: Record<string, "emerald" | "sky" | "amber" | "rose"> = {
  Excellent: "emerald",
  Good: "sky",
  "Needs Attention": "amber",
  "At Risk": "rose",
  "Loan-ready": "emerald",
  Improving: "amber",
  "High-risk": "rose",
};

export function ScoreRing({ value, grade }: { value: number; grade: string }) {
  const [display, setDisplay] = useState(0);
  const R = 52;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);

  const color =
    value >= 80 ? "#34d399" : value >= 65 ? "#38bdf8" : value >= 50 ? "#fbbf24" : "#fb7185";

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={R} fill="none" stroke="#27272a" strokeWidth="11" />
          <motion.circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (C * value) / 100 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums text-zinc-100">{display}</span>
          <span className="text-[11px] text-zinc-500">/ 100</span>
        </div>
      </div>
      <div>
        <Badge tone={gradeTone[grade] ?? "zinc"}>{grade}</Badge>
        <p className="mt-2 text-xs text-zinc-400">Business health score</p>
      </div>
    </div>
  );
}
