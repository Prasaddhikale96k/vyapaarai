"use client";

/**
 * Hero kinetic typography — manual word-span splits (revert restores SSR DOM),
 * swash + underline overlays, highlighter bars, trust segments, arrow wrap.
 * Devanagari: the H1/sub/trust are 100% English; chat chips are never split
 * (they live in HeroStage as atomic spans).
 */

export interface SplitOut {
  words: HTMLElement[];
  revert: () => void;
}

function wrapWord(text: string): HTMLElement {
  const mask = document.createElement("span");
  mask.setAttribute("aria-hidden", "true");
  mask.className = "hf-wmask";
  const inner = document.createElement("span");
  inner.className = "hf-wword";
  inner.textContent = text;
  mask.appendChild(inner);
  return mask;
}

/** Split an element's top-level text into masked word units. Returns inner words. */
export function splitWords(host: HTMLElement): SplitOut {
  const original = host.innerHTML;
  const words: HTMLElement[] = [];
  const frag = document.createDocumentFragment();
  Array.from(host.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = (node as Text).nodeValue ?? "";
      raw.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
          return;
        }
        const m = wrapWord(part);
        frag.appendChild(m);
        const inner = m.firstElementChild as HTMLElement | null;
        if (inner) words.push(inner);
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      frag.appendChild(node);
    }
  });
  host.replaceChildren(frag);
  return {
    words,
    revert: () => {
      try {
        host.innerHTML = original;
      } catch {
        /* noop */
      }
    },
  };
}

/**
 * Split each H1 line-mask inner into words. H1 gets aria-label with the full
 * text. Returns per-line words + one revert for the whole h1.
 */
export function splitH1(h1: HTMLElement): { lines: HTMLElement[][]; revert: () => void } {
  const label = (h1.textContent ?? "").replace(/\s+/g, " ").trim();
  if (label) h1.setAttribute("aria-label", label);
  const inners = Array.from(h1.querySelectorAll<HTMLElement>('[data-gsap="mask"]'));
  const splits = inners.map((el) => splitWords(el));
  return {
    lines: splits.map((s) => s.words),
    revert: () => {
      splits.forEach((s) => s.revert());
      try {
        h1.removeAttribute("aria-label");
      } catch {
        /* noop */
      }
    },
  };
}

/** Split the trust line by " · " segments into spans (resting opacity 1). */
export function splitTrust(p: HTMLElement): { segs: HTMLElement[]; revert: () => void } {
  const original = p.innerHTML;
  const parts = (p.textContent ?? "").split(" · ");
  p.innerHTML = "";
  const segs: HTMLElement[] = [];
  parts.forEach((t, i) => {
    if (i > 0) p.appendChild(document.createTextNode(" · "));
    const s = document.createElement("span");
    s.className = "hf-trustseg";
    s.textContent = t;
    p.appendChild(s);
    segs.push(s);
  });
  return {
    segs,
    revert: () => {
      try {
        p.innerHTML = original;
      } catch {
        /* noop */
      }
    },
  };
}

/** Wrap the "→" arrow char of the primary CTA in an animatable span. */
export function wrapArrow(btn: HTMLElement): () => void {
  const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
  let target: Text | null = null;
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    if (t.nodeValue && t.nodeValue.includes("→")) {
      target = t;
      break;
    }
  }
  if (!target || !target.parentNode) return () => {};
  const parent = target.parentNode as HTMLElement;
  const original = parent.innerHTML;
  const idx = (target.nodeValue ?? "").indexOf("→");
  const before = document.createTextNode((target.nodeValue ?? "").slice(0, idx));
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.className = "hf-arrow";
  arrow.textContent = "→";
  const after = document.createTextNode((target.nodeValue ?? "").slice(idx + 1));
  parent.replaceChild(after, target);
  parent.insertBefore(arrow, after);
  parent.insertBefore(before, arrow);
  return () => {
    try {
      parent.innerHTML = original;
    } catch {
      /* noop */
    }
  };
}

function wavyPath(w: number, h: number, amp: number): string {
  const seg = w / 4;
  const y0 = h * 0.55;
  return `M0 ${y0} q ${seg / 2} ${-amp} ${seg} 0 t ${seg} 0 t ${seg} 0 t ${seg} 0`;
}

function drawOverlay(
  host: HTMLElement,
  color: string,
  dy: number,
  key: string
): { path: SVGPathElement; remove: () => void } | null {
  try {
    const r = host.getBoundingClientRect();
    if (r.width < 6) return null;
    const ns = "http://www.w3.org/2000/svg";
    const hgt = Math.max(8, r.height * 0.22);
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("data-hf", key);
    svg.style.cssText = `position:absolute;left:0;right:0;bottom:${dy}px;height:${hgt}px;width:100%;overflow:visible;pointer-events:none;`;
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", wavyPath(r.width, hgt, 4.5));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    svg.appendChild(path);
    const cs = window.getComputedStyle(host);
    if (cs.position === "static") host.style.position = "relative";
    host.appendChild(svg);
    return {
      path,
      remove: () => {
        try {
          svg.remove();
          if (host.style.position === "relative") host.style.position = "";
        } catch {
          /* noop */
        }
      },
    };
  } catch {
    return null;
  }
}

/** Hand-drawn swash under the accent line. Measures at call time. */
export function addSwash(accent: HTMLElement, color = "#E8771A") {
  return drawOverlay(accent, color, -4, "swash");
}

/** Green wavy underline + speech-tail doodle for "on WhatsApp.". */
export function addWaUnderline(line: HTMLElement, color = "#25D366") {
  const ov = drawOverlay(line, color, -2, "wa-line");
  if (!ov) return null;
  let tail: SVGSVGElement | null = null;
  try {
    const ns = "http://www.w3.org/2000/svg";
    tail = document.createElementNS(ns, "svg");
    tail.setAttribute("aria-hidden", "true");
    tail.setAttribute("data-hf", "wa-tail");
    tail.setAttribute("viewBox", "0 0 24 24");
    tail.style.cssText =
      "position:absolute;right:-6px;bottom:-12px;width:26px;height:26px;overflow:visible;pointer-events:none;";
    const p = document.createElementNS(ns, "path");
    p.setAttribute("d", "M4 4 Q12 2 18 8 Q20 14 12 18 L8 22 L10 16 Q4 12 4 4 Z");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", color);
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    tail.appendChild(p);
    line.appendChild(tail);
  } catch {
    tail = null;
  }
  return {
    ...ov,
    remove: () => {
      ov.remove();
      try {
        tail?.remove();
      } catch {
        /* noop */
      }
    },
  };
}

/** Marker-highlighter bars behind matched sub-headline words. */
export function addHighlights(sub: HTMLElement, words: string[]): () => void {
  const bars: HTMLElement[] = [];
  try {
    const inners = Array.from(sub.querySelectorAll<HTMLElement>(".hf-wword"));
    inners.forEach((w) => {
      const t = (w.textContent ?? "").replace(/[.,—]/g, "").toLowerCase();
      if (!words.includes(t)) return;
      w.style.position = "relative";
      const bar = document.createElement("span");
      bar.setAttribute("aria-hidden", "true");
      bar.className = "hf-hl";
      w.appendChild(bar);
      bars.push(bar);
    });
  } catch {
    /* noop */
  }
  return () => {
    bars.forEach((b) => {
      try {
        b.remove();
      } catch {
        /* noop */
      }
    });
  };
}
