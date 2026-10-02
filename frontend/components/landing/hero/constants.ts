"use client";

/**
 * HERO FILM constants — seed arrays, object table, verbatim copy.
 * No Math.random in render: every "random" order is a FIXED array.
 * All demo facts verbatim from the master prompt (§2); never invent others.
 */

export const WAVE_SEED = [9, 16, 7, 20, 12, 18, 6, 22, 11, 17, 8, 14];

/** 5x5 UPI grid fill order (fixed shuffle of 0..24). */
export const UPI_ORDER = [7, 18, 2, 23, 11, 0, 15, 5, 21, 9, 13, 24, 3, 17, 8, 20, 1, 12, 22, 6, 16, 10, 19, 4, 14];

/** Growth-line values (health 44 → 88), mapped to x evenly in the layer. */
export const GROWTH_VALUES = [44, 46, 48, 47, 51, 55, 58, 63, 68, 72, 80, 88];

export const CHAT_OWNER_SCRIPT = [
  "Ramesh ko kitna dena hai?",
  "aaj 20kg aata becha 1200 mein",
  "Photo · Bill",
];

/** Devanagari product-mock lines — ATOMIC: never split, mask/line reveal only. */
export const CHAT_AI_SCRIPT = [
  "बिल पढ़ लिया ✓ ₹2,340",
  "Ramesh Gupta का उधार: ₹4,300",
  "क्या reminder भेजूं?",
];

export const TOAST_SCRIPT = [
  "Bill read · ₹2,340 recorded",
  "Voice note · entry added",
  "Reminder drafted · awaiting your OK",
  "Low stock · 18 SKUs flagged",
  "Health score · 44 → 88",
];

export type Band = "far" | "mid" | "near";

export interface ObjSpec {
  id: string;
  band: Band;
  left: number;
  top: number;
  w: string;
  rot: number;
  /** responsive visibility: "lg" hides below 1280px, "sm" = mobile-kept,
   *  "lg-sm" = hidden 640–1280, shown otherwise */
  vis?: "lg" | "sm" | "lg-sm";
}

/** Poster composition table (§9). left/top = % of stage box. */
export const OBJECTS: ObjSpec[] = [
  { id: "bill", band: "mid", left: 5, top: 30, w: "clamp(64px,6vw,120px)", rot: -8, vis: "sm" },
  { id: "chat-owner", band: "near", left: 3, top: 52, w: "clamp(120px,11vw,210px)", rot: 2, vis: "sm" },
  { id: "chat-ai", band: "mid", left: 86, top: 46, w: "clamp(130px,12vw,230px)", rot: -2 },
  { id: "health", band: "near", left: 91, top: 24, w: "clamp(64px,6vw,118px)", rot: 0, vis: "sm" },
  { id: "hub", band: "mid", left: 92, top: 40, w: "clamp(44px,4vw,80px)", rot: 0 },
  { id: "mic", band: "mid", left: 94, top: 62, w: "clamp(56px,5vw,100px)", rot: 0 },
  { id: "jar", band: "far", left: 11, top: 70, w: "clamp(52px,5vw,96px)", rot: 4 },
  { id: "diya", band: "far", left: 87, top: 74, w: "clamp(48px,4.5vw,90px)", rot: 0 },
  { id: "coin-big", band: "near", left: 96, top: 11, w: "clamp(40px,3.6vw,70px)", rot: 0, vis: "sm" },
  { id: "coin-mid", band: "mid", left: 13, top: 14, w: "clamp(30px,2.6vw,52px)", rot: 0, vis: "sm" },
  { id: "coin-small", band: "far", left: 80, top: 90, w: "clamp(22px,2vw,40px)", rot: 0, vis: "lg-sm" },
  { id: "stamp", band: "near", left: 14, top: 86, w: "clamp(88px,8vw,150px)", rot: -12 },
  { id: "upi", band: "far", left: 7, top: 90, w: "clamp(52px,5vw,96px)", rot: 0, vis: "lg" },
];

/** Growth path geometry: viewBox 1600x360, value 44→y300, 88→y70. */
export function growthPath(offsetY = 0): string {
  const n = GROWTH_VALUES.length;
  return GROWTH_VALUES.map((v, i) => {
    const x = 40 + (i * 1520) / (n - 1);
    const y = 300 - ((v - 44) / 44) * 230 + offsetY;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export const GROWTH_HEAD = { x: 1560, y: 70 };
