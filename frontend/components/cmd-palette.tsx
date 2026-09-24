"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

export function CmdPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { t } = useLang();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const generate = useCallback(async () => {
    setOpen(false);
    try {
      const r = await apiFetch<{ created: number }>("/actions/generate", { method: "POST" });
      toast.success(`+${r.created} recommendations`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate fail ho gaya");
    }
  }, []);

  const sendReport = useCallback(async () => {
    setOpen(false);
    try {
      const r = await apiFetch<{ simulated?: boolean }>("/reports/send-now", { method: "POST" });
      toast.success(r.simulated ? "Simulated (WhatsApp connect karo)" : "WhatsApp pe bhej di ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bhej nahi paye");
    }
  }, []);

  const refresh = useCallback(() => {
    setOpen(false);
    window.location.reload();
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command"
      className="fixed left-1/2 top-[22%] z-[60] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl border bg-[var(--card)] shadow-2xl"
      style={{ borderColor: "var(--card-border)" }}
    >
      <Command.Input
        placeholder={t("search_placeholder")}
        className="w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
        style={{ borderColor: "var(--card-border)", color: "var(--ink)" }}
      />
      <Command.List className="max-h-[300px] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-xs" style={{ color: "var(--ink-soft)" }}>
          {t("empty_generic")}
        </Command.Empty>
        <Command.Group heading="Pages" className="px-2 py-1 text-[11px] font-semibold uppercase" >
          {[
            ["Dashboard", "/app"],
            ["Copilot", "/app/chat"],
            ["Data & Sync", "/app/data"],
            ["Actions", "/app/actions"],
          ].map(([label, href]) => (
            <Command.Item
              key={href}
              onSelect={() => go(href)}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-[var(--accent-soft)]"
            >
              {label}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Actions" className="px-2 py-1 text-[11px] font-semibold uppercase">
          <Command.Item
            onSelect={generate}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-[var(--accent-soft)]"
          >
            ⚡ Generate recommendations
          </Command.Item>
          <Command.Item
            onSelect={sendReport}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-[var(--accent-soft)]"
          >
            📄 Send daily report on WhatsApp
          </Command.Item>
          <Command.Item
            onSelect={refresh}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-[var(--accent-soft)]"
          >
            ↻ Refresh page
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
