"use client";

/** Magnetic CTA: attracts cursor within 150px, inert on touch/reduced-motion. */

import Link from "next/link";
import { useRef, type MouseEvent, type ReactNode } from "react";

export default function MagneticButton({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const move = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 150) {
      el.style.transform = `translate(${(dx * 0.2).toFixed(1)}px, ${(dy * 0.2).toFixed(1)}px)`;
    } else {
      el.style.transform = "translate(0, 0)";
    }
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "translate(0, 0)";
  };

  return (
    <div className="inline-block" onMouseMove={move} onMouseLeave={leave}>
      <Link
        ref={ref}
        href={href}
        className={`inline-block ${className}`}
        style={{ transition: "transform 0.3s cubic-bezier(0.19, 1, 0.22, 1)" }}
      >
        {children}
      </Link>
    </div>
  );
}
