"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorBanner, FadeIn } from "@/components/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
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
          ? { background: "linear-gradient(135deg, var(--accent), #0d7a55)", color: "#fff" }
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
}

const STATUS_TONE: Record<string, string> = {
  live: "var(--accent)",
  polling: "var(--marigold)",
  offline: "var(--ink-faint)",
  error: "var(--rose, #f43f5e)",
};

function ConnectorsCard({ meId }: { meId: number | undefined }) {
  const connectors = useApi<Connector[]>("/connectors", 300000);
  const [tab, setTab] = useState<"google_sheets" | "excel_agent" | "tally_agent">("google_sheets");
  const [sheetLink, setSheetLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useRealtime(["connectors", "ingestion_logs"], () => connectors.refetch());

  const extractSheetId = (link: string): string => {
    const m = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : link.trim();
  };

  const connectSheets = async () => {
    const id = extractSheetId(sheetLink);
    if (!id) {
      toast.error("Sahi Google Sheets link daalo");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      await apiFetch("/connectors", {
        method: "POST",
        body: JSON.stringify({ type: "google_sheets", config: { sheet_id: id, range: "A1:Z1000" } }),
      });
      toast.success("Sheets connector live ✅");
      setSheetLink("");
      connectors.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Connect nahi hua");
    } finally {
      setBusy(false);
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
      <h3 className="card-title">🔌 Live Connectors</h3>
      <p className="card-sub mb-3">Google Sheets auto-sync • Excel/Tally local agent se</p>

      <div className="mb-3 flex gap-1.5">
        {(["google_sheets", "excel_agent", "tally_agent"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={
              tab === t
                ? { background: "var(--accent)", color: "#fff" }
                : { border: "1px solid var(--card-border)" }
            }
          >
            {t === "google_sheets" ? "Sheets" : t === "excel_agent" ? "Excel" : "Tally"}
          </button>
        ))}
      </div>

      {tab === "google_sheets" && (
        <div className="mb-3 space-y-2">
          <label htmlFor="sheet-link" className="block text-sm font-semibold">Google Sheets link</label>
          <input
            id="sheet-link"
            className="w-full rounded-xl border bg-transparent px-3 py-2 text-base outline-none"
            style={{ borderColor: "var(--card-border)" }}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={sheetLink}
            onChange={(e) => setSheetLink(e.target.value)}
            inputMode="url"
          />
          <div className="flex items-center gap-2">
            <Button onClick={connectSheets} disabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </Button>
            {msg && <span className="text-xs opacity-70">{msg}</span>}
          </div>
          <p className="text-[11px] opacity-60">
            Sheet public honi chahiye (private sheets ke liye OAuth deferred). Backend har 60s poll karta hai.
          </p>
        </div>
      )}

      {tab === "excel_agent" && (
        <div className="mb-3 rounded-xl border border-zinc-800 p-3 text-xs">
          <p className="mb-1 font-semibold">Excel local agent (watch folder → auto-ingest)</p>
          <pre className="overflow-auto rounded-lg bg-zinc-900 p-2 text-[11px] text-zinc-300">
{`cd backend
set BACKEND_URL=http://localhost:8000
set TOKEN_FILE=.\connectors\\token.txt
python connectors\\excel_sync.py`}
          </pre>
          <p className="mt-1 opacity-60">Token: pehle /login karo, JWT ko connectors/token.txt me save karo.</p>
        </div>
      )}

      {tab === "tally_agent" && (
        <div className="mb-3 rounded-xl border border-zinc-800 p-3 text-xs">
          <p className="mb-1 font-semibold">Tally local agent (localhost:9000 → auto-ingest)</p>
          <pre className="overflow-auto rounded-lg bg-zinc-900 p-2 text-[11px] text-zinc-300">
{`cd backend
set TALLY_URL=http://localhost:9000
set BACKEND_URL=http://localhost:8000
python connectors\\tally_sync.py`}
          </pre>
          <p className="mt-1 opacity-60">Tally ODBC/port 9000 pe chalu karo. Day Book vouchers sync hote hain.</p>
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
          <p className="text-xs text-zinc-500">Abhi koi connector nahi — upar se Sheets link daalo ya agent chalao.</p>
        ) : (
          <div className="space-y-2">
            {connectors.data.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 p-2 text-xs">
                <span className="font-semibold">{c.type === "google_sheets" ? "Sheets" : c.type === "excel_agent" ? "Excel" : "Tally"}</span>
                {statusChip(c.status)}
                <span className="ml-auto opacity-70">
                  {c.rows_synced} rows{c.last_sync_at ? ` • ${fmtTime(c.last_sync_at)}` : ""}
                </span>
                {c.type === "google_sheets" && (
                  <Button variant="outline" className="px-2 py-1 text-[11px]" onClick={() => syncNow(c.id)}>
                    Sync now
                  </Button>
                )}
                <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => remove(c.id)}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- main page ---------- */

export default function DataPage() {
  const logs = useApi<IngestLog[]>("/ingest/logs", 300000);
  const products = useApi<ProductRow[]>("/products", 300000);
  const files = useApi<FileRow[]>("/ingest/files", 300000);
  const me = useApi<Me>("/me", 300000);
  const [upType, setUpType] = useState("sales");
  const [uploading, setUploading] = useState(false);
  const [tallyUploading, setTallyUploading] = useState(false);

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

  const onCsv = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      const r = await upload(f, "/ingest/upload", { type: upType });
      if (r.rows_inserted > 0) toast.success(`${r.rows_inserted} rows synced ✅`);
      else toast.warning("Koi nayi row nahi — sab skipped");
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

  const onTally = async (f: File | undefined) => {
    if (!f) return;
    setTallyUploading(true);
    try {
      const r = await upload(f, "/ingest/tally-xml");
      toast.success(`${r.rows_inserted} rows synced ✅`);
      logs.refetch();
      products.refetch();
      files.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tally upload fail ho gaya");
    } finally {
      setTallyUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <FadeIn>
        <h1 className="text-xl font-bold text-zinc-50">Data & Sync</h1>
        <p className="text-xs text-zinc-400">CSV/Excel/Tally lao — sab apne aap sync.</p>
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

      <div className="grid gap-3 md:grid-cols-2">
        <Card delay={0.05} hover>
          <h3 className="card-title">📄 CSV / Excel upload</h3>
          <p className="card-sub mb-3">sales • inventory • receivables • expenses • products</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={upType} onChange={(e) => setUpType(e.target.value)}>
              {UPLOAD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <DropLabel primary accept=".csv,.xlsx,.xls" busy={uploading} busyLabel="Uploading…" onFile={onCsv}>
              Choose file
            </DropLabel>
          </div>
        </Card>
        <Card delay={0.1} hover>
          <h3 className="card-title">🧾 Tally XML</h3>
          <p className="card-sub mb-3">Tally se export kiya XML seedha sync karo</p>
          <DropLabel accept=".xml" busy={tallyUploading} busyLabel="Uploading…" onFile={onTally}>
            Choose Tally XML
          </DropLabel>
        </Card>
      </div>

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
  );
}
