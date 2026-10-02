"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ObjSpec } from "../constants";

/**
 * 4-wrapper object stack (§5 NESTED-WRAPPER RULE).
 * [scrollParallax] > [pointerParallax] > [orbit/float] > [art].
 * Each wrapper owns exactly one job; resting rotation lives in the
 * independent CSS `rotate` property so GSAP `transform` never fights it.
 */
export default function Obj({ spec, children }: { spec: ObjSpec; children: ReactNode }) {
  const vis =
    spec.vis === "lg" ? " hf-hide-lg" : spec.vis === "lg-sm" ? " hf-hide-lg hf-keep-sm" : spec.vis === "sm" ? " hf-keep-sm" : "";
  const style = {
    left: `${spec.left}%`,
    top: `${spec.top}%`,
    width: spec.w,
    rotate: `${spec.rot}deg`,
  } as CSSProperties;
  return (
    <div data-hf={`obj-${spec.id}`} className={`hf-obj hf-${spec.band}${vis}`} style={style}>
      <div className="hf-shadow" aria-hidden="true" />
      <div className="hf-scroll">
        <div className="hf-pointer">
          <div className="hf-float">{children}</div>
        </div>
      </div>
    </div>
  );
}
