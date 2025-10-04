import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { LandingNavbar } from '@/components/landing/navbar'
import { LandingHero } from '@/components/landing/hero'
import { FeatureHighlights } from '@/components/landing/feature-highlights'
import { HowItWorks } from '@/components/landing/how-it-works'
import { PricingPreview } from '@/components/landing/pricing-preview'
import { Testimonials } from '@/components/landing/testimonials'
import { FAQSection } from '@/components/landing/faq-section'
import { FinalCTA } from '@/components/landing/final-cta'

export default async function HomePage() {
  // Check if user is authenticated
  const session = await getSession()

  // If user is logged in, redirect to dashboard
  if (session) {
    redirect('/dashboard')
  }

  // Show landing page for non-authenticated users
  return (
    <div className="flex flex-col">
      <div className="relative isolate overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <LandingNavbar />
        <LandingHero />
      </div>
      <main className="flex flex-col gap-0">
        <FeatureHighlights />
        <HowItWorks />
        <PricingPreview />
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white">
          <Testimonials />
        </div>
        <FAQSection />
        <FinalCTA />
      </main>
    </div>
  )
}
