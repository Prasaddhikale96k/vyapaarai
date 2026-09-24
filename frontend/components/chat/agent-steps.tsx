"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Wrench } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { AgentStep } from "@/lib/api";

const agentTone: Record<string, "emerald" | "sky" | "violet" | "amber" | "zinc"> = {
  sales: "emerald",
  inventory: "sky",
  finance: "violet",
};

const agentEmoji: Record<string, string> = {
  sales: "📊",
  inventory: "📦",
  finance: "💰",
};

export function AgentSteps({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;
  return (
    <div className="rounded-2xl border" style={{ borderColor: "var(--card-border)", background: "var(--card)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-xs"
        style={{ color: "var(--ink-soft)" }}
      >
        <span className="flex items-center gap-1.5">
          <Wrench size={13} />
          {steps.length} agent step{steps.length > 1 ? "s" : ""} — kaise jawab mila?
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* vertical timeline with emoji avatars + connectors */}
            <div className="relative space-y-0 px-3.5 pb-3">
              <div className="absolute bottom-4 left-[27px] top-2 w-px" style={{ background: "var(--card-border)" }} />
              {steps.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="relative flex gap-2.5 py-1.5"
                >
                  <span
                    className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
                  >
                    {agentEmoji[s.agent] ?? "🤖"}
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border p-2.5 text-xs"
                    style={{ borderColor: "var(--card-border)" }}>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone={agentTone[s.agent] ?? "zinc"}>{s.agent}</Badge>
                      <code className="font-mono" style={{ color: "var(--accent)" }}>{s.tool}</code>
                    </div>
                    <code className="block truncate font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                      {JSON.stringify(s.args)}
                    </code>
                    <p className="mt-1 line-clamp-3" style={{ color: "var(--ink-soft)" }}>{s.result_preview}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
