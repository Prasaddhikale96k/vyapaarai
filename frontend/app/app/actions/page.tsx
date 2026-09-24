"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { ErrorBanner, FadeIn } from "@/components/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { SkeletonCard } from "@/components/ui/skeleton";
import { apiFetch, inr, useApi, type ActionItem } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "sent", label: "Sent" },
  { key: "rejected", label: "Rejected" },
];

const typeTone: Record<string, "rose" | "sky" | "violet" | "zinc"> = {
  payment_reminder: "rose",
  reorder: "sky",
  discount_offer: "violet",
};

function ActionCard({
  a,
  i,
  onDone,
}: {
  a: ActionItem;
  i: number;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const actionable = a.status === "pending";
  const upiLink = (() => {
    try {
      const m = String(a.draft_message ?? "").match(/upi:\/\/[^\s"']+/);
      return m ? m[0] : null;
    } catch {
      return null;
    }
  })();

  const [slammed, setSlammed] = useState<string | null>(null);

  const act = async (kind: "approve" | "reject") => {
    setBusy(true);
    try {
      const res = await apiFetch<{ status: string; delivery?: { simulated?: boolean } }>(
        `/actions/${a.id}/${kind}`,
        { method: "POST" }
      );
      if (kind === "approve") {
        try {
          confetti({ particleCount: 55, spread: 65, origin: { y: 0.7 }, disableForReducedMotion: true });
        } catch {
          /* ignore */
        }
        setSlammed("APPROVED");
        toast.success(
          res.delivery?.simulated
            ? "Approved — delivery simulated (WhatsApp connect karo)"
            : "Approved & sent on WhatsApp ✅"
        );
      } else {
        setSlammed("REJECTED");
        toast.success("Rejected");
      }
      setTimeout(onDone, 650);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action fail ho gaya");
    } finally {
      setBusy(false);
    }
  };

  const bars = Array.from({ length: 28 }, (_, i) => 1 + ((a.id * 7 + i * 13) % 4));

  return (
    <Card delay={0.05 * i} hover className="relative overflow-hidden">
      {/* perforated receipt edges */}
      <div className="pointer-events-none absolute inset-x-3 top-0 border-t-2 border-dashed" style={{ borderColor: "var(--card-border)" }} />
      <div className="pointer-events-none absolute inset-x-3 bottom-0 border-b-2 border-dashed" style={{ borderColor: "var(--card-border)" }} />
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Badge tone={typeTone[a.type] ?? "zinc"}>{a.type}</Badge>
        {a.amount !== null && a.amount !== undefined && (
          <span className="tnum ml-auto font-mono text-2xl font-bold" style={{ color: "var(--ink)" }}>{inr(a.amount)}</span>
        )}
      </div>
      <h3 className="mt-2 text-sm font-semibold" style={{ color: "var(--ink)" }}>{a.title}</h3>
      {a.draft_message && (
        <div className="mt-2 rounded-lg px-3 py-2 font-mono text-[11px] leading-relaxed"
          style={{ background: "color-mix(in srgb, var(--paper) 60%, var(--card))", color: "var(--ink-soft)", border: "1px dashed var(--card-border)" }}>
          {a.draft_message}
        </div>
      )}
      {upiLink && (
        <motion.a
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          href={upiLink}
          className="mt-2 inline-block rounded-full px-3 py-1.5 text-xs font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          💳 Open UPI link
        </motion.a>
      )}
      {(a.target_name || a.target_phone) && (
        <p className="mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
          {a.target_name}
          {a.target_phone ? ` • ${a.target_phone}` : ""}
        </p>
      )}
      {/* barcode strip */}
      <div className="mt-2 flex h-6 items-stretch gap-[2px]" aria-hidden>
        {bars.map((w, bi) => (
          <span key={bi} style={{ width: w, background: "var(--ink)", opacity: 0.75 }} />
        ))}
        <span className="tnum ml-2 self-center text-[10px]" style={{ color: "var(--ink-faint)" }}>#{a.id}</span>
      </div>
      {/* status stamp */}
      <div className="pointer-events-none absolute right-3 top-3">
        <motion.span
          key={slammed ?? a.status}
          initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -10 }}
          transition={{ type: "spring", stiffness: 380, damping: 15 }}
          className="inline-block rounded border-[2.5px] px-2 py-0.5 text-[11px] font-black uppercase tracking-widest"
          style={{
            borderColor: slammed === "APPROVED" || a.status === "sent" || a.status === "approved" ? "var(--accent)"
              : slammed === "REJECTED" || a.status === "rejected" ? "var(--rose)" : "var(--marigold)",
            color: slammed === "APPROVED" || a.status === "sent" || a.status === "approved" ? "var(--accent)"
              : slammed === "REJECTED" || a.status === "rejected" ? "var(--rose)" : "var(--marigold)",
          }}
        >
          {slammed ?? a.status}
        </motion.span>
      </div>
      {actionable && !slammed && (
        <div className="mt-3 flex gap-2">
          <motion.div whileTap={{ scale: 0.95 }} className="flex-1">
            <Button onClick={() => act("approve")} disabled={busy} className="w-full">
              {busy ? "…" : "APPROVE"}
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" onClick={() => act("reject")} disabled={busy}>
              {busy ? "…" : "REJECT"}
            </Button>
          </motion.div>
        </div>
      )}
    </Card>
  );
}

export default function ActionsPage() {
  const [tab, setTab] = useState("pending");
  const [generating, setGenerating] = useState(false);
  const { data, loading, error, refetch } = useApi<ActionItem[]>(`/actions?status=${tab}`, 300000);

  useRealtime(["actions"], () => refetch());

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await apiFetch<{ created: number }>("/actions/generate", { method: "POST" });
      toast.success(`+${r.created} recommendations`);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate fail ho gaya");
    } finally {
      setGenerating(false);
    }
  };

  const onDone = () => {
    // item moved to another tab → refresh current list
    refetch();
  };

  return (
    <div className="space-y-4">
      <FadeIn>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-50">Action Copilot</h1>
            <p className="text-xs text-zinc-400">AI suggests. Owner decides.</p>
          </div>
          <Button onClick={generate} disabled={generating} className="ml-auto">
            {generating ? "Generating…" : "⚡ Generate"}
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </FadeIn>

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error || !data ? (
        <ErrorBanner message={error ?? "Actions nahi mile"} onRetry={refetch} />
      ) : data.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-400">
            {tab === "pending"
              ? "अभी कोई pending action नहीं — Generate dabao ⚡"
              : `अभी कोई ${tab} action नहीं`}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((a, i) => (
            <ActionCard key={a.id} a={a} i={i} onDone={onDone} />
          ))}
        </div>
      )}
    </div>
  );
}
