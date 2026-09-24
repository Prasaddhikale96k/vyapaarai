import LandingShell from "@/components/landing/LandingShell";
import Hero from "@/components/landing/Hero";
import SocialProofBar from "@/components/landing/SocialProofBar";
import ProblemSection from "@/components/landing/ProblemSection";
import WhatsAppLoop from "@/components/landing/WhatsAppLoop";
import HowItWorks from "@/components/landing/HowItWorks";
import DemoNumbers from "@/components/landing/DemoNumbers";
import FeaturesBento from "@/components/landing/FeaturesBento";
import VoiceLanguageSection from "@/components/landing/VoiceLanguageSection";
import FestivalSection from "@/components/landing/FestivalSection";
import SoulSection from "@/components/landing/SoulSection";

/**
 * VyapaarAI landing — saffron/ivory/navy edition.
 * Sections land phase by phase; stubs below are VISIBLE placeholders
 * (anti-blank: real text, real ids) replaced with real components.
 */

const STUBS: { id: string; label: string }[] = [
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
        <WhatsAppLoop />
        <HowItWorks />
        <DemoNumbers />
        <FeaturesBento />
        <VoiceLanguageSection />
        <FestivalSection />
        <SoulSection />
        <footer className="mx-auto max-w-7xl px-4 py-16">
          <p className="text-sm" style={{ color: "#8B7355" }}>
            © 2025 VyapaarAI. Built for India&apos;s kiranas.
          </p>
        </footer>
      </main>
    </LandingShell>
  );
}
