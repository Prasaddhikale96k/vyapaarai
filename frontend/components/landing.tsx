"use client";

import { animate, AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* Product mock strings: Hindi replies live ONLY inside phone/WhatsApp previews
   (language-sweep exception). All marketing copy outside mocks is English. */
const ANSWER = "Profit Rs.24,300 vs Rs.31,100 last month (-21.8%). Purchases +12% aur Rs.53,400 udhaar atka hai — wahi wajah hai.";
const UPI = "upi://pay?pa=sharmatraders@okicici&pn=Sharma%20Kirana&am=8500.00&cu=INR";

const AGENTS = ["Sales", "Stock", "Finance"];

export function PhoneMockup() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0); // 0 q, 1 agents, 2 typing, 3 upi, 4 voice
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (reduce) {
      setPhase(4);
      setTyped(ANSWER.length);
      return;
    }
    let i = 0;
    setPhase(0);
    setTyped(0);
    const t = setInterval(() => {
      i = (i + 1) % 5;
      setPhase(i);
      if (i === 2) setTyped(0);
      if (i === 0) setTyped(0);
    }, 2400);
    return () => clearInterval(t);
  }, [reduce]);

  useEffect(() => {
    if (phase !== 2 || reduce) return;
    if (typed >= ANSWER.length) {
      const t = setTimeout(() => setPhase(3), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped((v) => v + 3), 40);
    return () => clearTimeout(t);
  }, [phase, typed, reduce]);

  return (
    <div
      className="relative mx-auto w-[290px] rounded-[2.2rem] border p-2"
      style={{ background: "#101613", borderColor: "var(--card-border)", boxShadow: "var(--shadow)" }}
    >
      <div className="rounded-[1.8rem] px-3 pb-4 pt-8" style={{ background: "var(--paper)" }}>
        <div className="mx-auto mb-3 h-5 w-24 rounded-full" style={{ background: "#101613" }} />
        <div className="space-y-2 text-[12px] leading-snug">
          <AnimatePresence>
            {phase >= 0 && (
              <motion.div
                key="q"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 text-white"
                style={{ background: "var(--accent)" }}
              >
                profit kyun gira?
              </motion.div>
            )}
          </AnimatePresence>
          {phase >= 1 && (
            <div className="flex flex-wrap gap-1">
              {AGENTS.map((a, i) => (
                <motion.span
                  key={a}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.3, ease: EASE }}
                  className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    borderColor: "var(--accent)",
                    color: "var(--accent)",
                    background: "var(--accent-soft)",
                  }}
                >
                  {a}
                </motion.span>
              ))}
            </div>
          )}
          {phase >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="rounded-2xl rounded-bl-md border px-3 py-2"
              style={{ background: "var(--card)", borderColor: "var(--card-border)", color: "var(--ink)" }}
            >
              {reduce ? ANSWER : ANSWER.slice(0, typed)}
              {phase === 2 && typed < ANSWER.length && <span className="animate-pulse">▍</span>}
            </motion.div>
          )}
          {phase >= 3 && (
            <motion.a
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: EASE }}
              whileTap={{ scale: 0.95 }}
              href={UPI}
              className="inline-block rounded-full px-3 py-1.5 text-[11px] font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--accent)", outlineColor: "var(--accent)" }}
            >
              Open UPI link • Rs.8,500
            </motion.a>
          )}
          {phase >= 4 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="flex items-center gap-1 rounded-2xl rounded-bl-md border px-3 py-2"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
            >
              <span className="text-[10px]" style={{ color: "var(--ink-soft)" }}>
                0:07
              </span>
              <svg width="110" height="22" viewBox="0 0 110 22" fill="none" aria-hidden="true">
                {[4, 9, 14, 7, 16, 11, 18, 8, 13, 6, 15, 10, 17, 9, 12, 7, 14, 10, 8, 12].map(
                  (h, i) => (
                    <motion.rect
                      key={i}
                      x={4 + i * 5}
                      y={11 - h / 2}
                      width="2.6"
                      height={h}
                      rx="1.3"
                      fill="var(--accent)"
                      animate={reduce ? {} : { scaleY: [1, 0.4, 1] }}
                      transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.07, ease: EASE }}
                      style={{ transformOrigin: "center" }}
                    />
                  )
                )}
              </svg>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* Mini-demo: English questions, product-truth answers (Hindi allowed in answers as mock).
   Signature moment: human typing with one backspace correction. */
