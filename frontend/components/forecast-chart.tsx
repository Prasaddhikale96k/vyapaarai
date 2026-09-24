"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import type { Forecast } from "@/lib/api";

const riskTone: Record<string, "emerald" | "amber" | "rose" | "sky"> = {
  OK: "emerald",
  MEDIUM: "sky",
  HIGH: "amber",
  CRITICAL: "rose",
};

function DarkTooltip(props: any) {
  const { active, payload, label } = props ?? {};
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
      <p className="mb-1 text-zinc-400">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export function ForecastChart({ data }: { data: Forecast }) {
  const hist = data.history ?? [];
  const fc = data.forecast ?? [];
  const festivals = data.festivals ?? [];
  const lastHist = hist[hist.length - 1];
  // overlap last history point so the dashed forecast starts continuously
  const rows = [
    ...hist.map((h) => ({ date: h.date.slice(5), h: h.qty as number | null, f: null as number | null })),
    ...(lastHist && fc.length > 0
      ? [{ date: fc[0].date.slice(5), h: lastHist.qty as number | null, f: lastHist.qty as number | null }]
      : []),
    ...fc.map((f) => ({ date: f.date.slice(5), h: null as number | null, f: f.qty as number | null })),
  ];

  // festival window bands, clamped to visible forecast labels
  const bands = festivals
    .map((fest) => {
      const x1 = fest.start.slice(5);
      const x2 = fest.end.slice(5);
      const labels = new Set(fc.map((f) => f.date.slice(5)));
      if (!Array.from(labels).some((l) => l >= x1 && l <= x2)) return null;
      return { fest, x1, x2 };
    })
    .filter((b): b is { fest: (typeof festivals)[number]; x1: string; x2: string } => b !== null);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-zinc-100">{data.name}</span>
        <Badge tone={riskTone[data.risk] ?? "zinc"}>{data.risk}</Badge>
        {festivals.map((fest) => (
          <Badge key={fest.name} tone="amber">
            🪔 {fest.name} spike expected ×{fest.multiplier}
          </Badge>
        ))}
        <span className="text-xs text-zinc-400">
          {data.stockout_days === null || data.stockout_days === undefined
            ? "stock steady"
            : `~${Math.round(data.stockout_days)} din ka stock`}
          {" • "}avg {data.avg_daily}/day
        </span>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="fcHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} minTickGap={24} />
            <YAxis tick={{ fill: "#71717a", fontSize: 10 }} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            {bands.map(({ fest, x1, x2 }) => (
              <ReferenceArea
                key={fest.name}
                x1={x1}
                x2={x2}
                fill="#fbbf24"
                fillOpacity={0.12}
                stroke="#fbbf24"
                strokeOpacity={0.4}
              />
            ))}
            <Line
              type="monotone"
              dataKey="h"
              name="history"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="h"
              name="history-area"
              stroke="none"
              fill="url(#fcHist)"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="f"
              name="forecast"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            {fc.length > 0 && (
              <ReferenceDot
                x={fc[fc.length - 1].date.slice(5)}
                y={fc[fc.length - 1].qty}
                r={5}
                fill="#fbbf24"
                stroke="#fff"
                strokeWidth={1.5}
                className="pulse-dot"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
