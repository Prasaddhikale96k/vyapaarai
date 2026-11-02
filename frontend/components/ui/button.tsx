"use client";

import { motion } from "framer-motion";
import type { MouseEventHandler, ReactNode } from "react";

type Props = {
  variant?: "primary" | "ghost" | "danger" | "outline";
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  title?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const styles: Record<string, string> = {
  primary: "text-white font-semibold hover:brightness-110 active:scale-[0.97]",
  ghost: "text-rose-400 hover:bg-rose-500/10",
  danger: "bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25",
  outline: "border border-zinc-700 text-zinc-200 hover:bg-zinc-800",
};

const brandBg =
  "linear-gradient(135deg, var(--brand, #e8771a), var(--brand-dark, #b85a00))";

export function Button({ variant = "primary", className = "", ...rest }: Props) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`rounded-xl px-4 py-2 text-sm transition disabled:opacity-50 ${styles[variant]} ${className}`}
      style={variant === "primary" ? { background: brandBg } : undefined}
      {...rest}
    />
  );
}
