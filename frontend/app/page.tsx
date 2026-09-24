"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { InkLine } from "@/components/ink-line";
import { CountUp, EASE, LivingLedger, MiniDemo, ScrollyTelling, SpotCard } from "@/components/landing";
import { useTheme } from "@/lib/theme";

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={toggle}
      aria-label="Toggle color theme"
      className="rounded-xl border p-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ borderColor: "var(--card-border)", color: "var(--ink)", outlineColor: "var(--accent)", minWidth: 44, minHeight: 44 }}
    >
      {theme === "light" ? "Dark" : "Light"}
    </motion.button>
  );
}

function MaskWords({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  if (reduce) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.65, ease: EASE, delay: delay + i * 0.06 }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* Magnetic CTA: pulls toward cursor within 80px radius, max 6px, springs back. */
function Magnetic({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy);
        if (d < 80) {
          setPos({ x: (dx / 80) * 6, y: (dy / 80) * 6 });
        } else setPos({ x: 0, y: 0 });
      }}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      style={{ display: "inline-block" }}
    >
      <motion.div animate={{ x: pos.x, y: pos.y }} transition={{ type: "spring", stiffness: 350, damping: 18 }}>
        {children}
      </motion.div>
    </div>
  );
}

/* Spec S2 rows: two counter-rotating, mixed weights via index. */
const BIZ1 = ["Kirana", "Pharmacy", "Hardware", "Garments", "Mobile Recharge", "Optics", "Dairy", "Textiles", "Stationery", "Toys"];
const BIZ2 = ["Footwear", "Plywood", "Paint", "Electronics", "Bakery", "Medical Store", "Auto Parts", "Barber Shop", "Tailoring", "Gifts"];

const BENTO = [
  { t: "Auto-categorize 47 expense types", d: "Chai, freight, packing. Every rupee finds its ledger head.", viz: "doc", big: false },
  { t: "Rs.2.1L caught before it slipped", d: "Overdue pings go out with a UPI link. You approve once.", viz: "upi", big: false },
  { t: "Works inside WhatsApp", d: "No app install. Your staff already knows how to use it.", viz: "live", big: false },
  { t: "Voice plus photo equals entry", d: "Speak or snap the register page. Five entries in seconds.", viz: "wave", big: false },
  { t: "18 SKUs critically low", d: "Sugar has 3 days left. Reorder drafted before the shelf empties.", viz: "gauge", big: false },
];

function TileViz({ kind }: { kind: string }) {
  const stroke = "var(--accent)";
  if (kind === "wave")
    return (
      <svg viewBox="0 0 120 28" className="mt-2 w-28" fill="none" aria-hidden="true">
        {[6, 12, 18, 10, 22, 14, 20, 8, 16, 11, 19, 13, 9, 15].map((h, i) => (
          <motion.rect key={i} x={4 + i * 8} y={14 - h / 2} width="3.4" height={h} rx="1.7" fill={stroke} opacity={0.75}
            whileHover={{ scaleY: 1.5 }} style={{ transformOrigin: "center" }} />
        ))}
      </svg>
    );
  if (kind === "chart")
    return (
      <svg viewBox="0 0 120 36" className="mt-2 w-28" fill="none" aria-hidden="true">
        <motion.path d="M4 30 C 30 28, 50 18, 75 16 S 105 8, 116 5" stroke={stroke} strokeWidth="2.5" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
        <circle cx="116" cy="5" r="3.5" fill="var(--marigold)" />
      </svg>
    );
  if (kind === "gauge")
    return (
      <svg viewBox="0 0 60 34" className="mt-2 w-16" fill="none" aria-hidden="true">
        <path d="M6 30 A 24 24 0 0 1 54 30" stroke="var(--card-border)" strokeWidth="6" strokeLinecap="round" />
        <motion.path d="M6 30 A 24 24 0 0 1 40 10" stroke={stroke} strokeWidth="6" strokeLinecap="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} />
      </svg>
    );
  if (kind === "live")
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ repeat: Infinity, duration: 1.6, ease: EASE }}
          className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />Live
      </span>
    );
  if (kind === "upi")
    return (
      <motion.span whileHover={{ rotate: -4 }} whileTap={{ scale: 0.96 }} className="mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
        style={{ background: "var(--accent)" }}>
        upi://pay…
      </motion.span>
    );
  return (
    <span className="mt-2 inline-block rounded-lg border border-dashed px-2.5 py-1 text-[11px]" style={{ borderColor: "var(--accent)", color: "var(--ink-soft)" }}>
      photo to 5 entries
    </span>
  );
}

