"use client";

/* Contacts + supplier messaging (one-shot P2): kind-grouped list, add form,
 * per-contact composer with quick templates, send via bridge + signature.
 * Send history = last-5 per contact on THIS device (localStorage). */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";

interface Contact {
  id: number;
  kind: string;
  name: string;
  phone: string;
  note: string;
  created_at: string | null;
}

const KINDS = ["supplier", "customer", "distributor", "other"];

const KIND_LABEL: Record<string, string> = {
  supplier: "Supplier",
  customer: "Grahak",
  distributor: "Distributor",
  other: "Other",
};

const TPL_REORDER = "Reorder: {product} {qty} bhejiye";
const TPL_PAYMENT = "Payment update: ...";

const HIST_KEY = "vyapaarai_contact_hist";

function loadHist(): Record<number, string[]> {
  try {
    const raw = window.localStorage.getItem(HIST_KEY);
    const j = raw ? JSON.parse(raw) : {};
    return typeof j === "object" && j ? j : {};
  } catch {
    return {};
  }
}

function pushHist(id: number, msg: string) {
  try {
    const h = loadHist();
    const arr = [msg, ...(h[id] ?? [])].slice(0, 5);
    h[id] = arr;
    window.localStorage.setItem(HIST_KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
}

function Composer({ c, onSent }: { c: Contact; onSent: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<string[]>([]);

  useEffect(() => {
    setHist(loadHist()[c.id] ?? []);
  }, [c.id]);

  const send = async () => {
    if (!msg.trim()) {
      toast.error("Message khaali hai — kuch likho");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ status: string; error?: string }>(`/contacts/${c.id}/send`, {
        method: "POST",
        body: JSON.stringify({ message: msg.trim() }),
      });
      if (r.status === "sent") {
        toast.success("WhatsApp pe bhej diya ✅");
        pushHist(c.id, msg.trim());
        setHist(loadHist()[c.id] ?? []);
        setMsg("");
        onSent();
      } else {
        toast.warning(r.error || "Gateway down — message nahi gaya (simulated)");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bhej nahi paye");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-zinc-800 p-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setMsg(TPL_REORDER)}
          className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
        >
          📦 Reorder template
        </button>
        <button
          type="button"
          onClick={() => setMsg(TPL_PAYMENT)}
          className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
        >
          💰 Payment template
        </button>
      </div>
      <textarea
        className="w-full rounded-xl border border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-40"
        rows={2}
        placeholder="Message likho… (signature auto-judega)"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        aria-label={`Message to ${c.name}`}
      />
      <Button className="px-4 py-1.5 text-xs" disabled={busy} onClick={send}>
        {busy ? "Bhej rahe…" : "WhatsApp pe bhejo 📲"}
      </Button>
      {hist.length > 0 && (
        <div className="text-[11px] text-zinc-500">
          <p className="font-semibold uppercase tracking-wide">Last sends (is device par):</p>
          {hist.map((h, i) => (
            <p key={i} className="truncate" title={h}>
              • {h.slice(0, 80)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", kind: "supplier", note: "" });
  const [formErr, setFormErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await apiFetch<Contact[]>("/contacts");
      setContacts(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Contacts nahi mile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (form.name.trim().length < 2) {
      setFormErr("Naam kam se kam 2 akshar likho");
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 10) {
      setFormErr("Sahi 10–13 digit phone daalo");
      return;
    }
    setFormErr("");
    setAdding(true);
    try {
      const c = await apiFetch<Contact>("/contacts", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Contact jud gaya ✅");
      setContacts((cs) => [...cs, c]);
      setForm({ name: "", phone: "", kind: "supplier", note: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add nahi ho paya");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      toast.success("Contact hata diya");
      setContacts((cs) => cs.filter((c) => c.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete nahi hua");
    }
  };

  const grouped: Record<string, Contact[]> = {};
  for (const c of contacts) {
    const k = KIND_LABEL[c.kind] ? c.kind : "other";
    (grouped[k] = grouped[k] ?? []).push(c);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-zinc-50">Contacts</h1>
        <p className="text-xs text-zinc-400">Supplier / grahak / distributor — seedha WhatsApp message bhejo.</p>
      </div>

      <Card>
        <h3 className="card-title mb-3">➕ Naya contact</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <label htmlFor="ct-name" className="mb-1 block text-xs font-semibold text-zinc-400">Naam *</label>
            <Input id="ct-name" placeholder="Supplier ka naam" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          </div>
          <div>
            <label htmlFor="ct-phone" className="mb-1 block text-xs font-semibold text-zinc-400">Phone *</label>
            <Input id="ct-phone" placeholder="10-digit mobile" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
          </div>
          <div>
            <label htmlFor="ct-kind" className="mb-1 block text-xs font-semibold text-zinc-400">Type</label>
            <Select id="ct-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="ct-note" className="mb-1 block text-xs font-semibold text-zinc-400">Note</label>
            <Input id="ct-note" placeholder="e.g. Atta supplier" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
        </div>
        {formErr && <p className="mt-2 text-xs font-semibold text-rose-400">{formErr}</p>}
        <Button className="mt-3 px-4 py-1.5 text-xs" disabled={adding} onClick={add}>
          {adding ? "Jud raha…" : "Contact jodo ✅"}
        </Button>
      </Card>

      {loading ? (
        <Card><p className="text-sm text-zinc-400">Load ho raha…</p></Card>
      ) : contacts.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-300">📭 Abhi koi contact nahi — upar se pehla supplier jodo,</p>
          <p className="text-xs text-zinc-500">phir yahin se reorder/payment message bhejo. Products/customers se bane contacts apne aap yahan aayenge.</p>
        </Card>
      ) : (
        KINDS.filter((k) => (grouped[k] ?? []).length > 0).map((k) => (
          <div key={k}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-bold text-zinc-200">
                {KIND_LABEL[k]} ({grouped[k].length})
              </span>
            </h2>
            <div className="space-y-2">
              {grouped[k].map((c) => (
                <Card key={c.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-zinc-100">{c.name}</p>
                      <p className="font-mono text-xs text-zinc-400">{c.phone}{c.note ? ` • ${c.note}` : ""}</p>
                    </div>
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                      {openId === c.id ? "Band karo" : "✉️ Likho"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      aria-label={`Delete ${c.name}`}
                      className="rounded px-1.5 py-1 text-zinc-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                  {openId === c.id && <Composer c={c} onSent={() => {}} />}
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
