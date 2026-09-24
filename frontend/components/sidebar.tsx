"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Database, LayoutDashboard, MessageCircle, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApi, type WaStatus } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useRealtime } from "@/lib/realtime";

function WaChip() {
  const { data } = useApi<WaStatus>("/whatsapp/status");
  const connected = data?.connected === true;
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{
        borderColor: connected ? "var(--accent)" : "var(--marigold)",
        color: connected ? "var(--accent)" : "var(--marigold)",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: connected ? "var(--accent)" : "var(--marigold)" }}
      />
      {connected ? "WhatsApp connected" : "WhatsApp setup pending"}
    </div>
  );
}

function LiveChip() {
  const live = useRealtime(["sales"], () => {});
  const { t } = useLang();
  const isLive = live === "live";
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{
        borderColor: isLive ? "var(--accent)" : "var(--marigold)",
        color: isLive ? "var(--accent)" : "var(--marigold)",
      }}
    >
      <motion.span
        animate={isLive ? { opacity: [1, 0.4, 1] } : {}}
        transition={isLive ? { repeat: Infinity, duration: 2 } : {}}
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: isLive ? "var(--accent)" : "var(--marigold)" }}
      />
      {isLive ? `● ${t("live")}` : t("polling")}
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <motion.button
      whileTap={{ scale: 0.85, rotate: 40 }}
      onClick={toggle}
      title={theme === "light" ? "Dark mode" : "Light mode"}
      className="rounded-xl p-2"
      style={{ color: "var(--ink-soft)" }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          exit={{ rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="block"
        >
          {theme === "light" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t, lang, toggle } = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const NAV = [
    { href: "/app", label: t("nav_dashboard"), icon: LayoutDashboard },
    { href: "/app/chat", label: t("nav_copilot"), icon: MessageCircle },
    { href: "/app/data", label: t("nav_data"), icon: Database },
    { href: "/app/actions", label: t("nav_actions"), icon: Zap },
  ];
  return (
    <>
      {/* desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 76 : 240 }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="hidden shrink-0 flex-col gap-1 overflow-hidden border-r p-4 md:flex"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div className="mb-5 flex items-center gap-2.5 px-1">
          <Link href="/app" className="flex shrink-0 items-center gap-2.5">
            <span
              className="font-display flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold"
              style={{ background: "linear-gradient(135deg, var(--accent), #0d7a55)", color: "#fff" }}
            >
              व्या
            </span>
            {!collapsed && (
              <span>
                <span className="font-display block text-base font-bold" style={{ color: "var(--ink)" }}>
                  VyapaarAI
                </span>
                <span className="block text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  {t("tagline")}
                </span>
              </span>
            )}
          </Link>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto shrink-0 rounded-lg p-1.5"
            style={{ color: "var(--ink-faint)" }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </motion.button>
        </div>
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              title={collapsed ? n.label : undefined}
              className="relative flex items-center gap-3 rounded-xl rounded-tr-[1.6rem] px-3 py-2.5 text-sm font-medium transition"
              style={{ color: active ? "#fff" : "var(--ink-soft)" }}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl rounded-tr-[1.6rem]"
                  style={{ background: "linear-gradient(135deg, var(--accent), #0d7a55)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 34 }}
                />
              )}
              <motion.span
                className="relative z-10 block"
                whileHover={{ rotate: -10, scale: 1.18 }}
                transition={{ type: "spring", stiffness: 400, damping: 12 }}
              >
                <Icon size={18} />
              </motion.span>
              {!collapsed && <span className="relative z-10">{n.label}</span>}
            </Link>
          );
        })}
        <div className="mt-auto space-y-2 pt-4">
          {!collapsed && (
            <>
              <LiveChip />
              <WaChip />
            </>
          )}
          <div className="flex items-center gap-1 px-1">
            <ThemeToggle />
            {!collapsed && (
              <>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggle}
                  className="rounded-xl px-2 py-1 text-xs font-bold"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {lang === "en" ? "हिं" : "EN"}
                </motion.button>
                <p className="ml-auto px-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
                  VyapaarAI v2.0
                </p>
              </>
            )}
          </div>
        </div>
      </motion.aside>

      {/* mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        {NAV.map((n) => {
          const active = pathname === n.href;
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
              style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
            >
              {active && (
                <motion.span
                  layoutId="nav-pill-mobile"
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full"
                  style={{ background: "var(--accent)" }}
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
