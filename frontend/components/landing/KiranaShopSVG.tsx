"use client";

/**
 * Kirana shop counter scene — hand-coded flat vector SVG (500×380).
 * Artwork (shapes/colors/positions) unchanged; parts grouped with ids so they
 * move independently: #cord-bulb, #sign, #shelf (+ .product children),
 * #shopkeeper (#head > #eyes, #body), #counter, #khata (#khata-lines,
 * #khata-numbers, #paid-stamp), #phone (#phone-screen, #msg-bubble, #typing-dots).
 * Entry: one GSAP timeline (≤2.2s, expo-out, transform+opacity only).
 * Loops: GPU-cheap CSS keyframes under .kirana-loops (JS adds the class only
 * when motion is allowed). Message cycle: tiny React interval in this file.
 * Reduced-motion / no-JS: fully static scene, message 1, final numbers.
 */

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { prefersReduced } from "./gsap-setup";

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

// Product-true message cycle (bubble shows two lines each).
const MESSAGES: [string, string][] = [
  ["Bill read!", "+ Rs.2,340"],
  ["Udhaari reminder", "sent → Ramesh"],
  ["Low stock:", "sugar (5 kg)"],
];

const JAR_COLORS = ["#E8771A", "#D4A017", "#2D6A4F", "#C0392B"];
const BOX_COLORS = ["#FFF3E0", "#E8DDD0", "#FFF8E1", "#DCF8C6"];

