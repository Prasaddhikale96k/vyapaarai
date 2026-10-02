"use client";

/**
 * Global overlays mounted once (G1 bookmark ribbon).
 * Desktop only (>=1024px), aria-hidden, pointer-events none, z below Nav.
 * scaleY scrubs 0->1 with page scroll; section tick dots light as sections pass.
 * Reduced motion: no scrub, ribbon hidden (static baseline preserved).
 */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";
import { registry } from "./registry";

export default function Overlays() {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      registry();
      const root = ref.current;
      if (!root || typeof window === "undefined") return;
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        try {
          const ribbon = root.querySelector(".m-ribbon-fill") as Element | null;
          if (ribbon) {
            gsap.fromTo(
              ribbon,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: document.documentElement,
                  start: "top top",
                  end: "bottom bottom",
                  scrub: 0.6,
                },
              }
            );
          }
          // Section tick dots light up as each section passes.
          const dots = Array.from(root.querySelectorAll(".m-ribbon-dot"));
          const sections = Array.from(document.querySelectorAll("section[id], main > *"));
          dots.forEach((d, i) => {
            const sec = sections[i];
            if (!sec) return;
            const dot = d as HTMLElement;
            try {
              ScrollTrigger.create({
                trigger: sec,
                start: "top center",
                onToggle: (self) => {
                  if (self.isActive) dot.style.background = "#E8771A";
                },
                onLeaveBack: () => {
                  dot.style.background = "rgba(232,119,26,0.25)";
                },
              });
            } catch {
              /* noop */
            }
          });
        } catch {
          /* ribbon skipped */
        }
      });
      return () => {
        try {
          mm.revert();
        } catch {
          /* noop */
        }
      };
    },
    { scope: ref, dependencies: [], revertOnUpdate: true }
  );

  const dots = Array.from({ length: 14 });
  return (
    <div ref={ref} aria-hidden="true" className="m-ribbon">
      <svg width="6" height="100" viewBox="0 0 6 100" preserveAspectRatio="none">
        <path d="M0 0 H6 V96 L3 100 L0 96 Z" fill="none" />
        <g className="m-ribbon-fill" style={{ transformOrigin: "top center" }}>
          <path d="M0 0 H6 V96 L3 100 L0 96 Z" fill="#E8771A" />
        </g>
      </svg>
      <div style={{ position: "absolute", right: -3, top: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "14px 0" }}>
        {dots.map((_, i) => (
          <span
            key={i}
            className="m-ribbon-dot"
            style={{ width: 4, height: 4, borderRadius: 999, background: "rgba(232,119,26,0.25)" }}
          />
        ))}
      </div>
    </div>
  );
}
