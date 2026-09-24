"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const EASE: [number, number, number, number] = [0.19, 1, 0.22, 1];

/* Hindi lives only inside these mock bubbles. */
const SCRIPT = [
  { from: "user", text: "Stock check karo" },
  { from: "ai", text: "18 SKUs low. Reorder: Tata Salt, Surf, Parle-G." },
  { from: "user", text: "Kitna udhaar pending?" },
  { from: "ai", text: "Rs.53,400 across 12 customers. Top: Ramesh Rs.8,500." },
] as const;

export default function Demo() {
  const reduce = useReducedMotion() ?? false;
  const boxRef = useRef<HTMLDivElement>(null);
  const inView = useInView(boxRef, { once: true, margin: "-100px" });
  const [started, setStarted] = useState(false);
  const [shown, setShown] = useState<number[]>(SCRIPT.map(() => 0));
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    if (!inView || reduce || started) return;
    setStarted(true);
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) fn();
        }, ms)
      );
    };
    let at = 400;
    SCRIPT.forEach((b, i) => {
      if (b.from === "ai") {
        later(() => setThinking(true), at);
        at += 800;
        later(() => setThinking(false), at);
      }
      for (let c = 0; c < b.text.length; c++) {
        at += b.text[c] === " " ? 200 : 120;
        const n = c + 1;
        later(
          () =>
            setShown((arr) => {
              const next = [...arr];
              next[i] = n;
              return next;
            }),
          at
        );
      }
      at += 500;
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView, reduce, started]);

  return (
    <section id="demo" className="px-6 py-16 md:py-24" style={{ background: "var(--paper)" }}>
      <div className="mx-auto max-w-md">
        <motion.h2
          className="mb-8 text-center text-3xl font-bold"
          style={{ color: "var(--ink)" }}
          data-reveal
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 20 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, margin: "-100px" },
                transition: { duration: 0.6, ease: EASE },
              })}
        >
          See it in action
        </motion.h2>
        <div ref={boxRef} className="rounded-3xl border p-6 shadow-xl" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="space-y-3" aria-live="polite">
            {SCRIPT.map((b, i) => {
              const txt = started && !reduce ? b.text.slice(0, shown[i]) : b.text;
              const mine = b.from === "user";
              return (
                <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[85%] rounded-2xl px-4 py-2 text-sm"
                    style={
                      mine
                        ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                        : {
                            background: "var(--paper)",
                            color: "var(--ink)",
                            border: "1px solid var(--card-border)",
                            borderBottomLeftRadius: 4,
                          }
                    }
                  >
                    {txt}
                    {started && !reduce && shown[i] < b.text.length && <span className="animate-pulse">▍</span>}
                  </div>
                </div>
              );
            })}
            {thinking && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--card-border)" }}>
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.2 }}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: "var(--ink-faint)" }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
