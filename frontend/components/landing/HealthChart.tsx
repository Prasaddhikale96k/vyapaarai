"use client";

/**
 * Business health score area chart — client-only Recharts (RULE-RECHARTS-CLIENT).
 * Loaded via next/dynamic(ssr:false) with a static-text Suspense fallback.
 */

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DATA = [44, 46, 48, 47, 51, 55, 58, 63, 68, 72, 80, 88].map((score, i) => ({
  week: `W${i + 1}`,
  score,
}));

export default function HealthChart() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "rgba(253,250,244,0.7)" }}>
        Business health score improved from 44 to 88 over 12 weeks.
      </p>
    );
  }
  try {
    return (
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <AreaChart data={DATA} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="healthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8771A" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#E8771A" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="week" tick={{ fill: "rgba(253,250,244,0.6)", fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
            <YAxis domain={[30, 95]} tick={{ fill: "rgba(253,250,244,0.6)", fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              contentStyle={{ background: "#162840", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#FDFAF4", fontSize: 12 }}
              formatter={(v) => [`${v}`, "Health"]}
            />
            <Area type="monotone" dataKey="score" stroke="#E8771A" strokeWidth={2.5} fill="url(#healthGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  } catch {
    setFailed(true);
    return null;
  }
}
