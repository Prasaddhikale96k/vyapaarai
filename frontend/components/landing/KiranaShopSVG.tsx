"use client";

/**
 * Kirana shop counter scene — hand-coded flat vector SVG (500×380).
 * Fully visible in static HTML; GSAP adds: ruled-line draw, chat bubble +
 * typing dots, lightbulb pulse, whole-scene slide-in.
 */

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { EASE_EXPO, prefersReduced } from "./gsap-setup";

gsap.registerPlugin(ScrollTrigger);

function WhatsAppGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2 A10 10 0 0 0 3.5 15.5 L2 22 L8.7 20.4 A10 10 0 1 0 12 2 Z"
        fill="#25D366"
      />
      <path
        d="M8.8 8.2 C8.5 8.2 8 8.4 7.8 8.9 C7.3 10 7.8 11.9 9.2 13.7 C10.6 15.5 12.4 16.4 13.9 16.2 C14.5 16.1 14.9 15.7 15.1 15.2 L15.7 13.9 C15.8 13.6 15.7 13.3 15.4 13.1 L13.9 12.2 C13.7 12.1 13.4 12.1 13.2 12.3 L12.6 12.9 C11.4 12.3 10.3 11.2 9.8 10 L10.4 9.4 C10.6 9.2 10.6 8.9 10.5 8.7 L9.6 7.2 C9.4 6.9 9.1 6.8 8.8 8.2"
        fill="#fff"
      />
    </svg>
  );
}

export { WhatsAppGlyph };

