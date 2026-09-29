"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

interface Owner {
  id: number;
  phone: string;
  name: string | null;
  business_name: string | null;
  business_type: string | null;
  language: string;
  allowed: boolean;
  distributor_phone: string | null;
  distributors: string[];
}

export default function AdminPage() {
  const [pending, setPending] = useState<Owner[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const me = await apiFetch<{ is_admin: boolean }>("/me");
      if (!me?.is_admin) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
      const rows = await apiFetch<Owner[]>("/owners?status=pending");
      setPending(Array.isArray(rows) ? rows : []);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Realtime: pending card appears instantly + toast on new registration
  useRealtime(["owner_profiles"], (p) => {
    load();
    try {
      if (p && p.eventType === "INSERT") {
        const row = (p.new || {}) as Record<string, unknown>;
        if (row.allowed === false) {
          toast.success(`🆕 Nayi registration: ${String(row.name || row.phone || "")}`);
        }
      }
    } catch {
      /* ignore */
    }
  });

  // 300s safety poll fallback
  useEffect(() => {
    const t = setInterval(load, 300000);
    return () => clearInterval(t);
  }, []);

  async function decide(id: number, ok: boolean) {
    try {
      await apiFetch(`/owners/${id}/${ok ? "approve" : "reject"}`, { method: "POST" });
      toast.success(ok ? "Approved 🎉" : "Rejected");
      setPending((p) => p.filter((o) => o.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nahi ho paya");
    }
  }

  if (loading) return <main className="p-6">Load ho raha...</main>;
  if (isAdmin === false)
    return (
      <main className="p-6">
        <Card className="p-6">Sirf admin dekh sakta hai. Pehle admin number se /login karo.</Card>
      </main>
    );

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <ShieldCheck size={20} /> Pending registrations ({pending.length})
      </h1>
      {pending.length === 0 && <Card className="p-6">Koi pending request nahi 🎉</Card>}
      <AnimatePresence>
        {pending.map((o) => (
          <motion.div key={o.id} layout exit={{ opacity: 0, x: 60 }}>
            <Card className="p-4 space-y-2">
              <p className="font-semibold">{o.name || "(naam nahi)"}</p>
              <p className="text-sm opacity-80">
                {o.business_name || "-"} • {o.phone} • {o.language}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {o.business_type && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                    {o.business_type}
                  </span>
                )}
                {(o.distributors && o.distributors.length > 0
                  ? o.distributors
                  : o.distributor_phone
                    ? [o.distributor_phone]
                    : []
                ).map((d) => (
                  <span key={d} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ border: "1px solid var(--card-border)" }}>
                    {d}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button className="px-3 py-1.5" onClick={() => decide(o.id, true)}>
                  <Check size={14} className="mr-1" /> APPROVE
                </Button>
                <Button className="px-3 py-1.5" variant="outline" onClick={() => decide(o.id, false)}>
                  <X size={14} className="mr-1" /> REJECT
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </main>
  );
}