const DEMO_QA: [string, string][] = [
  ["Why did profit dip?", "Purchases up 12% and Rs.53,400 stuck in credit. Margin 15% to 11%. Collect dues first."],
  ["When does stock run out?", "Sugar 1kg lasts about 3 days at 17 per day. Reorder today."],
  ["How much credit is pending?", "Rs.53,400 across 3 invoices. Largest: Sunita Devi Rs.32,500."],
  ["Which product should I drop?", "Haldiram Namkeen: zero sales in 45 days, 40 units idle. Run clearance."],
];

const TYPING_TARGET = "reorder 10kg sugar";
const TYPING_MISTAKE = "reorder 10kg sug";

export function MiniDemo() {
  const [active, setActive] = useState(0);
  const [words, setWords] = useState(0);
  const [typedQ, setTypedQ] = useState(TYPING_TARGET);
  const reduce = useReducedMotion();
  const full = DEMO_QA[active][1].split(" ");

  /* Answer reveal: word-by-word with natural pauses at punctuation (gsap.timeline-like variable durations). */
  useEffect(() => {
    setWords(reduce ? full.length : 0);
    if (reduce) return;
    let i = 0;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      if (cancelled) return;
      i += 1;
      setWords(i);
      if (i >= full.length) return;
      const w = full[i - 1] ?? "";
      const pause = /[.?!.…]$/.test(w) ? 420 : w.length <= 3 ? 70 : 130;
      t = setTimeout(step, pause);
    };
    t = setTimeout(step, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);

  /* Query typing with human rhythm + one backspace correction. */
  useEffect(() => {
    if (reduce) {
      setTypedQ(TYPING_TARGET);
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timers.push(t);
    };
    // Type the mistake fast in bursts, pause, backspace, retype correctly.
    let at = 300;
    for (let c = 1; c <= TYPING_MISTAKE.length; c++) {
      const burst = c % 4 === 0 ? 260 : 55 + (c % 3) * 40;
      at += burst;
      const n = c;
      schedule(() => setTypedQ(TYPING_MISTAKE.slice(0, n)), at);
    }
    at += 550; // thinking pause before correction
    for (let c = TYPING_MISTAKE.length - 1; c >= TYPING_MISTAKE.length - 3; c--) {
      at += 90;
      const n = c;
      schedule(() => setTypedQ(TYPING_MISTAKE.slice(0, n)), at);
    }
    at += 220;
    const fix = ["a", "ar"];
    fix.forEach((suf) => {
      at += 140;
      schedule(() => setTypedQ(TYPING_MISTAKE.slice(0, TYPING_MISTAKE.length - 3) + suf), at);
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [active, reduce]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {DEMO_QA.map(([q], i) => (
          <motion.button
            key={q}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActive(i)}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            style={
              active === i
                ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)", outlineColor: "var(--accent)" }
                : { borderColor: "var(--card-border)", color: "var(--ink-soft)" }
            }
          >
            {q}
          </motion.button>
        ))}
      </div>
      {/* Typing line with realistic caret + backspace correction */}
      <div className="card mb-3 flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: "var(--ink-faint)" }}>
          You
        </span>
        <p className="text-sm" style={{ color: "var(--ink)" }} aria-live="polite">
          {typedQ}
          <span className="animate-pulse" aria-hidden="true">
            ▍
          </span>
        </p>
      </div>
      <div className="card" style={{ minHeight: 132 }}>
        <div className="mb-2 flex gap-1">
          {["Sales", "Stock", "Finance"].map((s, si) => (
            <motion.span
              key={s}
              animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
              transition={{ repeat: Infinity, duration: 1.8, delay: si * 0.3, ease: EASE }}
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {s} ✓
            </motion.span>
          ))}
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
          {full.slice(0, words).map((w, i) => (
            <motion.span
              key={`${active}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="inline-block"
            >
              {w}
              {i < words - 1 ? " " : ""}
            </motion.span>
          ))}
          {words < full.length && <span className="animate-pulse">▍</span>}
        </p>
      </div>
    </div>
  );
}

export function Doodle({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} width="44" height="44" aria-hidden="true">
      <motion.path
        d={d}
        stroke="var(--marigold)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 1, ease: EASE }}
      />
    </svg>
  );
}

export function CountUp({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const c = animate(0, value, { duration: 1.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <span ref={ref} className="tnum">
      {prefix}
      {display.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

export function SpotCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`card group relative overflow-hidden ${className}`}>
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), var(--accent-soft), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[1.1rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ padding: 1.5, background: "linear-gradient(135deg, var(--accent), transparent 40%, transparent 60%, var(--marigold))", WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/* Living ledger hero visual: khata page writes itself with HUMAN rhythm —
   fast bursts + thinking pauses; ruled line draws just before its entry. */
const LEDGER_ROWS = ["Ramesh — Rs.8,500 on credit", "Sugar 40kg — sold out", "Chai stock — reorder?"];
const LEDGER_AI = "Profit -21.8%. Cause: purchases +12%, Rs.53,400 stuck in credit.";

/* Variable choreography: line draws (300ms) -> burst types (1.2s) -> pause -> next. */
const LEDGER_TIMING = [500, 2000, 3900];

export function LivingLedger() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? 3 : 0);
  const [showAi, setShowAi] = useState(reduce);
  const [typed, setTyped] = useState(reduce ? LEDGER_AI.length : 0);

  useEffect(() => {
    if (reduce) {
      setVisible(3);
      setShowAi(true);
      setTyped(LEDGER_AI.length);
      return;
    }
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = () => {
      setVisible(0);
      setShowAi(false);
      setTyped(0);
      LEDGER_TIMING.forEach((at, i) => {
        timers.push(
          setTimeout(() => {
            if (!cancelled) setVisible(i + 1);
          }, at)
        );
      });
      timers.push(
        setTimeout(() => {
          if (!cancelled) setShowAi(true);
        }, 5400)
      );
    };
    loop();
    const cycle = setInterval(() => {
      if (!cancelled) loop();
    }, 9000);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      clearInterval(cycle);
    };
  }, [reduce]);

  /* AI answer types in bursts once the card appears. */
  useEffect(() => {
    if (!showAi || reduce) return;
    if (typed >= LEDGER_AI.length) return;
    const burst = typed % 5 === 0 ? 180 : 28;
    const t = setTimeout(() => setTyped((v) => Math.min(LEDGER_AI.length, v + 2)), burst);
    return () => clearTimeout(t);
  }, [showAi, typed, reduce]);

  return (
    <div className="ruled-paper relative mx-auto w-full max-w-[380px] rounded-2xl border p-5"
      style={{ background: "var(--card)", borderColor: "var(--card-border)", boxShadow: "var(--shadow)" }}>
      <p className="font-display text-sm font-bold" style={{ color: "var(--ink-faint)" }}>Sharma Traders — day book</p>
      <svg viewBox="0 0 320 130" className="mt-2 w-full" fill="none" aria-hidden="true">
        {[28, 58, 88, 118].map((y, i) => (
          <motion.line
            key={y}
            x1="8"
            y1={y}
            x2="312"
            y2={y}
            stroke="var(--accent)"
            strokeOpacity="0.25"
            initial={{ pathLength: 0 }}
            animate={visible > i || reduce ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        ))}
      </svg>
      <div className="-mt-28 space-y-4 px-2" aria-live="polite">
        {LEDGER_ROWS.map((row, i) => (
          <motion.p
            key={row}
            className="font-display text-[15px] italic"
            style={{ color: "var(--ink)" }}
            initial={reduce ? {} : { opacity: 0, x: -10 }}
            animate={visible > i ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {row}
          </motion.p>
        ))}
      </div>
      <AnimatePresence>
        {showAi && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="mt-3 rounded-2xl rounded-bl-md border p-3"
            style={{ background: "var(--accent-soft)", borderColor: "var(--accent)" }}
          >
            <p className="text-xs font-bold" style={{ color: "var(--accent)" }}>VyapaarAI answer</p>
            <p className="mt-1 text-[13px] leading-snug" style={{ color: "var(--ink)" }}>
              {reduce ? LEDGER_AI : LEDGER_AI.slice(0, typed)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="tnum text-lg font-bold" style={{ color: "var(--ink)" }}>
                <CountUp value={53400} prefix="Rs." />
              </span>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: "var(--accent)" }}>
                Send UPI link
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Scrollytelling: 4 chapters, English marketing + product-truth numbers.
   Hindi lives only inside the phone mock bubbles. Swaps use masked
   clip-path transitions; phone tilts 3-4 deg per chapter. */
const CHAPTERS = [
  { t: "Morning brief, before chai", d: "Three alerts land at 8 AM. Rs.53,400 overdue caught while you slept.", mini: "brief" },
  { t: "Ask why profit dipped", d: "One question. Three specialists answer. Purchases up 12%, dues stuck.", mini: "chat" },
  { t: "Eighteen SKUs run low", d: "Sugar has 3 days left. Reorder goes out on WhatsApp. No app to install.", mini: "photo" },
  { t: "Night report, one page", d: "Health score 44 to 88 in 19 days. PDF on WhatsApp with a UPI link inside.", mini: "report" },
];

const TILTS = [-3, -1, 1.5, 3];

export function ScrollyTelling({ onChapter }: { onChapter?: (i: number) => void }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <div className="relative border-l-2 pl-5" style={{ borderColor: "var(--card-border)" }}>
          <motion.div
            className="absolute -left-[3px] top-0 w-[4px] rounded-full"
            style={{ background: "var(--accent)", height: `${((active + 1) / CHAPTERS.length) * 100}%` }}
          />
          {CHAPTERS.map((c, i) => (
            <motion.div
              key={c.t}
              onViewportEnter={() => {
                setActive(i);
                onChapter?.(i);
              }}
              viewport={{ margin: "-40% 0px -40% 0px" }}
              className="py-8"
              style={{ opacity: active === i ? 1 : 0.45 }}
            >
              <p className="font-display text-xl font-bold" style={{ color: "var(--ink)" }}>{c.t}</p>
              <p className="card-sub mt-1">{c.d}</p>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="md:sticky md:top-24 md:self-start">
        <motion.div
          className="card min-h-[260px]"
          animate={reduce ? {} : { rotate: TILTS[active] }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ transformOrigin: "center" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)", y: 14 }}
              animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)", y: 0 }}
              exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)", y: -10 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              {active === 0 && (
                <div>
                  <p className="card-title">Morning brief</p>
                  {["Rs.53,400 stuck in credit", "Sugar stock: 3 days left", "Profit down 21.8%"].map((b) => (
                    <p key={b} className="mt-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--card-border)" }}>{b}</p>
                  ))}
                </div>
              )}
              {active === 1 && <PhoneMockup />}
              {active === 2 && (
                <div>
                  <p className="card-title">Register scan</p>
                  <div className="mt-2 rounded-xl border border-dashed p-4 text-center text-xs" style={{ borderColor: "var(--accent)" }}>
                    photo.jpg turned into 5 entries
                  </div>
                  <p className="mt-2 text-sm font-bold" style={{ color: "var(--accent)" }}>Reply YES or NO to confirm</p>
                  <p className="card-sub mt-1">18 SKUs flagged low-stock. Distributor pinged on WhatsApp.</p>
                </div>
              )}
              {active === 3 && (
                <div className="text-center">
                  <p className="card-title">Daily report ready</p>
                  <p className="tnum font-display mt-2 text-4xl font-bold" style={{ color: "var(--ink)" }}>
                    44 → 88
                  </p>
                  <p className="card-sub">Health score in 19 days. UPI link inside. Sent on WhatsApp.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
