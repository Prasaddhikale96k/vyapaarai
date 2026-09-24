"use client";

/** QA route: renders every hand-coded doodle with labels + draw-in. */

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import {
  BiscuitPack,
  ChaiGlass,
  KiranaStore,
  MasalaDabba,
  MilkPouch,
  Munshi,
  OilBottle,
  RiceSack,
  RupeeCoins,
  Scooter,
  SoapBar,
  Sparkline,
  StampOK,
  StampOverdue,
  StampPaid,
  UdhaarKhata,
  WhatsAppPhone,
} from "@/components/illustrations/doodles";

const ITEMS: [string, (p: { className?: string }) => React.ReactNode][] = [
  ["Munshi", Munshi],
  ["KiranaStore", KiranaStore],
  ["UdhaarKhata", UdhaarKhata],
  ["RupeeCoins", RupeeCoins],
  ["ChaiGlass", ChaiGlass],
  ["Scooter", Scooter],
  ["WhatsAppPhone", WhatsAppPhone],
  ["RiceSack", RiceSack],
  ["OilBottle", OilBottle],
  ["SoapBar", SoapBar],
  ["BiscuitPack", BiscuitPack],
  ["MilkPouch", MilkPouch],
  ["MasalaDabba", MasalaDabba],
  ["Sparkline", Sparkline],
];

export default function DoodlesPreview() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.utils.toArray<SVGGeometryElement>("[data-draw]").forEach((path, i) => {
        try {
          const len = path.getTotalLength();
          gsap.fromTo(
            path,
            { strokeDasharray: len, strokeDashoffset: len },
            { strokeDashoffset: 0, duration: 1.2, ease: "expo.out", delay: (i % 14) * 0.06 }
          );
        } catch {
          /* ignore non-measurable */
        }
      });
    },
    { scope: root }
  );
  return (
    <div ref={root} className="min-h-screen p-12" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <h1 className="font-display mb-2 text-center text-4xl font-bold">Doodle Inventory (QA Preview)</h1>
      <p className="card-sub mb-12 text-center">17 exports · draw-in on mount · currentColor adapts to theme</p>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
        {ITEMS.map(([name, C]) => (
          <div key={name} className="card flex flex-col items-center gap-4 p-6">
            {C({ className: "h-24 w-24" })}
            <span className="card-sub">{name}</span>
          </div>
        ))}
        {[
          ["StampPaid", <StampPaid key="p" />],
          ["StampOverdue", <StampOverdue key="o" />],
          ["StampOK", <StampOK key="k" />],
        ].map(([name, el]) => (
          <div key={name as string} className="card flex flex-col items-center gap-4 p-6">
            {el as React.ReactNode}
            <span className="card-sub">{name as string}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
