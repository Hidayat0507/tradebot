import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Trading Bot",
  description:
    "Learn how the Trading Bot platform collects, uses, and protects your personal information in accordance with our privacy practices.",
}

const LAST_UPDATED = "May 15, 2024"

const sections = [
  {
    title: "1. Introduction",
    content:
      "This Privacy Policy explains how Trading Bot collects, uses, and protects the personal information of users who access our platform and services.",
  },
  {
    title: "2. Information We Collect",
    content:
      "We may collect personal details such as your name, email address, billing information, and trading account identifiers, along with usage data generated through your interactions with the platform.",
  },
  {
    title: "3. How We Use Information",
    content:
      "Collected information is used to provide and improve the platform, personalize your experience, process payments, and communicate important updates or security notifications.",
  },
  {
    title: "4. Data Sharing",
    content:
      "We do not sell your personal data. We may share information with trusted service providers or regulatory authorities when required to deliver the service or comply with legal obligations.",
  },
  {
    title: "5. Data Security",
    content:
      "We implement administrative, technical, and physical safeguards to protect your information. However, no security system is infallible, and you acknowledge the inherent risks of transmitting data online.",
  },
  {
    title: "6. Data Retention",
    content:
      "Your personal information is retained only for as long as necessary to fulfill the purposes outlined in this policy or as required by law. Afterward, data is securely deleted or anonymized.",
  },
  {
    title: "7. Your Rights",
    content:
      "Depending on your jurisdiction, you may have rights to access, update, or delete your personal information, as well as object to or restrict certain processing activities.",
  },
  {
    title: "8. International Transfers",
    content:
      "If we transfer personal information across borders, we take steps to ensure appropriate safeguards are in place consistent with applicable data protection laws.",
  },
  {
    title: "9. Children's Privacy",
    content:
      "The platform is not intended for individuals under 18 years of age. We do not knowingly collect personal information from children.",
  },
  {
    title: "10. Updates to This Policy",
    content:
      "We may update this Privacy Policy periodically. When changes are made, we will revise the \"Last updated\" date and, where appropriate, notify users through the platform or by email.",
  },
  {
    title: "11. Contact Us",
    content:
      "If you have questions or requests regarding this Privacy Policy, please reach out to our support team using the contact information provided in the platform.",
  },
]

export default function PrivacyPage() {
  return (
    <div className="container relative z-10 py-16">
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-4 text-center md:text-left">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Your privacy matters. This policy outlines the type of information we collect, how we use it, and the choices you have to manage your personal data on the Trading Bot platform.
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
            For more details about our data handling practices or to exercise your privacy rights, please contact us.
          </p>
          <p>
            We encourage you to review this policy regularly to stay informed about how we protect your information.
          </p>
        </footer>
      </div>
    </div>
  )
}
