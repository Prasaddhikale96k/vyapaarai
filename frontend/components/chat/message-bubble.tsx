"use client";

import { motion } from "framer-motion";
import { fmtClock } from "@/lib/api";

export function renderLite(text: string) {
  // markdown-lite: **bold** + newlines. Returns React nodes.
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-zinc-50">
          {m[1]}
        </strong>
      );
    }
    return (
      <span key={i} className="whitespace-pre-line">
        {p}
      </span>
    );
  });
}

export function MessageBubble({
  role,
  content,
  time,
}: {
  role: "user" | "ai";
  content: string;
  time: Date;
}) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`flex items-end gap-1.5 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--accent), #0d7a55)" }}>
          व्या
        </span>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser ? "rounded-br-md text-white" : "rounded-bl-md border"
        }`}
        style={
          isUser
            ? { background: "#005C4B" }
            : {
                background: "color-mix(in srgb, var(--card) 82%, var(--paper))",
                borderColor: "var(--card-border)",
                color: "var(--ink)",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='26'%3E%3Cline x1='0' y1='25.5' x2='120' y2='25.5' stroke='%23059669' stroke-opacity='0.10' stroke-width='1'/%3E%3C/svg%3E\")",
              }
        }
      >
        <div>{renderLite(content)}</div>
        <p className="mt-1 text-right text-[10px]" style={{ color: isUser ? "rgba(255,255,255,.7)" : "var(--ink-faint)" }}>
          {fmtClock(time)} {isUser ? "✓✓" : ""}
        </p>
      </div>
    </motion.div>
  );
}
