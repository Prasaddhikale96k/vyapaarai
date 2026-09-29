"use client";

/* Hidden OPS console (one-shot P1): NOT linked from product UI.
 * Owners list (suspend/restore as emergency ops override) + connectors status
 * + system health. No approval gate exists — OTP verify activates owners. */

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface Owner {
  id: number;
  phone: string;
  name: string | null;
  business_name: string | null;
  business_type: string | null;
  language: string;
  allowed: boolean;
  onboarded: boolean;
  distributors: string[];
}

interface ConnectorRow {
  id: number;
  type: string;
  status: string;
  last_sync_at: string | null;
  rows_synced: number;
}

interface ReadyState {
  db?: string;
  watch_dir?: boolean;
}

export default function OpsConsolePage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const me = await apiFetch<{ is_admin: boolean }>("/me");
      if (!me?.is_admin) {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);
      const [o, c, h] = await Promise.all([
        apiFetch<Owner[]>("/owners").catch(() => []),
        apiFetch<ConnectorRow[]>("/connectors").catch(() => []),
        apiFetch<ReadyState>("/health/ready").catch(() => null),
      ]);
      setOwners(Array.isArray(o) ? o : []);
      setConnectors(Array.isArray(c) ? c : []);
      setReady(h);
    } catch {
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setInterval(load, 300000);
    return () => clearInterval(t);
  }, []);

  async function override(id: number, allow: boolean) {
    setBusyId(id);
    try {
      await apiFetch(`/owners/${id}/${allow ? "approve" : "reject"}`, { method: "POST" });
      toast.success(allow ? "Restored (ops override)" : "Suspended (ops override)");
      setOwners((os) => os.map((o) => (o.id === id ? { ...o, allowed: allow } : o)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nahi ho paya");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <main className="p-6">Load ho raha...</main>;
  if (isAdmin === false)
    return (
      <main className="p-6">
        <Card className="p-6">Sirf ops dekh sakta hai. Pehle admin number se /login karo.</Card>
      </main>
    );

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <ShieldCheck size={20} /> Ops console <span className="text-xs font-normal opacity-60">(hidden — no product link)</span>
      </h1>

      <Card className="p-4">
        <h2 className="text-sm font-bold mb-2">System health</h2>
        <p className="text-sm opacity-80">
          DB: {ready?.db ?? "—"} • watch_dir: {ready?.watch_dir === undefined ? "—" : ready.watch_dir ? "ok" : "missing"}
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-bold mb-2">Connectors ({connectors.length})</h2>
        {connectors.length === 0 ? (
          <p className="text-sm opacity-60">Koi connector nahi.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {connectors.map((c) => (
              <p key={c.id} className="opacity-80">
                #{c.id} {c.type} • <span className="font-semibold">{c.status}</span> • {c.rows_synced} rows
                {c.last_sync_at ? ` • ${c.last_sync_at.slice(0, 16).replace("T", " ")}` : ""}
              </p>
            ))}
          </div>
        )}
      </Card>

      <h2 className="text-sm font-bold">Owners ({owners.length}) — suspend/restore = emergency ops override</h2>
      {owners.map((o) => (
        <Card key={o.id} className="p-4 space-y-2">
          <p className="font-semibold">
            {o.name || "(naam nahi)"}{" "}
            <span className={`text-xs font-bold ${o.allowed ? "text-emerald-400" : "text-rose-400"}`}>
              {o.allowed ? "ACTIVE" : "SUSPENDED"}
            </span>
            {!o.onboarded && <span className="text-xs opacity-60"> • not onboarded</span>}
          </p>
          <p className="text-sm opacity-80">
            {o.business_name || "-"} • {o.phone} • {o.business_type || "-"} • {o.language}
          </p>
          <div className="flex gap-2">
            {o.allowed ? (
              <Button className="px-3 py-1.5" variant="outline" disabled={busyId === o.id} onClick={() => override(o.id, false)}>
                SUSPEND
              </Button>
            ) : (
              <Button className="px-3 py-1.5" disabled={busyId === o.id} onClick={() => override(o.id, true)}>
                RESTORE
              </Button>
            )}
          </div>
        </Card>
      ))}
    </main>
  );
}