function countUp(el: SVGTextElement | null, to: number, duration: number): void {
  if (!el) return;
  if (prefersReduced()) {
    el.textContent = to.toLocaleString("en-IN");
    return;
  }
  const t0 = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(to * eased).toLocaleString("en-IN");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export default function KiranaShopSVG() {
  const root = useRef<HTMLDivElement>(null);
  const num1 = useRef<SVGTextElement>(null);
  const num2 = useRef<SVGTextElement>(null);
  const [motionOK, setMotionOK] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);
  const [typing, setTyping] = useState(false);

  // Loops + message cycle only when motion is allowed (client-only decision).
  useEffect(() => {
    if (prefersReduced()) return;
    setMotionOK(true);
    let i = 0;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (!alive) return;
      setTyping(true);
      timer = setTimeout(() => {
        if (!alive) return;
        setTyping(false);
        setMsgIdx(i % MESSAGES.length);
        i += 1;
        timer = setTimeout(step, 4100);
      }, 900);
    };
    timer = setTimeout(step, 2600); // let the entry choreography finish first
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  useGSAP(
    () => {
      if (prefersReduced()) return;
      const q = gsap.utils.selector(root.current);
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        scrollTrigger: { trigger: root.current, start: "top 95%", once: true },
        onComplete: () => {
          countUp(num1.current, 320, 800);
          countUp(num2.current, 1200, 900);
        },
      });
      tl.from("#cord-bulb", { y: -20, opacity: 0, duration: 0.3 }, 0)
        .from("#sign", { rotation: -6, transformOrigin: "50% 0%", duration: 0.45, ease: "back.out(1.4)" }, 0.15)
        .from("#shelf", { y: 24, opacity: 0, duration: 0.3 }, 0.3)
        .from(q(".product"), { scale: 0.6, opacity: 0, transformOrigin: "center", duration: 0.3, stagger: 0.04 }, 0.45)
        .from("#shopkeeper", { scale: 0.6, opacity: 0, transformOrigin: "50% 100%", duration: 0.35 }, 0.7)
        .from("#counter", { y: 30, opacity: 0, duration: 0.3 }, 0.85)
        .from("#khata-lines line", { scaleX: 0, transformOrigin: "left center", duration: 0.35, stagger: 0.05 }, 1.0)
        .fromTo("#paid-stamp", { scale: 1.3, rotation: -8, transformOrigin: "center" }, { scale: 1, rotation: 0, duration: 0.35 }, 1.3)
        .from("#phone", { y: 30, opacity: 0, duration: 0.35 }, 1.45)
        .from("#msg-bubble", { scale: 0.8, opacity: 0, transformOrigin: "center", duration: 0.3 }, 1.7);
      void q;
    },
    { scope: root }
  );

  const [line1, line2] = MESSAGES[msgIdx];

  return (
    <div ref={root} className="kirana-scene mx-auto w-full max-w-[500px]">
      <svg
        viewBox="0 0 500 380"
        className={`h-auto w-full${motionOK ? " kirana-loops" : ""}`}
        role="img"
        aria-label="Illustration of Sharma Kirana shop counter with an open ledger and a phone showing WhatsApp"
      >
        {/* ambient */}
        <ellipse cx="250" cy="352" rx="190" ry="16" fill="#E8DDD0" opacity="0.7" />
        {/* hanging bulb */}
        <g id="cord-bulb">
          <line x1="250" y1="0" x2="250" y2="34" stroke="#1A1209" strokeWidth="2" />
          <circle cx="250" cy="48" r="14" fill="#FFF8E1" stroke="#D4A017" strokeWidth="2" />
          <circle cx="250" cy="48" r="5" fill="#E8771A" />
          <g className="bulb-rays">
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
        </g>
        {/* shop sign */}
        <g id="sign">
          <g transform="rotate(-2 250 92)">
            <rect x="160" y="74" width="180" height="36" rx="6" fill="#0F2040" />
            <text x="250" y="98" textAnchor="middle" fontSize="17" fill="#FDFAF4" fontFamily="Georgia, serif" fontWeight="bold">
              Sharma Kirana
            </text>
          </g>
        </g>
        {/* shelves with jars/bottles */}
        <g id="shelf">
          {[0, 1, 2].map((row) => (
            <g key={row}>
              <rect x="70" y={128 + row * 34} width="150" height="6" rx="3" fill="#8B6914" />
              {[0, 1, 2, 3].map((i) =>
                i % 2 === 0 ? (
                  <circle
                    key={i}
                    className={row === 1 && i === 2 ? "product product-wiggle" : "product"}
                    cx={88 + i * 36}
                    cy={118 + row * 34}
                    r="9"
                    fill={JAR_COLORS[(row + i) % 4]}
                    opacity="0.85"
                  />
                ) : (
                  <rect
                    key={i}
                    className="product"
                    x={80 + i * 36}
                    y={106 + row * 34}
                    width="16"
                    height="22"
                    rx="3"
                    fill={BOX_COLORS[(row + i) % 4]}
                    stroke="#8B7355"
                    strokeWidth="1.5"
                  />
                )
              )}
            </g>
          ))}
        </g>
        {/* shopkeeper */}
        <g id="shopkeeper">
          <g id="head">
            <circle cx="392" cy="150" r="20" fill="#4A3728" />
            <g id="eyes">
              <circle cx="385" cy="148" r="2.4" fill="#FDFAF4" />
              <circle cx="399" cy="148" r="2.4" fill="#FDFAF4" />
            </g>
            <path d="M386 158 Q392 162 398 158" stroke="#FDFAF4" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
          <g id="body">
            <rect x="368" y="170" width="48" height="62" rx="10" fill="#E8771A" />
            <path d="M380 178 h24" stroke="#B85A00" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
        {/* counter */}
        <g id="counter">
          <rect x="40" y="232" width="420" height="110" rx="10" fill="#8B6914" />
          <rect x="40" y="232" width="420" height="14" rx="7" fill="#A67C2E" />
          {/* open bahi-khata */}
          <g id="khata">
            <rect x="80" y="252" width="150" height="66" rx="4" fill="#C0392B" />
            <rect x="86" y="256" width="66" height="58" rx="2" fill="#FFF9F0" />
            <rect x="152" y="256" width="66" height="58" rx="2" fill="#FFF9F0" />
            <g id="khata-lines">
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1="91" y1={266 + i * 11} x2="147" y2={266 + i * 11} stroke="#C9B99A" strokeWidth="1.4" />
              ))}
            </g>
            <g id="khata-numbers" fontFamily="'JetBrains Mono', monospace" fontSize="9" fill="#4A3728">
              <text ref={num1} x="158" y="272">320</text>
              <text ref={num2} x="158" y="283">1,200</text>
            </g>
            <g id="paid-stamp">
              <text x="158" y="294" fontSize="9" fill="#2D6A4F" fontFamily="'JetBrains Mono', monospace">paid</text>
            </g>
          </g>
          {/* phone with WhatsApp */}
          <g id="phone">
            <rect x="258" y="246" width="70" height="88" rx="10" fill="#1A1209" />
            <g id="phone-screen">
              <rect x="262" y="250" width="62" height="80" rx="7" fill="#E5DDD5" />
              <rect x="262" y="250" width="62" height="16" rx="7" fill="#128C7E" />
              <circle cx="270" cy="258" r="4" fill="#25D366" />
              <text x="278" y="261" fontSize="7" fill="#fff" fontFamily="Inter, sans-serif">VyapaarAI</text>
              <g id="msg-bubble" key={msgIdx} className={motionOK ? "bubble-pop" : undefined}>
                <rect x="266" y="272" width="54" height="26" rx="6" fill="#fff" stroke="#E8DDD0" strokeWidth="1" />
                <text x="269" y="282" fontSize="6" fill="#1A1209" fontFamily="Inter, sans-serif">{line1}</text>
                <text x="269" y="290" fontSize="6" fill="#2D6A4F" fontFamily="Inter, sans-serif">{line2}</text>
              </g>
              <g id="typing-dots" opacity={typing ? 1 : 0}>
                <circle className="tdot" cx="270" cy="306" r="2.4" fill="#8B7355" />
                <circle className="tdot" cx="277" cy="306" r="2.4" fill="#8B7355" />
                <circle className="tdot" cx="284" cy="306" r="2.4" fill="#8B7355" />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
