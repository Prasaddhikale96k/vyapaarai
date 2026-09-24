"use client";

/**
 * Bahi-khata illustration — open red-cover ledger, cream pages, mono numerals,
 * crossed-out entries, red ink stain + wobbly marker circles.
 * Static HTML fully visible; stain scale + circle draw-on enhance on scroll.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

export default function BahiKhataSVG() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      if (typeof window === "undefined") return;
      const q = gsap.utils.selector(root.current);
      // stain grows from its corner
      gsap.from(q('[data-gsap="stain"]'), {
        scale: 0,
        transformOrigin: "top right",
        duration: 0.9,
        ease: EASE_EXPO,
        immediateRender: false,
        scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
      });
      // marker circles draw on (getTotalLength is client-only by construction)
      q('[data-gsap="circle"]').forEach((p) => {
        const el = p as unknown as SVGPathElement;
        let len = 300;
        try {
          len = el.getTotalLength();
        } catch {
          /* keep fallback */
        }
        gsap.fromTo(
          el,
          { strokeDasharray: len, strokeDashoffset: len },
          {
            strokeDashoffset: 0,
            duration: 1,
            ease: "power1.inOut",
            immediateRender: false,
            scrollTrigger: { trigger: root.current, start: "top 80%", once: true },
          }
        );
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="mx-auto w-full max-w-[400px]">
      <svg viewBox="0 0 400 450" className="h-auto w-full" role="img" aria-label="Illustration of an open bahi-khata ledger with circled overdue entries and a red ink stain">
        <ellipse cx="200" cy="420" rx="150" ry="14" fill="#E8DDD0" opacity="0.7" />
        {/* cover */}
        <path d="M40 60 L200 40 L200 400 L40 420 Z" fill="#A93226" />
        <path d="M360 60 L200 40 L200 400 L360 420 Z" fill="#C0392B" />
        {/* pages */}
        <path d="M56 72 L196 55 L196 388 L56 405 Z" fill="#FFF9F0" />
        <path d="M344 72 L204 55 L204 388 L344 405 Z" fill="#FFFDF8" />
        <path d="M200 40 L200 400" stroke="#7B241C" strokeWidth="3" />
        {/* ruled lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={i}>
            <line x1="66" y1={100 + i * 24} x2="188" y2={88 + i * 24} stroke="#E8DDD0" strokeWidth="1.2" />
            <line x1="212" y1={88 + i * 24} x2="334" y2={100 + i * 24} stroke="#E8DDD0" strokeWidth="1.2" />
          </g>
        ))}
        {/* handwriting numerals */}
        <g fontFamily="'JetBrains Mono', monospace" fontSize="13" fill="#4A3728">
          <text x="76" y="102" transform="rotate(-4 76 102)">320</text>
          <text x="120" y="98" transform="rotate(2 120 98)">1,200</text>
          <text x="76" y="126" transform="rotate(3 76 126)">850</text>
          <text x="224" y="96" transform="rotate(-2 224 96)">4,300</text>
          <text x="224" y="120" transform="rotate(3 224 120)">1,800</text>
          <text x="268" y="116" transform="rotate(-3 268 116)">2,100</text>
        </g>
        {/* crossed-out entry */}
        <line x1="72" y1="140" x2="150" y2="132" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" />
        {/* wobbly marker circles around overdue figures */}
        <path
          data-gsap="circle"
          d="M214 84 C 230 78, 258 78, 272 86 C 284 93, 282 104, 268 108 C 250 113, 222 112, 214 104 C 208 97, 208 89, 214 84"
          fill="none"
          stroke="#E8771A"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          data-gsap="circle"
          d="M216 108 C 232 102, 258 102, 270 110 C 280 117, 276 127, 262 130 C 244 134, 220 132, 214 124 C 210 117, 210 111, 216 108"
          fill="none"
          stroke="#C0392B"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* red ink stain, top-right corner */}
        <g data-gsap="stain">
          <path
            d="M344 72 C 330 78, 328 94, 338 102 C 334 112, 344 120, 352 114 C 360 120, 368 110, 364 100 C 370 90, 360 76, 352 78 C 350 74, 347 72, 344 72 Z"
            fill="#C0392B"
            opacity="0.55"
          />
          <circle cx="352" cy="128" r="3" fill="#C0392B" opacity="0.5" />
          <circle cx="358" cy="140" r="2" fill="#C0392B" opacity="0.45" />
        </g>
        {/* cloth binding */}
        <rect x="36" y="56" width="10" height="368" rx="4" fill="#E8771A" transform="rotate(3 41 240)" />
      </svg>
    </div>
  );
}
