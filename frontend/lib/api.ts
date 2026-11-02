"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ---------- types (mirror backend shapes) ---------- */

export interface Subscore {
  name: string;
  score: number | null;
  weight: number;
  breakdown: string;
}
export interface HealthScore {
  overall: number | null;
  grade: string | null;
  has_data: boolean;
  subscores: Subscore[];
  headline: string;
}
export interface BriefItem {
  icon: string;
  title: string;
  detail: string;
  severity: string;
}
export interface Anomaly {
  type: string;
  severity: string;
  message: string;
  date?: string;
}
export interface ForecastPoint {
  date: string;
  qty: number;
  festival?: string | null;
}
export interface FestivalWindow {
  name: string;
  start: string;
  end: string;
  multiplier: number;
}
export interface Forecast {
  sku: string;
  name: string;
  stock_qty: number;
  reorder_level: number;
  avg_daily: number;
  stockout_days: number | null;
  risk: "CRITICAL" | "HIGH" | "MEDIUM" | "OK";
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  festivals: FestivalWindow[];
}
export interface CreditSubscore {
  name: string;
  score: number;
  weight: number;
  breakdown: string;
}
export interface CreditScore {
  overall: number;
  grade: string;
  subscores: CreditSubscore[];
  reasons: string[];
  bank_summary: string;
  months_data: number;
  monthly_revenue_avg: number;
  overdue_total: number;
  overdue_count: number;
}
export interface MatrixProduct {
  sku: string;
  name: string;
  velocity_30: number;
  revenue_30: number;
  margin_pct: number;
  quadrant: "STAR" | "VOLUME" | "HIDDEN_GEM" | "EXIT";
  action: string;
}
export interface BuySellMatrix {
  median_velocity: number;
  median_margin: number;
  products: MatrixProduct[];
  quadrant_counts: Record<string, number>;
}
export interface RootCauseFactor {
  factor: string;
  direction: string;
  impact: number;
  detail: string;
}
export interface RootCause {
  profit_cur: number;
  profit_prev: number;
  change_pct: number;
  factors: RootCauseFactor[];
  narrative: string;
}
export interface ProductRow {
  sku: string;
  name: string;
  category: string;
  sale_price: number;
  purchase_price: number;
  stock_qty: number;
  reorder_level: number;
}
export interface ActionItem {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  target_name: string | null;
  target_phone: string | null;
  amount: number | null;
  draft_message: string | null;
  status: string;
  created_at: string | null;
}
export interface AgentStep {
  agent: string;
  tool: string;
  args: Record<string, unknown>;
  result_preview: string;
}
export interface ChatResp {
  answer: string;
  steps: AgentStep[];
  suggested_actions: ActionItem[];
  provider: string;
  specialists_used: string[];
}
export interface WaStatus {
  configured: boolean;
  connected: boolean;
  instance: string;
  instructions: string;
}
export interface IngestSummary {
  source_type: string;
  filename: string;
  rows_inserted: number;
  rows_skipped: number;
  warnings: string[];
}
export interface IngestLog {
  id: number;
  source_type: string;
  filename: string;
  rows_inserted: number;
  rows_skipped: number;
  warnings: string[];
  created_at: string;
}

/* ---------- helpers ---------- */

const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "₹—";
  return inrFmt.format(Number(n));
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtClock(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- auth token ---------- */

export const TOKEN_KEY = "vyapaarai_token";

export function getToken(): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (typeof window === "undefined") return;
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function logoutToLogin() {
  setToken(null);
  try {
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  } catch {
    /* ignore */
  }
}

/* ---------- fetch ---------- */

export async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  // Token request ke waqt padho taaki 401-handler bata sake: session mari ya request hi bina-token thi.
  let hadToken = false;
  try {
    const headers: Record<string, string> = { ...(opts?.headers as Record<string, string> | undefined) };
    const tok = getToken();
    hadToken = !!tok;
    if (tok && !headers["Authorization"] && !headers["authorization"]) {
      headers["Authorization"] = `Bearer ${tok}`;
    }
    if (opts?.body && !headers["Content-Type"] && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    // Purana cached 401 jawab dobara na mile — har request fresh (auto-logout loop ka ek reason yehi tha).
    res = await fetch(`${API_URL}${path}`, { ...opts, headers, cache: "no-store" });
  } catch {
    throw new Error("Backend se connect nahi ho paya — kya uvicorn chal raha hai?");
  }
  if (res.status === 401 && !path.startsWith("/auth/")) {
    if (hadToken) {
      // Check if JWT token is actually expired by checking payload before wiping session
      let isActuallyExpiredOrInvalid = false;
      try {
        const tok = getToken();
        if (tok) {
          const parts = tok.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp && Date.now() / 1000 > payload.exp) {
              isActuallyExpiredOrInvalid = true;
            }
          } else {
            isActuallyExpiredOrInvalid = true;
          }
        } else {
          isActuallyExpiredOrInvalid = true;
        }
      } catch {
        isActuallyExpiredOrInvalid = true;
      }

      if (isActuallyExpiredOrInvalid) {
        logoutToLogin();
      } else {
        // Stray transient 401 on polling or route race — don't wipe active token immediately
        console.warn(`Transient 401 on ${path} — token still valid locally, skipping auto-logout`);
      }
    } else if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      // Bina token wali stray request — sirf login pe bhejo,
      // token wipe MAT karo taaki logged-in session bacha rahe.
      window.location.href = "/login";
    }
    throw new Error("Login chahiye — /login pe OTP lo");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = typeof j?.detail === "string" ? j.detail : JSON.stringify(j).slice(0, 200);
    } catch {
      detail = res.statusText;
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/* ---------- hook ---------- */

export function useApi<T>(path: string | null, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refetch = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const j = await apiFetch<T>(path);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kuch gadbad ho gayi");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    refetch();
    if (refreshMs && refreshMs > 0 && path) {
      timer.current = setInterval(refetch, refreshMs);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [refetch, refreshMs, path]);

  return { data, loading, error, refetch };
}
