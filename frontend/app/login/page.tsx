"use client";

import { motion, useReducedMotion } from "framer-motion";
import { KeyRound, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, setToken } from "@/lib/api";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [pendingNote, setPendingNote] = useState("");
  const reduce = useReducedMotion();

  // P19: ?phone= deep-link prefill (e.g. from register OTP step)
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("phone") || "";
      const d = q.replace(/\D/g, "");
      if (d.length >= 10) setPhone(d);
    } catch {
      /* ignore */
    }
  }, []);

  async function requestOtp() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Sahi phone number daalo (10+ digits)");
      return;
    }
    setBusy(true);
    setPendingNote("");
    try {
      const r = await apiFetch<{ sent: boolean; dev_otp?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      if (r?.dev_otp) setHint(`Dev OTP: ${r.dev_otp}`);
      setStep("otp");
      toast.success("OTP bheja gaya ✅");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OTP nahi bheja gaya";
      if (/pending|register/i.test(msg)) {
        setPendingNote("⏳ Number registered nahi — pehle /register karo ya WhatsApp par 'hi' bhejo 🙏");
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    const digits = phone.replace(/\D/g, "");
    if (code.replace(/\D/g, "").length !== 6) {
      toast.error("6-digit OTP daalo");
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ token: string }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: digits, code: code.trim() }),
      });
      setToken(r.token);
      toast.success("Login ho gaya 🎉");
      window.location.href = "/app";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OTP galat hai");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2" style={{ color: "var(--ink)" }}>
      {/* left: animated illustration */}
      <div
        className="relative hidden items-center justify-center overflow-hidden p-10 md:flex"
        style={{ background: "linear-gradient(150deg, var(--accent-soft), var(--paper) 70%)" }}
      >
        <div className="max-w-sm text-center">
          <motion.div
            initial={reduce ? {} : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="font-display mx-auto flex h-24 w-24 items-center justify-center rounded-3xl text-5xl font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--accent), #0d7a55)", boxShadow: "var(--shadow)" }}
          >
            व्या
          </motion.div>
          <motion.h1
            className="font-display mt-6 text-4xl font-bold"
            initial={reduce ? {} : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Data se <span style={{ color: "var(--accent)" }}>Decision</span> tak.
          </motion.h1>
          <motion.p className="card-sub mt-3 text-sm" initial={reduce ? {} : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            WhatsApp pe OTP aayega — dukaan ka copilot taiyaar.
          </motion.p>
          <motion.svg viewBox="0 0 300 90" className="mx-auto mt-6 w-64" fill="none">
            <motion.path
              d="M5 75 C 60 70, 120 40, 180 45 S 270 25, 295 12"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
            />
            <circle cx="295" cy="12" r="5" fill="var(--marigold)" />
          </motion.svg>
        </div>
        <Link href="/" className="absolute left-5 top-5 font-display text-lg font-bold">
          ← VyapaarAI
        </Link>
      </div>

      {/* right: form */}
      <div className="flex items-center justify-center p-4">
        <motion.div
          initial={reduce ? {} : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[360px]"
        >
          <Card className="space-y-4 p-6">
            <div>
              <h1 className="font-display text-2xl font-bold">VyapaarAI Login</h1>
              <p className="card-sub mt-1">WhatsApp par registered number se OTP lo.</p>
            </div>
            {step === "phone" ? (
              <>
                <label className="flex items-center gap-1.5 text-sm">
                  <Phone size={14} /> Phone number
                </label>
                <Input placeholder="9198XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
                <motion.div whileTap={{ scale: 0.97 }}>
              <Button className="w-full" disabled={busy} onClick={requestOtp}>
                {busy ? "Bhej rahe hain..." : "OTP bhejo"}
              </Button>
                {pendingNote && (
                  <p className="rounded-xl border border-dashed px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--marigold)", color: "var(--marigold)" }}>
                    {pendingNote}
                  </p>
                )}
                </motion.div>
              </>
            ) : (
              <>
                <label className="flex items-center gap-1.5 text-sm">
                  <KeyRound size={14} /> OTP ({phone})
                </label>
                <Input placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
                {hint && (
                <p className="rounded-xl border-2 border-dashed px-3 py-2 text-center text-sm font-bold tracking-widest"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                  DEV OTP — {hint.replace(/^Dev OTP:\s*/, "")}
                </p>
              )}
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button className="w-full" disabled={busy} onClick={verifyOtp}>
                    {busy ? "Check ho raha..." : "Verify & Login"}
                  </Button>
                </motion.div>
                <Button variant="outline" className="w-full" onClick={() => setStep("phone")}>
                  Number badlo
                </Button>
              </>
            )}
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
