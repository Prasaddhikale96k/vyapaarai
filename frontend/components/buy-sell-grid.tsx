"use client";

import { Card } from "@/components/ui/card";
import { inr, type BuySellMatrix, type MatrixProduct } from "@/lib/api";

const QUADS = [
  { key: "STAR", label: "STAR", color: "emerald", hint: "Push: display & promo" },
  { key: "VOLUME", label: "VOLUME", color: "sky", hint: "Raise price / cut cost" },
  { key: "HIDDEN_GEM", label: "HIDDEN GEM", color: "violet", hint: "Bundle to move volume" },
  { key: "EXIT", label: "EXIT", color: "rose", hint: "Clearance, stop reorder" },
] as const;

const headerColor: Record<string, string> = {
  emerald: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  sky: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  violet: "text-violet-300 border-violet-500/30 bg-violet-500/10",
  rose: "text-rose-300 border-rose-500/30 bg-rose-500/10",
};

function Chip({ p }: { p: MatrixProduct }) {
  return (
    <div
      title={`${p.name} • vel ${p.velocity_30}/day • margin ${p.margin_pct}% • ${p.action}`}
      className="cursor-default rounded-lg border border-zinc-700/70 bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-500"
    >
      <span className="font-medium">{p.name}</span>
      <span className="text-zinc-500"> • {inr(p.revenue_30)}</span>
    </div>
  );
}

export function BuySellGrid({ data, delay = 0 }: { data: BuySellMatrix; delay?: number }) {
  const byQuad = (q: string) => (data.products ?? []).filter((p) => p.quadrant === q);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {QUADS.map((q, qi) => {
        const items = byQuad(q.key);
        return (
          <Card key={q.key} delay={delay + 0.05 * qi} hover>
            <div
              className={`mb-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${headerColor[q.color]}`}
            >
              {q.label}
              <span className="opacity-70">({data.quadrant_counts?.[q.key] ?? items.length})</span>
            </div>
            <p className="card-sub mb-2">{q.hint}</p>
            {items.length === 0 ? (
              <p className="text-xs text-zinc-500">अभी कोई product नहीं</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {items.map((p) => (
                  <Chip key={p.sku} p={p} />
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