export default function KiranaShopSVG() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const q = gsap.utils.selector(root.current);
      const tl = gsap.timeline({
        defaults: { ease: EASE_EXPO },
        scrollTrigger: { trigger: root.current, start: "top 95%", once: true },
      });
      tl.from(q('[data-gsap="scene"]'), { x: 60, opacity: 0.1, duration: 1.2 }, 0)
        .from(q('[data-gsap="rule"]'), { scaleX: 0, transformOrigin: "left center", duration: 0.5, stagger: 0.15 }, 0.4)
        .from(q('[data-gsap="bubble"]'), { opacity: 0, y: 8, duration: 0.4 }, 1.0);
      gsap.to(q('[data-gsap="bulb"]'), {
        opacity: 0.8,
        scale: 1.02,
        transformOrigin: "center",
        duration: 1,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      q('[data-gsap="dot"]').forEach((d, i) => {
        gsap.to(d as Element, {
          y: -3,
          duration: 0.4,
          yoyo: true,
          repeat: -1,
          delay: i * 0.15,
          ease: "sine.inOut",
        });
      });
    },
    { scope: root }
  );

  return (
    <div ref={root} className="mx-auto w-full max-w-[500px]">
      <svg viewBox="0 0 500 380" className="h-auto w-full" role="img" aria-label="Illustration of Sharma Kirana shop counter with an open ledger and a phone showing WhatsApp">
        {/* ambient */}
        <ellipse cx="250" cy="352" rx="190" ry="16" fill="#E8DDD0" opacity="0.7" />
        {/* hanging bulb */}
        <g data-gsap="bulb">
          <line x1="250" y1="0" x2="250" y2="34" stroke="#1A1209" strokeWidth="2" />
          <circle cx="250" cy="48" r="14" fill="#FFF8E1" stroke="#D4A017" strokeWidth="2" />
          <circle cx="250" cy="48" r="5" fill="#E8771A" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1={250 + 22 * Math.cos((a * Math.PI) / 180)}
              y1={48 + 22 * Math.sin((a * Math.PI) / 180)}
              x2={250 + 28 * Math.cos((a * Math.PI) / 180)}
              y2={48 + 28 * Math.sin((a * Math.PI) / 180)}
              stroke="#D4A017"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ))}
        </g>
        {/* shop sign */}
        <g transform="rotate(-2 250 92)">
          <rect x="160" y="74" width="180" height="36" rx="6" fill="#0F2040" />
          <text x="250" y="98" textAnchor="middle" fontSize="17" fill="#FDFAF4" fontFamily="Georgia, serif" fontWeight="bold">
            Sharma Kirana
          </text>
        </g>
        {/* shelves with jars */}
        {[0, 1, 2].map((row) => (
          <g key={row}>
            <rect x="70" y={128 + row * 34} width="150" height="6" rx="3" fill="#8B6914" />
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                {i % 2 === 0 ? (
                  <circle cx={88 + i * 36} cy={118 + row * 34} r="9" fill={["#E8771A", "#D4A017", "#2D6A4F", "#C0392B"][ (row + i) % 4 ]} opacity="0.85" />
                ) : (
                  <rect x={80 + i * 36} y={106 + row * 34} width="16" height="22" rx="3" fill={["#FFF3E0", "#E8DDD0", "#FFF8E1", "#DCF8C6"][ (row + i) % 4 ]} stroke="#8B7355" strokeWidth="1.5" />
                )}
              </g>
            ))}
          </g>
        ))}
        {/* shopkeeper */}
        <g>
          <circle cx="392" cy="150" r="20" fill="#4A3728" />
          <rect x="368" y="170" width="48" height="62" rx="10" fill="#E8771A" />
          <path d="M380 178 h24" stroke="#B85A00" strokeWidth="2" strokeLinecap="round" />
          <circle cx="385" cy="148" r="2.4" fill="#FDFAF4" />
          <circle cx="399" cy="148" r="2.4" fill="#FDFAF4" />
          <path d="M386 158 Q392 162 398 158" stroke="#FDFAF4" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
        {/* counter */}
        <g data-gsap="scene">
          <rect x="40" y="232" width="420" height="110" rx="10" fill="#8B6914" />
          <rect x="40" y="232" width="420" height="14" rx="7" fill="#A67C2E" />
          {/* open bahi-khata */}
          <g>
            <rect x="80" y="252" width="150" height="66" rx="4" fill="#C0392B" />
            <rect x="86" y="256" width="66" height="58" rx="2" fill="#FFF9F0" />
            <rect x="152" y="256" width="66" height="58" rx="2" fill="#FFF9F0" />
            {[0, 1, 2, 3].map((i) => (
              <line key={i} data-gsap="rule" x1="91" y1={266 + i * 11} x2="147" y2={266 + i * 11} stroke="#C9B99A" strokeWidth="1.4" />
            ))}
            <text x="158" y="272" fontSize="9" fill="#4A3728" fontFamily="'JetBrains Mono', monospace">320</text>
            <text x="158" y="283" fontSize="9" fill="#4A3728" fontFamily="'JetBrains Mono', monospace">1,200</text>
            <text x="158" y="294" fontSize="9" fill="#2D6A4F" fontFamily="'JetBrains Mono', monospace">paid</text>
          </g>
          {/* phone with WhatsApp */}
          <g>
            <rect x="258" y="246" width="70" height="88" rx="10" fill="#1A1209" />
            <rect x="262" y="250" width="62" height="80" rx="7" fill="#E5DDD5" />
            <rect x="262" y="250" width="62" height="16" rx="7" fill="#128C7E" />
            <circle cx="270" cy="258" r="4" fill="#25D366" />
            <text x="278" y="261" fontSize="7" fill="#fff" fontFamily="Inter, sans-serif">VyapaarAI</text>
            <g data-gsap="bubble">
              <rect x="266" y="272" width="54" height="26" rx="6" fill="#fff" stroke="#E8DDD0" strokeWidth="1" />
              <text x="271" y="282" fontSize="7" fill="#1A1209" fontFamily="Inter, sans-serif">Bill read!</text>
              <text x="271" y="291" fontSize="6.5" fill="#2D6A4F" fontFamily="Inter, sans-serif">+ Rs.2,340</text>
              <circle data-gsap="dot" cx="270" cy="306" r="2.4" fill="#8B7355" />
              <circle data-gsap="dot" cx="277" cy="306" r="2.4" fill="#8B7355" />
              <circle data-gsap="dot" cx="284" cy="306" r="2.4" fill="#8B7355" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
