"use client";

/* P20 landing truth engine: live DB numbers, zero-state safe.
 * Fetch once on mount; loading OR all-zero -> qualitative zero-state lines.
 */
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

export interface PublicStats {
  overdue_total: number;
  low_stock_count: number;
  voice_entries: number;
  health_now: number;
  business_name: string;
}

export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/public/stats`);
        if (!res.ok) throw new Error(`stats ${res.status}`);
        const j = (await res.json()) as PublicStats;
        if (alive) setStats(j);
      } catch {
        if (alive) setStats(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // P20: live = real DATA exists (overdue/low/voice). health_now on an empty
  // DB is the engine's neutral default, not a measurement — excluded.
  const live =
    !loading &&
    !!stats &&
    (stats.overdue_total > 0 ||
      stats.low_stock_count > 0 ||
      stats.voice_entries > 0);
  return { stats, loading, live };
}
