"use client";

/** Key SVG coordinates (absolute in 500×380 viewBox) for GSAP svgOrigin/transformOrigin. */
export const COORDS = {
  // Canvas
  W: 500,
  H: 380,

  // Lamp
  lamp: {
    cordTop: { x: 250, y: 0 },
    cordBottom: { x: 250, y: 34 },
    bulbCenter: { x: 250, y: 48 },
    bulbRadius: 14,
    filamentRadius: 5,
    hook: { x: 250, y: 0 },
  },

  // Sign (Sharma Kirana) — hangs from two ropes at top corners
  sign: {
    rect: { x: 160, y: 74, w: 180, h: 36, rx: 6 },
    text: { x: 250, y: 98 },
    leftHook: { x: 160, y: 74 },
    rightHook: { x: 340, y: 74 },
    restRotation: -3, // degrees, slight tilt at rest
    dropStartY: -44,
    dropStartRot: 16,
    svgOrigin: { x: 160, y: 74 }, // left hook
  },

  // Ceiling beam (thin rail at top)
  beam: {
    y: 12,
    leftHook: { x: 160, y: 12 },
    rightHook: { x: 340, y: 12 },
  },

  // Shelves (3 rows)
  shelves: {
    rows: 3,
    plankY: [128, 162, 196],
    plank: { x: 70, w: 150, h: 6 },
    jarsPerRow: 4,
    jarCentersX: [88, 124, 160, 196],
    jarTopY: [118, 152, 186], // circle centers (circles); rects use y-12
    jarRadius: 9,
    jarRect: { w: 16, h: 22, rx: 3 },
    lidOffset: 14, // distance from top of jar to lid line
  },

  // Shopkeeper
  keeper: {
    head: { cx: 392, cy: 150, r: 20 },
    neck: { x: 378, y: 170, w: 28, h: 8 },
    body: { x: 368, y: 178, w: 48, h: 54, rx: 10 }, // kurta
    leftShoulder: { x: 368, y: 182 },
    rightShoulder: { x: 416, y: 182 },
    leftArm: { upper: { x: 356, y: 182, w: 16, h: 28 }, forearm: { w: 12, h: 22 }, hand: { r: 8 } },
    rightArm: { upper: { x: 416, y: 182, w: 16, h: 28 }, forearm: { w: 12, h: 22 }, hand: { r: 8 } },
    eyeL: { cx: 385, cy: 148, r: 2.4, pupilR: 1.2 },
    eyeR: { cx: 399, cy: 148, r: 2.4, pupilR: 1.2 },
    browL: { x: 381, y: 140, w: 8 },
    browR: { x: 393, y: 140, w: 8 },
    mouth: { path: "M386 158 Q392 162 398 158" },
    smilePath: "M382 158 Q392 165 402 158", // wider smile for thumbs-up
  },

  // Counter
  counter: {
    rect: { x: 40, y: 232, w: 420, h: 110, rx: 10 },
    topPlank: { x: 40, y: 232, w: 420, h: 14, rx: 7 },
    shadow: { cx: 250, cy: 352, rx: 190, ry: 16 },
  },

  // Ledger (bahi-khata)
  ledger: {
    cover: { x: 80, y: 252, w: 150, h: 66, rx: 4 },
    pageL: { x: 86, y: 256, w: 66, h: 58, rx: 2 },
    pageR: { x: 152, y: 256, w: 66, h: 58, rx: 2 },
    ruledLines: { startX: 91, endX: 147, baseY: 266, count: 4, spacing: 11 },
    entries: [
      { text: "320", x: 158, y: 272, color: "#4A3728" },
      { text: "1,200", x: 158, y: 283, color: "#4A3728" },
      { text: "paid", x: 158, y: 294, color: "#2D6A4F" },
      { text: "", x: 158, y: 305, color: "#E8771A" }, // row 3 (0-indexed): reserved for 2,340
    ],
    corner: { x: 212, y: 256, r: 8 }, // page corner curl anchor
  },

  // Phone
  phone: {
    body: { x: 258, y: 246, w: 70, h: 88, rx: 10 },
    screen: { x: 262, y: 250, w: 62, h: 80, rx: 7 },
    header: { x: 262, y: 250, w: 62, h: 16, rx: 7 },
    statusDot: { cx: 270, cy: 258, r: 4 },
    typingDots: { baseY: 306, cx: [270, 277, 284], r: 2.4 },
    bubble: { x: 266, y: 272, w: 54, h: 26, rx: 6 },
    bubbleText1: { x: 271, y: 282, text: "Bill read!" },
    bubbleText2: { x: 271, y: 291, text: "+ Rs.2,340" },
  },

  // Extras (mounted-only, initially hidden via gsap.set)
  extras: {
    paper: { x: 300, y: 260, w: 48, h: 60, rx: 3 },
    flash: { cx: 293, cy: 290, r: 30 },
    coins: 5,
    coinRadius: 6,
    coinTargets: { x: 185, y: 298 }, // 4th ledger row area
    lowTag: { x: 160, y: 140, w: 70, h: 20 },
    flagBadge: { x: 100, y: 110, w: 90, h: 24 },
    healthChip: { x: 330, y: 260, w: 80, h: 30, r: 15 },
    scanBeam: { x: 70, w: 150, y: 128, h: 70 },
    ghostPen: { x: 158, y: 298 },
  },
} as const;

/** Colour tokens (single source of truth). */
export const COLORS = {
  saffron: "#E8771A",
  gold: "#D4A017",
  navy: "#0F2040",
  ink: "#1A1209",
  wood: "#8B6914",
  woodLight: "#A67C2A",
  woodDark: "#6E5210",
  ledgerRed: "#C0392B",
  paper: "#FFF8E7",
  paperAlt: "#FFF9F0",
  ivory: "#FDFAF4",
  waGreen: "#25D366",
  waTeal: "#128C7E",
  ledgerGreen: "#2D6A4F",
  cream: "#E8DDD0",
  skin: "#4A3728",
  skinLight: "#B85A00",
  textDark: "#4A3728",
  textMuted: "#8B7355",
  shadow: "rgba(26,18,9,0.25)",
  lightCone: "rgba(212,160,23,0.18)",
  glow: "rgba(212,160,23,0.35)",
  sparkle: "#FFF8E7",
} as const;

/** Easing registry (CustomEase strings for GSAP 3.13+). */
export const EASES = {
  kOut: "0.16,1,0.3,1",
  kSettle: "0.34,1.4,0.64,1",
  kSnap: "0.7,0,0.2,1",
} as const;

/** Timing constants (ms → seconds for GSAP). */
export const TIMING = {
  intro: 2.8,
  introStartDelay: 0.35, // after Hero intro
  storyDuration: 11.5,
  storyRepeatDelay: 1.2,
} as const;