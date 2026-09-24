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
import HITLSection from "@/components/landing/HITLSection";
import Testimonials from "@/components/landing/Testimonials";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

/**
 * VyapaarAI landing — saffron/ivory/navy edition.
 * Sections land phase by phase; stubs below are VISIBLE placeholders
 * (anti-blank: real text, real ids) replaced with real components.
 */

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
        <HITLSection />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </LandingShell>
  );
}
