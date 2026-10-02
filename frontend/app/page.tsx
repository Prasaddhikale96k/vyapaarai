import LandingShell from "@/components/landing/LandingShell";
import MotionScope from "@/components/landing/motion/MotionScope";
import {
  buildBento,
  buildCta,
  buildDemoNumbers,
  buildFestival,
  buildFooter,
  buildHero,
  buildHitl,
  buildHowItWorks,
  buildMarquee,
  buildProblem,
  buildSoul,
  buildTestimonials,
  buildVoice,
  buildWhatsapp,
} from "@/components/landing/motion/sections";
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
        <MotionScope id="hero" build={buildHero}><Hero /></MotionScope>
        <MotionScope id="marquee" build={buildMarquee}><SocialProofBar /></MotionScope>
        <MotionScope id="problem" build={buildProblem}><ProblemSection /></MotionScope>
        <MotionScope id="whatsapp" build={buildWhatsapp}><WhatsAppLoop /></MotionScope>
        <MotionScope id="how-it-works" build={buildHowItWorks}><HowItWorks /></MotionScope>
        <MotionScope id="demo-numbers" build={buildDemoNumbers}><DemoNumbers /></MotionScope>
        <MotionScope id="bento" build={buildBento}><FeaturesBento /></MotionScope>
        <MotionScope id="voice" build={buildVoice}><VoiceLanguageSection /></MotionScope>
        <MotionScope id="festival" build={buildFestival}><FestivalSection /></MotionScope>
        <MotionScope id="soul" build={buildSoul}><SoulSection /></MotionScope>
        <MotionScope id="hitl" build={buildHitl}><HITLSection /></MotionScope>
        <MotionScope id="testimonials" build={buildTestimonials}><Testimonials /></MotionScope>
        <MotionScope id="cta" build={buildCta}><CTASection /></MotionScope>
      </main>
      <MotionScope id="footer" build={buildFooter}><Footer /></MotionScope>
    </LandingShell>
  );
}