/* S2 choreography: velocity skew clamped to ±5deg, per-row hover pause. */
function VelocityMarquee({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const { scrollY } = useScroll();
  const vel = useVelocity(scrollY);
  const [skew, setSkew] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const un = vel.on("change", (v) => {
      const s = Math.max(-5, Math.min(5, v / 600));
      setSkew(reverse ? -s : s);
    });
    return un;
  }, [vel, reverse, reduce]);
  return (
    <div className="overflow-hidden py-1.5" style={{ transform: `skewX(${skew}deg)` }}>
      <motion.div
        className="marquee-track flex w-max gap-3"
        style={{ animationDirection: reverse ? "reverse" : undefined }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.animationPlayState = "paused")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.animationPlayState = "")}
      >
        {[...items, ...items, ...items, ...items].map((b, i) => (
          <span
            key={i}
            className={`chip font-display ${i % 3 === 0 ? "text-base font-bold" : i % 3 === 1 ? "text-sm italic" : "text-sm"}`}
            style={{ background: "var(--card)" }}
          >
            {b}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

const QUOTE = "We built the bahi-khata that thinks — because thirteen million Indian kirana stores deserve intelligence, not just software.";

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [hideNav, setHideNav] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [mx, setMx] = useState({ x: 0, y: 0 });
  const reduce = useReducedMotion();
  const { scrollYProgress, scrollY } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const ctaY = useTransform(scrollY, [2000, 4200], [70, -70]);
  const [siteUrl, setSiteUrl] = useState("https://vyapaarai.app");
  const [boot, setBoot] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setBoot(false), reduce ? 0 : 800);
    return () => clearTimeout(t);
  }, [reduce]);

  useEffect(() => {
    let last = 0;
    const fn = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHideNav(y > 300 && y > last);
      last = y;
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    try {
      setSiteUrl(window.location.origin);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="grain relative min-h-screen" style={{ color: "var(--ink)" }}>
      {/* S0 preloader: ink V monogram (600ms) + clip wipe (300ms) = 800ms max */}
      <AnimatePresence>
        {boot && (
          <motion.div
            id="s0"
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center"
            style={{ background: "var(--paper)", clipPath: "inset(0 0 0 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <svg viewBox="0 0 64 64" width="76" height="76" fill="none" aria-hidden="true">
              <motion.path d="M14 12 L32 52 L50 12" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }} />
              <motion.path d="M32 52 L32 58" stroke="var(--marigold)" strokeWidth="4" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.15, delay: 0.5, ease: EASE }} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      <InkLine />
      <motion.div className="fixed inset-x-0 top-0 z-50 h-1 origin-left" style={{ scaleX: progress, background: "var(--accent)" }} />

      {/* nav */}
      <motion.header
        animate={{ y: hideNav ? "-100%" : "0%" }}
        transition={{ duration: 0.25, ease: EASE }}
        className="fixed inset-x-0 top-0 z-40 transition-colors"
        style={{
          background: scrolled ? "color-mix(in srgb, var(--paper) 88%, transparent)" : "transparent",
          borderBottom: scrolled ? "1px solid var(--card-border)" : "1px solid transparent",
        }}
      >
        <nav className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4" style={{ outlineColor: "var(--accent)" }}>
            <span className="font-display flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ background: "var(--accent)" }}>
              V
            </span>
            <span className="font-display text-lg font-bold">VyapaarAI</span>
          </Link>
          <div className="ml-auto hidden items-center gap-5 text-sm md:flex" style={{ color: "var(--ink-soft)" }}>
            <a href="#features" className="rounded px-1 py-2 hover:opacity-70 active:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: "var(--accent)" }}>Features</a>
            <a href="#how" className="rounded px-1 py-2 hover:opacity-70 active:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: "var(--accent)" }}>How it works</a>
            <a href="#demo" className="rounded px-1 py-2 hover:opacity-70 active:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: "var(--accent)" }}>Demo</a>
          </div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <ThemeToggle />
            <Link href="/register" className="hidden min-h-[44px] items-center text-sm font-semibold sm:inline-flex hover:opacity-70 active:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: "var(--accent)", outlineColor: "var(--accent)" }}>
              Register
            </Link>
            <Link href="/login" className="btn-primary inline-flex min-h-[44px] items-center hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4" style={{ textDecoration: "none", outlineColor: "var(--accent)" }}>
              Login
            </Link>
          </div>
        </nav>
      </motion.header>

      {/* S1 hero — living ledger. Choreography: mask-reveal headline words (60ms stagger) + ledger line-draw then burst-type. */}
      <section
        id="s1"
        className="relative z-[2] overflow-hidden pt-24"
        onMouseMove={(e) => {
          if (reduce) return;
          const r = e.currentTarget.getBoundingClientRect();
          setMx({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
        }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden
          style={{ background: `radial-gradient(520px circle at ${50 + mx.x * 26}% ${32 + mx.y * 18}%, var(--marigold-soft), transparent 70%)`, opacity: 0.5 }} />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-6 md:grid-cols-2 md:pt-12">
          <div>
            <h1 className="font-display font-bold leading-[1.02]" style={{ fontSize: "clamp(2.8rem, 8vw, 5.5rem)" }}>
              <MaskWords text="Your shop runs" delay={0.85} />
              <br />
              <MaskWords text="on udhaari." delay={1.0} />
              <br />
              <span className="italic" style={{ color: "var(--accent)" }}>
                <MaskWords text="Run it on intelligence." delay={1.15} />
              </span>
            </h1>
            <motion.p
              className="mt-5 max-w-md text-base"
              style={{ color: "var(--ink-soft)" }}
              initial={reduce ? {} : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.45, duration: 0.6, ease: EASE }}
            >
              VyapaarAI reads your register and your voice notes. It tells you what to do before money leaks. On WhatsApp.
            </motion.p>
            <motion.div
              className="mt-6 flex flex-wrap items-center gap-3"
              initial={reduce ? {} : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.6, ease: EASE }}
            >
              <div className="relative">
                <Magnetic>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setQrOpen((o) => !o)}
                    className="btn-primary inline-flex min-h-[44px] min-w-[44px] items-center hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4"
                    style={{ outlineColor: "var(--accent)" }}
                  >
                    Start on WhatsApp
                  </motion.button>
                </Magnetic>
                {qrOpen && (
                  <div className="card absolute z-30 mt-2 w-52 p-3 text-center">
                    <QRCodeSVG value={siteUrl} size={160} className="mx-auto" />
                    <p className="card-sub mt-2">Scan to open VyapaarAI</p>
                    <a href={`https://wa.me/?text=${encodeURIComponent("Look at VyapaarAI: " + siteUrl)}`}
                      target="_blank" rel="noreferrer" className="mt-1 inline-block min-h-[44px] text-xs font-semibold hover:opacity-70 active:opacity-50" style={{ color: "var(--accent)" }}>
                      Share on WhatsApp
                    </a>
                  </div>
                )}
              </div>
              <Link href="/register" className="btn-ghost inline-flex min-h-[44px] items-center hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4" style={{ textDecoration: "none", outlineColor: "var(--accent)" }}>Register</Link>
              <Link href="/login" className="inline-flex min-h-[44px] items-center text-sm font-semibold hover:opacity-70 active:opacity-50" style={{ color: "var(--ink-soft)" }}>Login</Link>
            </motion.div>
            <motion.p className="card-sub mt-4" initial={reduce ? {} : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.75, duration: 0.5, ease: EASE }}>
              Rs.53,400 overdue caught. 18 SKUs tracked. Two-minute onboarding.
            </motion.p>
          </div>
          <motion.div
            initial={reduce ? {} : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.1, duration: 0.7, ease: EASE }}
          >
            <LivingLedger />
          </motion.div>
        </div>
      </section>

      {/* S2 business marquee — counter-rotating rows, velocity skew, mixed weights */}
      <section id="s2" className="relative z-[2] border-y py-4" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
        <VelocityMarquee items={BIZ1} />
        <VelocityMarquee items={BIZ2} reverse />
      </section>

      {/* S3 scrolly — masked chapter swaps, phone tilt per chapter */}
      <section id="s3" className="relative z-[2] mx-auto max-w-7xl px-6 py-16">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          <MaskWords text="One day with your copilot" />
        </h2>
        <p className="card-sub mt-1">Scroll. The story advances itself.</p>
        <div className="mt-6">
          <ScrollyTelling />
        </div>
      </section>

      {/* S4 bento — oversized chart card + 5 tiles; border-light hover + tilt, no scale */}
      <section id="s4" className="relative z-[2] mx-auto max-w-7xl px-6 py-12">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          <MaskWords text="One copilot, whole shop" />
        </h2>
        <p className="card-sub mt-1">Vyapaar catches Rs.53K overdue. Your WhatsApp knows first.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Oversized 2x2: health journey chart, ink axis */}
          <motion.div
            className="sm:col-span-2 sm:row-span-1 lg:row-span-2"
            initial={reduce ? {} : { opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: EASE }}
            whileHover={reduce ? {} : { rotateX: 1, rotateY: -1 }}
            style={{ perspective: 800 }}
          >
            <SpotCard className="h-full">
              <h3 className="card-title font-display text-lg">Health 44 to 88 in 19 days</h3>
              <p className="card-sub mt-1">Dues collected. Dead stock cleared. The line only climbs.</p>
              <svg viewBox="0 0 320 120" className="mt-3 w-full" fill="none" aria-hidden="true">
                <line x1="24" y1="8" x2="24" y2="108" stroke="var(--ink-line)" strokeWidth="2" strokeLinecap="round" />
                <line x1="24" y1="108" x2="312" y2="108" stroke="var(--ink-line)" strokeWidth="2" strokeLinecap="round" />
                <motion.path
                  d="M24 92 C 80 88, 120 70, 170 62 S 260 34, 304 18"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, ease: EASE }}
                />
                <circle cx="304" cy="18" r="5" fill="#F59E0B" />
                <text x="30" y="30" fontSize="11" fontWeight="700" fill="var(--ink-soft)">88</text>
                <text x="30" y="100" fontSize="11" fontWeight="700" fill="var(--ink-soft)">44</text>
              </svg>
              <p className="tnum mt-1 text-xs font-bold" style={{ color: "var(--accent)" }}>Rs.53,400 overdue caught along the way</p>
            </SpotCard>
          </motion.div>
          {BENTO.map((f, i) => (
            <motion.div
              key={f.t}
              initial={reduce ? {} : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, ease: EASE, delay: ((i + 1) % 3) * 0.06 }}
              whileHover={reduce ? {} : { rotateX: 1, rotateY: -1 }}
              style={{ perspective: 800 }}
            >
              <SpotCard>
                <h3 className="card-title font-display text-lg">{f.t}</h3>
                <p className="card-sub mt-1">{f.d}</p>
                <TileViz kind={f.viz} />
              </SpotCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* S5 mini demo — typing with backspace correction, word-by-word answers */}
      <section id="s5" className="relative z-[2] mx-auto max-w-3xl px-6 py-14">
        <h2 className="font-display text-3xl font-bold md:text-4xl">
          <MaskWords text="Ask like you talk" />
        </h2>
        <p className="card-sub mt-1">Voice, photo, or text. Vyapaar writes your khata.</p>
        <div className="mt-5">
          <MiniDemo />
          <p className="card-sub mt-2 text-center">
            All of this runs on WhatsApp. No app install.
          </p>
        </div>
      </section>

      {/* S6 stats band — dark ink, clip-wipe numerals, sparklines, count on entry */}
      <section id="s6" className="relative z-[2]" style={{ background: "#101613" }}>
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 text-center sm:grid-cols-2 lg:grid-cols-4" style={{ color: "#FAF7F2" }}>
          {[
            { v: 53400, prefix: "Rs.", label: "overdue caught" },
            { v: 18, prefix: "", label: "SKUs flagged low-stock" },
            { v: 88, prefix: "", label: "health score in 19 days", raw: true },
            { v: 2847, prefix: "", label: "voice entries processed" },
          ].map((s) => (
            <div key={s.label}>
              <p className="font-display tnum overflow-hidden text-4xl font-bold md:text-5xl" style={{ color: "#FBBF24" }}>
                <motion.span className="inline-block" initial={reduce ? {} : { y: "60%" }} whileInView={{ y: "0%" }} viewport={{ once: true }} transition={{ duration: 0.7, ease: EASE }}>
                  {"raw" in s && s.raw ? (
                    <span className="tnum">44 → <CountUp value={s.v} /></span>
                  ) : (
                    <CountUp value={s.v} prefix={s.prefix} />
                  )}
                </motion.span>
              </p>
              <svg viewBox="0 0 120 20" className="mx-auto mt-1 w-28" fill="none" aria-hidden="true">
                <motion.path d="M4 16 C 30 14, 60 10, 116 4" stroke="#10B981" strokeWidth="2" strokeLinecap="round"
                  initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1, ease: EASE }} />
              </svg>
              <p className="mt-1 text-xs opacity-70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* S7 quote — word mask reveal, ruled paper, ink attribution underline */}
      <section id="s7" className="relative z-[2] mx-auto max-w-3xl px-6 py-14 text-center">
        <div className="ruled-paper card p-8">
          <div className="text-lg tracking-widest" style={{ color: "var(--marigold)" }} aria-hidden="true">★★★★★</div>
          <p className="font-display mt-3 text-2xl italic leading-snug">
            {QUOTE.split(" ").map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
                <motion.span className="inline-block" initial={reduce ? {} : { y: "110%" }} whileInView={{ y: "0%" }}
                  viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.5, ease: EASE, delay: i * 0.02 }}>
                  {w}
                  {i < QUOTE.split(" ").length - 1 ? " " : ""}
                </motion.span>
              </span>
            ))}
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
            VyapaarAI · Built for Bharat
          </p>
          <svg viewBox="0 0 160 40" width="150" height="38" fill="none" className="mx-auto mt-1" aria-hidden="true">
            <motion.path d="M10 28 C 40 28, 45 8, 70 18 S 100 34, 150 12" stroke="var(--ink-line)" strokeWidth="2"
              strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }}
              viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }} />
          </svg>
        </div>
      </section>

      {/* S8 final CTA — giant outline parallax opposite scroll + magnetic CTA + ink check */}
      <section id="s8" className="relative z-[2] overflow-hidden">
        <motion.div
          className="font-display pointer-events-none absolute inset-x-0 top-6 whitespace-nowrap text-center font-bold leading-none"
          style={{ fontSize: "21vw", opacity: 0.06, WebkitTextStroke: "2px var(--ink)", color: "transparent" }}
          aria-hidden="true"
        >
          <motion.span style={{ y: ctaY }} className="inline-block">
            VYAPAAR AI
          </motion.span>
        </motion.div>
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-4xl font-bold md:text-6xl">
            <MaskWords text="Start with one WhatsApp message." />
          </h2>
          <p className="card-sub mx-auto mt-3 max-w-md">Your ledger is waiting. Run your shop on intelligence.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <motion.div whileTap={{ scale: 0.98 }} className="inline-flex items-center gap-2">
                <Link href="/register" className="btn-primary inline-flex min-h-[44px] items-center hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4" style={{ textDecoration: "none", outlineColor: "var(--accent)" }}>Register your shop</Link>
                <motion.svg viewBox="0 0 24 24" width="30" height="30" fill="none" aria-hidden="true"
                  initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3, ease: EASE }}>
                  <motion.path d="M4 13 L10 19 L20 6" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </motion.div>
            </Magnetic>
            <Link href="/login" className="btn-ghost inline-flex min-h-[44px] items-center hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4" style={{ textDecoration: "none", outlineColor: "var(--accent)" }}>Login</Link>
          </div>
          <div className="mt-6 inline-block rounded-2xl border p-3" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
            <QRCodeSVG value={siteUrl} size={120} />
          </div>
        </div>
      </section>

      {/* footer — only real routes, dense columns, no dead links */}
      <footer className="relative z-[2] border-t" style={{ borderColor: "var(--card-border)" }}>
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 text-sm md:grid-cols-4" style={{ color: "var(--ink-soft)" }}>
          <div>
            <p className="font-display text-lg font-bold" style={{ color: "var(--ink)" }}>VyapaarAI</p>
            <p className="card-sub mt-1">Your shop runs on udhaari. Run it on intelligence.</p>
            <p className="card-sub mt-2">© 2026 VyapaarAI · Built for Bharat</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Product</p>
            <Link href="#features" className="w-fit hover:opacity-70 active:opacity-50">Features</Link>
            <Link href="#demo" className="w-fit hover:opacity-70 active:opacity-50">Demo</Link>
            <Link href="/app" className="w-fit hover:opacity-70 active:opacity-50">Dashboard</Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Company</p>
            <Link href="/register" className="w-fit hover:opacity-70 active:opacity-50">Register</Link>
            <Link href="/login" className="w-fit hover:opacity-70 active:opacity-50">Login</Link>
            <Link href="/admin" className="w-fit hover:opacity-70 active:opacity-50">Admin</Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>Resources</p>
            <Link href="#how" className="w-fit hover:opacity-70 active:opacity-50">How it works</Link>
            <Link href="/app/data" className="w-fit hover:opacity-70 active:opacity-50">Data and Sync</Link>
            <Link href="/app/chat" className="w-fit hover:opacity-70 active:opacity-50">Copilot</Link>
            <Link href="/app/actions" className="w-fit hover:opacity-70 active:opacity-50">Actions</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
