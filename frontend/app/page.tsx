import LandingShell from "@/components/landing/LandingShell";
import Hero from "@/components/landing/Hero";
import SocialProofBar from "@/components/landing/SocialProofBar";
import ProblemSection from "@/components/landing/ProblemSection";

/**
 * VyapaarAI landing — saffron/ivory/navy edition.
 * Sections land phase by phase; stubs below are VISIBLE placeholders
 * (anti-blank: real text, real ids) replaced with real components.
 */

const STUBS: { id: string; label: string }[] = [
  { id: "whatsapp-loop", label: "One WhatsApp. Your Entire Business." },
  { id: "how-it-works", label: "From Bahi-Khata to Business Intelligence" },
  { id: "demo", label: "Real Numbers. Real Business." },
  { id: "features", label: "Everything a Kirana Needs. Nothing It Doesn't." },
  { id: "voice", label: "Speak. It Listens. It Understands." },
  { id: "festival", label: "Diwali Is Coming. Are Your Shelves Ready?" },
  { id: "soul", label: "व्यापार" },
  { id: "hitl", label: "The AI Suggests. You Decide. Always." },
  { id: "testimonials", label: "From the Ledger to the Future." },
  { id: "cta", label: "Ready to Know Your Business?" },
];

export default function HomePage() {
  return (
    <LandingShell>
      <main style={{ background: "#FDFAF4", color: "#1A1209" }}>
        <Hero />
        <SocialProofBar />
        <ProblemSection />
        <footer className="mx-auto max-w-7xl px-4 py-16">
          <p className="text-sm" style={{ color: "#8B7355" }}>
            © 2025 VyapaarAI. Built for India&apos;s kiranas.
          </p>
        </footer>
      </main>
    </LandingShell>
  );
}
