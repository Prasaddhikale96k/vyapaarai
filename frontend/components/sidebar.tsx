"use client";

/**
 * Supabase-style sidebar: slim icon rail (68px) fixed on the left.
 * Mouse left edge pe lao (hover/focus) -> panel overlay me khulta hai.
 * Kabhi scroll nahi hota (h-screen, overflow hidden) — sab fit hai.
 * Mobile pe neeche bottom nav (unchanged).
 */

import { motion } from "framer-motion";
import { Database, LayoutDashboard, MessageCircle, Users, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { useApi, type WaStatus } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

function WaChip({ full }: { full: boolean }) {
  const { data } = useApi<WaStatus>("/whatsapp/status");
  const connected = data?.connected === true;
  if (!full) {
    return (
      <span
        className="mx-auto block h-2 w-2 rounded-full"
        title={connected ? "WhatsApp connected" : "WhatsApp setup pending"}
        style={{ background: connected ? "var(--accent)" : "var(--marigold)" }}
      />
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{
        borderColor: connected ? "var(--accent)" : "var(--marigold)",
        color: connected ? "var(--accent)" : "var(--marigold)",
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: connected ? "var(--accent)" : "var(--marigold)" }}
      />
      {connected ? "WhatsApp connected" : "WhatsApp setup pending"}
    </div>
  );
}

function LiveChip({ full }: { full: boolean }) {
  const live = useRealtime(["sales"], () => {});
  const { t } = useLang();
  const isLive = live === "live";
  if (!full) {
    return (
      <motion.span
        animate={isLive ? { opacity: [1, 0.4, 1] } : {}}
        transition={isLive ? { repeat: Infinity, duration: 2 } : {}}
        className="mx-auto block h-2 w-2 rounded-full"
        title={isLive ? t("live") : t("polling")}
        style={{ background: isLive ? "var(--accent)" : "var(--marigold)" }}
      />
    );
  }
  return (
    <div
      className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{
        borderColor: isLive ? "var(--accent)" : "var(--marigold)",
        color: isLive ? "var(--accent)" : "var(--marigold)",
      }}
    >
      <motion.span
        animate={isLive ? { opacity: [1, 0.4, 1] } : {}}
        transition={isLive ? { repeat: Infinity, duration: 2 } : {}}
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: isLive ? "var(--accent)" : "var(--marigold)" }}
      />
      {isLive ? `● ${t("live")}` : t("polling")}
    </div>
  );
}

function FadeLabel({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <motion.span
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      className="relative z-10 whitespace-nowrap"
    >
      {children}
    </motion.span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t, lang, toggle } = useLang();
  const [open, setOpen] = useState(false);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => {
    if (closeT.current) clearTimeout(closeT.current);
    setOpen(true);
  };
  const leave = () => {
    if (closeT.current) clearTimeout(closeT.current);
    closeT.current = setTimeout(() => setOpen(false), 140);
  };

  const NAV = [
    { href: "/app", label: t("nav_dashboard"), icon: LayoutDashboard },
    { href: "/app/chat", label: t("nav_copilot"), icon: MessageCircle },
    { href: "/app/data", label: t("nav_data"), icon: Database },
    { href: "/app/actions", label: t("nav_actions"), icon: Zap },
    { href: "/app/contacts", label: t("nav_contacts"), icon: Users },
  ];

  return (
    <>
      {/* spacer: content rail ke liye jagah chhodta hai (layout shift nahi) */}
      <div className="hidden w-[68px] shrink-0 md:block" aria-hidden="true" />

      {/* desktop: fixed rail, hover/focus pe overlay panel */}
      <div
        className="fixed left-0 top-0 z-50 hidden h-screen md:block"
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={enter}
        onBlur={leave}
      >
        <motion.aside
          initial={false}
          animate={{ width: open ? 248 : 68 }}
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className="flex h-screen flex-col gap-1 overflow-hidden border-r p-3"
          style={{
            background: "var(--card)",
            borderColor: "var(--card-border)",
            boxShadow: open ? "12px 0 40px rgba(26,18,9,0.14)" : "none",
          }}
          aria-label="App navigation"
        >
          <div className="mb-4 flex items-center gap-2.5 px-1.5 pt-1">
            <Link
              href="/app"
              className="flex shrink-0 items-center gap-2.5 rounded-lg"
              aria-label="VyapaarAI dashboard"
            >
              <span
                className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg font-bold"
                style={{ background: "linear-gradient(135deg, var(--brand, #e8771A), var(--brand-dark, #b85a00))", color: "#fff" }}
              >
                व्या
              </span>
              {open && (
                <span className="overflow-hidden">
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.16 }}
                    className="block whitespace-nowrap"
                  >
                    <span className="font-display block text-base font-bold leading-tight" style={{ color: "var(--ink)" }}>
                      VyapaarAI
                    </span>
                    <span className="block text-[11px] leading-tight" style={{ color: "var(--ink-faint)" }}>
                      {t("tagline")}
                    </span>
                  </motion.span>
                </span>
              )}
            </Link>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Primary">
            {NAV.map((n) => {
              const active = pathname === n.href;
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  title={n.label}
                  aria-current={active ? "page" : undefined}
                  className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
                  style={{ color: active ? "#fff" : "var(--ink-soft)" }}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl"
                      style={{ background: "linear-gradient(135deg, var(--brand, #e8771A), var(--brand-dark, #b85a00))" }}
                      transition={{ type: "spring", stiffness: 400, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10 block shrink-0">
                    <Icon size={19} />
                  </span>
                  <FadeLabel show={open}>{n.label}</FadeLabel>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-2 px-1 pb-1 pt-4">
            <LiveChip full={open} />
            <WaChip full={open} />
            {open ? (
              <div className="flex items-center gap-1">
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggle}
                  className="min-h-[44px] rounded-xl px-3 py-1 text-xs font-bold"
                  style={{ color: "var(--ink-soft)" }}
                  aria-label="Bhasha badlo"
                >
                  {lang === "en" ? "हिं" : "EN"}
                </motion.button>
                <p className="ml-auto whitespace-nowrap px-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  VyapaarAI v2.0
                </p>
              </div>
            ) : (
              <button
                onClick={toggle}
                className="mx-auto min-h-[44px] min-w-[44px] rounded-xl text-xs font-bold"
                style={{ color: "var(--ink-soft)" }}
                title="Bhasha badlo"
                aria-label="Bhasha badlo"
              >
                {lang === "en" ? "हिं" : "EN"}
              </button>
            )}
          </div>
        </motion.aside>
      </div>

      {/* mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
        aria-label="Primary"
      >
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium"
              style={{ color: active ? "var(--brand, #e8771a)" : "var(--ink-faint)" }}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill-mobile"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full"
                  style={{ background: "var(--brand, #e8771a)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <Icon size={20} />
              {n.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
