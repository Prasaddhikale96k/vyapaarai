"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorBanner, FadeIn } from "@/components/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  API_URL,
  apiFetch,
  fmtTime,
  getToken,
  inr,
  useApi,
  type IngestLog,
  type IngestSummary,
  type ProductRow,
} from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

const UPLOAD_TYPES = ["sales", "inventory", "receivables", "expenses", "products"];

/* ---------- types for new endpoints ---------- */

interface PreviewResp {
  type: string;
  columns_detected: string[];
  mapped_fields: string[];
  rows_total: number;
  rows_ok: number;
  errors: { row_no: number; reason: string }[];
  preview: Record<string, unknown>[];
}

interface FileRow {
  id: number;
  filename: string;
  sha256: string;
  sha8: string;
  size: number;
  source: string;
  status: string;
  rows_inserted: number;
  warnings: string[];
  created_at: string | null;
}

interface Me {
  id: number;
  phone: string;
  name: string | null;
  business_name: string | null;
  onboarded: boolean;
  is_admin?: boolean;
}

interface DocEntry {
  date?: string | null;
  party_name?: string | null;
  item?: string | null;
  qty?: number | null;
  amount?: number | null;
  entry_type?: string | null;
}

interface DocUploadResp {
  doc_id: number;
  entries: DocEntry[];
  summary_text: string;
}

interface PendingDoc {
  id: number;
  filename: string;
  source: string;
  status: string;
  entries: DocEntry[];
  entry_count: number;
  created_at: string | null;
}

const fileTone: Record<string, "emerald" | "zinc" | "rose" | "amber"> = {
  ingested: "emerald",
  skipped_same: "zinc",
  quarantined: "rose",
  error: "amber",
};

function FileStamp({ status }: { status: string }) {
  const c =
    status === "ingested" ? "var(--accent)"
    : status === "quarantined" ? "var(--rose)"
    : status === "error" ? "var(--rose)"
    : "var(--ink-faint)";
  return (
    <motion.span
      initial={{ scale: 1.8, opacity: 0, rotate: -16 }}
      animate={{ scale: 1, opacity: 1, rotate: -7 }}
      transition={{ type: "spring", stiffness: 320, damping: 15 }}
      className="inline-block rounded border-2 px-1.5 py-px text-[10px] font-black uppercase tracking-widest"
      style={{ borderColor: c, color: c }}
    >
      {status === "skipped_same" ? "SYNCED ✓" : status}
    </motion.span>
  );
}

function DropLabel({
  children,
  onFile,
  accept,
  busyLabel,
  busy,
  primary,
}: {
  children?: React.ReactNode;
  onFile: (f: File | undefined) => void;
  accept: string;
  busyLabel: string;
  busy: boolean;
  primary?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <motion.label
      animate={over ? { scale: 1.04, rotate: -0.5 } : { scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0]);
      }}
      className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold"
      style={
        primary
          ? { background: "linear-gradient(135deg, var(--brand, #e8771a), var(--brand-dark, #b85a00))", color: "#fff" }
          : {
              border: `2px dashed ${over ? "var(--accent)" : "var(--card-border)"}`,
              color: "var(--ink)",
              background: over ? "var(--accent-soft)" : "transparent",
            }
      }
    >
      {busy ? busyLabel : children}
      <Input
        type="file"
        accept={accept}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </motion.label>
  );
}

/* ---------- onboarding wizard ---------- */

function Wizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [previews, setPreviews] = useState<Record<string, PreviewResp>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [committed, setCommitted] = useState<Record<string, boolean>>({});
  const [downloading, setDownloading] = useState("");

  const downloadTemplate = async (t: string) => {
    setDownloading(t);
    try {
      const tok = getToken();
      const res = await fetch(`${API_URL}/ingest/template?type=${t}`, {
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      });
      if (!res.ok) throw new Error(`Template nahi mila (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template-${t}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download fail ho gaya");
    } finally {
      setDownloading("");
    }
  };

  const postFile = async (path: string, file: File, type: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    return apiFetch<PreviewResp | IngestSummary>(path, { method: "POST", body: fd });
  };

  const onPreview = async (t: string, f: File | undefined) => {
    if (!f) return;
    setBusy((b) => ({ ...b, [t]: true }));
    try {
      const r = (await postFile("/ingest/preview", f, t)) as PreviewResp;
      setPreviews((p) => ({ ...p, [t]: r }));
      if (r.rows_ok > 0) toast.success(`${t}: ${r.rows_ok}/${r.rows_total} rows green ✅`);
      else toast.warning(`${t}: koi valid row nahi — errors dekho`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview fail ho gaya");
    } finally {
      setBusy((b) => ({ ...b, [t]: false }));
    }
  };

  const onCommit = async (t: string, f: File | undefined, cached: File | null) => {
    const file = f ?? cached;
    if (!file) {
      toast.error("Pehle file choose karo, preview dekho, phir commit");
      return;
    }
    setBusy((b) => ({ ...b, [t]: true }));
    try {
      const r = (await postFile("/ingest/commit", file, t)) as IngestSummary;
      setCommitted((c) => ({ ...c, [t]: true }));
      toast.success(`${t}: +${r.rows_inserted} rows live ✅`);
      if (Object.keys(committed).length + 1 >= 1) {
        // first commit flips onboarded on backend; parent refetches /me
        onDone();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Commit fail ho gaya");
    } finally {
      setBusy((b) => ({ ...b, [t]: false }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-emerald-500/30">
        <h3 className="card-title">🧭 Dukaan setup wizard</h3>
        <p className="card-sub mb-3">
          Step {step} of 3 — pehla data lao, dukaan live karo.
        </p>
        <div className="mb-3 flex gap-1.5">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-emerald-400" : "bg-zinc-800"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <p className="mb-2 text-xs text-zinc-400">
              Step 1: apne data ka template download karo (canonical headers + 2 example rows).
            </p>
            <div className="flex flex-wrap gap-2">
              {UPLOAD_TYPES.map((t) => (
                <Button key={t} variant="outline" disabled={downloading === t} onClick={() => downloadTemplate(t)}>
                  {downloading === t ? "…" : `⬇ ${t}`}
                </Button>
              ))}
            </div>
            <div className="mt-3">
              <Button onClick={() => setStep(2)}>Next: upload & preview →</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400">
              Step 2: har type ki file → preview (green/red) → Commit. Pehla commit dukaan ko live kar dega 🎉
            </p>
            {UPLOAD_TYPES.map((t) => {
              const pv = previews[t];
              return (
                <div key={t} className="rounded-xl border border-zinc-800 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{t}</Badge>
                    {committed[t] && <Badge tone="emerald">committed ✓</Badge>}
                    <label className="ml-auto cursor-pointer rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800">
                      {busy[t] ? "…" : "Choose file"}
                      <Input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        disabled={busy[t]}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          onPreview(t, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {pv && pv.rows_ok > 0 && !committed[t] && (
                      <span className="text-[11px] text-emerald-300">preview green — commit ke liye neeche file dobara do 👇</span>
                    )}
                  </div>
                  {pv && (
                    <div className="mt-2">
                      <div className="mb-1 flex flex-wrap gap-1">
                        {pv.mapped_fields.map((m) => (
                          <Badge key={m} tone="emerald">
                            {m}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {pv.rows_ok}/{pv.rows_total} rows ok • type: {pv.type}
                      </p>
                      {pv.preview.length > 0 && (
                        <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-zinc-800 text-[11px]">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-zinc-500">
                                {Object.keys(pv.preview[0] ?? {}).map((k) => (
                                  <th key={k} className="px-2 py-1">
                                    {k}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {pv.preview.map((row, i) => (
                                <tr key={i} className="border-t border-zinc-800/60 text-zinc-300">
                                  {Object.values(row).map((v, j) => (
                                    <td key={j} className="px-2 py-1">
                                      {String(v ?? "—").slice(0, 40)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {pv.errors.length > 0 && (
                        <div className="mt-1 max-h-24 overflow-auto text-[11px] text-rose-300">
                          {pv.errors.slice(0, 10).map((e, i) => (
                            <p key={i}>
                              row {e.row_no}: {e.reason}
                            </p>
                          ))}
                        </div>
                      )}
                      {!committed[t] && pv.rows_ok > 0 && (
                        <label className="mt-2 inline-block cursor-pointer rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-1.5 text-xs font-semibold text-zinc-950">
                          {busy[t] ? "Committing…" : `Commit ${t} ✅`}
                          <Input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            disabled={busy[t]}
                            onChange={(e) => {
                              onCommit(t, e.target.files?.[0], null);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button variant="outline" onClick={() => setStep(3)}>
                Skip →
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">Dukaan live!</p>
            <p className="text-xs text-zinc-400">Pehla commit hotey hi wizard apne aap gayab ho jayega.</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button onClick={onDone}>Refresh status ↻</Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ---------- documents card ---------- */

function DocumentsCard() {
  const pending = useApi<PendingDoc[]>("/documents/pending");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DocUploadResp | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useRealtime(["document_logs"], () => pending.refetch());

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await apiFetch<DocUploadResp>("/documents/upload", { method: "POST", body: fd });
      setResult(r);
      toast.success(r.summary_text.slice(0, 120));
      pending.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Recognize fail ho gaya");
    } finally {
      setUploading(false);
    }
  };

  const decide = async (id: number, ok: boolean) => {
    setBusyId(id);
    try {
      const r = await apiFetch<{ confirmed?: number; message?: string; status?: string }>(
        `/documents/${id}/${ok ? "confirm" : "reject"}`,
        { method: "POST" }
      );
      toast.success(ok ? `${r.message ?? "Save ho gaya"} (${r.confirmed ?? 0} entries)` : "Discard ho gaya ❌");
      setResult(null);
      pending.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nahi ho paya");
    } finally {
      setBusyId(null);
    }
  };

  const entryTable = (entries: DocEntry[]) => (
    <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-zinc-800 text-[11px]">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="text-zinc-500">
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Party</th>
            <th className="px-2 py-1">Item</th>
            <th className="px-2 py-1 text-right">Qty</th>
            <th className="px-2 py-1 text-right">Amount</th>
            <th className="px-2 py-1">Type</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={i} className="border-t border-zinc-800/60 text-zinc-300">
              <td className="px-2 py-1">{String(e.date ?? "—")}</td>
              <td className="px-2 py-1">{String(e.party_name ?? "—")}</td>
              <td className="px-2 py-1">{String(e.item ?? "—")}</td>
              <td className="px-2 py-1 text-right">{String(e.qty ?? "—")}</td>
              <td className="px-2 py-1 text-right">{String(e.amount ?? "—")}</td>
              <td className="px-2 py-1">{String(e.entry_type ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <Card delay={0.12} hover>
      <h3 className="card-title">🧾 Documents — PDF/photo recognize + confirm</h3>
      <p className="card-sub mb-3">Bill/register ki photo ya PDF → entries → CONFIRM.</p>
      <DropLabel accept=".pdf,.jpg,.jpeg,.png,.webp" busy={uploading} busyLabel="Recognizing…" onFile={upload}>
        Choose PDF / photo
      </DropLabel>
      {result && (
        <div className="mt-2 rounded-xl border border-emerald-500/30 p-2">
          <p className="text-xs text-zinc-300">{result.summary_text}</p>
          {entryTable(result.entries)}
          <div className="mt-2 flex gap-2">
            <Button disabled={busyId === result.doc_id} onClick={() => decide(result.doc_id, true)}>
              CONFIRM ✅
            </Button>
            <Button variant="ghost" disabled={busyId === result.doc_id} onClick={() => decide(result.doc_id, false)}>
              DISCARD ❌
            </Button>
          </div>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Pending ({pending.data?.length ?? 0})
        </p>
        {pending.loading && !pending.data ? (
          <SkeletonCard lines={2} />
        ) : pending.error ? (
          <ErrorBanner message={pending.error} onRetry={pending.refetch} />
        ) : !pending.data?.length ? (
          <p className="text-xs text-zinc-500">Koi pending document nahi 🎉</p>
        ) : (
          <div className="space-y-2">
            {pending.data.map((d) => (
              <div key={d.id} className="rounded-xl border border-zinc-800 p-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-200">{d.filename}</span>
                  <Badge>{d.entry_count} entries</Badge>
                  <span className="ml-auto flex gap-2">
                    <Button disabled={busyId === d.id} onClick={() => decide(d.id, true)}>
                      CONFIRM
                    </Button>
                    <Button variant="ghost" disabled={busyId === d.id} onClick={() => decide(d.id, false)}>
                      DISCARD
                    </Button>
                  </span>
                </div>
                {entryTable(d.entries)}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- live connectors card ---------- */

interface Connector {
  id: number;
  type: string;
  config: Record<string, unknown>;
  status: string;
  last_sync_at: string | null;
  rows_synced: number;
  has_key?: boolean;
  key_hint?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  live: "var(--accent)",
  polling: "var(--marigold)",
  offline: "var(--ink-faint)",
  error: "var(--rose, #f43f5e)",
};

type HubKind = "cloud" | "agent" | "api";

interface HubEntry {
  type: string;
  icon: string;
  title: string;
  desc: string;
  kind: HubKind;
}

const HUB_CATALOG: HubEntry[] = [
  { type: "google_sheets", icon: "📊", title: "Google Sheets", desc: "Link paste karo — har 60s auto-sync", kind: "cloud" },
  { type: "excel_agent", icon: "📗", title: "Excel", desc: "Dukaan ke computer se auto-sync", kind: "agent" },
  { type: "tally_agent", icon: "🧾", title: "Tally Prime", desc: "Day Book vouchers auto-sync", kind: "agent" },
  { type: "busy_agent", icon: "📒", title: "Busy", desc: "Busy se sale auto-sync (agent)", kind: "agent" },
  { type: "marg_agent", icon: "📕", title: "Marg", desc: "Marg se sale auto-sync (agent)", kind: "agent" },
  { type: "zapier", icon: "⚡", title: "Zapier / Make", desc: "5000+ apps — bina code jodo", kind: "api" },
  { type: "shopify", icon: "🛍️", title: "Shopify", desc: "Online orders auto-sync", kind: "api" },
  { type: "woocommerce", icon: "🛒", title: "WooCommerce", desc: "Orders auto-sync", kind: "api" },
  { type: "custom_api", icon: "🔌", title: "Custom API", desc: "Apna software khud jodo", kind: "api" },
];

const AGENT_CMD: Record<string, { file: string; title: string; note: string }> = {
  excel_agent: { file: "excel_sync.py", title: "Excel local agent", note: "Watch folder → auto-ingest" },
  tally_agent: { file: "tally_sync.py", title: "Tally local agent", note: "localhost:9000 Day Book → auto-ingest" },
  busy_agent: { file: "excel_sync.py", title: "Busy local agent", note: "Busy export folder → auto-ingest" },
  marg_agent: { file: "excel_sync.py", title: "Marg local agent", note: "Marg export folder → auto-ingest" },
};

function ConnectorsCard({ meId }: { meId: number | undefined }) {
  const connectors = useApi<Connector[]>("/connectors", 300000);
  const [openType, setOpenType] = useState<string | null>(null);
  const [sheetLink, setSheetLink] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<{ id: number; key: string } | null>(null);

  useRealtime(["connectors", "ingestion_logs"], () => connectors.refetch());

  void meId;

  const extractSheetId = (link: string): string => {
    const m = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : link.trim();
  };

  const createType = async (type: string, config: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await apiFetch<{ ok: boolean; connector?: Connector; api_key?: string; error?: string }>(
        "/connectors",
        { method: "POST", body: JSON.stringify({ type, config }) }
      );
      if (!r.ok) {
        toast.error(r.error ?? "Connect nahi hua");
        return;
      }
      if (r.api_key && r.connector) setFreshKey({ id: r.connector.id, key: r.api_key });
      toast.success(`${type} connected ✅`);
      connectors.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect nahi hua");
    } finally {
      setBusy(false);
    }
  };

  const connectSheets = async () => {
    const id = extractSheetId(sheetLink);
    if (!id) {
      toast.error("Sahi Google Sheets link daalo");
      return;
    }
    await createType("google_sheets", { sheet_id: id, range: "A1:Z1000" });
    setSheetLink("");
  };

  const connectShop = async (type: string) => {
    const domain = shopDomain.trim();
    if (!domain) {
      toast.error("Dukaan ka domain likho (jaise myshop.myshopify.com)");
      return;
    }
    await createType(type, { domain });
    setShopDomain("");
  };

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(okMsg);
    } catch {
      toast.error("Copy nahi ho paya — haath se likh lo");
    }
  };

  const remove = async (id: number) => {
    try {
      await apiFetch(`/connectors/${id}`, { method: "DELETE" });
      toast.success("Connector hata diya");
      connectors.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nahi ho paya");
    }
  };

  const syncNow = async (id: number) => {
    try {
      await apiFetch(`/connectors/${id}/sync-now`, { method: "POST" });
      toast.success("Sync shuru ✅");
      connectors.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync nahi hua");
    }
  };

  const statusChip = (s: string) => (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
      style={{ color: STATUS_TONE[s] || STATUS_TONE.offline, border: `1px solid ${STATUS_TONE[s] || STATUS_TONE.offline}` }}
    >
      {s}
    </span>
  );

  return (
    <Card delay={0.08} hover>
      <h3 className="card-title">🔌 Connect — sab apps ek jagah</h3>
      <p className="card-sub mb-3">Sheets • Excel • Tally • Busy • Marg • Zapier • Shopify • Custom API</p>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {HUB_CATALOG.map((h, i) => {
          const connected = (connectors.data ?? []).some((c) => c.type === h.type);
          return (
            <motion.button
              key={h.type}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.3), ease: [0.23, 1, 0.32, 1] }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setFreshKey(null);
                setOpenType(h.type);
              }}
              className="rounded-2xl border p-3 text-left transition"
              style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
              aria-label={`${h.title} connect karo`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">{h.icon}</span>
                <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>{h.title}</span>
                {connected && (
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ color: "var(--accent)", border: "1px solid var(--accent)" }}
                  >
                    live
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>{h.desc}</p>
              <span
                className="mt-2 inline-block rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--brand, #e8771a), var(--brand-dark, #b85a00))" }}
              >
                {connected ? "Manage" : "Connect"}
              </span>
            </motion.button>
          );
        })}
      </div>

      {openType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Connector setup"
          onClick={() => setOpenType(null)}
        >
          <div
            className="w-full max-w-[440px] rounded-2xl border p-4"
            style={{ borderColor: "var(--card-border)", background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                {HUB_CATALOG.find((h) => h.type === openType)?.icon}{" "}
                {HUB_CATALOG.find((h) => h.type === openType)?.title}
              </h3>
              <button
                type="button"
                onClick={() => setOpenType(null)}
                aria-label="Close"
                className="rounded-lg px-2 py-1 text-lg"
                style={{ color: "var(--ink-faint)" }}
              >
                ✕
              </button>
            </div>

            {openType === "google_sheets" && (
              <div className="space-y-2">
                <label htmlFor="sheet-link" className="block text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  Google Sheets link
                </label>
                <input
                  id="sheet-link"
                  className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-base outline-none"
                  style={{ borderColor: "var(--card-border)", color: "var(--ink)" }}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  value={sheetLink}
                  onChange={(e) => setSheetLink(e.target.value)}
                  inputMode="url"
                />
                <Button onClick={connectSheets} disabled={busy}>
                  {busy ? "Connecting…" : "Connect"}
                </Button>
                <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  Sheet public honi chahiye. Backend har 60s poll karta hai.
                </p>
              </div>
            )}

            {AGENT_CMD[openType] && (
              <div className="space-y-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                <p className="font-semibold" style={{ color: "var(--ink)" }}>
                  {AGENT_CMD[openType].title} — {AGENT_CMD[openType].note}
                </p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Tally kholo (company loaded) — Excel/Busy ke liye file taiyaar rakho</li>
                  <li>Isi page pe <strong>💻 Computer se jodo</strong> se 6-char code lo</li>
                  <li>Computer pe agent chalao, code dalo — bas, auto-sync shuru</li>
                </ol>
                <pre
                  className="overflow-auto rounded-lg p-2 font-mono text-[11px]"
                  style={{ background: "var(--paper)", border: "1px solid var(--card-border)" }}
                >
{`cd backend
python connectors\\${AGENT_CMD[openType].file}`}
                </pre>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => copyText(`cd backend\npython connectors\\${AGENT_CMD[openType].file}`, "Command copy ho gaya 📋")}
                  >
                    Copy command
                  </Button>
                  <Button
                    variant="outline"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => createType(openType, {})}
                    disabled={busy}
                  >
                    {busy ? "…" : "Maine agent chala diya ✅"}
                  </Button>
                </div>
              </div>
            )}

            {(openType === "zapier" || openType === "custom_api" || openType === "shopify" || openType === "woocommerce") && (
              <div className="space-y-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                {(openType === "shopify" || openType === "woocommerce") && (
                  <div>
                    <label htmlFor="shop-domain" className="mb-1 block text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      Store domain
                    </label>
                    <input
                      id="shop-domain"
                      className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-base outline-none"
                      style={{ borderColor: "var(--card-border)", color: "var(--ink)" }}
                      placeholder={openType === "shopify" ? "myshop.myshopify.com" : "myshop.com"}
                      value={shopDomain}
                      onChange={(e) => setShopDomain(e.target.value)}
                      inputMode="url"
                    />
                  </div>
                )}
                <p>
                  {openType === "zapier"
                    ? "Zapier/Make me Webhook POST lagao — key neeche se copy karo. Orders/sales seedha ledger me aayenge."
                    : openType === "custom_api"
                      ? "Apne software se POST karo — key header me, sales JSON body me."
                      : "Store ke orders sync honge — key banao aur plugin/worker me dalo."}
                </p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    openType === "shopify" || openType === "woocommerce"
                      ? connectShop(openType)
                      : createType(openType, {})
                  }
                >
                  {busy ? "…" : "API key banao 🔑"}
                </Button>
                {freshKey && (
                  <div
                    className="rounded-xl border p-2"
                    style={{ borderColor: "var(--brand, #e8771a)", background: "var(--brand-soft, #fff3e0)" }}
                  >
                    <p className="font-bold" style={{ color: "var(--ink)" }}>Ye key EK BAAR dikhegi — abhi copy karo:</p>
                    <code className="mt-1 block break-all font-mono text-[11px]" style={{ color: "var(--ink)" }}>
                      {freshKey.key}
                    </code>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button className="px-3 py-1.5 text-xs" onClick={() => copyText(freshKey.key, "Key copy ho gayi 📋")}>
                        Copy key
                      </Button>
                      <Button
                        variant="outline"
                        className="px-3 py-1.5 text-xs"
                        onClick={() =>
                          copyText(
                            `curl -X POST ${API_URL}/v1/sales -H "X-API-Key: ${freshKey.key}" -H "Content-Type: application/json" -d '{"sales":[{"date":"2026-10-15","product":"Atta 5kg","qty":2,"unit_price":240}]}'`,
                            "cURL copy ho gaya 📋"
                          )
                        }
                      >
                        Copy cURL
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Connectors ({connectors.data?.length ?? 0})
        </p>
        {connectors.loading && !connectors.data ? (
          <SkeletonCard lines={2} />
        ) : connectors.error || !connectors.data ? (
          <ErrorBanner message={connectors.error ?? "Connectors nahi mile"} onRetry={connectors.refetch} />
        ) : connectors.data.length === 0 ? (
          <p className="text-xs text-zinc-500">Abhi kuch connected nahi — upar se apna app chuno, 1 minute me live ✅</p>
        ) : (
          <div className="space-y-2">
            {connectors.data.map((c) => {
              const label = HUB_CATALOG.find((h) => h.type === c.type)?.title ?? c.type;
              const regen = async () => {
                try {
                  const r = await apiFetch<{ ok: boolean; api_key?: string; error?: string }>(
                    `/connectors/${c.id}/regenerate-key`,
                    { method: "POST" }
                  );
                  if (r.api_key) {
                    setFreshKey({ id: c.id, key: r.api_key });
                    setOpenType(c.type);
                    toast.success("Nayi key ban gayi 🔑 — purani ab kaam nahi karegi");
                  } else {
                    toast.error(r.error ?? "Key nahi bani");
                  }
                  connectors.refetch();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Key nahi bani");
                }
              };
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 p-2 text-xs">
                  <span className="font-semibold">{label}</span>
                  {statusChip(c.status)}
                  {c.key_hint && (
                    <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      key {c.key_hint}
                    </code>
                  )}
                  <span className="ml-auto opacity-70">
                    {c.rows_synced} rows{c.last_sync_at ? ` • ${fmtTime(c.last_sync_at)}` : ""}
                  </span>
                  {c.type === "google_sheets" && (
                    <Button variant="outline" className="px-2 py-1 text-[11px]" onClick={() => syncNow(c.id)}>
                      Sync now
                    </Button>
                  )}
                  {c.has_key && (
                    <Button variant="outline" className="px-2 py-1 text-[11px]" onClick={regen}>
                      Nayi key
                    </Button>
                  )}
                  <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => remove(c.id)}>
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- direct entry grid ---------- */

type GridType = "sale" | "purchase" | "expense";

interface GridRowState {
  key: number;
  date: string;
  product: string;
  qty: string;
  price: string;
  customer: string;
  type: GridType;
  fromScan?: boolean;
}

type CellErrors = Record<number, Partial<Record<"date" | "product" | "qty" | "price", string>>>;

const GRID_TYPES: GridType[] = ["sale", "purchase", "expense"];

function todayISO(): string {
  try {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

let gridKey = 1;
function blankRow(): GridRowState {
  return { key: gridKey++, date: todayISO(), product: "", qty: "", price: "", customer: "", type: "sale" };
}

function validateGridRow(r: GridRowState): Partial<Record<"date" | "product" | "qty" | "price", string>> {
  const e: Partial<Record<"date" | "product" | "qty" | "price", string>> = {};
  if (!r.date.trim() || Number.isNaN(Date.parse(r.date.trim()))) e.date = "Sahi date daalo (YYYY-MM-DD)";
  if (!r.product.trim()) e.product = "Product chuno ya naya likho";
  const price = Number(String(r.price).replace(/,/g, "").trim());
  if (!r.price.trim() || Number.isNaN(price) || price <= 0) e.price = "Sahi price daalo (> 0)";
  if (r.type !== "expense") {
    const qty = Number(String(r.qty).replace(/,/g, "").trim());
    if (!r.qty.trim() || Number.isNaN(qty) || qty <= 0) e.qty = "Sahi qty daalo (> 0)";
  } else if (r.qty.trim()) {
    const qty = Number(String(r.qty).replace(/,/g, "").trim());
    if (Number.isNaN(qty) || qty <= 0) e.qty = "Sahi qty daalo (> 0)";
  }
  return e;
}

const GRID_COLS: { letter: string; label: string; hint: string }[] = [
  { letter: "A", label: "Date", hint: "YYYY-MM-DD" },
  { letter: "B", label: "Product", hint: "sale: item • purchase: stock • expense: head" },
  { letter: "C", label: "Qty", hint: "sale/purchase me zaroori" },
  { letter: "D", label: "Unit Price", hint: "₹ me" },
  { letter: "E", label: "Customer", hint: "sale: grahak • expense: note" },
  { letter: "F", label: "Type", hint: "sale / purchase / expense" },
];

/* ---------- scan bill modal (camera -> /documents/upload -> grid rows) ---------- */

interface ScanMappedRow {
  date: string;
  product: string;
  qty: string;
  price: string;
  customer: string;
  type: GridType;
}

function mapDocEntries(entries: DocEntry[]): { rows: ScanMappedRow[]; docTypeNote: string } {
  const rows: ScanMappedRow[] = [];
  let other = 0;
  for (const e of entries ?? []) {
    const et = String(e.entry_type ?? "SALE").toUpperCase();
    const type: GridType = et === "PURCHASE" ? "purchase" : "sale";
    if (et !== "SALE" && et !== "PURCHASE") other += 1;
    const qty = e.qty ?? null;
    const amount = e.amount ?? null;
    let price = "";
    if (amount !== null && amount !== undefined && String(amount) !== "") {
      const a = Number(amount);
      const q = qty !== null && qty !== undefined && String(qty) !== "" ? Number(qty) : NaN;
      price = !Number.isNaN(a) && !Number.isNaN(q) && q > 0 ? String(Math.round((a / q) * 100) / 100) : String(amount);
    }
    rows.push({
      date: e.date ? String(e.date).slice(0, 10) : todayISO(),
      product: e.item ? String(e.item) : "",
      qty: qty !== null && qty !== undefined && String(qty) !== "" ? String(qty) : "",
      price,
      customer: e.party_name ? String(e.party_name) : "",
      type,
    });
  }
  return { rows, docTypeNote: other > 0 ? `${other} udhaar-type entry sale me daali — theek kar lena` : "" };
}

function ScanBillModal({
  open,
  onClose,
  onEntries,
}: {
  open: boolean;
  onClose: () => void;
  onEntries: (rows: ScanMappedRow[], docId: number | null, note: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<"live" | "file" | "busy">("live");
  const [msg, setMsg] = useState("");
  const [noCamera, setNoCamera] = useState(false);

  const stopStream = () => {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setMsg("");
      setNoCamera(false);
      setMode("live");
      return;
    }
    setMsg("");
    setNoCamera(false);
    setMode("live");
    let cancelled = false;
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no-camera");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setNoCamera(true);
          setMode("file");
          setMsg("Camera ki permission nahi mili — neeche se photo file chuno 📁");
        }
      }
    };
    start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const uploadBlob = async (blob: Blob, name: string) => {
    setMode("busy");
    setMsg("Bill padh rahe hain… 🔍");
    try {
      const fd = new FormData();
      fd.append("file", blob, name);
      const r = await apiFetch<DocUploadResp>("/documents/upload", { method: "POST", body: fd });
      const mapped = mapDocEntries(r.entries ?? []);
      if (mapped.rows.length === 0) {
        setMsg("Bill me kuch padha nahi gaya — saaf photo lo ya haath se grid me likho 🙏");
        setMode(noCamera ? "file" : "live");
        return;
      }
      onEntries(mapped.rows, r.doc_id ?? null, mapped.docTypeNote);
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Scan fail ho gaya — dobara try karo");
      setMode(noCamera ? "file" : "live");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setMsg("Camera abhi taiyaar nahi — 2 sec ruk ke dobara dabao");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas nahi bana");
      ctx.drawImage(video, 0, 0);
      stopStream();
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setMsg("Photo nahi ban payi — dobara try karo");
            setMode("live");
            return;
          }
          uploadBlob(blob, "scan.jpg");
        },
        "image/jpeg",
        0.85
      );
    } catch {
      setMsg("Photo nahi ban payi — dobara try karo");
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    uploadBlob(f, f.name || "scan.jpg");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bill scan karo"
    >
      <div className="w-full max-w-[420px] rounded-2xl border border-zinc-700 bg-zinc-950 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-zinc-100">📷 Bill Scan</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scan"
            className="rounded-lg px-2 py-1 text-lg text-zinc-400 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>

        {mode === "live" && !noCamera && (
          <>
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
              <video ref={videoRef} playsInline muted autoPlay className="h-64 w-full object-cover" />
            </div>
            <Button className="mt-3 w-full py-3 text-base font-bold" onClick={capture}>
              📸 Capture
            </Button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className="mt-2 w-full text-center text-xs text-zinc-400 underline"
            >
              ya file se photo chuno
            </button>
          </>
        )}

        {mode === "busy" && (
          <div className="py-8 text-center">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 text-sm text-zinc-300">Bill padh rahe hain…</p>
          </div>
        )}

        {(mode === "file" || noCamera) && mode !== "busy" && (
          <label className="mt-1 block cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-200 hover:border-zinc-500">
            📁 Bill ki photo chuno
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {msg && <p className="mt-2 text-xs font-semibold text-amber-300">{msg}</p>}
        <p className="mt-2 text-[11px] text-zinc-500">
          Scan ke baad entries grid me aayengi (marigold) — check karke Save dabao.
        </p>
      </div>
    </div>
  );
}

function DirectEntryCard({ products, onSaved }: { products: ProductRow[]; onSaved: () => void }) {
  const [rows, setRows] = useState<GridRowState[]>(() => [blankRow(), blankRow(), blankRow()]);
  const [errors, setErrors] = useState<CellErrors>({});
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [customProducts, setCustomProducts] = useState<{ name: string; price: string }[]>([]);
  const [showMini, setShowMini] = useState<number | null>(null);
  const [miniName, setMiniName] = useState("");
  const [miniPrice, setMiniPrice] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanDocId, setScanDocId] = useState<number | null>(null);

  const onScanEntries = (mapped: ScanMappedRow[], docId: number | null, note: string) => {
    setRows((rs) => [
      ...rs,
      ...mapped.map((m) => ({ ...blankRow(), ...m, fromScan: true as boolean })),
    ]);
    setScanDocId(docId);
    toast.success(
      `${mapped.length} entries scan se grid me ✅${note ? ` — ${note}` : ""} (Documents wala pending bill DISCARD kar dena)`
    );
  };

  const productNames = [
    ...(products ?? []).map((p) => p.name).filter(Boolean),
    ...customProducts.map((c) => c.name),
  ];

  const setCell = (key: number, field: keyof GridRowState, value: string) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
    setErrors((es) => {
      if (!es[key]) return es;
      const next = { ...es };
      const rowErr = { ...next[key] } as Record<string, string>;
      delete rowErr[field as string];
      if (Object.keys(rowErr).length === 0) delete next[key];
      else next[key] = rowErr;
      return next;
    });
  };

  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const delRow = (key: number) => {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.key !== key)));
  };

  const confirmMini = (key: number) => {
    const name = miniName.trim();
    const price = miniPrice.trim();
    if (!name) {
      toast.error("Naye product ka naam likho");
      return;
    }
    if (!price || Number.isNaN(Number(price.replace(/,/g, ""))) || Number(price.replace(/,/g, "")) <= 0) {
      toast.error("Naye product ka sahi price likho");
      return;
    }
    setCustomProducts((cs) => (cs.some((c) => c.name === name) ? cs : [...cs, { name, price }]));
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, product: name, price } : r)));
    setShowMini(null);
    setMiniName("");
    setMiniPrice("");
  };

  const save = async () => {
    const errs: CellErrors = {};
    rows.forEach((r) => {
      const e = validateGridRow(r);
      if (Object.keys(e).length > 0) errs[r.key] = e;
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const n = Object.keys(errs).length;
      setSummary(`${n} row me error hai — laal cells theek karo, phir Save dabao`);
      toast.error("Grid me error hai — neeche dekho");
      return;
    }
    setSummary("");
    setSaving(true);
    try {
      const r = await apiFetch<IngestSummary>("/ingest/grid", {
        method: "POST",
        body: JSON.stringify({
          rows: rows.map(({ date, product, qty, price, customer, type }) => ({
            date, product, qty, unit_price: price, customer, type,
          })),
        }),
      });
      if (r.rows_inserted > 0) {
        toast.success(`${r.rows_inserted} rows saved ✅`);
        setRows([blankRow(), blankRow(), blankRow()]);
        if (scanDocId !== null) {
          // double-entry rokho: scan wala pending doc ab grid me save ho gaya
          try {
            await apiFetch(`/documents/${scanDocId}/reject`, { method: "POST" });
          } catch {
            /* best-effort — user Documents card se discard kar sakta hai */
          }
          setScanDocId(null);
        }
        onSaved();
      } else {
        toast.warning("Koi row save nahi hui — sab skipped");
      }
      if (r.warnings?.length) setSummary(`Warnings: ${r.warnings[0].slice(0, 140)}`);
      else setSummary("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save fail ho gaya");
    } finally {
      setSaving(false);
    }
  };

  const cellCls = (hasErr: boolean) =>
    `w-full bg-transparent px-2 py-1.5 text-xs outline-none placeholder:opacity-40 tabular-nums ${
      hasErr ? "border border-rose-500 rounded" : "border border-transparent"
    }`;

  return (
    <Card delay={0.06} hover>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h3 className="card-title">📝 Direct Entry — seedha likho, sync ho jayega</h3>
        <Button variant="outline" className="ml-auto px-3 py-1.5 text-xs" onClick={() => setScanOpen(true)}>
          📷 Scan Bill
        </Button>
      </div>
      <p className="card-sub mb-3">
        Excel jaisa grid — sale / purchase (stock khareed) / expense (kharcha). Purchase → khareed ledger me, expense ka head B column me likho.
      </p>
      <ScanBillModal open={scanOpen} onClose={() => setScanOpen(false)} onEntries={onScanEntries} />
      {/* horizontal scroll SIRF card ke andar — page scroll nahi hoga */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead>
            <tr className="bg-zinc-900/70 text-zinc-500">
              <th className="w-10 border border-zinc-800 px-2 py-1.5 text-center font-mono">#</th>
              {GRID_COLS.map((c) => (
                <th key={c.letter} className="border border-zinc-800 px-2 py-1.5" title={c.hint}>
                  <span className="mr-1.5 font-mono font-bold text-zinc-400">{c.letter}</span>
                  {c.label}
                </th>
              ))}
              <th className="w-12 border border-zinc-800 px-2 py-1.5 text-center">✕</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const re = errors[r.key] ?? {};
              const isNewChoice = r.product === "__new__";
              return (
                <tr
                  key={r.key}
                  className={`border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40 ${
                    r.fromScan ? "bg-amber-500/10" : ""
                  }`}
                >
                  <td className="border border-zinc-800 px-2 py-1.5 text-center font-mono text-zinc-500">
                    {i + 1}
                    {r.fromScan && (
                      <span className="mt-0.5 block rounded-full px-1 text-[9px] font-bold" style={{ background: "var(--marigold)", color: "#000" }}>
                        scan
                      </span>
                    )}
                  </td>
                  <td className="border border-zinc-800">
                    <input
                      className={`${cellCls(!!re.date)} font-mono`}
                      value={r.date}
                      placeholder="YYYY-MM-DD"
                      inputMode="numeric"
                      onChange={(e) => setCell(r.key, "date", e.target.value)}
                      aria-label={`Row ${i + 1} date`}
                    />
                  </td>
                  <td className="border border-zinc-800">
                    <select
                      className={`${cellCls(!!re.product)} ${isNewChoice ? "opacity-60" : ""}`}
                      value={productNames.includes(r.product) ? r.product : r.product ? "__typed__" : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__new__") {
                          setShowMini(r.key);
                          setMiniName("");
                          setMiniPrice(r.price);
                        } else if (v === "__typed__") {
                          /* free text already in input below */
                        } else {
                          setCell(r.key, "product", v);
                          const found = (products ?? []).find((p) => p.name === v);
                          if (found && !r.price) setCell(r.key, "price", String(found.sale_price));
                        }
                      }}
                      aria-label={`Row ${i + 1} product select`}
                    >
                      <option value="">— product —</option>
                      {productNames.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                      {r.product && !productNames.includes(r.product) && (
                        <option value="__typed__">{r.product} (likha hua)</option>
                      )}
                      <option value="__new__">➕ new product…</option>
                    </select>
                    <input
                      className={`${cellCls(!!re.product)} mt-0.5 border-t border-zinc-800/60`}
                      value={isNewChoice ? "" : r.product}
                      placeholder="ya naam likho"
                      onChange={(e) => setCell(r.key, "product", e.target.value)}
                      aria-label={`Row ${i + 1} product name`}
                    />
                  </td>
                  <td className="border border-zinc-800">
                    <input
                      className={`${cellCls(!!re.qty)} font-mono`}
                      value={r.qty}
                      placeholder={r.type === "expense" ? "(optional)" : "0"}
                      inputMode="decimal"
                      onChange={(e) => setCell(r.key, "qty", e.target.value)}
                      aria-label={`Row ${i + 1} qty`}
                    />
                  </td>
                  <td className="border border-zinc-800">
                    <input
                      className={`${cellCls(!!re.price)} font-mono`}
                      value={r.price}
                      placeholder="₹"
                      inputMode="decimal"
                      onChange={(e) => setCell(r.key, "price", e.target.value)}
                      aria-label={`Row ${i + 1} unit price`}
                    />
                  </td>
                  <td className="border border-zinc-800">
                    <input
                      className={cellCls(false)}
                      value={r.customer}
                      placeholder="grahak / note"
                      onChange={(e) => setCell(r.key, "customer", e.target.value)}
                      aria-label={`Row ${i + 1} customer`}
                    />
                  </td>
                  <td className="border border-zinc-800">
                    <select
                      className={cellCls(false)}
                      value={r.type}
                      onChange={(e) => setCell(r.key, "type", e.target.value)}
                      aria-label={`Row ${i + 1} type`}
                    >
                      {GRID_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-zinc-800 text-center">
                    <button
                      type="button"
                      onClick={() => delRow(r.key)}
                      aria-label={`Delete row ${i + 1}`}
                      className="rounded px-1.5 py-1 text-sm text-zinc-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showMini !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-zinc-700 p-2 text-xs">
          <span className="font-semibold">➕ Naya product:</span>
          <input
            className="rounded-lg border border-zinc-700 bg-transparent px-2 py-1.5 outline-none placeholder:opacity-40"
            placeholder="Naam"
            value={miniName}
            onChange={(e) => setMiniName(e.target.value)}
            aria-label="New product name"
          />
          <input
            className="w-28 rounded-lg border border-zinc-700 bg-transparent px-2 py-1.5 font-mono outline-none placeholder:opacity-40"
            placeholder="Price ₹"
            inputMode="decimal"
            value={miniPrice}
            onChange={(e) => setMiniPrice(e.target.value)}
            aria-label="New product price"
          />
          <Button className="px-3 py-1.5 text-xs" onClick={() => confirmMini(showMini)}>
            Add
          </Button>
          <Button variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => setShowMini(null)}>
            Cancel
          </Button>
        </div>
      )}

      {summary && <p className="mt-2 text-xs font-semibold text-amber-300">{summary}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={addRow}>
          + Add Row
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : `Save ${rows.length} rows ✅`}
        </Button>
      </div>
    </Card>
  );
}

/* ---------- computer pairing card (6-char code, token-copy khatm) ---------- */

function PairCodeCard() {
  const [code, setCode] = useState("");
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  const getCode = async () => {
    setBusy(true);
    try {
      const r = await apiFetch<{ ok: boolean; code?: string; expires_in?: number; error?: string }>(
        "/connectors/pair-code",
        { method: "POST" }
      );
      if (r.ok && r.code) {
        setCode(r.code);
        setSecs(r.expires_in ?? 600);
      } else {
        toast.error(r.error ?? "Code nahi bana");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Code nahi bana");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copy ho gaya 📋");
    } catch {
      toast.error("Copy nahi ho paya");
    }
  };

  return (
    <Card delay={0.08} hover>
      <p className="text-3xl" aria-hidden="true">💻</p>
      <h3 className="card-title mt-1">Computer se jodo</h3>
      <p className="card-sub mb-3">Tally / Excel / Busy — dukaan ke computer se auto-sync.</p>
      {!code || secs <= 0 ? (
        <Button onClick={getCode} disabled={busy} className="min-h-[44px]">
          {busy ? "…" : "Code dikhao"}
        </Button>
      ) : (
        <div>
          <button
            type="button"
            onClick={copy}
            className="rounded-xl border-2 border-dashed px-4 py-2 text-center font-mono text-2xl font-black tracking-[0.3em]"
            style={{ borderColor: "var(--brand, #e8771a)", color: "var(--ink)" }}
            aria-label="Pairing code, tap karke copy karo"
          >
            {code}
          </button>
          <p className="card-sub mt-2">
            Computer pe agent chalao, ye code dalo — bas. {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} min valid.
          </p>
        </div>
      )}
    </Card>
  );
}

/* ---------- main page ---------- */

const REFRESH_MS = 300000;
// Products/inventory come from the local sqlite ledger (Supabase realtime is
// not wired to it), so poll them fast — a new Tally item should appear in
// ~10s, not 5 minutes.
const LIVE_REFRESH_MS = 10000;

function DataPage() {
  const logs = useApi<IngestLog[]>("/ingest/logs", REFRESH_MS);
  const products = useApi<ProductRow[]>("/products", LIVE_REFRESH_MS);
  const files = useApi<FileRow[]>("/ingest/files", REFRESH_MS);
  // /me static hai — ek baar lao (stray 401 + auto-logout surface kam).
  const me = useApi<Me>("/me");
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([logs.refetch(), products.refetch(), files.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  useRealtime(
    ["ingestion_logs", "processed_files", "document_logs", "products", "inventory"],
    () => {
      logs.refetch();
      products.refetch();
      files.refetch();
    }
  );

  const showWizard = !!me.data && me.data.onboarded === false;

  const upload = async (file: File, endpoint: string, extra?: Record<string, string>) => {
    const fd = new FormData();
    fd.append("file", file);
    if (extra) for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    // NOTE: do NOT set Content-Type manually — browser sets multipart boundary
    return apiFetch<IngestSummary>(endpoint, { method: "POST", body: fd });
  };

  // Ek hi dropzone: .xml -> Tally, baaki sab auto-detect (type backend pehchanta hai)
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const isXml = f.name.toLowerCase().endsWith(".xml");
    setUploading(true);
    try {
      const r = isXml ? await upload(f, "/ingest/tally-xml") : await upload(f, "/ingest/upload");
      if (r.rows_inserted > 0) {
        const kind = (r.source_type || "").replace("_", " ");
        toast.success(`${r.rows_inserted} rows synced ✅${kind ? ` (${kind} samjha)` : ""}`);
      } else toast.warning("Koi nayi row nahi — sab skipped");
      if (r.warnings?.length) toast.warning(`${r.warnings.length} warnings: ${r.warnings[0].slice(0, 120)}`);
      logs.refetch();
      products.refetch();
      files.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fail ho gaya");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <FadeIn>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h1 className="text-xl font-bold text-zinc-50">Hisaab jodo 📥</h1>
            <p className="text-xs text-zinc-400">Koi ek rasta chuno — baaki hum sambhalenge.</p>
          </div>
          <Button
            variant="outline"
            className="ml-auto px-3 py-1.5 text-xs"
            onClick={refreshAll}
            disabled={refreshing}
          >
            {refreshing ? "↻ Refreshing…" : "↻ Refresh now"}
          </Button>
        </div>
      </FadeIn>

      {showWizard && (
        <FadeIn delay={0.02}>
          <Wizard
            onDone={() => {
              me.refetch();
              products.refetch();
              logs.refetch();
              files.refetch();
            }}
          />
        </FadeIn>
      )}

      {/* 3 aasaan raste — bas ek chuno */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card delay={0.02} hover className="ledger-top">
          <p className="text-3xl" aria-hidden="true">📱</p>
          <h3 className="card-title mt-1">WhatsApp pe bhejo</h3>
          <p className="card-sub mb-3">Sabse aasaan — bill photo, voice note ya text. Likhne ki zaroorat nahi.</p>
          <Link
            href="/app/chat"
            className="btn-primary inline-block min-h-[44px] px-4 py-2.5 text-sm font-semibold"
            style={{ textDecoration: "none" }}
          >
            Chat kholo →
          </Link>
        </Card>
        <Card delay={0.05} hover>
          <p className="text-3xl" aria-hidden="true">📄</p>
          <h3 className="card-title mt-1">File lao</h3>
          <p className="card-sub mb-3">Excel, CSV ya Tally XML — type hum pehchan lenge.</p>
          <DropLabel primary accept=".csv,.xlsx,.xls,.xml" busy={uploading} busyLabel="Padh rahe…" onFile={onFile}>
            File chuno
          </DropLabel>
        </Card>
        <PairCodeCard />
      </div>

      <DirectEntryCard
        products={products.data ?? []}
        onSaved={() => {
          logs.refetch();
          products.refetch();
          files.refetch();
        }}
      />

      <details className="group rounded-2xl border border-zinc-800 p-1">
        <summary className="cursor-pointer list-none rounded-xl px-3 py-3 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/60">
          <span aria-hidden="true">⚙️</span> Aur tareeke + purana hisab
          <span className="card-sub ml-2">Sheets • Zapier • dukaan apps • bills • tables</span>
        </summary>
        <div className="space-y-5 p-2">
          <ConnectorsCard meId={me.data?.id} />

          <DocumentsCard />

      <FadeIn delay={0.1}>
        <Card>
          <h3 className="card-title">🔄 Auto-sync ON — ./watch folder monitor ho raha hai</h3>
          <p className="card-sub mt-1">CSV file wahan daalo, apne aap sync. Kuch karne ki zaroorat nahi.</p>
        </Card>
      </FadeIn>

      <FadeIn delay={0.11}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Processed files — restart-safe ledger
        </h2>
        {files.loading && !files.data ? (
          <SkeletonCard lines={3} />
        ) : files.error || !files.data ? (
          <ErrorBanner message={files.error ?? "Ledger nahi mila"} onRetry={files.refetch} />
        ) : files.data.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-400">Abhi koi watch-file process nahi hui — ./watch me file daalo 📥</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">SHA</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Rows</th>
                  <th className="px-3 py-2">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {files.data.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/60">
                    <td className="px-3 py-2 text-zinc-400">{fmtTime(f.created_at)}</td>
                    <td className="px-3 py-2 text-zinc-200">{f.filename}</td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{f.sha8}</td>
                    <td className="px-3 py-2">
                      <FileStamp status={f.status} />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-300">
                      {f.rows_inserted}
                    </td>
                    <td
                      className="max-w-[220px] truncate px-3 py-2 text-zinc-500"
                      title={(f.warnings ?? []).join("\n")}
                    >
                      {(f.warnings ?? []).length ? `${f.warnings.length} warning(s)` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-[11px] text-zinc-600">restart-safe: har file ka ledger — same file dobara ingest nahi hoti.</p>
      </FadeIn>

      <FadeIn delay={0.12}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Sync log</h2>
        {logs.loading && !logs.data ? (
          <SkeletonCard lines={4} />
        ) : logs.error || !logs.data ? (
          <ErrorBanner message={logs.error ?? "Sync log nahi mila"} onRetry={logs.refetch} />
        ) : logs.data.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-400">अभी कोई sync नहीं हुआ — pehli file upload karo 📤</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2 text-right">Inserted</th>
                  <th className="px-3 py-2 text-right">Skipped</th>
                  <th className="px-3 py-2">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((l) => (
                  <tr key={l.id} className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/60">
                    <td className="px-3 py-2 text-zinc-400">{fmtTime(l.created_at)}</td>
                    <td className="px-3 py-2">
                      <Badge>{l.source_type}</Badge>
                    </td>
                    <td className="px-3 py-2 text-zinc-200">{l.filename}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-300">
                      {l.rows_inserted}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-300">{l.rows_skipped}</td>
                    <td
                      className="max-w-[220px] truncate px-3 py-2 text-zinc-500"
                      title={(l.warnings ?? []).join("\n")}
                    >
                      {(l.warnings ?? []).length ? `${l.warnings.length} warning(s)` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FadeIn>

      <FadeIn delay={0.14}>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">Products</h2>
        {products.loading && !products.data ? (
          <SkeletonCard lines={5} />
        ) : products.error || !products.data ? (
          <ErrorBanner message={products.error ?? "Products nahi mile"} onRetry={products.refetch} />
        ) : products.data.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-400">अभी कोई डेटा नहीं — pehle CSV upload karo 📦</p>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500">
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Sale</th>
                  <th className="px-3 py-2 text-right">Purchase</th>
                  <th className="px-3 py-2 text-right">Stock / Reorder</th>
                </tr>
              </thead>
              <tbody>
                {products.data.map((p) => {
                  const low = p.stock_qty < p.reorder_level;
                  const warn = !low && p.stock_qty < p.reorder_level * 1.5;
                  return (
                    <tr
                      key={p.sku}
                      className={`border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/60 ${
                        low ? "bg-rose-500/5" : warn ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-zinc-300">{p.sku}</td>
                      <td className="px-3 py-2 text-zinc-100">{p.name}</td>
                      <td className="px-3 py-2 text-zinc-400">{p.category}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-200">{inr(p.sale_price)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">{inr(p.purchase_price)}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          low ? "text-rose-300" : warn ? "text-amber-300" : "text-emerald-300"
                        }`}
                      >
                        {p.stock_qty} / {p.reorder_level}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FadeIn>
    </div>
  </details>
  </div>
  );
}

export default DataPage;
