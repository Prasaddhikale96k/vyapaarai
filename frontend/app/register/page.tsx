"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

const LANGS = ["hi", "mr", "en", "gu", "ta", "te", "kn", "bn"];

function Hourglass() {
  return (
    <svg viewBox="0 0 64 80" width="72" height="90" fill="none">
      <motion.g
        animate={{ rotate: [0, 0, 180, 180, 360] }}
        transition={{ repeat: Infinity, duration: 6, times: [0, 0.35, 0.5, 0.85, 1] }}
        style={{ transformOrigin: "32px 40px" }}
      >
        <path d="M14 6 h36 M14 74 h36 M18 6 C 18 30, 46 30, 46 40 C 46 50, 18 50, 18 74" stroke="var(--marigold)" strokeWidth="3" strokeLinecap="round" />
        <motion.circle cx="32" cy="26" r="3" fill="var(--marigold)" animate={{ cy: [26, 52] }} transition={{ repeat: Infinity, duration: 3 }} />
      </motion.g>
    </svg>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({ phone: "", name: "", business_name: "", distributor_phone: "", language: "hi" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Sahi phone number daalo (10+ digits)");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ status: string; message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setDone(r.message || "⏳ Admin approval ke baad login karein");
      toast.success("Request mil gayi ✅");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Register nahi ho paya";
      if (/already registered/i.test(msg)) {
        toast.error(msg);
        setDone("ALREADY:" + msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none placeholder:opacity-50";

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ color: "var(--ink)" }}>
      <motion.div
        initial={reduce ? {} : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px]"
      >
        <Link href="/" className="font-display mb-4 inline-block text-lg font-bold">
          ← VyapaarAI
        </Link>
        <div className="card space-y-3 p-6">
          {!done ? (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold">Dukaan register karo 📝</h1>
                <p className="card-sub mt-1">WhatsApp nahi? Yahan se — admin approve karega.</p>
              </div>
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Phone (10 digits)" value={form.phone} onChange={set("phone")} inputMode="tel" />
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Aapka naam" value={form.name} onChange={set("name")} />
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Dukaan ka naam" value={form.business_name} onChange={set("business_name")} />
              <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Distributor ka mobile" value={form.distributor_phone} onChange={set("distributor_phone")} inputMode="tel" />
              <select className={inputCls} style={{ borderColor: "var(--card-border)", background: "var(--card)" }} value={form.language} onChange={set("language")}>
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-50">
                {busy ? "Bhej rahe…" : "Register karo"}
              </motion.button>
              <p className="text-center text-xs" style={{ color: "var(--ink-soft)" }}>
                Already registered? <Link href="/login" style={{ color: "var(--accent)" }} className="font-semibold">Login karo →</Link>
              </p>
            </>
          ) : done.startsWith("ALREADY:") ? (
            <div className="text-center">
              <p className="text-sm font-semibold">{done.slice(8)}</p>
              <Link href="/login" className="btn-primary mt-4 inline-block" style={{ textDecoration: "none" }}>
                Login karo →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <Hourglass />
              <h2 className="font-display mt-3 text-xl font-bold">Request mil gayi! ⏳</h2>
              <p className="card-sub mt-1">{done}</p>
              <p className="mt-2 text-xs font-semibold" style={{ color: "var(--marigold)" }}>
                Admin approve karega — thoda intezaar karo 🙏
              </p>
              <Link href="/login" className="btn-ghost mt-4 inline-block" style={{ textDecoration: "none" }}>
                Login page
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
