import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms & Conditions | Trading Bot",
  description:
    "Review the terms and conditions governing the use of the Trading Bot platform, including user responsibilities and limitations of liability.",
}

const LAST_UPDATED = "May 15, 2024"

const sections = [
  {
    title: "1. Acceptance of Terms",
    content:
      "By accessing or using the Trading Bot platform, you agree to be bound by these Terms & Conditions. If you do not agree with any part of the terms, you must not access the platform.",
  },
  {
    title: "2. Eligibility",
    content:
      "You must be at least 18 years old and capable of entering into legally binding agreements to use the services provided by the platform.",
  },
  {
    title: "3. Account Responsibilities",
    content:
      "You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Notify us immediately of any unauthorized use or security breach.",
  },
  {
    title: "4. Acceptable Use",
    content:
      "You agree not to misuse the platform, including attempting to gain unauthorized access, interfering with service availability, or using the platform for unlawful purposes.",
  },
  {
    title: "5. Trading Risks",
    content:
      "Automated trading involves significant risk. Performance is not guaranteed, and you acknowledge that you are solely responsible for the results of trades executed through the platform.",
  },
  {
    title: "6. Fees and Payments",
    content:
      "Any applicable subscription fees or transaction costs will be disclosed prior to purchase. Fees are non-refundable unless required by law or specified otherwise.",
  },
  {
    title: "7. Third-Party Services",
    content:
      "The platform integrates with third-party exchanges and services. We are not responsible for the performance or availability of those providers.",
  },
  {
    title: "8. Intellectual Property",
    content:
      "All platform content, trademarks, and technology are owned by Trading Bot or its licensors. You may not copy, modify, or distribute any part of the platform without prior written consent.",
  },
  {
    title: "9. Limitation of Liability",
    content:
      "To the maximum extent permitted by law, Trading Bot is not liable for any indirect, incidental, or consequential damages arising from your use of the platform.",
  },
  {
    title: "10. Changes to These Terms",
    content:
      "We may update these Terms & Conditions from time to time. Continued use of the platform after changes become effective constitutes acceptance of the revised terms.",
  },
]

export default function TermsPage() {
  return (
    <div className="container relative z-10 py-16">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-4 text-center md:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Terms &amp; Conditions</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Please read these Terms &amp; Conditions carefully before using the Trading Bot platform. They outline your responsibilities and the limitations that apply when accessing our services.
          </p>
        </header>

        <div className="space-y-8 rounded-xl border border-border bg-background/80 p-8 shadow-sm backdrop-blur">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{section.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                {section.content}
              </p>
            </section>
          ))}
        </div>

        <footer className="space-y-3 rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
          <p>
            If you have any questions about these Terms &amp; Conditions, please contact our support team before continuing to use the platform.
          </p>
          <p>
            Your continued use of Trading Bot indicates your acceptance of these terms.
          </p>
        </footer>
      </div>
    </div>
  )
}
