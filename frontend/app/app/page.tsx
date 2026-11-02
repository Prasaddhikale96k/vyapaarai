"use client";

import { animate, AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BuySellGrid } from "@/components/buy-sell-grid";
import { ErrorBanner, FadeIn } from "@/components/fade-in";
import { ForecastChart } from "@/components/forecast-chart";
import { RootCauseCard } from "@/components/root-cause-card";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  API_URL,
  apiFetch,
  fmtClock,
  getToken,
  useApi,
  type ActionItem,
  type Anomaly,
  type BriefItem,
  type BuySellMatrix,
  type CreditScore,
  type Forecast,
  type HealthScore,
  type ProductRow,
  type RootCause,
  type WaStatus,
} from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

const REFRESH_MS = 300000;

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const c = animate(0, value, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => c.stop();
  }, [value]);
  return (
    <span className="tnum text-2xl font-bold" style={{ color: "var(--ink)" }}>
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

function Spark({ series, color }: { series: number[]; color: string }) {
  if (!series.length) return null;
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const pts = series
    .map((v, i) => `${(i / Math.max(series.length - 1, 1)) * 96},${30 - ((v - min) / Math.max(max - min, 1)) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 96 32" width="96" height="32" className="mt-1">
      <motion.polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1 }}
      />
    </svg>
  );
}

interface FeedItem {
  id: number;
  text: string;
  time: Date;
}

interface HubConn {
  id: number;
  type: string;
  status: string;
  rows_synced: number;
}

const CONN_LABEL: Record<string, string> = {
  google_sheets: "Sheets",
  excel_agent: "Excel",
  tally_agent: "Tally",
  busy_agent: "Busy",
  marg_agent: "Marg",
  zapier: "Zapier",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  custom_api: "API",
};

const FEED_LABEL: Record<string, string> = {
  sales: "Sale synced 🧾",
  actions: "Action update ⚡",
  owner_profiles: "Registration 👤",
  ingestion_logs: "File synced 📥",
  processed_files: "Watch sync 📥",
  receivables: "Udhaar update 💰",
  inventory: "Stock update 📦",
  products: "Product update 📦",
  document_logs: "Document update 📄",
};

function Stamp({ text, tone }: { text: string; tone: "rose" | "emerald" | "amber" }) {
  const c = tone === "rose" ? "var(--rose)" : tone === "emerald" ? "var(--accent)" : "var(--marigold)";
  return (
    <motion.span
      initial={{ scale: 2.2, opacity: 0, rotate: -18 }}
      animate={{ scale: 1, opacity: 1, rotate: -8 }}
      transition={{ type: "spring", stiffness: 300, damping: 16 }}
      className="inline-block rounded-md border-[2.5px] px-2.5 py-0.5 text-xs font-black uppercase tracking-widest"
      style={{ borderColor: c, color: c, background: "color-mix(in srgb, var(--card) 70%, transparent)" }}
    >
      {text}
    </motion.span>
  );
}

function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <FadeIn delay={delay}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </FadeIn>
  );
}

/* ---------- PWA install card (one-time, dismissible) ---------- */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

const INSTALL_DISMISS_KEY = "vyapaarai_install_dismissed";

function InstallCard() {
  const [dismissed, setDismissed] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1") setDismissed(true);
      const mq = window.matchMedia?.("(display-mode: standalone)");
      const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (mq?.matches || ios) setStandalone(true);
    } catch {
      /* ignore */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || standalone) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    }
    setDeferred(null);
  };

  return (
    <Card delay={0.02}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="card-title">📲 Install VyapaarAI</h3>
          <p className="card-sub mb-2">App jaisa experience — ek tap me dukaan ka hisaab.</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-300">
            <li>Chrome me ⋮ menu kholo (Android)</li>
            <li>&ldquo;Install app&rdquo; / &ldquo;Add to Home screen&rdquo; dabao</li>
            <li>Home screen se VyapaarAI kholo — full-screen chalega</li>
          </ol>
          <p className="mt-2 text-[11px] text-zinc-500">
            iPhone: Share ⬆ → Add to Home Screen.
          </p>
          <div className="mt-2 flex gap-2">
            {deferred && <Button onClick={install} className="px-4 py-1.5 text-xs">Install karo</Button>}
            <Button variant="ghost" onClick={dismiss} className="px-3 py-1.5 text-xs">
              Baad me
            </Button>
          </div>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss install" className="rounded px-1 text-zinc-500 hover:text-zinc-200">
          ✕
        </button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const health = useApi<HealthScore>("/health-score", REFRESH_MS);
  const brief = useApi<BriefItem[]>("/brief", REFRESH_MS);
  const anomalies = useApi<Anomaly[]>("/anomalies", REFRESH_MS);
  const root = useApi<RootCause>("/root-cause", REFRESH_MS);
  const credit = useApi<CreditScore>("/credit-score", REFRESH_MS);
  const matrix = useApi<BuySellMatrix>("/buy-sell-matrix", REFRESH_MS);
  const products = useApi<ProductRow[]>("/products", REFRESH_MS);
  const wa = useApi<WaStatus>("/whatsapp/status", REFRESH_MS);
  const connectors = useApi<HubConn[]>("/connectors", REFRESH_MS);

  const [sku, setSku] = useState<string>("");
  const [reportOpen, setReportOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const feedId = useRef(1);
  const activeSku = sku || products.data?.[0]?.sku || "";
  const forecast = useApi<Forecast>(
    activeSku ? `/forecast?sku=${encodeURIComponent(activeSku)}&days=14` : null,
    REFRESH_MS
  );

  const refetchAll = () => {
    health.refetch();
    brief.refetch();
    anomalies.refetch();
    root.refetch();
    credit.refetch();
    pendingActions.refetch();
    me.refetch();
    matrix.refetch();
    products.refetch();
    wa.refetch();
    connectors.refetch();
    forecast.refetch();
  };

  const pendingActions = useApi<ActionItem[]>(`/actions?status=pending`, REFRESH_MS);
  // /me kabhi badalta nahi — ek baar lao, 5-min poll mat karo (stray 401 + auto-logout surface kam).
  const me = useApi<{ name?: string | null }>(`/me`);

  const hindiDate = (() => {
    try {
      return new Intl.DateTimeFormat("hi-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
    } catch {
      return "";
    }
  })();

  // Supabase Realtime (postgres_changes) + 300s safety poll fallback
  useRealtime(
    ["sales", "ingestion_logs", "processed_files", "receivables", "inventory"],
    (payload) => {
      refetchAll();
      pendingActions.refetch();
      const table = (payload as { table?: string } | undefined)?.table ?? "";
      setFeed((f) =>
        [{ id: feedId.current++, text: FEED_LABEL[table] ?? "Sync update 🔄", time: new Date() }, ...f].slice(0, 8)
      );
    }
  );

  const copyBankSummary = async () => {
    const text = credit.data?.bank_summary ?? "";
    if (!text) {
      toast.error("Summary abhi ready nahi");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Bank summary copied 📋");
    } catch {
      toast.error("Copy nahi ho paya");
    }
  };

  const waConnected = wa.data?.connected === true;
  // P22 honesty: empty account -> no fake scores; checklist instead.
  const hasData = health.data?.has_data !== false;

  const ONBOARD_STEPS = [
    { icon: "📸", title: "Bill photo", detail: "Assistant ko WhatsApp par bill bhejo — ya camera se scan karo", href: "/app/data", cta: "Scan karo" },
    { icon: "🎤", title: "Voice note", detail: "Bikri ya udhaari mic par bolo, likhna nahi padega", href: "/app/chat", cta: "Chat kholo" },
    { icon: "🧾", title: "Web grid", detail: "Seedha table me sale aur stock likho", href: "/app/data", cta: "Grid kholo" },
    { icon: "📊", title: "CSV / Excel", detail: "Purani file upload karo, baaki VyapaarAI sambhalega", href: "/app/data", cta: "Upload karo" },
  ];

  const downloadPdf = async () => {
    try {
      const tok = getToken();
      const res = await fetch(`${API_URL}/reports/daily`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) throw new Error(`Report nahi mili (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF download ho gayi 📄");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fail ho gaya");
    } finally {
      setReportOpen(false);
    }
  };

  const downloadCreditPdf = async () => {
    try {
      const tok = getToken();
      const res = await fetch(`${API_URL}/credit-score/report`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) throw new Error(`Credit report nahi mili (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `credit-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Bank-ready PDF download ho gayi 🏦");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fail ho gaya");
    }
  };

  const sendWa = async () => {    setSending(true);
    try {
      const r = await apiFetch<{ simulated?: boolean }>("/reports/send-now", {
        method: "POST",
      });
      toast.success(
        r.simulated
          ? "Gateway down — simulated (WhatsApp connect karo)"
          : "WhatsApp pe bhej di ✅"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bhej nahi paye");
    } finally {
      setSending(false);
      setReportOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">
              Namaste{me.data?.name ? `, ${me.data.name.split(" ")[0]} ji` : ""} 🙏
            </h1>
            <p className="text-xs capitalize" style={{ color: "var(--ink-soft)" }}>
              {hindiDate} • <span className="font-display">व्यापार</span> Copilot — AI suggests. Owner decides.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <motion.span
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`h-2 w-2 rounded-full ${health.error ? "bg-rose-500" : "bg-emerald-400"}`}
              />
              {health.error ? "offline" : "live"}
            </span>
            <Badge tone={waConnected ? "emerald" : "amber"}>
              {waConnected ? "WhatsApp connected" : "WhatsApp setup pending"}
            </Badge>
            {(() => {
              const live = (connectors.data ?? []).find((c) =>
                ["live", "polling"].includes(c.status));
              if (!live) return null;
              return (
                <Badge tone="emerald">
                  🔌 {CONN_LABEL[live.type] ?? live.type} live • {live.rows_synced} rows
                </Badge>
              );
            })()}
            <Button variant="outline" onClick={refetchAll} className="flex items-center gap-1.5">
              <RefreshCw size={14} /> Refresh
            </Button>
            <div className="relative">
              <Button variant="outline" onClick={() => setReportOpen((o) => !o)}>
                📄 Aaj ki report
              </Button>
              {reportOpen && (
                <div className="absolute right-0 z-50 mt-2 w-48 rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-xl">
                  <button
                    onClick={downloadPdf}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    ⬇ Download PDF
                  </button>
                  <button
                    onClick={sendWa}
                    disabled={sending}
                    className="block w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {sending ? "Bhej rahe…" : "📲 WhatsApp pe bhejo"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      <InstallCard />

      {health.data && !hasData && (
        <FadeIn>
          <Card delay={0.05} hover className="ledger-top">
            <h3 className="card-title font-display">Shuru karo — pehli entry 🚀</h3>
            <p className="card-sub mb-3 mt-1">Neeche 4 tareeke — jo aasan lage, wahi chuno. Pehli entry aate hi tumhara score banega.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ONBOARD_STEPS.map((s) => (
                <div key={s.title} className="flex items-center gap-3 rounded-xl border border-zinc-800 p-3">
                  <span className="text-2xl" aria-hidden="true">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-100">{s.title}</p>
                    <p className="truncate text-xs text-zinc-400">{s.detail}</p>
                  </div>
                  <Link
                    href={s.href}
                    className="shrink-0 rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
                  >
                    {s.cta}
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </FadeIn>
      )}

      {/* row 1: score + subscores */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card delay={0} hover className="ledger-top lg:col-span-1">
          <h3 className="card-title mb-3 font-display">Business health <span style={{ color: "var(--ink-faint)" }}>• स्वास्थ्य</span></h3>
          {health.loading && !health.data ? (
            <SkeletonCard lines={2} />
          ) : health.error || !health.data ? (
            <ErrorBanner message={health.error ?? "Health score nahi mila"} onRetry={health.refetch} />
          ) : !hasData ? (
            <>
              <ScoreRing value={null} grade={null} />
              <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>Pehli entry aate hi score banega 📊</p>
            </>
          ) : (
            <>
              <ScoreRing value={health.data.overall} grade={health.data.grade} />
              <div className="mt-2">
                <Stamp
                  text={health.data.grade ?? "—"}
                  tone={(health.data.overall ?? 0) >= 65 ? "emerald" : (health.data.overall ?? 0) >= 50 ? "amber" : "rose"}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{health.data.headline}</p>
            </>
          )}
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          {health.loading && !health.data ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : health.error || !health.data ? (
            <div className="sm:col-span-2">
              <ErrorBanner message={health.error ?? "Subscores nahi mile"} onRetry={health.refetch} />
            </div>
          ) : (
            health.data.subscores.map((s, i) => (
              <Card key={s.name} delay={0.05 * (i + 1)} hover>
                <div className="flex items-baseline justify-between">
                  <h3 className="card-title">{s.name}</h3>
                  <span className="text-2xl font-bold tabular-nums text-zinc-50">{s.score ?? "—"}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, s.score ?? 0))}%` }}
                    transition={{ duration: 0.8, delay: 0.1 + 0.08 * i }}
                    className={`h-full rounded-full ${
                      (s.score ?? 0) >= 65
                        ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                        : (s.score ?? 0) >= 50
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-400">{s.breakdown}</p>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* credit score row */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card delay={0.05} hover className="lg:col-span-1">
          <h3 className="card-title mb-3">🏦 Business Credit Score</h3>
          {credit.loading && !credit.data ? (
            <SkeletonCard lines={2} />
          ) : credit.error || !credit.data ? (
            <ErrorBanner message={credit.error ?? "Credit score nahi mila"} onRetry={credit.refetch} />
          ) : (
            <ScoreRing value={credit.data.overall} grade={credit.data.grade} />
          )}
        </Card>
        <Card delay={0.1} hover className="ledger-top lg:col-span-2">
          <span className="watermark-char">ऋ</span>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="card-title font-display">Business credit score</h3>
            <Button variant="outline" onClick={downloadCreditPdf} className="ml-auto">
              🏦 Bank-ready PDF
            </Button>
            <Button variant="outline" onClick={copyBankSummary}>
              📋 Copy bank summary
            </Button>
          </div>
          {credit.loading && !credit.data ? (
            <SkeletonCard lines={3} />
          ) : credit.error || !credit.data ? (
            <ErrorBanner message={credit.error ?? "Reasons nahi mile"} onRetry={credit.refetch} />
          ) : (
            <details>
              <summary className="mt-2 cursor-pointer text-xs font-semibold text-zinc-300 hover:text-zinc-100">
                Score kyun {(credit.data.overall ?? 0) >= 60 ? "achha" : "kam"} hai? Dekho →
              </summary>
              <ul className="mt-2 space-y-1.5">
                {(credit.data.reasons ?? []).map((r, i) => (
                  <li key={i} className="text-xs leading-relaxed text-zinc-300">
                    • {r}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>

      {/* KPI + live feed row */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Card delay={0} hover>
            <p className="card-sub">Health</p>
            {!hasData && health.data ? (
              <span className="tnum text-2xl font-bold" style={{ color: "var(--ink)" }}>—</span>
            ) : (
              <CountUp value={health.data?.overall ?? 0} suffix="/100" />
            )}
          </Card>
          <Card delay={0.05} hover>
            <p className="card-sub">Credit score</p>
            <CountUp value={credit.data?.overall ?? 0} suffix="/100" />
          </Card>
          <Card delay={0.1} hover>
            <p className="card-sub">Products</p>
            <CountUp value={products.data?.length ?? 0} />
            {forecast.data && (
              <Spark series={(forecast.data.history ?? []).slice(-14).map((h) => h.qty)} color="var(--accent)" />
            )}
          </Card>
          <Card delay={0.15} hover>
            <p className="card-sub">Pending actions</p>
            <CountUp value={pendingActions.data?.length ?? 0} />
          </Card>
        </div>
        <Card delay={0.1} hover>
          <h3 className="card-title">⚡ Live activity</h3>
          {feed.length === 0 ? (
            <p className="card-sub mt-2">Sync hote hi yahan dikhega — kuch badlo aur dekho 👀</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              <AnimatePresence initial={false}>
                {feed.map((f) => (
                  <motion.li
                    key={f.id}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-xs"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    <span>{f.text}</span>
                    <span className="ml-auto tnum" style={{ color: "var(--ink-faint)" }}>
                      {fmtClock(f.time)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </div>

      {/* row 2: alerts + anomalies */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Section title="Aaj ke alerts • सूचना" delay={0.1}>
            {brief.loading && !brief.data ? (
              <SkeletonCard />
            ) : brief.error || !brief.data ? (
              <ErrorBanner message={brief.error ?? "Alerts nahi mile"} onRetry={brief.refetch} />
            ) : (
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
                {brief.data.map((b, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i }}
                    whileHover={{ y: -3 }}
                    className="card min-w-[240px] snap-start border-l-4"
                    style={{
                      borderLeftColor: b.severity === "high" ? "var(--rose)" : b.severity === "medium" ? "var(--marigold)" : "var(--accent)",
                    }}
                  >
                    <motion.p
                      className="text-xl"
                      initial={{ rotate: -12, scale: 0.7 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ delay: 0.15 + 0.08 * i, type: "spring", stiffness: 300, damping: 12 }}
                    >
                      {b.icon}
                    </motion.p>
                    <p className="card-title mt-1">{b.title}</p>
                    <p className="card-sub mt-1">{b.detail}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </Section>
        </div>
        <div className="lg:col-span-2">
          <Section title="Anomalies" delay={0.15}>
            {anomalies.loading && !anomalies.data ? (
              <SkeletonCard lines={2} />
            ) : anomalies.error || !anomalies.data ? (
              <ErrorBanner message={anomalies.error ?? "Anomalies nahi mili"} onRetry={anomalies.refetch} />
            ) : anomalies.data.length === 0 ? (
              <Card>
                <p className="text-sm" style={{ color: "var(--ink-soft)" }}>अभी कोई anomaly नहीं ✅</p>
              </Card>
            ) : (
              <div className="card space-y-0 p-2">
                {anomalies.data.map((a, i) => (
                  <FadeIn key={i} delay={0.05 * i}>
                    <div
                      className="flex items-start gap-2.5 px-2 py-2"
                      style={{ borderBottom: i < (anomalies.data?.length ?? 0) - 1 ? "1px dashed var(--card-border)" : "none" }}
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: a.severity === "high" ? "var(--rose)" : "var(--marigold)" }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                          {a.type}
                          {a.date ? <span className="tnum font-normal" style={{ color: "var(--ink-faint)" }}> • {a.date.slice(5)}</span> : null}
                        </p>
                        <p className="text-xs leading-snug" style={{ color: "var(--ink-soft)" }}>{a.message}</p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* row 3: forecast */}
      <Section title="Demand forecast" delay={0.1}>
        <Card hover>
          {products.loading && !products.data ? (
            <SkeletonCard lines={2} />
          ) : products.error || !products.data?.length ? (
            <ErrorBanner
              message={products.error ?? "Products nahi mile — अभी कोई डेटा नहीं"}
              onRetry={products.refetch}
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Select value={activeSku} onChange={(e) => setSku(e.target.value)} className="w-auto">
                  {products.data.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </Select>
              </div>
              {forecast.loading && !forecast.data ? (
                <SkeletonCard lines={4} />
              ) : forecast.error || !forecast.data ? (
                <ErrorBanner message={forecast.error ?? "Forecast nahi mila"} onRetry={forecast.refetch} />
              ) : (
                <ForecastChart data={forecast.data} />
              )}
            </>
          )}
        </Card>
      </Section>

      {/* row 4: root cause + matrix mini */}
      <div className="grid gap-3 lg:grid-cols-2">
        {root.loading && !root.data ? (
          <SkeletonCard lines={4} />
        ) : root.error || !root.data ? (
          <ErrorBanner message={root.error ?? "Root-cause nahi mila"} onRetry={root.refetch} />
        ) : (
          <RootCauseCard data={root.data} delay={0.1} />
        )}
        <Card delay={0.15} hover>
          <h3 className="card-title">Buy / Sell matrix</h3>
          {matrix.loading && !matrix.data ? (
            <SkeletonCard lines={2} />
          ) : matrix.error || !matrix.data ? (
            <ErrorBanner message={matrix.error ?? "Matrix nahi mili"} onRetry={matrix.refetch} />
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {["STAR", "VOLUME", "HIDDEN_GEM", "EXIT"].map((q) => (
                <div key={q} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2 text-center">
                  <p className="text-[11px] font-bold text-zinc-400">{q.replace("_", " ")}</p>
                  <p className="text-2xl font-bold tabular-nums text-zinc-50">
                    {matrix.data?.quadrant_counts?.[q] ?? 0}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="card-sub mt-2">Kaunsa maal badhao, kaunsa hatao — 4 khaane me.</p>
        </Card>
      </div>

      {/* poora grid — jisko detail chahiye wahi khole */}
      <Section title="Har product ka hisaab" delay={0.1}>
        <details className="rounded-2xl border border-zinc-800 p-1">
          <summary className="cursor-pointer list-none rounded-xl px-3 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/60">
            Poori list dekho ({matrix.data?.products?.length ?? 0} products)
          </summary>
          <div className="p-2">
            {matrix.loading && !matrix.data ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : matrix.error || !matrix.data ? (
              <ErrorBanner message={matrix.error ?? "Matrix nahi mili"} onRetry={matrix.refetch} />
            ) : (
              <BuySellGrid data={matrix.data} />
            )}
          </div>
        </details>
      </Section>
    </div>
  );
}
