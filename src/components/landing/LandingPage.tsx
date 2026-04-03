import {
  LandingNav,
  Hero,
  HeroVideoShowcase,
  SocialProof,
  Features,
  HowItWorks,
  UseCases,
  PricingCTA,
  FinalCTA,
  LandingFooter,
} from '@/components/landing';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <Hero />
      <HeroVideoShowcase />
      <SocialProof />
      <Features />
      <HowItWorks />
      <UseCases />
      <PricingCTA />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
