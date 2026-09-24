"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ActionItem } from "@/lib/api";

export function SuggestedChips({ items }: { items: ActionItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.06 * i }}
        >
          <Link
            href="/actions"
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20"
          >
            {a.title}
            <span className="flex items-center gap-0.5 text-[11px] opacity-80">
              Approve in Actions <ArrowRight size={12} />
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
