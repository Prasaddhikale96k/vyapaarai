import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#E8771A",
          light: "#FFF3E0",
          dark: "#B85A00",
        },
        success: {
          DEFAULT: "#059669",
          light: "#D9F2E7",
          dark: "#0D7A55",
        },
        saffron: {
          DEFAULT: "#E8771A",
          light: "#FFF3E0",
          dark: "#B85A00",
        },
        gold: {
          DEFAULT: "#D4A017",
          light: "#FFF8E1",
        },
        ivory: "#FDFAF4",
        ink: {
          DEFAULT: "#1A1209",
          muted: "#4A3728",
          subtle: "#8B7355",
        },
        navy: {
          DEFAULT: "#0F2040",
          muted: "#162840",
        },
        ledger: "#2D6A4F",
      },
      fontFamily: {
        display: ["Playfair Display", "Georgia", "serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Courier New", "monospace"],
        devanagari: ["Tiro Devanagari Sanskrit", "Noto Serif Devanagari", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
