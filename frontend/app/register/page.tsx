"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch, setToken } from "@/lib/api";

const BUSINESS_TYPES: { code: string; label: string }[] = [
  { code: "kirana", label: "Kirana / General Store" },
  { code: "pharmacy", label: "Pharmacy / Medical" },
  { code: "hardware", label: "Hardware" },
  { code: "garments", label: "Garments / Fashion" },
  { code: "electronics", label: "Electronics / Mobile" },
  { code: "bakery", label: "Bakery / Food" },
  { code: "dairy", label: "Dairy" },
  { code: "stationery", label: "Stationery" },
  { code: "auto_parts", label: "Auto Parts" },
  { code: "services", label: "Services" },
  { code: "other", label: "Other" },
];

const LANGS: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "en", label: "English" },
  { code: "gu", label: "Gujarati" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "bn", label: "Bengali" },
];

interface LookupHit {
  phone: string;
  name: string;
  business_name: string;
  business_type: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    phone: "",
    name: "",
    business_name: "",
    business_type: "",
    distributors: [] as string[],
    language: "hi",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // P19: same-page OTP step (number pre-filled, no /login hop needed)
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpFails, setOtpFails] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [lookupQ, setLookupQ] = useState("");
  const [lookupHits, setLookupHits] = useState<LookupHit[]>([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [manualDist, setManualDist] = useState("");
  const reduce = useReducedMotion();
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const runLookup = async (q: string) => {
    if (!q.trim()) {
      setLookupHits([]);
      return;
    }
    setLookupBusy(true);
    try {
      const hits = await apiFetch<LookupHit[]>(`/distributors/lookup?q=${encodeURIComponent(q.trim())}`);
      setLookupHits(Array.isArray(hits) ? hits : []);
    } catch {
      setLookupHits([]);
    } finally {
      setLookupBusy(false);
    }
  };

  const onLookupChange = (q: string) => {
    setLookupQ(q);
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => runLookup(q), 300);
  };

  const addDistributor = (phone: string) => {
    const d = phone.replace(/\D/g, "");
    if (d.length < 10) {
      toast.error("Distributor ka 10-digit mobile number daalo");
      return;
    }
    if (form.distributors.includes(d)) {
      toast.error("Ye distributor pehle se added hai");
      return;
    }
    if (form.distributors.length >= 5) {
      toast.error("Max 5 distributors add kar sakte ho");
      return;
    }
    setForm((f) => ({ ...f, distributors: [...f.distributors, d] }));
  };

  const removeDistributor = (phone: string) =>
    setForm((f) => ({ ...f, distributors: f.distributors.filter((x) => x !== phone) }));

  const addManual = () => {
    const d = manualDist.replace(/\D/g, "");
    if (!d) return;
    addDistributor(d);
    setManualDist("");
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.phone.replace(/\D/g, "").length < 10) e.phone = "Sahi phone number daalo (10+ digits)";
    if (!form.business_type) e.business_type = "Business category chuno";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      toast.error("Form me kuch errors hain — neeche dekho");
      return;
    }
    setBusy(true);
    try {
      const digits = form.phone.replace(/\D/g, "");
      const r = await apiFetch<{ status: string; message: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      if (r.status === "pending") {
        // P19: seedha OTP step — OTP request karo aur same page par verify
        await requestOtp(digits, true);
        return;
      }
      setDone(r.message || "✅ Number note ho gaya — ab Login par OTP verify karo");
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

  const maskPhone = (digits: string) => {
    const d = digits.replace(/\D/g, "");
    if (d.length <= 4) return d;
    return `${d.slice(0, 2)}${"*".repeat(d.length - 4)}${d.slice(-2)}`;
  };

  const requestOtp = async (digits: string, silent = false) => {
    setOtpErr("");
    try {
      const r = await apiFetch<{ sent: boolean; dev_otp?: string; reason?: string }>("/auth/otp/request", {
        method: "POST",
        body: JSON.stringify({ phone: digits }),
      });
      setOtpPhone(digits);
      setOtp("");
      setOtpFails(0);
      setCooldown(30);
      if (!silent) toast.success("OTP dobara bheja ✅");
      if (r?.dev_otp) toast.success(`Dev OTP: ${r.dev_otp}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OTP nahi bheja gaya";
      // P19 honesty: 502 delivery-fail / 403 suspended — OTP card par dikhao, retry do
      setOtpPhone(digits);
      setOtpErr(msg);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verifyOtp = async () => {
    if (!otpPhone) return;
    if (otp.replace(/\D/g, "").length !== 6) {
      setOtpErr("6-digit OTP daalo");
      return;
    }
    setOtpBusy(true);
    setOtpErr("");
    try {
      const r = await apiFetch<{ token: string }>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ phone: otpPhone, code: otp.trim() }),
      });
      setToken(r.token);
      toast.success("Account active — shuru karo 🎉");
      window.location.href = "/app";
    } catch (e) {
      const n = otpFails + 1;
      setOtpFails(n);
      setOtpErr(
        n >= 3
          ? "3 baar galat — neeche Resend dabao aur naya OTP lo"
          : (e instanceof Error ? e.message : "OTP galat hai")
      );
    } finally {
      setOtpBusy(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border bg-transparent px-3 py-2 text-base outline-none placeholder:opacity-50";
  const errCls = "mt-1 text-xs font-semibold";
  const errStyle = { color: "var(--rose, #f43f5e)" };

  return (
    <main className="flex min-h-screen items-center justify-center p-4" style={{ color: "var(--ink)" }}>
      <motion.div
        initial={reduce ? {} : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[460px]"
      >
        <Link href="/" className="font-display mb-4 inline-block text-lg font-bold">
          ← VyapaarAI
        </Link>
        <div className="card space-y-4 p-6">
          {otpPhone ? (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold">OTP verify karo 🔐</h1>
                <p className="card-sub mt-1">
                  {maskPhone(otpPhone)} par OTP WhatsApp pe bheja gaya — daalo aur shuru karo.
                </p>
              </div>
              <div>
                <label htmlFor="reg-otp" className="mb-1 block text-sm font-semibold">6-digit OTP</label>
                <input id="reg-otp" className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
                {otpErr && <p className={errCls} style={errStyle}>{otpErr}</p>}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={verifyOtp} disabled={otpBusy} className="btn-primary w-full disabled:opacity-50">
                {otpBusy ? "Check ho raha…" : "Verify & Shuru karo"}
              </motion.button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={cooldown > 0 || otpBusy}
                  onClick={() => requestOtp(otpPhone)}
                  className="font-semibold disabled:opacity-50"
                  style={{ color: "var(--accent)" }}
                >
                  {cooldown > 0 ? `Resend (${cooldown}s)` : "OTP dobara bhejo"}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtpPhone(null); setOtp(""); setOtpErr(""); }}
                  className="font-semibold"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Number galat? Badlo
                </button>
              </div>
              <p className="text-center text-xs" style={{ color: "var(--ink-soft)" }}>
                Already active? <Link href={`/login?phone=${encodeURIComponent(otpPhone)}`} style={{ color: "var(--accent)" }} className="font-semibold">Login →</Link>
              </p>
            </>
          ) : !done ? (
            <>
              <div>
                <h1 className="font-display text-2xl font-bold">Dukaan register karo 📝</h1>
                <p className="card-sub mt-1">WhatsApp nahi? Yahan se — OTP verify karte hi shuru.</p>
              </div>

              <div>
                <label htmlFor="reg-phone" className="mb-1 block text-sm font-semibold">Phone (10 digits)</label>
                <input id="reg-phone" className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Phone (10 digits)" value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" />
                {errors.phone && <p className={errCls} style={errStyle}>{errors.phone}</p>}
              </div>

              <div>
                <label htmlFor="reg-name" className="mb-1 block text-sm font-semibold">Aapka naam</label>
                <input id="reg-name" className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Aapka naam" value={form.name} onChange={set("name")} autoComplete="name" />
              </div>

              <div>
                <label htmlFor="reg-biz" className="mb-1 block text-sm font-semibold">Dukaan ka naam</label>
                <input id="reg-biz" className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Dukaan ka naam" value={form.business_name} onChange={set("business_name")} autoComplete="organization" />
              </div>

              <div>
                <label htmlFor="reg-btype" className="mb-1 block text-sm font-semibold">Business category *</label>
                <select id="reg-btype" className={inputCls} style={{ borderColor: "var(--card-border)", background: "var(--card)" }} value={form.business_type} onChange={set("business_type")}>
                  <option value="">— category chuno —</option>
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.code} value={b.code}>{b.label}</option>
                  ))}
                </select>
                {errors.business_type && <p className={errCls} style={errStyle}>{errors.business_type}</p>}
              </div>

              <div>
                <label htmlFor="reg-dist" className="mb-1 block text-sm font-semibold">Distributors (max 5)</label>
                <div className="flex flex-wrap gap-1.5">
                  {form.distributors.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                      {d}
                      <button type="button" onClick={() => removeDistributor(d)} aria-label={`Remove ${d}`} className="font-bold leading-none">×</button>
                    </span>
                  ))}
                  {form.distributors.length === 0 && <span className="text-xs opacity-60">Abhi koi distributor nahi — neeche search ya manual add karo</span>}
                </div>
                <input id="reg-dist" className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Distributor search (naam ya phone)" value={lookupQ} onChange={(e) => onLookupChange(e.target.value)} inputMode="search" />
                {lookupBusy && <p className="mt-1 text-xs opacity-60">Search ho raha…</p>}
                {!lookupBusy && lookupHits.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-auto rounded-xl border" style={{ borderColor: "var(--card-border)" }}>
                    {lookupHits.map((h) => (
                      <button key={h.phone} type="button" onClick={() => addDistributor(h.phone)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:opacity-80">
                        <span className="font-semibold">{h.name || h.business_name || h.phone}</span>
                        <span className="text-xs opacity-70">{h.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input className={inputCls} style={{ borderColor: "var(--card-border)" }} placeholder="Manual: 10-digit mobile" value={manualDist} onChange={(e) => setManualDist(e.target.value)} inputMode="tel" />
                  <button type="button" onClick={addManual} className="rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--card-border)" }}>Add</button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-lang" className="mb-1 block text-sm font-semibold">Bhasha</label>
                <select id="reg-lang" className={inputCls} style={{ borderColor: "var(--card-border)", background: "var(--card)" }} value={form.language} onChange={set("language")}>
                  {LANGS.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={busy} className="btn-primary w-full disabled:opacity-50">
                {busy ? "Bhej rahe…" : "Register karo"}
              </motion.button>
              <p className="text-center text-xs" style={{ color: "var(--ink-soft)" }}>
                Already registered? <Link href="/login" style={{ color: "var(--accent)" }} className="font-semibold">Login karo →</Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-sm font-semibold">{done.slice(8)}</p>
              <Link href="/login" className="btn-primary mt-4 inline-block" style={{ textDecoration: "none" }}>
                Login karo →
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </main>
  );
}
