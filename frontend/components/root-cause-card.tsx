"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RootCause } from "@/lib/api";

function DirIcon({ d }: { d: string }) {
  const dir = (d || "").toLowerCase();
  if (dir === "up") return <ArrowUpRight size={16} className="text-emerald-400" />;
  if (dir === "flat") return <Minus size={16} className="text-zinc-400" />;
  return <ArrowDownRight size={16} className="text-rose-400" />;
}

export function RootCauseCard({ data, delay = 0 }: { data: RootCause; delay?: number }) {
  return (
    <Card delay={delay} hover>
      <h3 className="card-title">Profit root-cause</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{data.narrative}</p>
      <div className="mt-3 space-y-2">
        {(data.factors ?? []).map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
          >
            <DirIcon d={f.direction} />
            <div>
              <p className="text-xs font-semibold text-zinc-200">{f.factor}</p>
              <p className="text-xs text-zinc-400">{f.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
