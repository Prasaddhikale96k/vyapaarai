"use client";

import { Card } from "@/components/ui/card";
import type { BriefItem } from "@/lib/api";

const sevStyle: Record<string, string> = {
  high: "border-rose-500/30",
  medium: "border-amber-500/30",
  low: "border-emerald-500/30",
};

export function BriefList({ items }: { items: BriefItem[] }) {
  if (!items?.length) {
    return <p className="text-sm text-zinc-400">अभी कोई अलर्ट नहीं — sab shaant hai ✅</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((b, i) => (
        <Card key={i} delay={0.05 * i} className={sevStyle[b.severity] ?? "border-zinc-800"}>
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">{b.icon}</span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{b.title}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{b.detail}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
